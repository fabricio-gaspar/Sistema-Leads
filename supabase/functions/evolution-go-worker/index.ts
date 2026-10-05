import { createAdminClient } from '../_shared/auth.ts';
import { json, safeError } from '../_shared/http.ts';
import { normalizeEvolutionGoBaseUrl } from '../_shared/messaging/EvolutionGoProvider.ts';
import { claimInboundWork, finishInboundWork, processInboundWork } from '../_shared/inboundWork.ts';
import { runProvisioningWork } from '../_shared/provisioningWork.ts';

type Admin = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown, max = 4_000): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

function secureEqual(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected || actual.length !== expected.length) return false;
  let result = 0;
  for (let index = 0; index < actual.length; index += 1) result |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return result === 0;
}

function serviceRoleAuthorized(request: Request): boolean {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
  return secureEqual(token, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
}

function retryAt(attempt: number): string {
  return new Date(Date.now() + Math.min(60_000 * 2 ** Math.max(0, attempt - 1), 30 * 60_000)).toISOString();
}

async function mark(admin: Admin, event: Row, state: string, input: Row = {}) {
  await finishInboundWork(admin, 'evolution_go', event, state, input.error_code);
}

async function accountIntegration(admin: Admin, event: Row) {
  const { data: account, error: accountError } = await admin.from('whatsapp_accounts')
    .select('id,integration_id,enabled,connection_status').eq('id', event.whatsapp_account_id)
    .eq('organization_id', event.organization_id).eq('provider', 'evolution_go').is('archived_at', null).maybeSingle();
  if (accountError || !account || account.integration_id !== event.integration_id) throw new Error('evolution_go_account_not_ready');
  const { data: integration, error: integrationError } = await admin.from('integrations')
    .select('id,enabled,connected,paused').eq('id', event.integration_id).eq('organization_id', event.organization_id).maybeSingle();
  if (integrationError || !integration) throw new Error('evolution_go_integration_not_ready');
  return { account, integration };
}

/**
 * Load the organization-wide Evolution controls at the moment an event is
 * consumed. The webhook's check is intentionally not trusted here: a queued
 * event can outlive a channel being disconnected or disabled.
 */
async function processConnection(admin: Admin, event: Row, payload: Row) {
  const { account, integration } = await accountIntegration(admin, event);
  const state = text(payload.state, 40);
  const connected = state === 'connected';
  const now = new Date().toISOString();
  const { error: accountError } = await admin.from('whatsapp_accounts').update({
    connection_status: connected ? 'connected' : 'disconnected', status_checked_at: now,
    ...(!connected ? { enabled: false } : {}),
    connected_at: connected ? now : null, last_error_code: connected ? null : `provider_${state || 'disconnected'}`,
  }).eq('id', account.id).eq('organization_id', event.organization_id);
  const { error: integrationError } = await admin.from('integrations').update({
    // A connection callback describes transport only. Never restore a snapshot
    // of administrative intent after a concurrent pause/disconnect.
    connected, ...(!connected ? { enabled: false, paused: true } : {}),
    last_tested_at: now, last_success_at: connected ? now : null,
    last_error: connected ? null : `provider_${state || 'disconnected'}`,
    status_detail: connected ? 'Evolution GO confirmou a conexão.' : 'Evolution GO informou que a sessão foi desconectada.',
  }).eq('id', integration.id).eq('organization_id', event.organization_id);
  if (accountError || integrationError) throw new Error('evolution_go_connection_state_save_failed');
  await mark(admin, event, 'processed');
}

async function processReceipt(admin: Admin, event: Row, payload: Row) {
  // Historical receipts require ownership, not an active transport. No Ana or
  // outbound dispatch is reachable from this reconciliation-only branch.
  const { account } = await accountIntegration(admin, event);
  const messageIds = Array.isArray(payload.provider_message_ids)
    ? [...new Set(payload.provider_message_ids.filter((value): value is string => typeof value === 'string' && value.length <= 300))].slice(0, 100)
    : [];
  const status = text(payload.status, 30);
  if (!messageIds.length || !['sent', 'delivered', 'read', 'failed'].includes(status)) {
    await mark(admin, event, 'ignored', { error_code: 'receipt_payload_invalid' });
    return;
  }
  const { data, error } = await admin.rpc('reconcile_whatsapp_receipt_for_account', {
    p_whatsapp_account_id: account.id,
    p_organization_id: event.organization_id, p_provider_message_ids: messageIds,
    p_expected_message_count: messageIds.length, p_status: status,
    p_occurred_at: text(payload.timestamp, 80) || new Date().toISOString(),
  });
  if (error) throw new Error('evolution_go_receipt_reconciliation_failed');
  if (!Array.isArray(data) || !data.length) {
    await mark(admin, event, 'needs_review', { error_code: 'outbound_message_not_matched' });
    return;
  }
  await mark(admin, event, data.length < messageIds.length ? 'needs_review' : 'processed', {
    error_code: data.length < messageIds.length ? 'receipt_targets_pending' : null,
  });
}

async function processInbound(admin: Admin, event: Row, _payload: Row) {
  return processInboundWork(admin, 'evolution_go', event);
}

async function processOne(admin: Admin, event: Row) {
  const owned = await claimInboundWork(admin, 'evolution_go', event);
  if (!owned) return { skipped: true };
  try {
    const payload = object(owned.sanitized_payload);
    if (owned.event_kind === 'inbound') return await processInbound(admin, owned, payload);
    else if (owned.event_kind === 'receipt') await processReceipt(admin, owned, payload);
    else if (owned.event_kind === 'connection') await processConnection(admin, owned, payload);
    else await mark(admin, owned, 'ignored', { error_code: 'unsupported_event_kind' });
    return { processed: true };
  } catch (error) {
    const code = safeError(error).replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 100) || 'evolution_go_worker_failed';
    const terminalRouteState = new Set([
      'evolution_go_account_not_ready',
      'evolution_go_integration_not_ready',
      'evolution_go_account_disabled',
      'evolution_go_account_disconnected',
      'evolution_go_integration_disabled',
      'evolution_go_integration_disconnected',
      'evolution_go_integration_paused',
      'evolution_go_provider_control_missing',
      'evolution_go_kill_switch_active',
      'evolution_go_inbound_disabled',
      'evolution_go_send_disabled',
    ]);
    if (terminalRouteState.has(code)) {
      await mark(admin, owned, 'ignored', { error_code: code });
      return { ignored: true, code };
    }
    const attempts = Number(owned.attempt_count ?? 1);
    await mark(admin, owned, attempts >= 5 ? 'dead_letter' : 'failed', { error_code: code, next_retry_at: retryAt(attempts) });
    return { failed: true, code };
  }
}

