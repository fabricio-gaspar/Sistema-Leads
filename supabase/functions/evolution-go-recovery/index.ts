import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

type Row = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown, max = 1000): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
const required = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
};
const admin = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});

function headersFor(origin: string | null): HeadersInit {
  const allowed = new Set((Deno.env.get('WAYFLEX_ALLOWED_ORIGINS') ||
    'http://127.0.0.1:4173,https://leadai-crm-preview.fabricio926564.chatgpt.site')
    .split(',').map((item) => item.trim()).filter(Boolean));
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...(origin && allowed.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS' } : {}),
  };
}

function result(status: number, body: Row, origin: string | null): Response {
  return new Response(JSON.stringify(body), { status, headers: headersFor(origin) });
}

async function userIdFor(request: Request): Promise<string> {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new Error('authentication_required');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error('invalid_session');
  return data.user.id;
}

async function one(table: string, filters: Record<string, string>, columns = '*'): Promise<Row> {
  let query = admin.from(table).select(columns);
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
  const { data, error } = await query.maybeSingle();
  if (error || !data) throw new Error(`${table}_record_missing`);
  return data as unknown as Row;
}

async function secretFor(integrationId: string): Promise<Row> {
  const { data, error } = await admin.rpc('read_integration_secret', { p_integration: integrationId });
  if (error || !data) throw new Error('recovery_secret_unavailable');
  return object(data);
}

async function gatewayFor(organizationId: string): Promise<{ baseUrl: string; apiKey: string }> {
  const corporate = await one('whatsapp_accounts', {
    organization_id: organizationId, provider: 'evolution_go', account_type: 'corporate',
  }, 'id,integration_id');
  const integrationId = text(corporate.integration_id, 80);
  if (!UUID.test(integrationId)) throw new Error('recovery_corporate_integration_missing');
  const integration = await one('integrations', { id: integrationId, organization_id: organizationId },
    'id,configuration');
  if (text(object(object(integration.configuration).server_validation).status, 30) !== 'passed') {
    throw new Error('recovery_server_validation_required');
  }
  const secret = await secretFor(integrationId);
  const input = text(secret.base_url, 500);
  const apiKey = text(secret.global_api_key, 1000);
  const url = new URL(input);
  const allowedOrigins = (Deno.env.get('EVOLUTION_GO_ALLOWED_ORIGINS') ||
    'https://evo-eisenflow.kz3solucoes.cloud').split(',').map((value) => value.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
    !allowedOrigins.includes(url.origin) || !apiKey) throw new Error('recovery_gateway_not_allowed');
  return { baseUrl: url.origin, apiKey };
}

