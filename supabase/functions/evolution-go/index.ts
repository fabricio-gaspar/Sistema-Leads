import {
  createAdminClient,
  hasOrganizationPermission,
  requireUser,
} from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';
import { EvolutionGoProvider, normalizeEvolutionGoBaseUrl } from '../_shared/messaging/EvolutionGoProvider.ts';

type Admin = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value: unknown, max = 1_000): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const uuid = (value: unknown): string => {
  const candidate = text(value, 80);
  return UUID.test(candidate) ? candidate : '';
};

/**
 * The provisioned Evolution GO tenant for this CRM. An environment override
 * is supported for infrastructure changes, but the function stays fail-closed
 * to every origin except the tenant explicitly approved by the administrator.
 */
const PROVISIONED_EVOLUTION_GO_ORIGIN = 'https://evo-eisenflow.kz3solucoes.cloud';

function allowedOrigins(): string[] {
  const configured = (Deno.env.get('EVOLUTION_GO_ALLOWED_ORIGINS') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
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

async function context(admin: Admin, userId: string): Promise<{ organizationId: string; actorName: string }> {
  const { data: profile, error } = await admin.from('profiles').select('active_organization_id,name').eq('id', userId).maybeSingle();
  if (error || !profile?.active_organization_id) throw new Error('organization_context_required');
  const organizationId = String(profile.active_organization_id);
  const manageable = await hasOrganizationPermission(admin, organizationId, userId, 'channels.manage_all')
    || await hasOrganizationPermission(admin, organizationId, userId, 'configuration.manage');
  if (!manageable) throw new Error('permission_denied');
  return { organizationId, actorName: text(profile.name, 160) || 'Usuário' };
}

async function secretFor(admin: Admin, integrationId: string): Promise<Row> {
  const { data, error } = await admin.rpc('read_integration_secret', { p_integration: integrationId });
  if (error) throw new Error('evolution_go_secret_read_failed');
  return object(data);
}

async function recordFor(admin: Admin, organizationId: string) {
  const { data: account, error } = await admin.from('whatsapp_accounts')
    .select('id,integration_id,label,enabled,is_default,connection_status,connected_phone_suffix,connected_at,status_checked_at,webhook_registered_at,last_error_code,provider_metadata,created_at')
    .eq('organization_id', organizationId).eq('provider', 'evolution_go').is('archived_at', null).maybeSingle();
  if (error) throw new Error('evolution_go_account_lookup_failed');
  if (!account) return null;
  const { data: integration, error: integrationError } = await admin.from('integrations')
    .select('id,key,label,connected,enabled,paused,last_tested_at,last_success_at,last_error,status_detail,configuration')
    .eq('id', account.integration_id).eq('organization_id', organizationId).maybeSingle();
  if (integrationError || !integration) throw new Error('evolution_go_integration_lookup_failed');
  const { data: controls, error: controlsError } = await admin.from('messaging_provider_controls')
    .select('inbound_enabled,send_enabled,automation_enabled,kill_switch,reason,updated_at')
    .eq('organization_id', organizationId).eq('provider', 'evolution_go').maybeSingle();
  if (controlsError) throw new Error('evolution_go_control_lookup_failed');
  return { account, integration, controls };
}

async function createRecord(admin: Admin, organizationId: string, userId: string, label: string) {
  const accountId = crypto.randomUUID();
  const integrationId = crypto.randomUUID();
  const { error: integrationError } = await admin.from('integrations').insert({
    id: integrationId,
    organization_id: organizationId,
    key: `whatsapp_evolution_go:${accountId}`,
    label,
    provider: 'Evolution GO',
    category: 'communication',
    connected: false,
    enabled: false,
    paused: true,
    mode: 'real',
    status_detail: 'Canal Evolution GO criado; aguardando credenciais e validação.',
    configuration: { configured: false, provider_version: '0.7.2' },
  });
  if (integrationError) throw new Error('evolution_go_integration_create_failed');
  const { error: accountError } = await admin.from('whatsapp_accounts').insert({
    id: accountId,
    organization_id: organizationId,
    integration_id: integrationId,
    label,
    provider: 'evolution_go',
    account_type: 'corporate',
    is_default: false,
    enabled: false,
    connection_status: 'unconfigured',
    created_by: userId,
    provider_metadata: { provider_version: '0.7.2' },
  });
  if (accountError) {
    await admin.from('integrations').delete().eq('id', integrationId).eq('organization_id', organizationId);
    throw new Error('evolution_go_account_create_failed');
  }
  await admin.from('messaging_provider_controls').upsert({
    organization_id: organizationId, provider: 'evolution_go', inbound_enabled: false, send_enabled: false,
    automation_enabled: false, kill_switch: true, reason: 'provider_not_validated', changed_by: userId,
  }, { onConflict: 'organization_id,provider' });
  return { account: { id: accountId, integration_id: integrationId }, integration: { id: integrationId } };
}

async function ensureRecord(admin: Admin, organizationId: string, userId: string, label: string) {
  return await recordFor(admin, organizationId) ?? await createRecord(admin, organizationId, userId, label);
}

function publicStatus(record: Awaited<ReturnType<typeof recordFor>>) {
  if (!record) return { configured: false, account: null, integration: null, controls: null };
  const configuration = object(record.integration.configuration);
  const controls = record.controls ?? { inbound_enabled: false, send_enabled: false, automation_enabled: false, kill_switch: true, reason: 'provider_not_configured' };
  return {
    configured: configuration.configured === true,
    account: {
      id: record.account.id, label: record.account.label, enabled: record.account.enabled === true,
      isDefault: record.account.is_default === true, connectionStatus: record.account.connection_status,
      phoneSuffix: record.account.connected_phone_suffix ?? null, connectedAt: record.account.connected_at ?? null,
      checkedAt: record.account.status_checked_at ?? null, webhookRegisteredAt: record.account.webhook_registered_at ?? null,
      errorCode: record.account.last_error_code ?? null,
    },
    integration: {
      id: record.integration.id, connected: record.integration.connected === true, enabled: record.integration.enabled === true,
      paused: record.integration.paused === true, statusDetail: record.integration.status_detail ?? null,
      lastTestedAt: record.integration.last_tested_at ?? null, lastSuccessAt: record.integration.last_success_at ?? null,
      lastError: record.integration.last_error ?? null,
      baseUrlConfigured: Boolean(configuration.base_url_configured), instanceName: configuration.instance_name ?? null,
      version: configuration.provider_version ?? null,
    },
    controls: {
      inboundEnabled: controls.inbound_enabled === true, sendEnabled: controls.send_enabled === true,
      automationEnabled: controls.automation_enabled === true, killSwitch: controls.kill_switch === true,
      reason: controls.reason ?? null,
    },
  };
}

async function audit(admin: Admin, input: { organizationId: string; userId: string; actorName: string; action: string; entityId: string; detail: string; data?: Row }) {
  const { error } = await admin.from('audit_logs').insert({
    organization_id: input.organizationId, actor_id: input.userId, actor_name: input.actorName, actor_type: 'user',
    action: input.action, detail: input.detail, entity_table: 'whatsapp_accounts', entity_id: input.entityId,
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

/** Creates an Evolution GO instance once. Deliberately never retries a POST: an
 * uncertain response must be investigated instead of risking a second session. */
async function createInstance(body: Row, existingSecret: Row) {
  const baseUrlInput = text(body.base_url, 500) || text(existingSecret.base_url, 500);
  const globalApiKey = text(body.global_api_key, 1_000) || text(existingSecret.global_api_key, 1_000);
  const instanceName = text(body.instance_name, 120) || text(existingSecret.instance_name, 120);
  if (!baseUrlInput || !globalApiKey || !instanceName) throw new Error('evolution_go_instance_create_credentials_required');
  const baseUrl = normalizeEvolutionGoBaseUrl(baseUrlInput, allowedOrigins());
  const instanceId = crypto.randomUUID();
  const instanceToken = randomSecret();
  const response = await fetch(new URL('/instance/create', baseUrl), {
    method: 'POST',
    headers: { apikey: globalApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ instanceId, name: instanceName, token: instanceToken, advancedSettings: {} }),
    signal: AbortSignal.timeout(20_000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`evolution_go_instance_create_${response.status}`);
  return { base_url: baseUrl, global_api_key: globalApiKey, instance_name: instanceName, instance_id: instanceId, instance_token: instanceToken };
}

async function saveConfiguration(admin: Admin, body: Row, organizationId: string, userId: string) {
  const label = text(body.label, 120) || 'WhatsApp Evolution GO';
  const stored = await ensureRecord(admin, organizationId, userId, label);
  const existing = await secretFor(admin, stored.integration.id);
  const baseUrlInput = text(body.base_url, 500) || text(existing.base_url, 500);
  const globalApiKey = text(body.global_api_key, 1_000) || text(existing.global_api_key, 1_000);
  const instanceToken = text(body.instance_token, 1_000) || text(existing.instance_token, 1_000);
  const instanceName = text(body.instance_name, 120) || text(existing.instance_name, 120);
  const instanceId = text(body.instance_id, 120) || text(existing.instance_id, 120);
  const timeoutMs = Math.min(Math.max(Number(body.timeout_ms ?? existing.timeout_ms ?? 12_000), 2_000), 30_000);
  const retryAttempts = Math.min(Math.max(Number(body.retry_attempts ?? existing.retry_attempts ?? 0), 0), 3);
  if (!baseUrlInput || !globalApiKey || !instanceToken || !instanceName) throw new Error('evolution_go_credentials_required');
  const baseUrl = normalizeEvolutionGoBaseUrl(baseUrlInput, allowedOrigins());
  const webhookSecret = text(existing.webhook_secret, 256) || randomSecret();
  const credentials = { base_url: baseUrl, global_api_key: globalApiKey, instance_token: instanceToken, instance_name: instanceName, instance_id: instanceId || null, webhook_secret: webhookSecret, timeout_ms: timeoutMs, retry_attempts: retryAttempts };
  const { error: secretError } = await admin.rpc('store_integration_secret', { p_integration: stored.integration.id, p_secret: credentials });
  if (secretError) throw new Error('evolution_go_credentials_save_failed');
  // `store_integration_secret` owns the Vault reference in this JSON column.
  // Read it back before adding display-only metadata so the reference is never lost.
  const { data: storedIntegration, error: storedIntegrationError } = await admin.from('integrations')
    .select('configuration').eq('id', stored.integration.id).eq('organization_id', organizationId).maybeSingle();
  if (storedIntegrationError || !storedIntegration) throw new Error('evolution_go_secret_reference_read_failed');
  const persistedConfiguration = object(storedIntegration.configuration);
  const now = new Date().toISOString();
  const { error: integrationError } = await admin.from('integrations').update({
    label, connected: false, enabled: false, paused: true, last_error: null, last_error_at: null,
    status_detail: 'Credenciais armazenadas no cofre; conecte a instância e valide os callbacks antes de ativar.',
    configuration: { ...persistedConfiguration, configured: true, base_url_configured: true, instance_name: instanceName, provider_version: '0.7.2', timeout_ms: timeoutMs, retry_attempts: retryAttempts }, updated_at: now,
  }).eq('id', stored.integration.id).eq('organization_id', organizationId);
  const { error: accountError } = await admin.from('whatsapp_accounts').update({
    label, enabled: false, is_default: false, connection_status: 'configured', status_checked_at: null,
    webhook_registered_at: null, last_error_code: null, provider_metadata: { provider_version: '0.7.2', instance_name: instanceName }, updated_at: now,
  }).eq('id', stored.account.id).eq('organization_id', organizationId);
  if (integrationError || accountError) throw new Error('evolution_go_configuration_state_save_failed');
  return await recordFor(admin, organizationId);
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, error: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, headers);
  try {
    const body = object(await request.json().catch(() => ({})));
    const action = text(body.action, 80);
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const { organizationId, actorName } = await context(admin, user.id);

    if (action === 'status') return json({ ok: true, ...publicStatus(await recordFor(admin, organizationId)) }, 200, headers);
    if (action === 'create_instance') {
      const existingRecord = await ensureRecord(admin, organizationId, user.id, text(body.label, 120) || 'WhatsApp Evolution GO');
      const existingSecret = await secretFor(admin, existingRecord.integration.id);
      const created = await createInstance(body, existingSecret);
      const record = await saveConfiguration(admin, { ...body, ...created }, organizationId, user.id);
      if (!record) throw new Error('evolution_go_record_missing');
      await audit(admin, { organizationId, userId: user.id, actorName, action: 'whatsapp.evolution_go_instance_created', entityId: record.account.id, detail: 'Instância Evolution GO criada e credenciais armazenadas no cofre; conclua a conexão antes de ativar.', data: { instance_id: created.instance_id } });
      return json({ ok: true, ...publicStatus(record) }, 200, headers);
    }
    if (action === 'save') {
      const record = await saveConfiguration(admin, body, organizationId, user.id);
      if (!record) throw new Error('evolution_go_record_missing');
      await audit(admin, { organizationId, userId: user.id, actorName, action: 'whatsapp.evolution_go_configured', entityId: record.account.id, detail: 'Credenciais Evolution GO armazenadas no cofre; o canal permanece desativado até a validação.' });
      return json({ ok: true, ...publicStatus(record) }, 200, headers);
    }

    const record = await recordFor(admin, organizationId);
    if (!record) throw new Error('evolution_go_not_configured');
    const secret = await secretFor(admin, record.integration.id);
    const provider = providerFrom(secret);
    const now = new Date().toISOString();

    if (action === 'connect') {
      await provider.connect({ webhookUrl: callbackUrl(record.integration.id, text(secret.webhook_secret, 256)), subscribe: true, immediate: false });
      await admin.from('whatsapp_accounts').update({ connection_status: 'qr', webhook_registered_at: now, status_checked_at: now, last_error_code: null }).eq('id', record.account.id);
      await admin.from('integrations').update({ connected: false, enabled: false, paused: true, status_detail: 'Webhook registrado; conclua QR Code ou código de pareamento e atualize o status.' }).eq('id', record.integration.id);
      await audit(admin, { organizationId, userId: user.id, actorName, action: 'whatsapp.evolution_go_connect_requested', entityId: record.account.id, detail: 'Conexão Evolution GO iniciada; aguarda QR Code ou pareamento.' });
      return json({ ok: true, ...publicStatus(await recordFor(admin, organizationId)) }, 200, headers);
    }
    if (action === 'qr') return json({ ok: true, qr: await provider.qr() }, 200, headers);
    if (action === 'pair') {
      const pairingCode = await provider.pair(text(body.phone, 32));
      return json({ ok: true, pairingCode }, 200, headers);
    }
    if (action === 'refresh_status') {
      const current = await provider.status();
      const connected = current.connected === true && current.loggedIn === true;
      await admin.from('whatsapp_accounts').update({
        connection_status: connected ? 'connected' : 'disconnected', connected_phone_suffix: phoneSuffix(current.phone),
        connected_at: connected ? now : null, status_checked_at: now, last_error_code: null,
      }).eq('id', record.account.id);
      await admin.from('integrations').update({
        connected,
        enabled: connected ? record.integration.enabled === true : false,
        paused: connected ? record.integration.paused === true : true,
        last_tested_at: now, last_success_at: now, last_error: null, last_error_at: null,
        status_detail: connected
          ? record.integration.enabled === true ? 'Canal Evolution GO continua operacional após a validação.' : 'Instância conectada e pronta para ativação controlada.'
          : 'A instância ainda não possui sessão conectada.',
      }).eq('id', record.integration.id);
      return json({ ok: true, ...publicStatus(await recordFor(admin, organizationId)) }, 200, headers);
    }
    if (action === 'reconnect') {
      await provider.reconnect();
      await admin.from('whatsapp_accounts').update({ connection_status: 'qr', status_checked_at: now }).eq('id', record.account.id);
      await audit(admin, { organizationId, userId: user.id, actorName, action: 'whatsapp.evolution_go_reconnect_requested', entityId: record.account.id, detail: 'Reconexão Evolution GO solicitada; confirme o QR Code ou o pareamento antes de ativar.' });
      return json({ ok: true, ...publicStatus(await recordFor(admin, organizationId)) }, 200, headers);
    }
    if (action === 'disconnect' || action === 'logout') {
      if (action === 'disconnect') await provider.disconnect(); else await provider.logout();
      await admin.from('messaging_provider_controls').update({ inbound_enabled: false, send_enabled: false, automation_enabled: false, kill_switch: true, reason: action, changed_by: user.id }).eq('organization_id', organizationId).eq('provider', 'evolution_go');
      await admin.from('whatsapp_accounts').update({ enabled: false, is_default: false, connection_status: 'disconnected', status_checked_at: now }).eq('id', record.account.id);
      await admin.from('integrations').update({ connected: false, enabled: false, paused: true, status_detail: 'Canal desconectado; credenciais preservadas no cofre.' }).eq('id', record.integration.id);
      await audit(admin, { organizationId, userId: user.id, actorName, action: `whatsapp.evolution_go_${action}`, entityId: record.account.id, detail: action === 'logout' ? 'Sessão Evolution GO encerrada.' : 'Canal Evolution GO desconectado.' });
      return json({ ok: true, ...publicStatus(await recordFor(admin, organizationId)) }, 200, headers);
    }
    if (action === 'activate') {
      const current = await provider.status();
      if (current.connected !== true || current.loggedIn !== true) throw new Error('evolution_go_connection_validation_required');
      // Exactly one corporate default remains selected. Other credentials and sessions are preserved.
      await admin.from('whatsapp_accounts').update({ is_default: false }).eq('organization_id', organizationId).eq('account_type', 'corporate').neq('id', record.account.id);
      await admin.from('whatsapp_accounts').update({ is_default: true, enabled: true, connection_status: 'connected', connected_phone_suffix: phoneSuffix(current.phone), connected_at: now, status_checked_at: now, last_error_code: null }).eq('id', record.account.id);
      await admin.from('messaging_provider_controls').upsert({ organization_id: organizationId, provider: 'evolution_go', inbound_enabled: true, send_enabled: true, automation_enabled: true, kill_switch: false, reason: 'validated_and_activated', changed_by: user.id }, { onConflict: 'organization_id,provider' });
      await admin.from('integrations').update({ connected: true, enabled: true, paused: false, last_tested_at: now, last_success_at: now, last_error: null, last_error_at: null, status_detail: 'Canal Evolution GO operacional após validação explícita.' }).eq('id', record.integration.id);
      await audit(admin, { organizationId, userId: user.id, actorName, action: 'whatsapp.evolution_go_activated', entityId: record.account.id, detail: 'Canal Evolution GO ativado como conta corporativa padrão após validação.', data: { phone_suffix: phoneSuffix(current.phone) } });
      return json({ ok: true, ...publicStatus(await recordFor(admin, organizationId)) }, 200, headers);
    }
    if (action === 'deactivate') {
      await admin.from('messaging_provider_controls').update({ inbound_enabled: false, send_enabled: false, automation_enabled: false, kill_switch: true, reason: 'disabled_by_operator', changed_by: user.id }).eq('organization_id', organizationId).eq('provider', 'evolution_go');
      await admin.from('whatsapp_accounts').update({ enabled: false, is_default: false }).eq('id', record.account.id);
      await admin.from('integrations').update({ enabled: false, paused: true, status_detail: 'Uso operacional desativado; sessão e credenciais preservadas.' }).eq('id', record.integration.id);
      await audit(admin, { organizationId, userId: user.id, actorName, action: 'whatsapp.evolution_go_deactivated', entityId: record.account.id, detail: 'Uso operacional Evolution GO desativado sem apagar credenciais.' });
      return json({ ok: true, ...publicStatus(await recordFor(admin, organizationId)) }, 200, headers);
    }
    throw new Error('unsupported_action');
  } catch (error) {
    return json({ ok: false, error: safeError(error) }, 400, allowedCorsHeaders(request));
  }
});
