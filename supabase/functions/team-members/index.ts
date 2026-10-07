import { createAdminClient, requireOrganizationPermission, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';
import { defaultPermissionsForRole, organizationPermissions } from '../_shared/permissions.ts';
import { maskDailyReportPhone, normalizeDailyReportPhone, validDailyReportTime } from '../_shared/dailyLeadReport.ts';

const roles = new Set(['administrador', 'vendedor', 'sdr', 'cx']);
type Action = 'create' | 'invite' | 'update_member' | 'reset_password' | 'update_role' | 'set_status' | 'remove' | 'permissions_get' | 'permissions_set' | 'daily_report_get' | 'daily_report_set' | 'handoff_alert_get' | 'handoff_alert_set' | 'invites_get' | 'invite_cancel' | 'invite_resend' | 'policy_get' | 'policy_set' | 'activate_invite' | 'pending_invites';

function text(value: unknown, max = 180): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function memberRole(value: unknown): string {
  const role = text(value, 40).toLowerCase();
  if (!roles.has(role)) throw new Error('invalid_member_role');
  return role;
}

function memberEmail(value: unknown): string {
  const email = text(value, 254).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('invalid_member_email');
  return email;
}

function memberPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) {
    throw new Error('invalid_member_password');
  }
  return value;
}

function reportTimeZone(value: unknown): string {
  const candidate = text(value, 80) || 'America/Sao_Paulo';
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: candidate }).format();
    return candidate;
  } catch {
    throw new Error('invalid_daily_report_timezone');
  }
}

const defaultSecurityPolicy = {
  requireMfa: false,
  revokeSessionsOnDisable: true,
  quarterlyReview: true,
  availableRoles: { administrador: true, vendedor: true, sdr: true, cx: true },
};

function securityPolicy(value: unknown) {
  const candidate = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const availableRoles = candidate.availableRoles && typeof candidate.availableRoles === 'object' && !Array.isArray(candidate.availableRoles)
    ? candidate.availableRoles as Record<string, unknown>
    : {};
  return {
    requireMfa: candidate.requireMfa === true,
    revokeSessionsOnDisable: candidate.revokeSessionsOnDisable !== false,
    quarterlyReview: candidate.quarterlyReview !== false,
    availableRoles: Object.fromEntries(['administrador', 'vendedor', 'sdr', 'cx'].map((role) => [role, availableRoles[role] !== false])),
  };
}

async function loadSecurityPolicy(admin: ReturnType<typeof createAdminClient>, organizationId: string) {
  const { data, error } = await admin.from('organization_module_data')
    .select('data').eq('organization_id', organizationId).eq('module_key', 'access_security_policy').maybeSingle();
  if (error) throw error;
  return { ...defaultSecurityPolicy, ...securityPolicy(data?.data) };
}