async function providerRequest(baseUrl: string, apiKey: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(new URL(path, baseUrl), { ...init,
    headers: { apikey: apiKey, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    signal: AbortSignal.timeout(20_000), redirect: 'error' });
}

type RemoteInstance = { id: string; name: string; connected: boolean; jid: string | null };
async function remoteInstances(baseUrl: string, apiKey: string): Promise<RemoteInstance[]> {
  const response = await providerRequest(baseUrl, apiKey, '/instance/all');
  if (!response.ok) throw new Error(`recovery_list_http_${response.status}`);
  const payload = object(await response.json().catch(() => null));
  if (!Array.isArray(payload.data)) throw new Error('recovery_list_invalid');
  return payload.data.map((raw) => {
    const item = object(raw);
    return { id: text(item.id, 120), name: text(item.name, 120),
      connected: item.connected === true, jid: text(item.jid, 160) || null };
  });
}

function exactMatch(instances: RemoteInstance[], name: string): RemoteInstance | null {
  const matches = instances.filter((instance) => instance.name === name);
  if (matches.length > 1) throw new Error('recovery_duplicate_remote_name');
  return matches[0] ?? null;
}

async function instanceTokenAccepted(baseUrl: string, token: string): Promise<boolean> {
  const response = await providerRequest(baseUrl, token, '/instance/status');
  return response.ok;
}

async function audit(organizationId: string, actorId: string, accountId: string, action: string, data: Row): Promise<void> {
  const { error } = await admin.from('audit_logs').insert({ organization_id: organizationId,
    actor_id: actorId, actor_name: 'Administrador', actor_type: 'user', action,
    detail: 'Recuperação administrativa de instância individual Evolution GO.',
    entity_table: 'whatsapp_accounts', entity_id: accountId,
    event_data: { provider: 'evolution_go', ...data } });
  if (error) throw new Error('recovery_audit_failed');
}

async function scopedRecords(accountId: string, actorId: string) {
  const account = await one('whatsapp_accounts', { id: accountId, provider: 'evolution_go', account_type: 'seller' },
    'id,organization_id,owner_user_id,integration_id,enabled,connection_status,archived_at,provider_metadata');
  const organizationId = text(account.organization_id, 80);
  const ownerUserId = text(account.owner_user_id, 80);
  const integrationId = text(account.integration_id, 80);
  if (!UUID.test(organizationId) || !UUID.test(ownerUserId) || !UUID.test(integrationId) || account.archived_at) {
    throw new Error('recovery_account_scope_invalid');
  }
  const [actor, owner, integration, job] = await Promise.all([
    one('organization_members', { organization_id: organizationId, user_id: actorId }, 'role,status'),
    one('organization_members', { organization_id: organizationId, user_id: ownerUserId }, 'role,status'),
    one('integrations', { id: integrationId, organization_id: organizationId },
      'id,enabled,connected,paused,configuration'),
    one('evolution_go_seller_provisioning_jobs', { organization_id: organizationId,
      user_id: ownerUserId, whatsapp_account_id: accountId, integration_id: integrationId },
      'id,state,instance_name,last_error_code'),
  ]);
  if (actor.role !== 'administrador' || actor.status !== 'active') throw new Error('recovery_admin_required');
  if (owner.status !== 'active' || owner.role !== 'vendedor') throw new Error('recovery_owner_not_active');
  if (account.enabled === true || account.connection_status === 'connected' ||
    integration.enabled === true || integration.connected === true || integration.paused !== true) {
    throw new Error('recovery_channel_must_be_disabled');
  }
  const instanceName = text(job.instance_name, 120);
  if (!/^wf-[0-9a-f]{12}-[0-9a-f]{12}$/.test(instanceName)) throw new Error('recovery_instance_name_invalid');
  return { account, integration, job, organizationId, integrationId, instanceName, ownerUserId };
}

function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function replaceInstance(accountId: string, actorId: string, expectedName: string, expectedRemoteId: string) {
  const scope = await scopedRecords(accountId, actorId);
  if (scope.instanceName !== expectedName || scope.job.state !== 'awaiting_qr') {
    throw new Error('recovery_stale_intent');
  }
  const gateway = await gatewayFor(scope.organizationId);
  const oldSecret = await secretFor(scope.integrationId);
  if (text(oldSecret.base_url, 500).replace(/\/$/, '') !== gateway.baseUrl ||
    text(oldSecret.instance_name, 120) !== scope.instanceName) {
    throw new Error('recovery_gateway_mismatch');
  }
  const remote = exactMatch(await remoteInstances(gateway.baseUrl, gateway.apiKey), scope.instanceName);
  if (!remote || remote.id !== expectedRemoteId || !UUID.test(remote.id) || remote.connected || remote.jid) {
    throw new Error('recovery_remote_state_changed');
  }
  if (await instanceTokenAccepted(gateway.baseUrl, text(oldSecret.instance_token, 1000))) {
    throw new Error('recovery_token_already_valid');
  }
  await audit(scope.organizationId, actorId, accountId, 'whatsapp.evolution_go_replacement_started',
    { instance_name: scope.instanceName, old_provider_id: remote.id });
  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin.from('evolution_go_seller_provisioning_jobs')
    .update({ state: 'needs_review', last_error_code: 'recovery_delete_pending', updated_at: now })
    .eq('id', scope.job.id).eq('state', 'awaiting_qr').select('id').maybeSingle();
  if (claimError || !claimed) throw new Error('recovery_claim_conflict');

  // A DELETE or POST is never retried. On an uncertain result, reconcile by
  // listing the provider and leave the durable job in needs_review if unclear.
  let deleteSucceeded = false;
  try {
    const response = await providerRequest(gateway.baseUrl, gateway.apiKey,
      `/instance/delete/${encodeURIComponent(remote.id)}`, { method: 'DELETE' });
    deleteSucceeded = response.ok;
  } catch { /* Check the authoritative list below. */ }
  const afterDelete = exactMatch(await remoteInstances(gateway.baseUrl, gateway.apiKey), scope.instanceName);
  if (afterDelete) throw new Error(deleteSucceeded ? 'recovery_delete_not_confirmed' : 'recovery_delete_uncertain');
  const { data: deletedState, error: deletedStateError } = await admin.from('evolution_go_seller_provisioning_jobs')
    .update({ last_error_code: 'recovery_deleted_create_pending', updated_at: new Date().toISOString() })
    .eq('id', scope.job.id).eq('state', 'needs_review').eq('last_error_code', 'recovery_delete_pending')
    .select('id').maybeSingle();
  if (deletedStateError || !deletedState) throw new Error('recovery_deleted_state_save_failed');

  const newToken = randomToken();
  const nextSecret = { ...oldSecret, base_url: gateway.baseUrl, instance_name: scope.instanceName,
    instance_id: null, instance_token: newToken, webhook_secret: randomToken() };
  const { error: secretError } = await admin.rpc('store_integration_secret', {
    p_integration: scope.integrationId, p_secret: nextSecret });
  if (secretError) throw new Error('recovery_new_secret_save_failed');
  const storedNewToken = await secretFor(scope.integrationId);
  if (storedNewToken.instance_token !== newToken || text(storedNewToken.instance_id) !== '') {
    throw new Error('recovery_new_secret_unconfirmed');
  }
  const { data: createIntent, error: intentError } = await admin.from('evolution_go_seller_provisioning_jobs')
    .update({ last_error_code: 'recovery_create_pending', updated_at: new Date().toISOString() })
    .eq('id', scope.job.id).eq('state', 'needs_review').eq('last_error_code', 'recovery_deleted_create_pending')
    .select('id').maybeSingle();
  if (intentError || !createIntent) throw new Error('recovery_create_intent_save_failed');

  try {
    await providerRequest(gateway.baseUrl, gateway.apiKey, '/instance/create', { method: 'POST',
      body: JSON.stringify({ name: scope.instanceName, token: newToken }) });
  } catch { /* One POST only; reconcile the result below. */ }
  const created = exactMatch(await remoteInstances(gateway.baseUrl, gateway.apiKey), scope.instanceName);
  if (!created || !created.id || !(await instanceTokenAccepted(gateway.baseUrl, newToken))) {
    throw new Error('recovery_create_unconfirmed');
  }
  const { error: finalSecretError } = await admin.rpc('store_integration_secret', {
    p_integration: scope.integrationId, p_secret: { ...nextSecret, instance_id: created.id } });
  if (finalSecretError) throw new Error('recovery_instance_id_save_failed');
  const finalSecret = await secretFor(scope.integrationId);
  if (finalSecret.instance_token !== newToken || finalSecret.instance_id !== created.id) {
    throw new Error('recovery_instance_id_unconfirmed');
  }
  const persistedIntegration = await one('integrations', { id: scope.integrationId, organization_id: scope.organizationId },
    'configuration');
  const { error: integrationError } = await admin.from('integrations').update({ enabled: false, connected: false,
    paused: true, last_error: null, status_detail: 'Nova instância criada; vendedor deve conectar e escanear o QR.',
    configuration: { ...object(persistedIntegration.configuration), configured: true,
      base_url_configured: true, instance_name: scope.instanceName, provider_version: '0.7.2',
      provisioning_state: 'awaiting_qr' }, updated_at: new Date().toISOString() })
    .eq('id', scope.integrationId).eq('organization_id', scope.organizationId);
  if (integrationError) throw new Error('recovery_integration_save_failed');
  const { error: accountError } = await admin.from('whatsapp_accounts').update({ enabled: false,
    connection_status: 'configured', status_checked_at: null, webhook_registered_at: null,
    connected_at: null, connected_phone_suffix: null, last_error_code: null,
    provider_metadata: { ...object(scope.account.provider_metadata), provider_version: '0.7.2',
      instance_name: scope.instanceName },
    updated_at: new Date().toISOString() }).eq('id', accountId).eq('organization_id', scope.organizationId);
  if (accountError) throw new Error('recovery_account_save_failed');
  const { data: finished, error: jobError } = await admin.from('evolution_go_seller_provisioning_jobs')
    .update({ state: 'awaiting_qr', last_error_code: null, processing_started_at: null,
      completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', scope.job.id).eq('state', 'needs_review').eq('last_error_code', 'recovery_create_pending')
    .select('id').maybeSingle();
  if (jobError || !finished) throw new Error('recovery_job_finish_failed');
  await audit(scope.organizationId, actorId, accountId, 'whatsapp.evolution_go_replacement_completed',
    { instance_name: scope.instanceName, old_provider_id: remote.id, new_provider_id: created.id });
  return { ok: true, instance_name: scope.instanceName, provider_id: created.id,
    token_confirmed: true, connection_status: 'configured', messaging_enabled: false };
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headersFor(origin) });
  if (request.method !== 'POST') return result(405, { ok: false, error: 'method_not_allowed' }, origin);
  try {
    const actorId = await userIdFor(request);
    const body = object(await request.json().catch(() => null));
    const accountId = text(body.account_id, 80);
    if (!UUID.test(accountId)) throw new Error('recovery_account_id_required');
    const scope = await scopedRecords(accountId, actorId);
    const gateway = await gatewayFor(scope.organizationId);
    if (body.action === 'inspect') {
      const current = exactMatch(await remoteInstances(gateway.baseUrl, gateway.apiKey), scope.instanceName);
      const secret = await secretFor(scope.integrationId);
      return result(200, { ok: true, instance_name: scope.instanceName, job_state: scope.job.state,
        provider_id: current?.id ?? null, provider_connected: current?.connected ?? false,
        stored_id_matches: current?.id === text(secret.instance_id, 120),
        token_accepted: current ? await instanceTokenAccepted(gateway.baseUrl,
          text(secret.instance_token, 1000)) : false }, origin);
    }
    if (body.action !== 'replace') throw new Error('unsupported_action');
    const expectedName = text(body.confirm_instance_name, 120);
    const expectedRemoteId = text(body.confirm_remote_id, 120);
    if (expectedName !== scope.instanceName || !UUID.test(expectedRemoteId)) throw new Error('recovery_confirmation_required');
    return result(200, await replaceInstance(accountId, actorId, expectedName, expectedRemoteId), origin);
  } catch (error) {
    const code = error instanceof Error && /^[a-z][a-z0-9_]{2,100}$/.test(error.message)
      ? error.message : 'recovery_unexpected_failure';
    return result(code === 'authentication_required' || code === 'invalid_session' ? 401 : 409,
      { ok: false, error: code }, origin);
  }
});
