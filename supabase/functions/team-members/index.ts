import { createAdminClient, requireOrganizationPermission, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';
import { defaultPermissionsForRole, organizationPermissions } from '../_shared/permissions.ts';
import { maskDailyReportPhone, normalizeDailyReportPhone, validDailyReportTime } from '../_shared/dailyLeadReport.ts';

const roles = new Set(['administrador', 'vendedor', 'sdr', 'cx']);
type Action = 'create' | 'invite' | 'update_member' | 'reset_password' | 'update_role' | 'set_status' | 'remove' | 'permissions_get' | 'permissions_set' | 'daily_report_get' | 'daily_report_set' | 'handoff_alert_get' | 'handoff_alert_set' | 'invites_get' | 'invite_cancel' | 'invite_resend' | 'policy_get' | 'policy_set' | 'activate_invite';

function text(value: unknown, max = 180): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function memberRole(value: unknown): string {
  const role = text(value, 40).toLowerCase();
  if (!roles.has(role)) throw new Error('invalid_member_role');
  return role;
}

function memberPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) {
    throw new Error('invalid_member_password');
  }
  return value;
}

function memberEmail(value: unknown): string {
  const email = text(value, 254).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('invalid_member_email');
  return email;
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

interface PreparedInvite {
  id: string;
  previous: {
    role: string;
    invited_by: string | null;
    expires_at: string;
    accepted_at: string | null;
    cancelled_at: string | null;
  } | null;
}

type SellerProvisioning = {
  jobId: string;
  whatsappAccountId: string;
  integrationId: string;
  instanceName: string;
  state: string;
};

/**
 * The database transaction creates only local, disabled records and a durable
 * queue entry. The worker is the sole process that talks to WA-AKG, so
 * a failed HTTP call can never leave an account without an auditable job.
 */
async function enqueueSellerProvisioning(
  admin: ReturnType<typeof createAdminClient>,
  input: { organizationId: string; userId: string; actorId: string; source: 'direct_create' | 'invite'; inviteId?: string },
): Promise<SellerProvisioning> {
  const { data, error } = await admin.rpc('enqueue_wa_akg_seller_provisioning', {
    p_organization_id: input.organizationId,
    p_user_id: input.userId,
    p_created_by: input.actorId,
    p_source: input.source,
    p_invite_id: input.inviteId ?? null,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row || typeof row !== 'object') throw new Error('wa_akg_provisioning_enqueue_failed');
  const candidate = row as Record<string, unknown>;
  const jobId = text(candidate.job_id, 80);
  const whatsappAccountId = text(candidate.whatsapp_account_id, 80);
  const integrationId = text(candidate.integration_id, 80);
  const instanceName = text(candidate.instance_name, 120);
  const state = text(candidate.state, 40);
  if (!jobId || !whatsappAccountId || !integrationId || !instanceName || !state) {
    throw new Error('wa_akg_provisioning_enqueue_failed');
  }
  return { jobId, whatsappAccountId, integrationId, instanceName, state };
}

function wakeSellerProvisioningWorker(jobId: string): void {
  const baseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!baseUrl || !serviceRole) return;
  // The job is durable; this is only a low-latency wake-up. If the task cannot
  // run, the scheduler will process it later rather than silently dropping it.
  const pending = fetch(`${baseUrl}/functions/v1/wa-akg-worker`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ provisioning_job_id: jobId }),
    signal: AbortSignal.timeout(45_000),
  }).catch(() => undefined);
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil: (task: Promise<unknown>) => void } }).EdgeRuntime;
  runtime?.waitUntil(pending);
}