async function loadProvisioningSecret(admin: Admin, integrationId: string): Promise<Row> {
  const { data, error } = await admin.rpc('read_integration_secret', { p_integration: integrationId });
  if (error) throw new Error('evolution_go_provisioning_secret_read_failed');
  return object(data);
}

type GlobalProvisioningCredentials = {
  baseUrlInput: string;
  globalApiKey: string;
};

function isEvolutionGoProvider(value: unknown): boolean {
  return text(value, 80).toLowerCase().replace(/[^a-z0-9]+/g, '_') === 'evolution_go';
}

function environmentGlobalProvisioningCredentials(): GlobalProvisioningCredentials | null {
  const baseUrlInput = text(Deno.env.get('EVOLUTION_GO_BASE_URL'), 500);
  const globalApiKey = text(Deno.env.get('EVOLUTION_GO_GLOBAL_API_KEY'), 1_000);
  // Do not combine a partial database configuration with a partial environment
  // configuration. A mismatched base URL and global key could target the wrong
  // Evolution tenant.
  return baseUrlInput && globalApiKey ? { baseUrlInput, globalApiKey } : null;
}

/**
 * The organization-level corporate account owns the global Evolution GO
 * credential. Seller accounts intentionally store only their own token and
 * webhook secret. A configured corporate account can remain disabled while it
 * awaits QR validation, so "active" here means the non-archived organization
 * configuration record, not a channel approved to send messages.
 */