async function dailyReportSettings(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  userId: string,
) {
  const [preferenceRead, deliveryRead] = await Promise.all([
    admin.from('notification_preferences')
      .select('daily_lead_report_enabled,daily_lead_report_phone,daily_lead_report_time,timezone,daily_lead_report_last_status,daily_lead_report_last_sent_at,daily_lead_report_last_error')
      .eq('organization_id', organizationId).eq('user_id', userId).maybeSingle(),
    admin.from('daily_lead_report_deliveries')
      .select('status,sent_at,error,created_at').eq('organization_id', organizationId).eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (preferenceRead.error || deliveryRead.error) throw new Error('daily_report_settings_read_failed');
  const preference = preferenceRead.data;
  const delivery = deliveryRead.data;
  return {
    enabled: preference?.daily_lead_report_enabled === true,
    phoneSuffix: maskDailyReportPhone(preference?.daily_lead_report_phone) || null,
    scheduleTime: validDailyReportTime(preference?.daily_lead_report_time) || '18:00',
    timezone: reportTimeZone(preference?.timezone),
    lastStatus: delivery?.status ?? preference?.daily_lead_report_last_status ?? null,
    lastSentAt: delivery?.sent_at ?? preference?.daily_lead_report_last_sent_at ?? null,
    lastError: delivery?.error ?? preference?.daily_lead_report_last_error ?? null,
  };
}

async function handoffAlertSettings(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  userId: string,
) {
  const { data, error } = await admin.from('notification_preferences')
    .select('handoff_whatsapp_enabled,handoff_whatsapp_phone')
    .eq('organization_id', organizationId).eq('user_id', userId).maybeSingle();
  if (error) throw new Error('handoff_alert_settings_read_failed');
  return {
    enabled: data?.handoff_whatsapp_enabled === true,
    phoneSuffix: maskDailyReportPhone(data?.handoff_whatsapp_phone) || null,
  };
}

function isExistingAuthUser(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === 'email_exists'
    || candidate.code === 'user_already_exists'
    || (typeof candidate.message === 'string' && /already (been )?registered|already exists/i.test(candidate.message));
}

type SellerProvisioning = {
  jobId: string;
  state: string;
};

const sellerProvisioningStates = new Set([
  'queued', 'processing', 'awaiting_qr', 'completed', 'failed', 'needs_review', 'cancelled',
]);

/**
 * The membership transaction owns creation of the local seller account and
 * durable queue entry. This function deliberately only reads that job: an Edge
 * retry must never recreate an account after the membership is active.
 */
async function sellerProvisioningForMember(
  admin: ReturnType<typeof createAdminClient>,
  input: { organizationId: string; userId: string },
): Promise<SellerProvisioning | null> {
  const { data, error } = await admin.from('evolution_go_seller_provisioning_jobs')
    .select('id,state')
    .eq('organization_id', input.organizationId)
    .eq('user_id', input.userId)
    .maybeSingle();
  if (error) throw new Error('evolution_go_provisioning_lookup_failed');
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const candidate = data as Record<string, unknown>;
  const jobId = text(candidate.id, 80);
  const state = text(candidate.state, 40);
  if (!jobId || !sellerProvisioningStates.has(state)) {
    throw new Error('evolution_go_provisioning_lookup_failed');
  }
  return { jobId, state };
}

function wakeSellerProvisioningWorker(jobId: string): void {
  const baseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!baseUrl || !serviceRole) return;
  // The job is durable; this is only a low-latency wake-up. If the task cannot
  // run, the scheduler will process it later rather than silently dropping it.
  const pending = fetch(`${baseUrl}/functions/v1/evolution-go-worker`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ provisioning_job_id: jobId }),
    signal: AbortSignal.timeout(45_000),
  }).catch(() => undefined);
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil: (task: Promise<unknown>) => void } }).EdgeRuntime;
  runtime?.waitUntil(pending);
}

