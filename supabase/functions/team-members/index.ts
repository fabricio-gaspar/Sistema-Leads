import { createAdminClient, requireOrganizationPermission, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';
import { defaultPermissionsForRole, organizationPermissions, type OrganizationPermission } from '../_shared/permissions.ts';

const roles = new Set(['administrador', 'vendedor', 'sdr', 'cx']);
type Action = 'create' | 'invite' | 'update_role' | 'set_status' | 'remove' | 'permissions_get' | 'permissions_set';

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
  } | null;
}

async function prepareOrganizationInvite(
  admin: ReturnType<typeof createAdminClient>, organizationId: string, actorId: string, email: string, role: string,
): Promise<PreparedInvite> {
  const now = new Date();
  const { data: pendingInvites, error: pendingError } = await admin.from('organization_invites')
    .select('id,organization_id').ilike('email', email).is('accepted_at', null).gt('expires_at', now.toISOString());
  if (pendingError) throw pendingError;
  if ((pendingInvites ?? []).some((invite) => invite.organization_id !== organizationId)) {
    throw new Error('member_invite_conflict');
  }

  const { data: existing, error: existingError } = await admin.from('organization_invites')
    .select('id,role,invited_by,expires_at,accepted_at')
    .eq('organization_id', organizationId).eq('email', email).maybeSingle();
  if (existingError) throw existingError;

  const invitation = {
    organization_id: organizationId,
    email,
    role,
    invited_by: actorId,
    expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
    accepted_at: null,
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
    } : null,
  };
}

async function restorePreparedInvite(
  admin: ReturnType<typeof createAdminClient>, prepared: PreparedInvite,
): Promise<void> {
  if (prepared.previous) {
    await admin.from('organization_invites').update(prepared.previous)
      .eq('id', prepared.id).is('accepted_at', null);
    return;
  }
  await admin.from('organization_invites').delete().eq('id', prepared.id).is('accepted_at', null);
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

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = text(body.action, 32) as Action;
    if (!['create', 'invite', 'update_role', 'set_status', 'remove', 'permissions_get', 'permissions_set'].includes(action)) throw new Error('unsupported_action');
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (profileError || !profile?.active_organization_id) throw new Error('organization_context_required');
    const organizationId = profile.active_organization_id;
    await requireOrganizationPermission(admin, organizationId, user.id, 'team.manage');

    if (action === 'create') {
      const email = text(body.email, 254).toLowerCase();
      const name = text(body.name, 120);
      const password = memberPassword(body.password);
      const role = memberRole(body.role);
      if (!name) throw new Error('invalid_member_name');
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('invalid_member_email');

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
        throw membershipError;
      }
      const { error: profileError } = await admin.from('profiles').update({
        name, email, active: true, active_organization_id: organizationId, updated_at: now,
      }).eq('id', created.user.id);
      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id);
        throw profileError;
      }

      await admin.from('audit_logs').insert({
        organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'team.member_created',
        detail: `Acesso criado para ${email}.`, entity_table: 'organization_members', event_data: { email, role, user_id: created.user.id },
      });
      return json({ ok: true, user_id: created.user.id, message: 'Acesso criado e liberado.' }, 201, headers);
    }

    if (action === 'invite') {
      const email = text(body.email, 254).toLowerCase();
      const name = text(body.name, 120);
      const role = memberRole(body.role);
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('invalid_member_email');
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
        organization_id: organizationId, user_id: invitation.user.id, role, status: 'active', updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,user_id' });
      if (membershipError) throw membershipError;
      await admin.from('audit_logs').insert({
        organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'team.member_invited',
        detail: `Convite enviado para ${email}.`, entity_table: 'organization_members', event_data: { email, role },
      });
      return json({ ok: true, message: 'Convite enviado. O acesso será liberado após o aceite.' }, 200, headers);
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

    if (action === 'permissions_set') {
      const requested = body.permissions;
      if (!requested || typeof requested !== 'object' || Array.isArray(requested)) throw new Error('permissions_required');
      const permissionMap = requested as Record<string, unknown>;
      const values = organizationPermissions.map((permission) => {
        const allowed = permissionMap[permission];
        if (typeof allowed !== 'boolean') throw new Error('invalid_permission_value');
        return { organization_id: organizationId, user_id: targetUserId, permission, allowed, updated_at: new Date().toISOString() };
      });
      const { error } = await admin.from('team_member_permissions').upsert(values, { onConflict: 'organization_id,user_id,permission' });
      if (error) throw error;
      await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'team.member_permissions_changed', detail: 'Permissões individuais do membro atualizadas.', entity_table: 'organization_members', event_data: { user_id: targetUserId } });
      return json({ ok: true }, 200, headers);
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
      await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: body.enabled ? 'team.member_enabled' : 'team.member_disabled', detail: body.enabled ? 'Acesso de membro liberado.' : 'Acesso de membro bloqueado.', entity_table: 'organization_members', event_data: { user_id: targetUserId } });
      return json({ ok: true }, 200, headers);
    }

    await ensureAnotherAdministrator(admin, organizationId, targetUserId, current.role === 'administrador' && current.status === 'active');
    const { count: otherOrganizationCount, error: otherOrganizationError } = await admin.from('organization_members')
      .select('organization_id', { count: 'exact', head: true }).eq('user_id', targetUserId).neq('organization_id', organizationId);
    if (otherOrganizationError) throw otherOrganizationError;
    if ((otherOrganizationCount ?? 0) > 0) throw new Error('member_linked_to_another_organization');

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(targetUserId);
    if (deleteUserError) throw new Error('member_identity_deletion_failed');
    await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'team.member_deleted', detail: 'Identidade do membro removida definitivamente.', entity_table: 'organization_members', event_data: { user_id: targetUserId } });
    return json({ ok: true, deleted_identity: true }, 200, headers);
  } catch (error) {
    return json({ ok: false, erro: safeError(error) }, 400, headers);
  }
});