async function loadGlobalProvisioningCredentials(
  admin: Admin,
  organizationId: string,
): Promise<GlobalProvisioningCredentials> {
  const { data: corporateAccount, error: accountError } = await admin.from('whatsapp_accounts')
    .select('id,integration_id,is_default,updated_at')
    .eq('organization_id', organizationId)
    .eq('provider', 'evolution_go')
    .eq('account_type', 'corporate')
    .is('archived_at', null)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (accountError) throw new Error('evolution_go_global_account_lookup_failed');

  const corporateIntegrationId = text(corporateAccount?.integration_id, 80);
  if (corporateAccount && !UUID.test(corporateIntegrationId)) {
    throw new Error('evolution_go_global_integration_lookup_failed');
  }
  if (UUID.test(corporateIntegrationId)) {
    const { data: corporateIntegration, error: integrationError } = await admin.from('integrations')
      .select('id,provider')
      .eq('id', corporateIntegrationId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (integrationError || !corporateIntegration || !isEvolutionGoProvider(corporateIntegration.provider)) {
      throw new Error('evolution_go_global_integration_lookup_failed');
    }

    const { data: secret, error: secretError } = await admin.rpc('read_integration_secret', {
      p_integration: corporateIntegrationId,
    });
    if (secretError) throw new Error('evolution_go_global_secret_read_failed');
    const corporateSecret = object(secret);
    const baseUrlInput = text(corporateSecret.base_url, 500);
    const globalApiKey = text(corporateSecret.global_api_key, 1_000);
    if (baseUrlInput && globalApiKey) return { baseUrlInput, globalApiKey };
  }

  const fallback = environmentGlobalProvisioningCredentials();
  if (fallback) return fallback;
  throw new Error('evolution_go_global_credentials_missing');
}

function providerInstanceIdFromResponse(payload: unknown, fallbackName: string): string {
  const created = object(object(payload).data);
  const instanceId = text(created.id, 120)
    || text(created.instance_id, 120)
    || text(created.instanceId, 120)
    || text(created.name, 120)
    || fallbackName;
  // Identifiers are persisted in Vault and may be used in URL paths later.
  // Reject control characters instead of serializing an unsafe provider value.
  if (!instanceId || /[\u0000-\u001f\u007f]/.test(instanceId)) {
    throw new Error('evolution_go_instance_create_response_invalid');
  }
  return instanceId;
}

async function processProvisioningOne(admin: Admin, job: Row) {
  return runProvisioningWork(admin, 'evolution_go', job, async (claimed, step, saveSecret) => {
    const integrationId = text(claimed.integration_id, 80);
    const instanceName = text(claimed.instance_name, 120);
    const gateway = await loadGlobalProvisioningCredentials(admin, text(claimed.organization_id, 80));
    const baseUrl = normalizeEvolutionGoBaseUrl(gateway.baseUrlInput, allowedOrigins());
    const previous = await loadProvisioningSecret(admin, integrationId);
    if (previous.instance_id) throw new Error('evolution_go_existing_instance_requires_review');
    const instanceToken = text(previous.instance_token, 1_000) || randomSecret();
    const webhookSecret = text(previous.webhook_secret, 256) || randomSecret();
    const secret = { base_url: baseUrl, instance_name: instanceName, instance_id: null,
      instance_token: instanceToken, webhook_secret: webhookSecret, timeout_ms: 12_000, retry_attempts: 0 };
    await saveSecret(secret);
    const response = await step('create_instance', () => fetch(new URL('/instance/create', baseUrl), {
      method: 'POST', headers: { apikey: gateway.globalApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: instanceName, token: instanceToken }), signal: AbortSignal.timeout(20_000), redirect: 'error',
    }), true);
    if (!response.ok) throw new Error('evolution_go_instance_create_uncertain');
    const instanceId = providerInstanceIdFromResponse(await response.json().catch(() => null), instanceName);
    await saveSecret({ ...secret, instance_id: instanceId });
    return { connection_status: 'configured', configuration: { configured: true, base_url_configured: true,
      instance_name: instanceName, provider_version: '0.7.2', provisioning_state: 'awaiting_qr' } };
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  if (!serviceRoleAuthorized(request) && !secureEqual(request.headers.get('x-evolution-go-worker-token'), Deno.env.get('EVOLUTION_GO_WORKER_TOKEN'))) {
    return json({ ok: false, error: 'worker_auth_required' }, 401);
  }
  try {
    const body = object(await request.json().catch(() => ({})));
    const eventId = text(body.event_id, 80);
    const provisioningJobId = text(body.provisioning_job_id, 80);
    const organizationId = text(body.organization_id, 80);
    const admin = createAdminClient();
    const shouldProcessEvents = Boolean(eventId) || !provisioningJobId;
    const shouldProcessProvisioning = Boolean(provisioningJobId) || !eventId;
    const now = new Date().toISOString();

    const eventResults: Row[] = [];
    if (shouldProcessEvents) {
      let query = admin.from('evolution_go_webhook_events').select('*').in('processing_status', ['queued', 'failed', 'processing'])
        .lte('next_retry_at', now).order('created_at', { ascending: true }).limit(20);
      if (UUID.test(eventId)) query = query.eq('id', eventId);
      if (UUID.test(organizationId)) query = query.eq('organization_id', organizationId);
      const { data, error } = await query;
      if (error) throw new Error('evolution_go_queue_read_failed');
      for (const event of data ?? []) eventResults.push(await processOne(admin, event as Row));
    }

    const provisioningResults: Row[] = [];
    if (shouldProcessProvisioning) {
      let query = admin.from('evolution_go_seller_provisioning_jobs').select('*').in('state', ['queued', 'failed', 'processing'])
        .lte('next_attempt_at', now).order('created_at', { ascending: true }).limit(20);
      if (UUID.test(provisioningJobId)) query = query.eq('id', provisioningJobId);
      if (UUID.test(organizationId)) query = query.eq('organization_id', organizationId);
      const { data, error } = await query;
      if (error) throw new Error('evolution_go_provisioning_queue_read_failed');
      for (const job of data ?? []) provisioningResults.push(await processProvisioningOne(admin, job as Row));
    }

    const eventProcessed = eventResults.filter((result) => result.processed).length;
    const eventFailed = eventResults.filter((result) => result.failed).length;
    const provisioned = provisioningResults.filter((result) => result.provisioned).length;
    const provisioningFailed = provisioningResults.filter((result) => result.failed).length;
    return json({
      ok: true,
      processed: eventProcessed,
      failed: eventFailed,
      skipped: eventResults.filter((result) => result.skipped).length,
      provisioned,
      provisioning_failed: provisioningFailed,
      provisioning_skipped: provisioningResults.filter((result) => result.skipped).length,
      provisioning_cancelled: provisioningResults.filter((result) => result.cancelled).length,
    });
  } catch (error) {
    return json({ ok: false, error: safeError(error).replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 100) }, 500);
  }
});