async function cancelSellerProvisioningForInvite(
  admin: ReturnType<typeof createAdminClient>, organizationId: string, inviteId: string,
): Promise<number> {
  const [waRead, evolutionRead] = await Promise.all([
    admin.from('wa_akg_seller_provisioning_jobs').select('id,account_id,integration_id')
      .eq('organization_id', organizationId).eq('invite_id', inviteId).in('state', ['queued', 'failed', 'processing']),
    admin.from('evolution_go_seller_provisioning_jobs').select('id,whatsapp_account_id,integration_id')
      .eq('organization_id', organizationId).eq('invite_id', inviteId)
      .in('state', ['queued', 'failed', 'processing', 'awaiting_qr']),
  ]);
  if (waRead.error || evolutionRead.error) throw new Error('seller_provisioning_cancel_read_failed');
  const waJobs = waRead.data ?? [];
  const evolutionJobs = evolutionRead.data ?? [];
  if (!waJobs.length && !evolutionJobs.length) return 0;
  const now = new Date().toISOString();
  const updates: Array<PromiseLike<{ error: unknown }>> = [];
  if (waJobs.length) updates.push(admin.from('wa_akg_seller_provisioning_jobs').update({
      state: 'cancelled', completed_at: now, error_code: 'invite_cancelled', updated_at: now,
    }).eq('organization_id', organizationId).in('id', waJobs.map((job) => job.id)));
  if (evolutionJobs.length) updates.push(admin.from('evolution_go_seller_provisioning_jobs').update({
      state: 'cancelled', completed_at: now, last_error_code: 'invite_cancelled', updated_at: now,
    }).eq('organization_id', organizationId).in('id', evolutionJobs.map((job) => job.id)));
  const accountIds = [...new Set([
    ...waJobs.map((job) => job.account_id), ...evolutionJobs.map((job) => job.whatsapp_account_id),
  ].filter(Boolean))];
  const integrationIds = [...new Set([
    ...waJobs.map((job) => job.integration_id), ...evolutionJobs.map((job) => job.integration_id),
  ].filter(Boolean))];
  updates.push(
    admin.from('whatsapp_accounts').update({
      enabled: false, archived_at: now, updated_at: now,
    }).eq('organization_id', organizationId).in('id', accountIds),
    admin.from('integrations').update({
      enabled: false, paused: true, status_detail: 'Canal individual arquivado porque o convite foi cancelado.', updated_at: now,
    }).eq('organization_id', organizationId).in('id', integrationIds),
  );
  const results = await Promise.all(updates);
  if (results.some((result) => result.error)) throw new Error('seller_provisioning_cancel_failed');
  return waJobs.length + evolutionJobs.length;
}

async function prepareOrganizationInvite(
  admin: ReturnType<typeof createAdminClient>, organizationId: string, actorId: string, email: string, role: string,
): Promise<PreparedInvite> {
  const now = new Date();
  const { data: pendingInvites, error: pendingError } = await admin.from('organization_invites')
    .select('id,organization_id').ilike('email', email).is('accepted_at', null).is('cancelled_at', null).gt('expires_at', now.toISOString());
  if (pendingError) throw pendingError;
  if ((pendingInvites ?? []).some((invite) => invite.organization_id !== organizationId)) {
    throw new Error('member_invite_conflict');
  }

  const { data: existing, error: existingError } = await admin.from('organization_invites')
    .select('id,role,invited_by,expires_at,accepted_at,cancelled_at')
    .eq('organization_id', organizationId).eq('email', email).maybeSingle();
  if (existingError) throw existingError;

  const invitation = {
    organization_id: organizationId,
    email,
    role,
    invited_by: actorId,
    expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
    accepted_at: null,
    cancelled_at: null,
  };
  const query = existing?.id
    ? admin.from('organization_invites').update(invitation).eq('id', existing.id)
    : admin.from('organization_invites').insert(invitation);
  const { data: prepared, error: prepareError } = await query.select('id').single();
  if (prepareError || !prepared?.id) throw prepareError ?? new Error('member_invitation_preparation_failed');
  return {
    id: prepared.id,
    previous: existing ? {
      role: existing.role,
      invited_by: existing.invited_by,
      expires_at: existing.expires_at,
      accepted_at: existing.accepted_at,
      cancelled_at: existing.cancelled_at,
    } : null,
  };
}

async function restorePreparedInvite(
  admin: ReturnType<typeof createAdminClient>, prepared: PreparedInvite,
): Promise<void> {
  if (prepared.previous) {
    await admin.from('organization_invites').update(prepared.previous)
      .eq('id', prepared.id).is('accepted_at', null).is('cancelled_at', null);
    return;
  }
  await admin.from('organization_invites').delete().eq('id', prepared.id).is('accepted_at', null).is('cancelled_at', null);
}

