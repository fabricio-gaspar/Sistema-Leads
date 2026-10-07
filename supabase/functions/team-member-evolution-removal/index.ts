import { createAdminClient, requireOrganizationPermission, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

type Row = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value: unknown, max = 1000): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const admin = createAdminClient();

function instanceNameFor(organizationId: string, userId: string): string {
  return `wf-${organizationId.replaceAll('-', '').slice(0, 12)}-${userId.replaceAll('-', '').slice(0, 12)}`;
}

async function record(table: string, filters: Record<string, string | null>, columns: string): Promise<Row | null> {
  let query = admin.from(table).select(columns);
  for (const [key, value] of Object.entries(filters)) query = value === null ? query.is(key, null) : query.eq(key, value);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`${table}_read_failed`);
  return data as Row | null;
}

async function gatewayFor(organizationId: string): Promise<{ baseUrl: string; apiKey: string } | null> {
  const corporate = await record('whatsapp_accounts', {
    organization_id: organizationId, provider: 'evolution_go', account_type: 'corporate',
  }, 'integration_id');
  if (!corporate) return null;
  const integrationId = text(corporate.integration_id, 80);
  if (!UUID.test(integrationId)) throw new Error('member_gateway_not_configured');
  const integration = await record('integrations', { id: integrationId, organization_id: organizationId },
    'configuration');
  if (!integration) throw new Error('member_gateway_not_configured');
  const { data, error } = await admin.rpc('read_integration_secret', { p_integration: integrationId });
  if (error || !data) throw new Error('member_gateway_not_configured');
  const secret = object(data);
  const rawUrl = text(secret.base_url, 500);
  const apiKey = text(secret.global_api_key, 1000);
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error('member_gateway_not_configured'); }
  const allowedOrigins = (Deno.env.get('EVOLUTION_GO_ALLOWED_ORIGINS') ||
    'https://evo-eisenflow.kz3solucoes.cloud').split(',').map((item) => item.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' ||
      url.search || url.hash || !allowedOrigins.includes(url.origin) || !apiKey) {
    throw new Error('member_gateway_not_allowed');
  }
  return { baseUrl: url.origin, apiKey };
}

type RemoteInstance = { id: string; name: string };
async function listInstances(gateway: { baseUrl: string; apiKey: string }): Promise<RemoteInstance[]> {
  const response = await fetch(new URL('/instance/all', gateway.baseUrl), {
    headers: { apikey: gateway.apiKey }, signal: AbortSignal.timeout(20_000), redirect: 'error',
  });
  if (!response.ok) throw new Error(`member_remote_list_http_${response.status}`);
  const payload = object(await response.json().catch(() => null));
  if (!Array.isArray(payload.data)) throw new Error('member_remote_list_invalid');
  return payload.data.map((raw) => {
    const item = object(raw);
    return { id: text(item.id, 120), name: text(item.name, 120) };
  });
}

function exactRemote(instances: RemoteInstance[], expectedName: string): RemoteInstance | null {
  const matches = instances.filter((item) => item.name === expectedName);
  if (matches.length > 1) throw new Error('member_remote_name_duplicated');
  const match = matches[0] ?? null;
  if (match && !UUID.test(match.id)) throw new Error('member_remote_id_invalid');
  return match;
}

