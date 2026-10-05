import {
  createAdminClient,
  hasOrganizationPermission,
  requireUser,
} from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';
import { EvolutionGoProvider, normalizeEvolutionGoBaseUrl } from '../_shared/messaging/EvolutionGoProvider.ts';
import { accountLifecycleStatus, runAccountLifecycle, setAccountProviderControls, type LifecycleStep } from '../_shared/accountLifecycle.ts';

type Admin = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;
type AccountType = 'corporate' | 'seller';

type ActorContext = {
  organizationId: string;
  actorName: string;
  userId: string;
  canManage: boolean;
  canViewOwn: boolean;
  canConnectOwn: boolean;
};

type AccountRecord = {
  account: Row;
  integration: Row;
  controls: Row | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACCOUNT_ACTIONS = new Set([
  'connect', 'qr', 'pair', 'refresh_status', 'reconnect', 'disconnect', 'logout', 'activate', 'deactivate',
]);
const text = (value: unknown, max = 1_000): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const uuid = (value: unknown): string => {
  const candidate = text(value, 80);
  return UUID.test(candidate) ? candidate : '';
};

/**
 * The provisioned Evolution GO tenant for this CRM. An environment override
 * is supported for infrastructure changes, but the function stays fail-closed
 * to every origin except a tenant explicitly approved by the administrator.
 */
const PROVISIONED_EVOLUTION_GO_ORIGIN = 'https://evo-eisenflow.kz3solucoes.cloud';

function allowedOrigins(): string[] {
  const configured = (Deno.env.get('EVOLUTION_GO_ALLOWED_ORIGINS') ?? '')
    .split(',').map((value) => value.trim()).filter(Boolean);
  return configured.length ? configured : [PROVISIONED_EVOLUTION_GO_ORIGIN];
}

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function phoneSuffix(value: string | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

function callbackUrl(integrationId: string, webhookSecret: string): string {
  const url = new URL(`${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-evolution-go`);
  url.searchParams.set('integration_id', integrationId);
  url.searchParams.set('token', webhookSecret);
  return url.toString();
}

async function context(admin: Admin, userId: string): Promise<ActorContext> {
  const { data: profile, error } = await admin.from('profiles')
    .select('active_organization_id,name').eq('id', userId).maybeSingle();
  if (error || !profile?.active_organization_id) throw new Error('organization_context_required');
  const organizationId = String(profile.active_organization_id);
  const { data: membership, error: membershipError } = await admin.from('organization_members')
    .select('status').eq('organization_id', organizationId).eq('user_id', userId).maybeSingle();
  if (membershipError || !membership || membership.status !== 'active') throw new Error('organization_access_denied');
  const [manageAll, manageConfiguration, canViewOwn, canConnectOwn] = await Promise.all([
    hasOrganizationPermission(admin, organizationId, userId, 'channels.manage_all'),
    hasOrganizationPermission(admin, organizationId, userId, 'configuration.manage'),
    hasOrganizationPermission(admin, organizationId, userId, 'channels.view_own'),
    hasOrganizationPermission(admin, organizationId, userId, 'channels.connect_own'),
  ]);
  return {
    organizationId,
    actorName: text(profile.name, 160) || 'Usuário',
    userId,
    canManage: manageAll || manageConfiguration,
    canViewOwn,
    canConnectOwn,
  };
}

function accountType(account: Row): AccountType {
  return account.account_type === 'seller' ? 'seller' : 'corporate';
}

function isOwner(account: Row, actor: ActorContext): boolean {
  return accountType(account) === 'seller' && String(account.owner_user_id ?? '') === actor.userId;
}

function canView(account: Row, actor: ActorContext): boolean {
  if (actor.canManage) return true;
  // Match the canonical whatsapp_accounts RLS contract: the shared corporate
  // account is the selected default; non-default corporate candidates remain
  // administrative until promoted.
  if (accountType(account) === 'corporate') return account.is_default === true;
  return isOwner(account, actor) && actor.canViewOwn;
}

function canConnect(account: Row, actor: ActorContext): boolean {
  if (actor.canManage) return true;
  return isOwner(account, actor) && actor.canConnectOwn;
}

function accessFlags(account: Row, actor: ActorContext) {
  const connect = canConnect(account, actor);
  return { canManage: actor.canManage, canConnect: connect, canViewQr: connect };
}

async function secretFor(admin: Admin, integrationId: string): Promise<Row> {
  const { data, error } = await admin.rpc('read_integration_secret', { p_integration: integrationId });
  if (error) throw new Error('evolution_go_secret_read_failed');
  return object(data);
}

async function recordFor(admin: Admin, organizationId: string, accountId: string): Promise<AccountRecord | null> {
  const { data: account, error } = await admin.from('whatsapp_accounts')
    .select('id,integration_id,owner_user_id,label,provider,account_type,enabled,is_default,connection_status,connected_phone_suffix,connected_at,status_checked_at,webhook_registered_at,last_error_code,provider_metadata,created_at')
    .eq('id', accountId).eq('organization_id', organizationId).eq('provider', 'evolution_go')
    .is('archived_at', null).maybeSingle();
  if (error) throw new Error('evolution_go_account_lookup_failed');
  if (!account) return null;
  const { data: integration, error: integrationError } = await admin.from('integrations')
    .select('id,key,label,provider,connected,enabled,paused,last_tested_at,last_success_at,last_error,status_detail,configuration')
    .eq('id', account.integration_id).eq('organization_id', organizationId).maybeSingle();
  if (integrationError || !integration) throw new Error('evolution_go_integration_lookup_failed');
  const integrationProvider = text(integration.provider, 80).toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (integrationProvider !== 'evolution_go') throw new Error('evolution_go_integration_lookup_failed');
  const { data: controls, error: controlsError } = await admin.from('messaging_provider_controls')
    .select('inbound_enabled,send_enabled,automation_enabled,kill_switch,reason,updated_at')
    .eq('organization_id', organizationId).eq('provider', 'evolution_go').maybeSingle();
  if (controlsError) throw new Error('evolution_go_control_lookup_failed');
  return { account, integration, controls };
}

async function accessibleRecord(
  admin: Admin,
  actor: ActorContext,
  accountId: string,
  access: 'view' | 'connect' | 'manage',
): Promise<AccountRecord> {
  if (!accountId) throw new Error('evolution_go_account_required');
  const record = await recordFor(admin, actor.organizationId, accountId);
  // Private seller accounts are non-enumerable: an inaccessible id is
  // indistinguishable from an absent or cross-organization account.
  if (!record) throw new Error('evolution_go_account_not_found');
  const allowed = access === 'manage'
    ? actor.canManage
    : access === 'connect'
      ? canConnect(record.account, actor)
      : canView(record.account, actor);
  if (!allowed) throw new Error('evolution_go_account_not_found');
  return record;
}

async function listRecords(admin: Admin, actor: ActorContext): Promise<AccountRecord[]> {
  let query = admin.from('whatsapp_accounts')
    .select('id,owner_user_id,account_type,is_default')
    .eq('organization_id', actor.organizationId).eq('provider', 'evolution_go').is('archived_at', null)
    .order('is_default', { ascending: false }).order('label');
  if (!actor.canManage) {
    query = query.or(`and(account_type.eq.corporate,is_default.eq.true),owner_user_id.eq.${actor.userId}`);
  }
  const { data: accounts, error } = await query;
  if (error) throw new Error('evolution_go_accounts_lookup_failed');
  const records = await Promise.all((accounts ?? [])
    .filter((account) => canView(object(account), actor))
    .map((account) => recordFor(admin, actor.organizationId, String(account.id))));
  return records.filter((record): record is AccountRecord => Boolean(record));
}

/**
 * Self-service must never inherit the administrator's broader list scope.
 * This lookup is intentionally separate from listRecords: even an
 * administrator opening "Meu WhatsApp" receives at most the seller account
 * owned by their authenticated identity, never the corporate/default account
 * or another seller's account.
 */
async function ownSellerRecord(admin: Admin, actor: ActorContext): Promise<AccountRecord | null> {
  if (!actor.canViewOwn && !actor.canManage) return null;
  const { data: account, error } = await admin.from('whatsapp_accounts')
    .select('id')
    .eq('organization_id', actor.organizationId)
    .eq('provider', 'evolution_go')
    .eq('account_type', 'seller')
    .eq('owner_user_id', actor.userId)
    .is('archived_at', null)
    .maybeSingle();
  if (error) throw new Error('evolution_go_own_account_lookup_failed');
  return account ? recordFor(admin, actor.organizationId, String(account.id)) : null;
}

async function createRecord(
  admin: Admin,
  actor: ActorContext,
  input: { accountId: string; type: AccountType; ownerUserId: string | null; label: string },
): Promise<AccountRecord> {
  const integrationId = crypto.randomUUID();
  const { error: integrationError } = await admin.from('integrations').insert({
    id: integrationId,
    organization_id: actor.organizationId,
    key: `whatsapp_evolution_go:${input.accountId}`,
    label: input.label,
    provider: 'Evolution GO',
    category: 'communication',
    connected: false,
    enabled: false,
    paused: true,
    mode: 'real',
    status_detail: 'Canal Evolution GO criado; aguardando provisionamento seguro e validação.',
    configuration: { configured: false, provider_version: '0.7.2' },
  });
  if (integrationError) throw new Error('evolution_go_integration_create_failed');
  const { error: accountError } = await admin.from('whatsapp_accounts').insert({
    id: input.accountId,
    organization_id: actor.organizationId,
    integration_id: integrationId,
    owner_user_id: input.type === 'seller' ? input.ownerUserId : null,
    label: input.label,
    provider: 'evolution_go',
    account_type: input.type,
    is_default: false,
    enabled: false,
    connection_status: 'unconfigured',
    created_by: actor.userId,
    provider_metadata: { provider_version: '0.7.2' },
  });
  if (accountError) {
    await admin.from('integrations').delete().eq('id', integrationId).eq('organization_id', actor.organizationId);
    if (accountError.code === '23505') throw new Error('evolution_go_account_already_exists');
    throw new Error('evolution_go_account_create_failed');
  }
  const { error: controlError } = await admin.from('messaging_provider_controls').upsert({
    organization_id: actor.organizationId,
    provider: 'evolution_go',
    inbound_enabled: false,
    send_enabled: false,
    automation_enabled: false,
    kill_switch: true,
    reason: 'provider_not_validated',
    changed_by: actor.userId,
  }, { onConflict: 'organization_id,provider', ignoreDuplicates: true });
  if (controlError) throw new Error('evolution_go_control_save_failed');
  const record = await recordFor(admin, actor.organizationId, input.accountId);
  if (!record) throw new Error('evolution_go_record_missing');
  return record;
}

function publicStatus(record: AccountRecord, actor: ActorContext) {
  const configuration = object(record.integration.configuration);
  const controls = record.controls ?? {
    inbound_enabled: false,
    send_enabled: false,
    automation_enabled: false,
    kill_switch: true,
    reason: 'provider_not_configured',
  };
  return {
    configured: configuration.configured === true,
    account: {
      id: record.account.id,
      ownerUserId: record.account.owner_user_id ?? null,
      accountType: accountType(record.account),
      label: record.account.label,
      enabled: record.account.enabled === true,
      isDefault: record.account.is_default === true,
      connectionStatus: record.account.connection_status,
      phoneSuffix: record.account.connected_phone_suffix ?? null,
      connectedAt: record.account.connected_at ?? null,
      checkedAt: record.account.status_checked_at ?? null,
      webhookRegisteredAt: record.account.webhook_registered_at ?? null,
      errorCode: record.account.last_error_code ?? null,
    },
    integration: {
      id: record.integration.id,
      connected: record.integration.connected === true,
      enabled: record.integration.enabled === true,
      paused: record.integration.paused === true,
      statusDetail: record.integration.status_detail ?? null,
      lastTestedAt: record.integration.last_tested_at ?? null,
      lastSuccessAt: record.integration.last_success_at ?? null,
      // Free-form provider errors are deliberately not returned because a
      // legacy value could contain request material. The account error code is
      // the only public diagnostic identifier.
      lastError: record.account.last_error_code ?? null,
      baseUrlConfigured: Boolean(configuration.base_url_configured),
      instanceName: configuration.instance_name ?? null,
      version: configuration.provider_version ?? null,
    },
    controls: {
      inboundEnabled: controls.inbound_enabled === true,
      sendEnabled: controls.send_enabled === true,
      automationEnabled: controls.automation_enabled === true,
      killSwitch: controls.kill_switch === true,
      reason: controls.reason ?? null,
    },
    ...accessFlags(record.account, actor),
  };
}

function noSelfServiceAccount() {
  return {
    configured: false,
    account: null,
    integration: null,
    controls: null,
    // This endpoint is purpose-built for self-service.  Do not let a manager
    // mode accidentally activate the administration UI in Meu WhatsApp.
    canManage: false,
    canConnect: false,
    canViewQr: false,
  };
}

async function audit(admin: Admin, input: {
  organizationId: string;
  userId: string;
  actorName: string;
  action: string;
  entityId: string;
  detail: string;
  data?: Row;
}) {
  const { error } = await admin.from('audit_logs').insert({
    organization_id: input.organizationId,
    actor_id: input.userId,
    actor_name: input.actorName,
    actor_type: 'user',
    action: input.action,
    detail: input.detail,
    entity_table: 'whatsapp_accounts',
    entity_id: input.entityId,
    event_data: { provider: 'evolution_go', ...(input.data ?? {}) },
  });
  if (error) console.error('evolution_go_audit_failed', { action: input.action, accountId: input.entityId });
}

function providerFrom(secret: Row): EvolutionGoProvider {
  const baseUrl = text(secret.base_url, 500);
  const instanceToken = text(secret.instance_token, 1_000);
  const timeoutRaw = Number(secret.timeout_ms);
  if (!baseUrl || !instanceToken) throw new Error('evolution_go_credentials_incomplete');
  return new EvolutionGoProvider({
    baseUrl,
    instanceToken,
    allowedOrigins: allowedOrigins(),
    timeoutMs: Number.isInteger(timeoutRaw) ? timeoutRaw : undefined,
  });
}

/**
 * Start (or refresh) the unauthenticated connection flow before obtaining a
 * QR/pairing code. Evolution GO 0.7.x deliberately reports both flags as
 * false while its WhatsApp socket is being created. Treating that transient
 * status as a failure prevented the subsequent QR endpoint from ever being
 * called. The QR and pairing endpoints are the authoritative readiness check:
 * they return a usable credential only once the runtime is actually ready.
 */
async function prepareUnauthenticatedRuntime(
  provider: EvolutionGoProvider,
  webhookUrl: string,
  step: LifecycleStep,
): Promise<'ready' | 'already_connected'> {
  const before = await step(() => provider.status());
  if (before.loggedIn) return 'already_connected';

  await step(() => provider.connect({
    webhookUrl,
    subscribe: true,
    immediate: false,
  }), true);
  return 'ready';
}

const QR_STARTUP_RETRY_DELAY_MS = 1_500;
const QR_STARTUP_MAX_ATTEMPTS = 5;

/**
 * The GO service can acknowledge `/instance/connect` before its WhatsApp
 * client has produced the first code. During that short window it returns a
 * retryable 400 from the read-only QR endpoint. Retrying this GET is safe and
 * avoids making an operator manually race the provider's startup sequence.
 */
async function freshQr(provider: EvolutionGoProvider, webhookUrl: string, step: LifecycleStep) {
  let lastError: unknown;
  for (let attempt = 0; attempt < QR_STARTUP_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await step(() => provider.qr());
    } catch (error) {
      lastError = error;
      if (safeError(error) !== 'evolution_go_request_rejected_400' || attempt + 1 === QR_STARTUP_MAX_ATTEMPTS) throw error;
      if (attempt === 0) {
        // A stale, pre-connection client can keep returning a retryable QR
        // error indefinitely. Reset it once, then restore the webhook before
        // polling again. This is scoped to the current seller instance.
        await step(() => provider.reconnect(), true);
        await step(() => provider.connect({ webhookUrl, subscribe: true, immediate: false }), true);
      }
      await new Promise<void>((resolve) => setTimeout(resolve, QR_STARTUP_RETRY_DELAY_MS));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('evolution_go_qr_unavailable');
}

/** Creates an Evolution GO instance once. Deliberately never retries a POST: an
 * uncertain response must be investigated instead of risking a second session. */
async function createInstance(body: Row, existingSecret: Row, defaultName: string) {
  const baseUrlInput = text(body.base_url, 500)
    || text(existingSecret.base_url, 500)
    || text(Deno.env.get('EVOLUTION_GO_BASE_URL'), 500);
  const globalApiKey = text(body.global_api_key, 1_000)
    || text(existingSecret.global_api_key, 1_000)
    || text(Deno.env.get('EVOLUTION_GO_GLOBAL_API_KEY'), 1_000);
  const instanceName = text(body.instance_name, 120) || text(existingSecret.instance_name, 120) || defaultName;
  if (!baseUrlInput || !globalApiKey || !instanceName) throw new Error('evolution_go_instance_create_credentials_required');
  const baseUrl = normalizeEvolutionGoBaseUrl(baseUrlInput, allowedOrigins());
  const instanceToken = randomSecret();
  const response = await fetch(new URL('/instance/create', baseUrl), {
    method: 'POST',
    headers: { apikey: globalApiKey, 'Content-Type': 'application/json' },
    // Evolution GO creates the identifier itself. Sending a locally-generated
    // identifier or an unsupported advanced-settings object can make a valid
    // creation look failed, leaving an orphaned remote instance behind.
    body: JSON.stringify({ name: instanceName, token: instanceToken }),
    signal: AbortSignal.timeout(20_000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`evolution_go_instance_create_${response.status}`);
  const payload = object(await response.json().catch(() => null));
  const created = object(payload.data);
  // Current Evolution GO versions return `data.id`; compatible versions can
  // use the instance name for administration. Never persist a random local
  // UUID instead of the provider's identifier.
  const instanceId = text(created.id, 120) || text(created.instance_id, 120)
    || text(created.instanceId, 120) || text(created.name, 120) || instanceName;
  return {
    base_url: baseUrl,
    global_api_key: globalApiKey,
    instance_name: instanceName,
    instance_id: instanceId,
    instance_token: instanceToken,
  };
}

async function saveConfiguration(admin: Admin, body: Row, actor: ActorContext, record: AccountRecord) {
  const label = text(body.label, 120) || text(record.account.label, 120) || 'WhatsApp Evolution GO';
  const existing = await secretFor(admin, String(record.integration.id));
  const baseUrlInput = text(body.base_url, 500)
    || text(existing.base_url, 500)
    || text(Deno.env.get('EVOLUTION_GO_BASE_URL'), 500);
  const globalApiKey = text(body.global_api_key, 1_000)
    || text(existing.global_api_key, 1_000)
    || text(Deno.env.get('EVOLUTION_GO_GLOBAL_API_KEY'), 1_000);
  const instanceToken = text(body.instance_token, 1_000) || text(existing.instance_token, 1_000);
  const instanceName = text(body.instance_name, 120) || text(existing.instance_name, 120) || label;
  const instanceId = text(body.instance_id, 120) || text(existing.instance_id, 120);
  const timeoutMs = Math.min(Math.max(Number(body.timeout_ms ?? existing.timeout_ms ?? 12_000), 2_000), 30_000);
  const retryAttempts = Math.min(Math.max(Number(body.retry_attempts ?? existing.retry_attempts ?? 0), 0), 3);
  if (!baseUrlInput || !globalApiKey || !instanceToken || !instanceName) throw new Error('evolution_go_credentials_required');
  const baseUrl = normalizeEvolutionGoBaseUrl(baseUrlInput, allowedOrigins());
  const webhookSecret = text(existing.webhook_secret, 256) || randomSecret();
  const credentials = {
    base_url: baseUrl,
    global_api_key: globalApiKey,
    instance_token: instanceToken,
    instance_name: instanceName,
    instance_id: instanceId || null,
    webhook_secret: webhookSecret,
    timeout_ms: timeoutMs,
    retry_attempts: retryAttempts,
  };
  const { error: secretError } = await admin.rpc('store_integration_secret', {
    p_integration: record.integration.id,
    p_secret: credentials,
  });
  if (secretError) throw new Error('evolution_go_credentials_save_failed');
  // `store_integration_secret` owns the Vault reference in this JSON column.
  // Read it back before adding display-only metadata so the reference is never lost.
  const { data: storedIntegration, error: storedIntegrationError } = await admin.from('integrations')
    .select('configuration').eq('id', record.integration.id).eq('organization_id', actor.organizationId).maybeSingle();
  if (storedIntegrationError || !storedIntegration) throw new Error('evolution_go_secret_reference_read_failed');
  const persistedConfiguration = object(storedIntegration.configuration);
  const now = new Date().toISOString();
  const { error: integrationError } = await admin.from('integrations').update({
    label,
    connected: false,
    enabled: false,
    paused: true,
    last_error: null,
    last_error_at: null,
    status_detail: 'Credenciais armazenadas no cofre; conecte a instância e valide os callbacks antes de ativar.',
    configuration: {
      ...persistedConfiguration,
      configured: true,
      base_url_configured: true,
      instance_name: instanceName,
      provider_version: '0.7.2',
      timeout_ms: timeoutMs,
      retry_attempts: retryAttempts,
    },
    updated_at: now,
  }).eq('id', record.integration.id).eq('organization_id', actor.organizationId);
  const { error: accountError } = await admin.from('whatsapp_accounts').update({
    label,
    enabled: false,
    is_default: false,
    connection_status: 'configured',
    status_checked_at: null,
    webhook_registered_at: null,
    last_error_code: null,
    provider_metadata: { provider_version: '0.7.2', instance_name: instanceName },
    updated_at: now,
  }).eq('id', record.account.id).eq('organization_id', actor.organizationId);
  if (integrationError || accountError) {
    throw new Error('evolution_go_configuration_state_save_failed');
  }
  return await recordFor(admin, actor.organizationId, String(record.account.id));
}


Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, error: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, headers);
  let action = '';
  try {
    const body = object(await request.json().catch(() => ({})));
    action = text(body.action, 80);
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const actor = await context(admin, user.id);

    if (action === 'list') {
      const records = await listRecords(admin, actor);
      const accounts = await Promise.all(records.map(async (record) => ({ ...publicStatus(record, actor),
        lifecycle: await accountLifecycleStatus(admin, { organizationId: actor.organizationId,
          accountId: String(record.account.id), provider: 'evolution_go', actorId: actor.userId }) })));
      return json({
        ok: true,
        accounts,
        canManage: actor.canManage,
      }, 200, headers);
    }

    if (action === 'my_account') {
      const record = await ownSellerRecord(admin, actor);
      const status = record
        ? { ...publicStatus(record, actor), canManage: false }
        : noSelfServiceAccount();
      const lifecycle = record ? await accountLifecycleStatus(admin, { organizationId: actor.organizationId,
        accountId: String(record.account.id), provider: 'evolution_go', actorId: actor.userId }) : null;
      return json({ ok: true, ...status, lifecycle }, 200, headers);
    }

    const accountId = uuid(body.account_id);
    if (!accountId) throw new Error('evolution_go_account_required');

    if (action === 'create_account') {
      if (!actor.canManage) throw new Error('permission_denied');
      if (await recordFor(admin, actor.organizationId, accountId)) throw new Error('evolution_go_account_already_exists');
      const type = body.account_type === 'seller' ? 'seller' : body.account_type === 'corporate' ? 'corporate' : '';
      if (!type) throw new Error('evolution_go_account_type_required');
      const ownerUserId = type === 'seller' ? uuid(body.owner_user_id) : null;
      if (type === 'seller' && !ownerUserId) throw new Error('evolution_go_account_owner_required');
      if (ownerUserId) {
        const { data: owner, error: ownerError } = await admin.from('organization_members')
          .select('status').eq('organization_id', actor.organizationId).eq('user_id', ownerUserId).maybeSingle();
        if (ownerError || !owner || owner.status !== 'active') throw new Error('evolution_go_account_owner_inactive');
      }
      const label = text(body.label, 120)
        || (type === 'seller' ? 'WhatsApp Evolution GO pessoal' : 'WhatsApp Evolution GO corporativo');
      const record = await createRecord(admin, actor, { accountId, type, ownerUserId, label });
      await audit(admin, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        actorName: actor.actorName,
        action: 'whatsapp.evolution_go_account_created',
        entityId: accountId,
        detail: type === 'seller'
          ? 'Conta Evolution GO privada criada para o proprietário informado.'
          : 'Conta Evolution GO corporativa compartilhada criada.',
        data: { account_type: type, owner_user_id: ownerUserId },
      });
      return json({ ok: true, ...publicStatus(record, actor) }, 200, headers);
    }

    if (action === 'status') {
      const record = await accessibleRecord(admin, actor, accountId, 'view');
      const lifecycle = await accountLifecycleStatus(admin, { organizationId: actor.organizationId, accountId, provider: 'evolution_go', actorId: actor.userId });
      return json({ ok: true, ...publicStatus(record, actor), lifecycle }, 200, headers);
    }

    if (action === 'save' || action === 'create_instance') {
      const current = await accessibleRecord(admin, actor, accountId, 'manage');
      const result = await runAccountLifecycle(admin, { organizationId: actor.organizationId, accountId,
        provider: 'evolution_go', actorId: actor.userId }, action, async (step) => {
        let configuration = body;
        if (action === 'create_instance') {
          const existingSecret = await secretFor(admin, String(current.integration.id));
          const created = await step(() => createInstance(body, existingSecret,
            text(current.account.label, 120) || 'WhatsApp Evolution GO'), true);
          configuration = { ...body, ...created };
        }
        const saved = await step(() => saveConfiguration(admin, configuration, actor, current));
        if (!saved) throw new Error('evolution_go_record_missing');
        return { connectionStatus: 'configured' };
      });
      const record = await recordFor(admin, actor.organizationId, accountId);
      if (!record) throw new Error('evolution_go_record_missing');
      return json({ ok: result.status < 400, ...publicStatus(record, actor), lifecycle: result.lifecycle, ...result.payload }, result.status, headers);
    }

    const lifecycleContext = { organizationId: actor.organizationId, accountId, provider: 'evolution_go' as const, actorId: actor.userId };
    if (action === 'set_provider_controls') {
      if (!actor.canManage) throw new Error('permission_denied');
      await accessibleRecord(admin, actor, accountId, 'manage');
      await setAccountProviderControls(admin, lifecycleContext, body);
      const updated = await recordFor(admin, actor.organizationId, accountId);
      if (!updated) throw new Error('evolution_go_record_missing');
      return json({ ok: true, ...publicStatus(updated, actor) }, 200, headers);
    }
    if (!ACCOUNT_ACTIONS.has(action)) throw new Error('unsupported_action');
    const record = await accessibleRecord(admin, actor, accountId, 'connect');
    const result = await runAccountLifecycle(admin, lifecycleContext, action, async (step) => {
      const secret = await secretFor(admin, String(record.integration.id));
      const provider = providerFrom(secret);
      if (action === 'connect') {
        const webhookSecret = text(secret.webhook_secret, 256);
        if (!webhookSecret) throw new Error('evolution_go_credentials_incomplete');
        await step(() => provider.connect({
          webhookUrl: callbackUrl(String(record.integration.id), webhookSecret), subscribe: true, immediate: false,
        }), true);
        return { connectionStatus: 'qr', webhookRegistered: true };
      }
      if (action === 'reconnect') {
        await step(() => provider.reconnect(), true);
        return { connectionStatus: 'qr' };
      }
      if (action === 'disconnect' || action === 'logout') {
        await step(() => action === 'disconnect' ? provider.disconnect() : provider.logout(), true);
        return { connected: false };
      }
      if (action === 'activate' || action === 'refresh_status') {
        const current = await step(() => provider.status());
        const connected = current.connected === true && current.loggedIn === true;
        if (action === 'activate' && !connected) throw new Error('evolution_go_connection_validation_required');
        return { connected, phoneSuffix: phoneSuffix(current.phone) };
      }
      if (action === 'qr' || action === 'pair') {
        const webhookSecret = text(secret.webhook_secret, 256);
        if (!webhookSecret) throw new Error('evolution_go_credentials_incomplete');
        const webhookUrl = callbackUrl(String(record.integration.id), webhookSecret);
        const runtime = await prepareUnauthenticatedRuntime(provider, webhookUrl, step);
        if (runtime === 'already_connected') throw new Error('evolution_go_instance_already_connected');
        if (action === 'qr') {
          const qr = await freshQr(provider, webhookUrl, step);
          if (!qr.qrcode?.startsWith('data:image/')) throw new Error('evolution_go_qr_unavailable');
          return { connectionStatus: 'qr', webhookRegistered: true, payload: { qr } };
        }
        let pairingCode: string;
        try { pairingCode = await step(() => provider.pair(text(body.phone, 32)), true); }
        catch (error) {
          if (safeError(error) === 'evolution_go_request_rejected_500') throw new Error('evolution_go_pair_provider_rejected');
          throw error;
        }
        return { connectionStatus: 'qr', webhookRegistered: true, payload: { pairingCode } };
      }
      throw new Error('unsupported_action');
    });
    const updated = await recordFor(admin, actor.organizationId, accountId);
    if (!updated) throw new Error('evolution_go_record_missing');
    return json({ ok: result.status < 400, ...publicStatus(updated, actor), lifecycle: result.lifecycle, ...result.payload },
      result.status, { ...headers, 'Cache-Control': 'no-store' });
  } catch (error) {
    const code = safeError(error);
    // Keep this diagnostic deliberately narrow: operation and normalized code
    // make provider incompatibilities traceable without emitting credentials,
    // phone numbers, QR material or upstream response bodies.
    console.error('evolution_go_action_failed', { action, code });
    return json({ ok: false, error: code }, 400, allowedCorsHeaders(request));
  }
});