async function ensureAnotherAdministrator(
  admin: ReturnType<typeof createAdminClient>, organizationId: string, targetUserId: string, removesAdmin: boolean,
) {
  if (!removesAdmin) return;
  const { data, error } = await admin.from('organization_members').select('user_id')
    .eq('organization_id', organizationId).eq('role', 'administrador').eq('status', 'active');
  if (error) throw error;
  if ((data ?? []).some((member) => member.user_id === targetUserId) && (data?.length ?? 0) <= 1) {
    throw new Error('last_administrator_protected');
  }
}

type MemberPurgeSummary = {
  evolutionAccounts: number;
  integrationSecrets: number;
  storageObjects: number;
};

type MemberStorageObject = {
  bucket_id: string | null;
  name: string | null;
};

/**
 * Supabase Auth's admin signOut endpoint expects the member's JWT, not their
 * user id. Team administration never receives another member's JWT, so use
 * the service-only database helper to revoke renewable sessions by user id.
 */
async function revokeMemberSessions(
  admin: ReturnType<typeof createAdminClient>, targetUserId: string,
): Promise<number> {
  const { data, error } = await admin.rpc('revoke_user_auth_sessions', { p_user_id: targetUserId });
  if (error || !Number.isInteger(data) || data < 0) throw new Error('member_sessions_revoke_failed');
  return data;
}

/**
 * Storage objects cannot be deleted by issuing SQL against storage.objects:
 * the Storage service deliberately blocks that route to protect object
 * consistency. A service-only RPC lists only the departing member's objects,
 * then the Storage API clears both each object record and its backing file.
 */
async function purgeMemberOwnedStorage(
  admin: ReturnType<typeof createAdminClient>, targetUserId: string,
): Promise<number> {
  const pageSize = 100;
  let removedCount = 0;

  while (true) {
    const { data, error } = await admin.rpc('list_user_owned_storage', {
      p_user_id: targetUserId,
      p_limit: pageSize,
    });
    if (error) throw new Error('member_storage_list_failed');

    if (data !== null && !Array.isArray(data)) throw new Error('member_storage_list_failed');
    const objects = ((data ?? []) as MemberStorageObject[]).filter((object) =>
      typeof object.bucket_id === 'string' && object.bucket_id.length > 0
      && typeof object.name === 'string' && object.name.length > 0,
    );
    if (!objects.length) return removedCount;

    const pathsByBucket = new Map<string, string[]>();
    for (const object of objects) {
      const bucket = object.bucket_id as string;
      const paths = pathsByBucket.get(bucket) ?? [];
      paths.push(object.name as string);
      pathsByBucket.set(bucket, paths);
    }

    for (const [bucket, paths] of pathsByBucket) {
      const { error: removeError } = await admin.storage.from(bucket).remove(paths);
      if (removeError) throw new Error('member_storage_delete_failed');
      removedCount += paths.length;
    }

    // Each successful delete shrinks the first page. Re-read it until no
    // records remain so accounts with more than one page are fully cleaned.
    if (objects.length < pageSize) return removedCount;
  }
}

/**
 * Removes data that is exclusively attached to a team member. Commercial leads
 * and messages are deliberately not deleted: they belong to the organization
 * and their user references are cleared by their ON DELETE SET NULL foreign
 * keys. This makes the identity unrecoverable without destroying the company
 * history that may be shared with other members.
 */