async function wakeSellerProvisioningForMember(
  admin: ReturnType<typeof createAdminClient>,
  input: { organizationId: string; userId: string },
) {
  try {
    const provisioning = await sellerProvisioningForMember(admin, input);
    if (!provisioning) return { provisioningState: null, provisioningWarning: 'seller_provisioning_missing' };
    if (['queued', 'failed', 'processing'].includes(provisioning.state)) {
      wakeSellerProvisioningWorker(provisioning.jobId);
    }
    return { provisioningState: provisioning.state, provisioningWarning: null };
  } catch {
    return { provisioningState: null, provisioningWarning: 'seller_provisioning_pending_review' };
  }
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = text(body.action, 32) as Action;
    if (!['create', 'invite', 'update_member', 'reset_password', 'update_role', 'set_status', 'remove', 'permissions_get', 'permissions_set', 'daily_report_get', 'daily_report_set', 'handoff_alert_get', 'handoff_alert_set', 'invites_get', 'invite_cancel', 'invite_resend', 'policy_get', 'policy_set', 'activate_invite', 'pending_invites'].includes(action)) throw new Error('unsupported_action');
    const { user, client } = await requireUser(request);
    const admin = createAdminClient();

    // Keep older clients safe as well: removal is owned by the isolated
    // provider-reconciliation endpoint, never by the generic member RPC.
    if (action === 'remove') {
      const origin = request.headers.get('origin');
      const endpoint = new URL('/functions/v1/team-member-evolution-removal', Deno.env.get('SUPABASE_URL'));
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: request.headers.get('authorization') ?? '',
          apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          'Content-Type': 'application/json',
          ...(origin ? { Origin: origin } : {}),
        },
        body: JSON.stringify({ action: 'remove', user_id: body.user_id }),
        signal: AbortSignal.timeout(60_000),
      });
      const payload = await response.json().catch(() => ({ ok: false, erro: 'member_removal_unconfirmed' }));
      return json(payload, response.status, headers);
    }

    if (action === 'pending_invites') {
      const { data, error } = await client.rpc('team_pending_invites');
      if (error) throw error;
      return json({ ok: true, invites: data ?? [] }, 200, headers);
    }
    if (action === 'activate_invite') {
      const inviteId = text(body.invite_id, 64);
      if (!inviteId || !Number.isSafeInteger(body.revision) || Number(body.revision) < 1) throw new Error('invite_revision_required');
      const { data, error } = await client.rpc('team_invite_accept', { p_id: inviteId, p_revision: body.revision });
      if (error || !data?.organization_id) throw error ?? new Error('invite_acceptance_failed');
      let provisioningState: string | null = null;
      let provisioningWarning: string | null = null;
      if (data.role === 'vendedor') {
        ({ provisioningState, provisioningWarning } = await wakeSellerProvisioningForMember(admin, {
          organizationId: data.organization_id, userId: user.id,
        }));
      }
      return json({ ok: true, ...data, provisioning_state: provisioningState, provisioning_warning: provisioningWarning }, 200, headers);
    }
    if (action === 'update_member' || action === 'reset_password') {
      throw new Error('global_identity_self_service_required');
    }

    const { data: profile, error: profileError } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (profileError || !profile?.active_organization_id) throw new Error('organization_context_required');
    const organizationId = profile.active_organization_id;
    await requireOrganizationPermission(admin, organizationId, user.id, 'team.manage');

    if (action === 'create') {
      const name = text(body.name, 120);
      const email = memberEmail(body.email);
      const role = memberRole(body.role);
      const password = memberPassword(body.password);
      if (!name) throw new Error('invalid_member_name');

      // Refuse before creating an Auth identity if the coordinated database
      // contract, role policy or seller lifecycle trigger is unavailable.
      const { data: readiness, error: readinessError } = await admin.rpc('team_direct_create_preflight', {
        p_org: organizationId, p_actor: user.id, p_role: role,
      });
      if (readinessError || readiness?.ready !== true) {
        throw new Error('member_creation_backend_unavailable');
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { name, wayflex_invitation: true, wayflex_direct_create: true },
      });
      if (createError || !created.user) {
        if (isExistingAuthUser(createError)) throw new Error('member_email_already_registered');
        throw new Error('member_creation_failed');
      }

      const { data: attached, error: attachError } = await admin.rpc('team_direct_create_attach', {
        p_org: organizationId, p_actor: user.id, p_user: created.user.id,
        p_email: email, p_name: name, p_role: role,
      });
      // Never delete a new global identity as compensation after an ambiguous
      // database response: another tenant may have legitimately attached it.
      if (attachError || attached?.user_id !== created.user.id) {
        throw new Error('member_creation_pending_review');
      }

      const provisioning = role === 'vendedor'
        ? await wakeSellerProvisioningForMember(admin, { organizationId, userId: created.user.id })
        : { provisioningState: null, provisioningWarning: null };
      const provisioningNeedsReview = Boolean(provisioning.provisioningWarning)
        || ['needs_review', 'cancelled', 'failed'].includes(provisioning.provisioningState ?? '');
      return json({
        ok: true, user_id: created.user.id, role,
        provisioning_state: provisioning.provisioningState,
        provisioning_warning: provisioning.provisioningWarning,
        message: role === 'vendedor'
          ? provisioningNeedsReview
            ? 'Usuário criado. O vínculo Evolution GO precisa de revisão antes do QR Code.'
            : 'Usuário criado. A instância individual Evolution GO foi vinculada e será preparada pelo servidor.'
          : 'Usuário criado com o papel selecionado.',
      }, 201, headers);
    }

    if (action === 'policy_get') {
      return json({ ok: true, policy: await loadSecurityPolicy(admin, organizationId) }, 200, headers);
    }

    if (action === 'policy_set') {
      if (!body.policy || typeof body.policy !== 'object' || Array.isArray(body.policy)) throw new Error('security_policy_required');
      const policy = securityPolicy(body.policy);
      const now = new Date().toISOString();
      const { error } = await client.from('organization_module_data').upsert({
        organization_id: organizationId, module_key: 'access_security_policy', data: policy, updated_by: user.id, updated_at: now,
      }, { onConflict: 'organization_id,module_key' });
      if (error) throw error;
      await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'team.security_policy_changed', detail: text(body.reason, 180) || 'Política de segurança atualizada.', entity_table: 'organization_module_data', event_data: { module_key: 'access_security_policy', policy } });
      return json({ ok: true, policy }, 200, headers);
    }

    if (action === 'invites_get') {
      const { data, error } = await admin.from('organization_invites')
        .select('id,email,role,invited_by,expires_at,accepted_at,cancelled_at,created_at')
        .eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return json({ ok: true, invites: data ?? [] }, 200, headers);
    }

    if (action === 'invite_cancel') {
      const { error } = await client.rpc('team_invite_cancel', { p_id: text(body.invite_id, 64) });
      if (error) throw error;
      return json({ ok: true }, 200, headers);
    }
    if (action === 'invite' || action === 'invite_resend') {
      let email = body.email; let requestedRole = body.role;
      if (action === 'invite_resend') {
        const { data: invite, error } = await admin.from('organization_invites')
          .select('email,role,accepted_at,cancelled_at').eq('organization_id', organizationId)
          .eq('id', text(body.invite_id, 64)).maybeSingle();
        if (error || !invite) throw error ?? new Error('invite_not_found');
        if (invite.accepted_at || invite.cancelled_at) throw new Error('invite_not_current');
        email = invite.email; requestedRole = invite.role;
      }
      const { data: invitation, error: prepareError } = await client.rpc('team_invite_prepare', {
        p_org: organizationId, p_email: memberEmail(email), p_role: memberRole(requestedRole),
      });
      if (prepareError || !invitation?.id) throw prepareError ?? new Error('member_invitation_failed');
      const name = text(body.name, 120);
      const { error: deliveryError } = await admin.auth.admin.inviteUserByEmail(invitation.email, {
        // A marker may suppress standalone bootstrap, but NEVER grants tenant access.
        data: { ...(name ? { name } : {}), wayflex_invitation: true },
        redirectTo: `${Deno.env.get('ALLOWED_ORIGIN') ?? 'https://leadai-crm-preview.fabricio926564.chatgpt.site'}/login`,
      });
      // External email delivery is not transactional. Keep the canonical pending
      // invitation on failures; never delete an Auth identity as compensation.
      const delivery = !deliveryError ? 'sent' : isExistingAuthUser(deliveryError) ? 'existing_account' : 'failed';
      return json({ ok: true, invite_id: invitation.id, revision: invitation.revision, delivery,
        message: delivery === 'sent' ? 'Convite enviado. O titular deve confirmar o e-mail e aceitar o vínculo.'
          : delivery === 'existing_account' ? 'Convite registrado. O titular deve entrar na conta existente e aceitar em Convites pendentes.'
            : 'Convite registrado, mas o e-mail não foi enviado. Reenvie após verificar o serviço de e-mail.',
      }, 200, headers);
    }

    const targetUserId = text(body.user_id, 64);
    if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) throw new Error('member_required');
    const { data: current, error: currentError } = await admin.from('organization_members').select('role,status')
      .eq('organization_id', organizationId).eq('user_id', targetUserId).maybeSingle();
    if (currentError || !current) throw currentError ?? new Error('member_not_found');

    if (action === 'permissions_get') {
      const { data: rows, error } = await admin.from('team_member_permissions')
        .select('permission,allowed').eq('organization_id', organizationId).eq('user_id', targetUserId);
      if (error) throw error;
      const overrides = new Map((rows ?? []).map((row) => [row.permission, row.allowed === true]));
      const defaults = defaultPermissionsForRole(current.role);
      const permissions = Object.fromEntries(organizationPermissions.map((permission) => [permission, current.role === 'administrador' ? true : (overrides.get(permission) ?? defaults[permission])]));
      return json({ ok: true, role: current.role, permissions }, 200, headers);
    }

    if (action === 'permissions_set') {
      if (current.role === 'administrador') throw new Error('administrator_permissions_are_fixed');
      const requested = body.permissions;
      if (!requested || typeof requested !== 'object' || Array.isArray(requested)) throw new Error('permissions_required');
      const permissionMap = requested as Record<string, unknown>;
      const defaults = defaultPermissionsForRole(current.role);
      const values = organizationPermissions.map((permission) => {
        const allowed = permissionMap[permission] ?? defaults[permission];
        if (typeof allowed !== 'boolean') throw new Error('invalid_permission_value');
        return { organization_id: organizationId, user_id: targetUserId, permission, allowed, updated_at: new Date().toISOString() };
      });
      const { error } = await admin.from('team_member_permissions').upsert(values, { onConflict: 'organization_id,user_id,permission' });
      if (error) throw error;
      await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'team.member_permissions_changed', detail: 'Permissões individuais do membro atualizadas.', entity_table: 'organization_members', event_data: { user_id: targetUserId } });
      return json({ ok: true }, 200, headers);
    }

    if (action === 'daily_report_get') {
      return json({ ok: true, settings: await dailyReportSettings(admin, organizationId, targetUserId) }, 200, headers);
    }

    if (action === 'daily_report_set') {
      if (typeof body.enabled !== 'boolean') throw new Error('daily_report_enabled_required');
      const { data: existing, error: existingError } = await admin.from('notification_preferences')
        .select('daily_lead_report_phone,daily_lead_report_time,timezone')
        .eq('organization_id', organizationId).eq('user_id', targetUserId).maybeSingle();
      if (existingError) throw new Error('daily_report_settings_read_failed');
      const rawPhone = text(body.phone, 40);
      const suppliedPhone = rawPhone ? normalizeDailyReportPhone(rawPhone) : null;
      if (rawPhone && !suppliedPhone) throw new Error('invalid_daily_report_phone');
      const phone = suppliedPhone || normalizeDailyReportPhone(existing?.daily_lead_report_phone);
      if (body.enabled && !phone) throw new Error('daily_report_phone_required');
      const scheduleTime = validDailyReportTime(body.schedule_time)
        || validDailyReportTime(existing?.daily_lead_report_time)
        || '18:00';
      if (body.schedule_time !== undefined && !validDailyReportTime(body.schedule_time)) throw new Error('invalid_daily_report_time');
      const timezone = reportTimeZone(body.timezone ?? existing?.timezone);
      const { error: writeError } = await admin.from('notification_preferences').upsert({
        organization_id: organizationId,
        user_id: targetUserId,
        daily_lead_report_enabled: body.enabled,
        daily_lead_report_phone: phone,
        daily_lead_report_time: scheduleTime,
        timezone,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,user_id' });
      if (writeError) throw new Error('daily_report_settings_save_failed');
      await admin.from('audit_logs').insert({
        organization_id: organizationId,
        actor_id: user.id,
        actor_name: profile.name,
        actor_type: 'user',
        action: body.enabled ? 'notification.daily_report_enabled' : 'notification.daily_report_disabled',
        detail: body.enabled ? 'Resumo diário pelo WhatsApp habilitado para um usuário.' : 'Resumo diário pelo WhatsApp desabilitado para um usuário.',
        entity_table: 'notification_preferences',
        event_data: { user_id: targetUserId, schedule_time: scheduleTime, timezone, phone_suffix: phone?.slice(-4) ?? null },
      });
      return json({ ok: true, settings: await dailyReportSettings(admin, organizationId, targetUserId) }, 200, headers);
    }

    if (action === 'handoff_alert_get') {
      return json({ ok: true, settings: await handoffAlertSettings(admin, organizationId, targetUserId) }, 200, headers);
    }

    if (action === 'handoff_alert_set') {
      if (typeof body.enabled !== 'boolean') throw new Error('handoff_alert_enabled_required');
      const { data: existing, error: existingError } = await admin.from('notification_preferences')
        .select('handoff_whatsapp_phone').eq('organization_id', organizationId).eq('user_id', targetUserId).maybeSingle();
      if (existingError) throw new Error('handoff_alert_settings_read_failed');
      const rawPhone = text(body.phone, 40);
      const suppliedPhone = rawPhone ? normalizeDailyReportPhone(rawPhone) : null;
      if (rawPhone && !suppliedPhone) throw new Error('invalid_handoff_alert_phone');
      const phone = suppliedPhone || normalizeDailyReportPhone(existing?.handoff_whatsapp_phone);
      if (body.enabled && !phone) throw new Error('handoff_alert_phone_required');
      const { error: writeError } = await admin.from('notification_preferences').upsert({
        organization_id: organizationId,
        user_id: targetUserId,
        handoff_whatsapp_enabled: body.enabled,
        handoff_whatsapp_phone: phone,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,user_id' });
      if (writeError) throw new Error('handoff_alert_settings_save_failed');
      await admin.from('audit_logs').insert({
        organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user',
        action: body.enabled ? 'notification.handoff_alert_enabled' : 'notification.handoff_alert_disabled',
        detail: body.enabled ? 'Aviso de transferência por WhatsApp habilitado para um usuário.' : 'Aviso de transferência por WhatsApp desabilitado para um usuário.',
        entity_table: 'notification_preferences', event_data: { user_id: targetUserId, phone_suffix: phone?.slice(-4) ?? null },
      });
      return json({ ok: true, settings: await handoffAlertSettings(admin, organizationId, targetUserId) }, 200, headers);
    }

    if (action === 'set_status' && typeof body.enabled !== 'boolean') throw new Error('member_status_required');
    const requestedRole = action === 'update_role' ? memberRole(body.role) : null;
    const { data, error } = await client.rpc('team_member_change', {
      p_org: organizationId, p_user: targetUserId, p_action: action,
      p_role: requestedRole,
      p_enabled: action === 'set_status' ? body.enabled : null,
    });
    if (error) throw error;
    const sellerActivated = (action === 'update_role' && requestedRole === 'vendedor'
      && current.role !== 'vendedor' && current.status === 'active')
      || (action === 'set_status' && body.enabled === true && current.status !== 'active' && current.role === 'vendedor');
    const provisioning = sellerActivated
      ? await wakeSellerProvisioningForMember(admin, { organizationId, userId: targetUserId })
      : { provisioningState: null, provisioningWarning: null };
    return json({ ok: true, ...data, provisioning_state: provisioning.provisioningState,
      provisioning_warning: provisioning.provisioningWarning }, 200, headers);
  } catch (error) {
    return json({ ok: false, erro: safeError(error) }, 400, headers);
  }
});
