import { createAdminClient, requireOrganizationPermission, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

type Row = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value: unknown, max = 1000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const admin = createAdminClient();

async function record(table: string, filters: Record<string, string>, columns: string): Promise<Row | null> {
  let query = admin.from(table).select(columns);
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`${table}_read_failed`);
  return data as Row | null;
}

async function claimRemoval(organizationId: string, userId: string): Promise<void> {
  const existing = await record('team_member_wa_akg_removal_claims', {
    organization_id: organizationId, user_id: userId,
  }, 'state');
  if (existing?.state === 'finalized') throw new Error('member_already_removed');
  if (existing?.state === 'claimed') return;
  const { error } = await admin.from('team_member_wa_akg_removal_claims').insert({
    organization_id: organizationId, user_id: userId, state: 'claimed',
  });
  if (error) throw new Error(error.code === '23505' ? 'member_removal_in_progress' : 'member_removal_claim_failed');
}

async function purgeMemberOwnedStorage(userId: string): Promise<number> {
  let removed = 0;
  while (true) {
    const { data, error } = await admin.rpc('list_user_owned_storage', { p_user_id: userId, p_limit: 100 });
    if (error || (data !== null && !Array.isArray(data))) throw new Error('member_storage_list_failed');
    const objects = (data ?? []) as Array<{ bucket_id?: unknown; name?: unknown }>;
    if (!objects.length) return removed;
    const byBucket = new Map<string, string[]>();
    for (const item of objects) {
      const bucket = text(item.bucket_id, 120), name = text(item.name, 1000);
      if (!bucket || !name) throw new Error('member_storage_list_failed');
      byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), name]);
    }
    for (const [bucket, names] of byBucket) {
      const { error: removeError } = await admin.storage.from(bucket).remove(names);
      if (removeError) throw new Error('member_storage_delete_failed');
      removed += names.length;
    }
    if (objects.length < 100) return removed;
  }
}

async function eraseIdentity(input: { organizationId: string; actorId: string; userId: string }) {
  const storageObjectsDeleted = await purgeMemberOwnedStorage(input.userId);
  const { data: revokedSessions, error: revokeError } = await admin.rpc('revoke_user_auth_sessions', { p_user_id: input.userId });
  if (revokeError || !Number.isInteger(revokedSessions)) throw new Error('member_sessions_revoke_failed');
  const { data: finalized, error: finalizeError } = await admin.rpc('team_member_wa_akg_identity_erasure_finalize', {
    p_organization_id: input.organizationId, p_actor_id: input.actorId, p_user_id: input.userId,
  });
  if (finalizeError || finalized?.identity_deleted !== true) throw new Error('member_identity_deletion_failed');
  return { identity_deleted: true, storage_objects_deleted: storageObjectsDeleted, sessions_revoked: revokedSessions };
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);
  try {
    const body = object(await request.json().catch(() => null));
    if (body.action !== 'remove') throw new Error('unsupported_action');
    const userId = text(body.user_id, 80);
    if (!UUID.test(userId)) throw new Error('member_required');
    const { user } = await requireUser(request);
    if (user.id === userId) throw new Error('member_self_deletion_protected');
    const profile = await record('profiles', { id: user.id }, 'active_organization_id');
    const organizationId = text(profile?.active_organization_id, 80);
    if (!UUID.test(organizationId)) throw new Error('organization_context_required');
    await requireOrganizationPermission(admin, organizationId, user.id, 'team.manage');
    const actor = await record('organization_members', { organization_id: organizationId, user_id: user.id }, 'role,status');
    if (actor?.role !== 'administrador' || actor.status !== 'active') throw new Error('member_removal_admin_required');
    const input = { organizationId, actorId: user.id, userId };
    const { data: readiness, error: readinessError } = await admin.rpc('team_member_identity_erasure_preflight', {
      p_organization_id: organizationId, p_actor_id: user.id, p_user_id: userId,
    });
    if (readinessError || readiness?.ready !== true) throw new Error('member_identity_erasure_preflight_failed');
    const { data: sharedData, error: sharedDataError } = await admin.rpc('team_member_shared_data_preflight', { p_user_id: userId });
    if (sharedDataError || sharedData?.ready !== true) {
      if (sharedDataError?.message?.includes('member_shared_company_data_requires_reassignment')) {
        throw new Error('member_shared_company_data_requires_reassignment');
      }
      throw new Error('member_shared_data_preflight_failed');
    }
    await claimRemoval(organizationId, userId);
    const { data: removed, error: removeError } = await admin.rpc('team_member_wa_akg_remove_finalize', {
      p_organization_id: organizationId, p_actor_id: user.id, p_user_id: userId,
    });
    if (removeError || removed?.membership_removed !== true) throw new Error('member_local_finalize_failed');
    return json({ ok: true, ...removed, ...await eraseIdentity(input) }, 200, headers);
  } catch (error) {
    return json({ ok: false, erro: safeError(error) }, 409, headers);
  }
});