async function claimRemoval(input: {
  organizationId: string; userId: string; instanceName: string; remoteId: string | null;
}): Promise<'claimed' | 'remote_absent'> {
  const filters = { organization_id: input.organizationId, user_id: input.userId };
  const existing = await record('team_member_evolution_removal_claims', filters,
    'state,instance_name,remote_id,claimed_at');
  if (existing) {
    if (existing.instance_name !== input.instanceName) throw new Error('member_removal_claim_conflict');
    if (existing.state === 'finalized') throw new Error('member_already_removed');
    if (existing.state === 'remote_absent') return 'remote_absent';
    const claimedAt = Date.parse(text(existing.claimed_at, 60));
    if (!Number.isFinite(claimedAt) || Date.now() - claimedAt < 5 * 60_000) {
      throw new Error('member_removal_in_progress');
    }
    const { data, error } = await admin.from('team_member_evolution_removal_claims')
      .update({ remote_id: input.remoteId, claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('organization_id', input.organizationId).eq('user_id', input.userId)
      .eq('state', 'claimed').eq('claimed_at', existing.claimed_at).select('state').maybeSingle();
    if (error || !data) throw new Error('member_removal_claim_conflict');
    return 'claimed';
  }
  const { error } = await admin.from('team_member_evolution_removal_claims').insert({
    ...filters, instance_name: input.instanceName, remote_id: input.remoteId, state: 'claimed',
  });
  if (error) throw new Error(error.code === '23505' ? 'member_removal_in_progress' : 'member_removal_claim_failed');
  return 'claimed';
}

async function purgeMemberOwnedStorage(userId: string): Promise<number> {
  let removed = 0;
  while (true) {
    const { data, error } = await admin.rpc('list_user_owned_storage', {
      p_user_id: userId, p_limit: 100,
    });
    if (error || (data !== null && !Array.isArray(data))) {
      throw new Error('member_storage_list_failed');
    }
    const objects = (data ?? []) as Array<{ bucket_id?: unknown; name?: unknown }>;
    if (!objects.length) return removed;
    const byBucket = new Map<string, string[]>();
    for (const item of objects) {
      const bucket = text(item.bucket_id, 120);
      const name = text(item.name, 1000);
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
  const { data: revokedSessions, error: revokeError } = await admin.rpc('revoke_user_auth_sessions', {
    p_user_id: input.userId,
  });
  if (revokeError || !Number.isInteger(revokedSessions)) {
    throw new Error('member_sessions_revoke_failed');
  }
  const { data: finalized, error: finalizeError } = await admin.rpc('team_member_identity_erasure_finalize', {
    p_organization_id: input.organizationId,
    p_actor_id: input.actorId,
    p_user_id: input.userId,
  });
  if (finalizeError || finalized?.identity_deleted !== true) {
    throw new Error('member_identity_deletion_failed');
  }
  return { identity_deleted: true, storage_objects_deleted: storageObjectsDeleted,
    sessions_revoked: revokedSessions };
}

async function remove(input: { organizationId: string; actorId: string; userId: string }) {
  const expectedName = instanceNameFor(input.organizationId, input.userId);
  const [member, account, job, gateway] = await Promise.all([
    record('organization_members', { organization_id: input.organizationId, user_id: input.userId }, 'role,status'),
    record('whatsapp_accounts', { organization_id: input.organizationId, owner_user_id: input.userId,
      provider: 'evolution_go', account_type: 'seller', archived_at: null },
    'id,integration_id,provider_metadata,enabled,connection_status'),
    record('evolution_go_seller_provisioning_jobs', {
      organization_id: input.organizationId, user_id: input.userId,
    }, 'id,instance_name,integration_id,whatsapp_account_id'),
    gatewayFor(input.organizationId),
  ]);
  if (!member) {
    const claim = await record('team_member_evolution_removal_claims', {
      organization_id: input.organizationId, user_id: input.userId,
    }, 'state,instance_name');
    if (claim?.state !== 'finalized' || claim.instance_name !== expectedName) {
      throw new Error('member_not_found');
    }
    if (gateway && exactRemote(await listInstances(gateway), expectedName)) {
      throw new Error('member_remote_delete_not_confirmed');
    }
    return { membership_removed: true, instance_name: expectedName,
      history_preserved: true, identity_deleted: false };
  }
  if (text(job?.instance_name, 120) && job?.instance_name !== expectedName) {
    throw new Error('member_instance_identity_mismatch');
  }
  const accountInstanceName = text(object(account?.provider_metadata).instance_name, 120);
  if (accountInstanceName && accountInstanceName !== expectedName) {
    throw new Error('member_instance_identity_mismatch');
  }
  if (account) {
    const integrationId = text(account.integration_id, 80);
    if (!UUID.test(integrationId)) throw new Error('member_integration_not_individual');
    const integration = await record('integrations', {
      id: integrationId, organization_id: input.organizationId,
    }, 'key');
    const { data: otherAccounts, error: otherAccountsError } = await admin.from('whatsapp_accounts')
      .select('id').eq('integration_id', integrationId).neq('id', text(account.id, 80)).limit(1);
    if (integration?.key !== `whatsapp_evolution_go:${account.id}` || otherAccountsError ||
        (otherAccounts ?? []).length > 0 ||
        (job && (job.integration_id !== integrationId || job.whatsapp_account_id !== account.id))) {
      throw new Error('member_integration_not_individual');
    }
  }
  if (!gateway && (member.role === 'vendedor' || account || job)) {
    throw new Error('member_gateway_not_configured');
  }

  // A previous failed removal may have lost local account/job rows. The name is
  // deterministic from tenant + user, so a unique exact remote match is still
  // reconciled; no other instance can be selected by a browser-supplied value.
  let remote = gateway ? exactRemote(await listInstances(gateway), expectedName) : null;
  const claim = await claimRemoval({ ...input, instanceName: expectedName, remoteId: remote?.id ?? null });
  if (claim === 'claimed') {
    if (job) {
      const { error: jobError } = await admin.from('evolution_go_seller_provisioning_jobs')
        .update({ state: 'cancelled', last_error_code: 'member_removal_pending',
          completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', job.id).eq('organization_id', input.organizationId);
      if (jobError) throw new Error('member_provisioning_fence_failed');
    }
    if (account) {
      const integrationId = text(account.integration_id, 80);
      if (!UUID.test(integrationId)) throw new Error('member_integration_not_individual');
      const { error: integrationError } = await admin.from('integrations')
        .update({ enabled: false, connected: false, paused: true, updated_at: new Date().toISOString() })
        .eq('id', integrationId).eq('organization_id', input.organizationId);
      if (integrationError) throw new Error('member_route_disable_failed');
      const { error: accountError } = await admin.from('whatsapp_accounts')
        .update({ enabled: false, is_default: false, connection_status: 'disconnected',
          updated_at: new Date().toISOString() })
        .eq('id', account.id).eq('organization_id', input.organizationId);
      if (accountError) throw new Error('member_route_disable_failed');
    }
    if (remote && gateway) {
      try {
        await fetch(new URL(`/instance/delete/${encodeURIComponent(remote.id)}`, gateway.baseUrl), {
          method: 'DELETE', headers: { apikey: gateway.apiKey },
          signal: AbortSignal.timeout(20_000), redirect: 'error',
        });
      } catch { /* A single DELETE is issued; reconcile the authoritative list. */ }
    }
  }
  remote = gateway ? exactRemote(await listInstances(gateway), expectedName) : null;
  if (remote) throw new Error('member_remote_delete_not_confirmed');
  const { data: absence, error: absenceError } = await admin.from('team_member_evolution_removal_claims')
    .update({ state: 'remote_absent', updated_at: new Date().toISOString() })
    .eq('organization_id', input.organizationId).eq('user_id', input.userId)
    .in('state', ['claimed', 'remote_absent']).select('state').maybeSingle();
  if (absenceError || !absence) throw new Error('member_remote_absence_save_failed');
  const { data: result, error: finalizeError } = await admin.rpc('team_member_evolution_remove_finalize', {
    p_organization_id: input.organizationId, p_actor_id: input.actorId,
    p_user_id: input.userId, p_instance_name: expectedName,
  });
  if (finalizeError || result?.membership_removed !== true) {
    throw new Error('member_local_finalize_failed');
  }
  return result;
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
    const actor = await record('organization_members', {
      organization_id: organizationId, user_id: user.id,
    }, 'role,status');
    if (actor?.role !== 'administrador' || actor.status !== 'active') {
      throw new Error('member_removal_admin_required');
    }
    const input = { organizationId, actorId: user.id, userId };
    const { data: readiness, error: readinessError } = await admin.rpc('team_member_identity_erasure_preflight', {
      p_organization_id: organizationId, p_actor_id: user.id, p_user_id: userId,
    });
    if (readinessError || readiness?.ready !== true) {
      throw new Error('member_identity_erasure_preflight_failed');
    }
    const { data: sharedData, error: sharedDataError } = await admin.rpc('team_member_shared_data_preflight', {
      p_user_id: userId,
    });
    if (sharedDataError || sharedData?.ready !== true) {
      if (sharedDataError?.message?.includes('member_shared_company_data_requires_reassignment')) {
        throw new Error('member_shared_company_data_requires_reassignment');
      }
      throw new Error('member_shared_data_preflight_failed');
    }
    const removed = await remove(input);
    return json({ ok: true, ...removed, ...await eraseIdentity(input) }, 200, headers);
  } catch (error) {
    return json({ ok: false, erro: safeError(error) }, 409, headers);
  }
});