async function purgeMemberOwnedData(
  admin: ReturnType<typeof createAdminClient>, organizationId: string, targetUserId: string,
): Promise<MemberPurgeSummary> {
  const { data: accounts, error: accountsError } = await admin.from('whatsapp_accounts')
    .select('id,integration_id').eq('organization_id', organizationId).eq('owner_user_id', targetUserId);
  if (accountsError) throw new Error('member_whatsapp_accounts_read_failed');

  const accountIds = (accounts ?? []).map((account) => String(account.id)).filter(Boolean);
  const integrationIds = [...new Set((accounts ?? []).map((account) => String(account.integration_id)).filter(Boolean))];
  const now = new Date().toISOString();

  if (accountIds.length) {
    // Stop the durable worker first. Marking records as archived is a
    // fail-closed guard against a worker that started before this request.
    const [waJobs, evolutionJobs, accountArchive] = await Promise.all([
      admin.from('wa_akg_seller_provisioning_jobs').update({
        state: 'cancelled', completed_at: now, error_code: 'member_deleted', updated_at: now,
      }).eq('organization_id', organizationId).in('account_id', accountIds)
        .in('state', ['queued', 'failed', 'processing']),
      admin.from('evolution_go_seller_provisioning_jobs').update({
        state: 'cancelled', completed_at: now, last_error_code: 'member_deleted', updated_at: now,
      }).eq('organization_id', organizationId).in('whatsapp_account_id', accountIds)
        .in('state', ['queued', 'failed', 'processing', 'awaiting_qr']),
      admin.from('whatsapp_accounts').update({
        enabled: false, is_default: false, connection_status: 'disconnected', archived_at: now, updated_at: now,
      }).eq('organization_id', organizationId).in('id', accountIds),
    ]);
    if (waJobs.error || evolutionJobs.error || accountArchive.error) throw new Error('member_operational_channel_lock_failed');

    // These tables use RESTRICT because a normal channel transfer must retain
    // history. On permanent identity deletion the records are user-owned, so
    // remove them before deleting the account and its integration secret.
    const [bindings, outbox, conversations] = await Promise.all([
      admin.from('lead_whatsapp_account_bindings').delete().eq('organization_id', organizationId).in('whatsapp_account_id', accountIds),
      admin.from('messaging_outbox').delete().eq('organization_id', organizationId).in('whatsapp_account_id', accountIds),
      admin.from('whatsapp_conversations').delete().eq('organization_id', organizationId).in('whatsapp_account_id', accountIds),
    ]);
    if (bindings.error || outbox.error || conversations.error) throw new Error('member_operational_channel_purge_failed');

    const { error: accountDeleteError } = await admin.from('whatsapp_accounts').delete()
      .eq('organization_id', organizationId).in('id', accountIds);
    if (accountDeleteError) throw new Error('member_whatsapp_accounts_delete_failed');
  }

  for (const integrationId of integrationIds) {
    const { data: removed, error: secretError } = await admin.rpc('delete_integration_secret', { p_integration: integrationId });
    if (secretError || (removed !== true && removed !== false)) throw new Error('member_integration_secret_purge_failed');
    const { error: integrationDeleteError } = await admin.from('integrations').delete()
      .eq('organization_id', organizationId).eq('id', integrationId);
    if (integrationDeleteError) throw new Error('member_integration_delete_failed');
  }

  const storageObjects = await purgeMemberOwnedStorage(admin, targetUserId);

  // Keep the audit timeline useful without retaining the removed person's
  // name. The FK will also clear actor_id once Auth deletes the identity.
  const { error: auditAnonymizeError } = await admin.from('audit_logs').update({ actor_name: 'Usuário removido' })
    .eq('organization_id', organizationId).eq('actor_id', targetUserId);
  if (auditAnonymizeError) throw new Error('member_audit_anonymize_failed');

  return {
    evolutionAccounts: accountIds.length,
    integrationSecrets: integrationIds.length,
    storageObjects,
  };
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = text(body.action, 32) as Action;
    if (!['create', 'invite', 'update_member', 'reset_password', 'update_role', 'set_status', 'remove', 'permissions_get', 'permissions_set', 'daily_report_get', 'daily_report_set', 'handoff_alert_get', 'handoff_alert_set', 'invites_get', 'invite_cancel', 'invite_resend', 'policy_get', 'policy_set', 'activate_invite'].includes(action)) throw new Error('unsupported_action');
    const { user } = await requireUser(request);
    const admin = createAdminClient();

    // Convites são ativados somente quando o próprio convidado autentica. Isso
    // mantém a conta fora da organização até o aceite e não exige permissão de
    // administrador para o primeiro acesso.
    if (action === 'activate_invite') {
      const email = text(user.email, 254).toLowerCase();
      if (!email) throw new Error('member_email_required');
      const { data: pending, error: pendingError } = await admin.from('organization_invites')
        .select('id,organization_id,role,expires_at,accepted_at').ilike('email', email)
        .is('accepted_at', null).is('cancelled_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (pendingError) throw pendingError;
      if (!pending) return json({ ok: true, activated: false }, 200, headers);
      const now = new Date().toISOString();
      const { error: membershipError } = await admin.from('organization_members').upsert({
        organization_id: pending.organization_id, user_id: user.id, role: pending.role, status: 'active', updated_at: now,
      }, { onConflict: 'organization_id,user_id' });
      if (membershipError) throw membershipError;
      const { error: profileError } = await admin.from('profiles').update({
        active: true, active_organization_id: pending.organization_id, updated_at: now,
      }).eq('id', user.id);
      if (profileError) throw profileError;
      const { error: inviteError } = await admin.from('organization_invites').update({ accepted_at: now }).eq('id', pending.id).is('accepted_at', null).is('cancelled_at', null);
      if (inviteError) throw inviteError;
      await admin.from('audit_logs').insert({ organization_id: pending.organization_id, actor_id: user.id, actor_name: email, actor_type: 'user', action: 'team.invite_accepted', detail: 'Convite aceito e acesso liberado.', entity_table: 'organization_invites', entity_id: pending.id, event_data: { user_id: user.id, role: pending.role } });
      return json({ ok: true, activated: true, organization_id: pending.organization_id }, 200, headers);
    }

    const { data: profile, error: profileError } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (profileError || !profile?.active_organization_id) throw new Error('organization_context_required');
    const organizationId = profile.active_organization_id;
    await requireOrganizationPermission(admin, organizationId, user.id, 'team.manage');

    if (action === 'policy_get') {
      return json({ ok: true, policy: await loadSecurityPolicy(admin, organizationId) }, 200, headers);
    }

    if (action === 'policy_set') {
      if (!body.policy || typeof body.policy !== 'object' || Array.isArray(body.policy)) throw new Error('security_policy_required');
      const policy = securityPolicy(body.policy);
      const now = new Date().toISOString();
      const { error } = await admin.from('organization_module_data').upsert({
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

    if (action === 'invite_cancel' || action === 'invite_resend') {
      const inviteId = text(body.invite_id, 64);
      if (!inviteId) throw new Error('invite_required');
      const { data: invite, error: inviteError } = await admin.from('organization_invites')
        .select('id,email,role,accepted_at,cancelled_at').eq('organization_id', organizationId).eq('id', inviteId).maybeSingle();
      if (inviteError || !invite) throw inviteError ?? new Error('invite_not_found');
      if (invite.accepted_at) throw new Error('invite_already_accepted');
      if (invite.cancelled_at) throw new Error('invite_already_cancelled');
      if (action === 'invite_cancel') {
        const { error } = await admin.from('organization_invites').update({ cancelled_at: new Date().toISOString() }).eq('organization_id', organizationId).eq('id', inviteId).is('accepted_at', null).is('cancelled_at', null);
        if (error) throw error;
        const cancelledProvisioning = await cancelSellerProvisioningForInvite(admin, organizationId, inviteId);
        await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'team.invite_cancelled', detail: `Convite cancelado para ${invite.email}.`, entity_table: 'organization_invites', entity_id: inviteId, event_data: { email: invite.email, role: invite.role, evolution_go_provisioning_cancelled: cancelledProvisioning } });
        return json({ ok: true }, 200, headers);
      }
      const { error } = await admin.auth.admin.inviteUserByEmail(invite.email, { data: {}, redirectTo: `${Deno.env.get('ALLOWED_ORIGIN') ?? 'https://leadai-crm-preview.fabricio926564.chatgpt.site'}/login` });
      if (error) throw error;
      await admin.from('organization_invites').update({ expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), cancelled_at: null }).eq('organization_id', organizationId).eq('id', inviteId).is('accepted_at', null).is('cancelled_at', null);
      await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'team.invite_resent', detail: `Convite reenviado para ${invite.email}.`, entity_table: 'organization_invites', entity_id: inviteId, event_data: { email: invite.email, role: invite.role } });
      return json({ ok: true }, 200, headers);
    }

    if (action === 'create') {
      const email = memberEmail(body.email);
      const name = text(body.name, 120);
      const password = memberPassword(body.password);
      const role = memberRole(body.role);
      if (!name) throw new Error('invalid_member_name');

      const preparedInvite = await prepareOrganizationInvite(admin, organizationId, user.id, email, role);

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });
      if (createError || !created.user) {
        await restorePreparedInvite(admin, preparedInvite);
        if (isExistingAuthUser(createError)) throw new Error('member_email_already_registered');
        throw createError ?? new Error('member_creation_failed');
      }

      const now = new Date().toISOString();
      const { error: membershipError } = await admin.from('organization_members').upsert({
        organization_id: organizationId, user_id: created.user.id, role, status: 'active', updated_at: now,
      }, { onConflict: 'organization_id,user_id' });
      if (membershipError) {
        await admin.auth.admin.deleteUser(created.user.id);
        await restorePreparedInvite(admin, preparedInvite);
        throw membershipError;
      }
      const { error: profileError } = await admin.from('profiles').update({
        name, email, active: true, active_organization_id: organizationId, updated_at: now,
      }).eq('id', created.user.id);
      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id);
        await restorePreparedInvite(admin, preparedInvite);
        throw profileError;
      }

      // `prepareOrganizationInvite` is used here only as a cross-organization
      // email reservation. A direct credential-based creation must not leave a
      // phantom invitation visible to the administrator.
      const { error: reservationCleanupError } = await admin.from('organization_invites').delete()
        .eq('id', preparedInvite.id).is('accepted_at', null).is('cancelled_at', null);
      if (reservationCleanupError) {
        await admin.auth.admin.deleteUser(created.user.id);
        await restorePreparedInvite(admin, preparedInvite);
        throw new Error('member_invitation_cleanup_failed');
      }

      let provisioning: SellerProvisioning | null = null;
      if (role === 'vendedor') {
        try {
          provisioning = await enqueueSellerProvisioning(admin, {
            organizationId, userId: created.user.id, actorId: user.id, source: 'direct_create',
          });
        } catch (provisioningError) {
          await admin.auth.admin.deleteUser(created.user.id);
          throw provisioningError;
        }
      }

      await admin.from('audit_logs').insert({
        organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'team.member_created',
        detail: `Acesso criado para ${email}.`, entity_table: 'organization_members', event_data: {
          email, role, user_id: created.user.id,
          evolution_go_auto_provisioning: provisioning ? { job_id: provisioning.jobId, state: provisioning.state } : null,
        },
      });
      if (provisioning) wakeSellerProvisioningWorker(provisioning.jobId);
      return json({
        ok: true, user_id: created.user.id,
        provisioning: provisioning ? { state: provisioning.state, automatic_channel: true } : null,
        message: provisioning ? 'Acesso criado; o canal individual Evolution GO será preparado automaticamente.' : 'Acesso criado e liberado.',
      }, 201, headers);
    }

    if (action === 'invite') {
      const email = memberEmail(body.email);
      const name = text(body.name, 120);
      const role = memberRole(body.role);
      const preparedInvite = await prepareOrganizationInvite(admin, organizationId, user.id, email, role);
      const redirectTo = `${Deno.env.get('ALLOWED_ORIGIN') ?? 'https://leadai-crm-preview.fabricio926564.chatgpt.site'}/login`;
      const { data: invitation, error: invitationError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: name ? { name } : {}, redirectTo,
      });
      if (invitationError || !invitation.user) {
        await restorePreparedInvite(admin, preparedInvite);
        throw invitationError ?? new Error('member_invitation_failed');
      }
      const { error: membershipError } = await admin.from('organization_members').upsert({
        organization_id: organizationId, user_id: invitation.user.id, role, status: 'invited', updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,user_id' });
      if (membershipError) {
        await admin.auth.admin.deleteUser(invitation.user.id);
        await restorePreparedInvite(admin, preparedInvite);
        throw membershipError;
      }
      let provisioning: SellerProvisioning | null = null;
      if (role === 'vendedor') {
        try {
          provisioning = await enqueueSellerProvisioning(admin, {
            organizationId, userId: invitation.user.id, actorId: user.id, source: 'invite', inviteId: preparedInvite.id,
          });
        } catch (provisioningError) {
          await admin.auth.admin.deleteUser(invitation.user.id);
          await restorePreparedInvite(admin, preparedInvite);
          throw provisioningError;
        }
      }
      await admin.from('audit_logs').insert({
        organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'team.member_invited',
        detail: `Convite enviado para ${email}; acesso pendente até o aceite.`, entity_table: 'organization_invites', event_data: {
          email, role,
          evolution_go_auto_provisioning: provisioning ? { job_id: provisioning.jobId, state: provisioning.state } : null,
        },
      });
      if (provisioning) wakeSellerProvisioningWorker(provisioning.jobId);
      return json({
        ok: true, provisioning: provisioning ? { state: provisioning.state, automatic_channel: true } : null,
        message: provisioning ? 'Convite enviado; o canal individual Evolution GO será preparado automaticamente.' : 'Convite enviado. O acesso será liberado após o aceite.',
      }, 200, headers);
    }

    const targetUserId = text(body.user_id, 64);
    if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) throw new Error('member_required');
    const { data: current, error: currentError } = await admin.from('organization_members').select('role,status')
      .eq('organization_id', organizationId).eq('user_id', targetUserId).maybeSingle();
    if (currentError || !current) throw currentError ?? new Error('member_not_found');
    if (action === 'remove' && targetUserId === user.id) throw new Error('member_self_deletion_protected');

    if (action === 'permissions_get') {
      const { data: rows, error } = await admin.from('team_member_permissions')
        .select('permission,allowed').eq('organization_id', organizationId).eq('user_id', targetUserId);
      if (error) throw error;
      const overrides = new Map((rows ?? []).map((row) => [row.permission, row.allowed === true]));
      const defaults = defaultPermissionsForRole(current.role);
      const permissions = Object.fromEntries(organizationPermissions.map((permission) => [permission, overrides.get(permission) ?? defaults[permission]]));
      return json({ ok: true, role: current.role, permissions }, 200, headers);
    }

    if (action === 'update_member') {
      const name = text(body.name, 120);
      const email = memberEmail(body.email);
      if (!name) throw new Error('invalid_member_name');
      const { data: previousProfile, error: previousProfileError } = await admin.from('profiles')
        .select('name,email').eq('id', targetUserId).maybeSingle();
      if (previousProfileError || !previousProfile) throw previousProfileError ?? new Error('member_profile_not_found');

      const { error: authUpdateError } = await admin.auth.admin.updateUserById(targetUserId, {
        email,
        email_confirm: true,
        user_metadata: { name },
      });
      if (authUpdateError) {
        if (isExistingAuthUser(authUpdateError)) throw new Error('member_email_already_registered');
        throw new Error('member_profile_update_failed');
      }

      const now = new Date().toISOString();
      const { error: profileUpdateError } = await admin.from('profiles').update({ name, email, updated_at: now }).eq('id', targetUserId);
      if (profileUpdateError) {
        await admin.auth.admin.updateUserById(targetUserId, {
          email: previousProfile.email,
          email_confirm: true,
          user_metadata: { name: previousProfile.name },
        });
        throw new Error('member_profile_update_failed');
      }
      await admin.from('audit_logs').insert({
        organization_id: organizationId,
        actor_id: user.id,
        actor_name: profile.name,
        actor_type: 'user',
        action: 'team.member_updated',
        detail: 'Cadastro de membro atualizado.',
        entity_table: 'profiles',
        entity_id: targetUserId,
        event_data: { user_id: targetUserId, name, email },
      });
      return json({ ok: true }, 200, headers);
    }

    if (action === 'reset_password') {
      const password = memberPassword(body.password);
      const { error: passwordError } = await admin.auth.admin.updateUserById(targetUserId, { password });
      if (passwordError) throw new Error('member_password_reset_failed');

      // A senha temporária substitui a anterior e encerra as sessões renováveis
      // existentes. Access tokens emitidos antes disso expiram normalmente e
      // continuam sujeitos às checagens de associação e permissões do CRM.
      let revokedSessionCount = 0;
      try {
        revokedSessionCount = await revokeMemberSessions(admin, targetUserId);
      } catch {
        throw new Error('member_password_reset_session_revoke_failed');
      }
      await admin.from('audit_logs').insert({
        organization_id: organizationId,
        actor_id: user.id,
        actor_name: profile.name,
        actor_type: 'user',
        action: 'team.member_password_reset',
        detail: 'Senha temporária de membro redefinida.',
        entity_table: 'organization_members',
        entity_id: targetUserId,
        event_data: { user_id: targetUserId, sessions_revoked: revokedSessionCount > 0, revoked_session_count: revokedSessionCount },
      });
      return json({ ok: true, sessions_revoked: revokedSessionCount > 0 }, 200, headers);
    }

    if (action === 'permissions_set') {
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

    if (action === 'update_role') {
      const role = memberRole(body.role);
      await ensureAnotherAdministrator(admin, organizationId, targetUserId, current.role === 'administrador' && role !== 'administrador');
      const { error } = await admin.from('organization_members').update({ role, updated_at: new Date().toISOString() })
        .eq('organization_id', organizationId).eq('user_id', targetUserId);
      if (error) throw error;
      await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'team.member_role_changed', detail: 'Papel de membro atualizado.', entity_table: 'organization_members', event_data: { user_id: targetUserId, role } });
      return json({ ok: true }, 200, headers);
    }

    if (action === 'set_status') {
      if (typeof body.enabled !== 'boolean') throw new Error('member_status_required');
      await ensureAnotherAdministrator(admin, organizationId, targetUserId, current.role === 'administrador' && current.status === 'active' && body.enabled === false);
      const { error } = await admin.from('organization_members').update({ status: body.enabled ? 'active' : 'disabled', updated_at: new Date().toISOString() })
        .eq('organization_id', organizationId).eq('user_id', targetUserId);
      if (error) throw error;
      if (!body.enabled && (await loadSecurityPolicy(admin, organizationId)).revokeSessionsOnDisable) {
        const revokedSessionCount = await revokeMemberSessions(admin, targetUserId);
        await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'team.sessions_revoked', detail: 'Sessões renováveis do usuário revogadas após desativação.', entity_table: 'organization_members', event_data: { user_id: targetUserId, revoked_session_count: revokedSessionCount } });
      }
      await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: body.enabled ? 'team.member_enabled' : 'team.member_disabled', detail: body.enabled ? 'Acesso de membro liberado.' : 'Acesso de membro bloqueado.', entity_table: 'organization_members', event_data: { user_id: targetUserId } });
      return json({ ok: true }, 200, headers);
    }

    await ensureAnotherAdministrator(admin, organizationId, targetUserId, current.role === 'administrador' && current.status === 'active');
    const { count: otherOrganizationCount, error: otherOrganizationError } = await admin.from('organization_members')
      .select('organization_id', { count: 'exact', head: true }).eq('user_id', targetUserId).neq('organization_id', organizationId);
    if (otherOrganizationError) throw otherOrganizationError;
    if ((otherOrganizationCount ?? 0) > 0) throw new Error('member_linked_to_another_organization');

    // Auth user deletion does not invalidate a JWT already issued to the
    // browser. Revoke renewable sessions first; organization membership and
    // permissions are then removed by the Auth-user cascade.
    await revokeMemberSessions(admin, targetUserId);

    const purge = await purgeMemberOwnedData(admin, organizationId, targetUserId);

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(targetUserId);
    if (deleteUserError) throw new Error('member_identity_deletion_failed');
    await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'team.member_deleted', detail: 'Identidade e dados privados do membro removidos definitivamente.', entity_table: 'organization_members', event_data: { evolution_accounts_deleted: purge.evolutionAccounts, integration_secrets_deleted: purge.integrationSecrets, storage_objects_deleted: purge.storageObjects } });
    return json({ ok: true, deleted_identity: true }, 200, headers);
  } catch (error) {
    return json({ ok: false, erro: safeError(error) }, 400, headers);
  }
});
