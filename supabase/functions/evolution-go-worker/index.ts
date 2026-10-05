import { createAdminClient } from '../_shared/auth.ts';
import { json, safeError } from '../_shared/http.ts';
import { normalizeEvolutionGoBaseUrl } from '../_shared/messaging/EvolutionGoProvider.ts';

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

function phoneFromJid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const jid = value.trim().toLowerCase();
  if (!jid || jid.endsWith('@g.us') || jid.endsWith('@broadcast') || jid.includes('@lid')) return null;
  const digits = jid.split('@')[0].replace(/\D/g, '');
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

function retryAt(attempt: number): string {
  return new Date(Date.now() + Math.min(60_000 * 2 ** Math.max(0, attempt - 1), 30 * 60_000)).toISOString();
}

async function mark(admin: Admin, event: Row, state: string, input: Row = {}) {
  const { error } = await admin.from('evolution_go_webhook_events').update({
    processing_status: state,
    processed_at: ['processed', 'ignored', 'needs_review', 'dead_letter'].includes(state) ? new Date().toISOString() : null,
    ...input,
  }).eq('id', event.id).eq('organization_id', event.organization_id);
  if (error) throw new Error('evolution_go_queue_state_save_failed');
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
async function providerControls(admin: Admin, organizationId: unknown) {
  const { data, error } = await admin.from('messaging_provider_controls')
    .select('inbound_enabled,send_enabled,automation_enabled,kill_switch')
    .eq('organization_id', organizationId).eq('provider', 'evolution_go').maybeSingle();
  if (error) throw new Error('evolution_go_control_read_failed');
  if (!data) throw new Error('evolution_go_provider_control_missing');
  return data;
}

async function activeRouteReady(admin: Admin, event: Row) {
  const route = await accountIntegration(admin, event);
  if (route.account.enabled !== true) throw new Error('evolution_go_account_disabled');
  if (route.account.connection_status !== 'connected') throw new Error('evolution_go_account_disconnected');
  if (route.integration.enabled !== true) throw new Error('evolution_go_integration_disabled');
  if (route.integration.connected !== true) throw new Error('evolution_go_integration_disconnected');
  if (route.integration.paused === true) throw new Error('evolution_go_integration_paused');
  const controls = await providerControls(admin, event.organization_id);
  if (controls.kill_switch === true) throw new Error('evolution_go_kill_switch_active');
  return { ...route, controls };
}

async function inboundRouteReady(admin: Admin, event: Row) {
  const route = await activeRouteReady(admin, event);
  if (route.controls.inbound_enabled !== true) throw new Error('evolution_go_inbound_disabled');
  return route;
}

async function automationDispatchReady(admin: Admin, event: Row) {
  const route = await inboundRouteReady(admin, event);
  // Inbound reception and AI automation are intentionally independent: when
  // automation is paused, the seller must still see the customer's message in
  // the Central, but no AI reply may be generated.
  if (route.controls.send_enabled !== true || route.controls.automation_enabled !== true) return null;
  return route;
}

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

async function processInbound(admin: Admin, event: Row, payload: Row) {
  const { account, integration } = await inboundRouteReady(admin, event);
  const messageId = text(payload.message_id, 300);
  const phone = phoneFromJid(payload.remote_jid);
  const message = text(payload.text, 4_000);
  if (!messageId || !phone || !message) {
    await mark(admin, event, 'ignored', { error_code: 'inbound_payload_invalid' });
    return;
  }
  const { data: resolutionRows, error: resolutionError } = await admin.rpc('resolve_whatsapp_lead_for_account', {
    p_organization_id: event.organization_id, p_account_id: account.id, p_phone: phone,
  });
  if (resolutionError) throw new Error('evolution_go_lead_resolution_failed');
  const resolution = Array.isArray(resolutionRows) ? object(resolutionRows[0]) : object(resolutionRows);
  const leadId = text(resolution.lead_id, 80);
  const resolutionReason = text(resolution.reason, 100) || 'not_found';
  if (!leadId || !UUID.test(leadId)) {
    await mark(admin, event, 'needs_review', { error_code: resolutionReason === 'ambiguous_identity' ? 'lead_identity_ambiguous' : 'lead_not_matched' });
    await admin.from('audit_logs').insert({
      organization_id: event.organization_id,
      action: 'webhook.unmatched', detail: 'Evento Evolution GO recebido sem lead vinculado automaticamente.',
      entity_table: 'evolution_go_webhook_events', entity_id: event.id,
      event_data: { provider: 'evolution_go', phone_suffix: phone.slice(-4), resolution: resolutionReason },
    });
    return;
  }
  const { data: lead, error: leadError } = await admin.from('leads')
    .select('id,modo_atendimento,ai_paused,automation_status,first_inbound_at,whatsapp_account_id')
    .eq('organization_id', event.organization_id).eq('id', leadId).maybeSingle();
  if (leadError || !lead) throw new Error('evolution_go_resolved_lead_missing');

  const externalId = `message:${messageId}`;
  const { data: inbound, error: inboundError } = await admin.from('channel_inbound_events').upsert({
    organization_id: event.organization_id, whatsapp_account_id: account.id, provider: 'evolution_go', event_type: 'message',
    external_id: externalId, lead_id: lead.id, payload, status: 'received', error: null, processed_at: null,
  }, { onConflict: 'organization_id,provider,external_id', ignoreDuplicates: true }).select('id,status').maybeSingle();
  if (inboundError) throw new Error('evolution_go_inbound_persist_failed');
  if (!inbound) { await mark(admin, event, 'processed', { error_code: 'duplicate_inbound' }); return; }

  const occurredAt = text(payload.timestamp, 80) || new Date().toISOString();
  const { error: messageError } = await admin.from('lead_messages').insert({
    organization_id: event.organization_id, lead_id: lead.id, whatsapp_account_id: account.id,
    sender: 'lead', sender_name: 'Lead', type: 'received', text: message, sent_at: occurredAt,
    provider: 'evolution_go', message_origin: 'customer', provider_message_id: messageId,
    provider_occurred_at: occurredAt,
  });
  if (messageError && messageError.code !== '23505') throw new Error('evolution_go_message_persist_failed');

  const leadUpdate: Row = {
    first_inbound_at: lead.first_inbound_at ?? occurredAt, last_contact: occurredAt, no_reply_deadline_at: null,
    no_reply_processed_at: null, contact_approval_status: 'approved',
    contact_approval_reason: 'Contato iniciou uma conversa individual pelo WhatsApp.', contact_approved_at: occurredAt,
  };
  if (resolutionReason !== 'account_history_identity') leadUpdate.whatsapp_account_id = account.id;
  const { error: leadUpdateError } = await admin.from('leads').update(leadUpdate)
    .eq('organization_id', event.organization_id).eq('id', lead.id);
  if (leadUpdateError) throw new Error('evolution_go_lead_update_failed');

  const { data: queuedJobs, error: jobsError } = await admin.from('outreach_jobs').select('id,payload')
    .eq('organization_id', event.organization_id).eq('lead_id', lead.id).in('status', ['queued', 'retry']);
  if (jobsError) throw new Error('evolution_go_pending_jobs_read_failed');
  const automatedIds = (queuedJobs ?? []).filter((job) => object(job.payload).manual !== true).map((job) => job.id);
  if (automatedIds.length) await admin.from('outreach_jobs').update({ status: 'cancelled', processed_at: occurredAt, error: 'cancelled_by_inbound_reply' })
    .eq('organization_id', event.organization_id).in('id', automatedIds).in('status', ['queued', 'retry']);

  const humanResponsible = lead.ai_paused === true || lead.modo_atendimento === 'humano' || lead.automation_status === 'human';
  let anaCompleted = true;
  if (!humanResponsible) {
    // Re-check immediately before waking Ana. This keeps a queued inbound
    // event from producing an automated response when an administrator turns
    // off automation or outbound sending while it is being processed.
    const dispatchRoute = await automationDispatchReady(admin, event);
    if (dispatchRoute) {
      const { data: secret, error: secretError } = await admin.rpc('read_integration_secret', { p_integration: dispatchRoute.integration.id });
      const webhookSecret = text(object(secret).webhook_secret, 256);
      if (secretError || !webhookSecret) throw new Error('evolution_go_ana_credential_missing');
      const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ana-run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`, 'Content-Type': 'application/json', 'x-internal-worker-secret': webhookSecret },
        body: JSON.stringify({ event: 'message.received', message_id: messageId, request_id: `evolution:${messageId}`,
          retry_failed: true, lead_id: lead.id, modo: lead.modo_atendimento, organization_id: event.organization_id,
          source_integration_id: dispatchRoute.integration.id, contexto: { channel: 'whatsapp', inbound_event_id: externalId, media_requires_review: Boolean(text(payload.media_kind, 30)) },
        }), signal: AbortSignal.timeout(45_000),
      });
      const result = object(await response.json().catch(() => null));
      // The Ana endpoint's idempotent duplicate is already a completed delivery;
      // retrying it would only create queue noise and cannot generate a second reply.
      anaCompleted = response.ok && (result.ok === true || result.duplicate === true);
    }
  }
  await admin.from('channel_inbound_events').update({ status: anaCompleted ? 'processed' : 'failed', error: anaCompleted ? null : 'ana_not_completed', processed_at: new Date().toISOString() })
    .eq('id', inbound.id).eq('organization_id', event.organization_id);
  if (!anaCompleted) throw new Error('evolution_go_ana_not_completed');
  await mark(admin, event, 'processed');
}

async function processOne(admin: Admin, event: Row) {
  const claim = await admin.from('evolution_go_webhook_events').update({
    processing_status: 'processing', attempt_count: Number(event.attempt_count ?? 0) + 1, error_code: null,
  }).eq('id', event.id).eq('organization_id', event.organization_id).in('processing_status', ['queued', 'failed'])
    .select('*').maybeSingle();
  if (claim.error) throw new Error('evolution_go_queue_claim_failed');
  if (!claim.data) return { skipped: true };
  const owned = claim.data as Row;
  try {
    const payload = object(owned.sanitized_payload);
    if (owned.event_kind === 'inbound') await processInbound(admin, owned, payload);
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

async function updateProvisioningState(
  admin: Admin,
  job: Row,
  state: 'queued' | 'failed' | 'awaiting_qr' | 'needs_review',
  input: Row = {},
  requireProcessing = true,
): Promise<boolean> {
  let query = admin.from('evolution_go_seller_provisioning_jobs').update({
    state,
    updated_at: new Date().toISOString(),
    ...input,
  }).eq('id', job.id).eq('organization_id', job.organization_id);
  if (requireProcessing) query = query.eq('state', 'processing');
  const { data, error } = await query.select('id').maybeSingle();
  if (error) throw new Error('evolution_go_provisioning_state_save_failed');
  return Boolean(data);
}

async function auditProvisioning(admin: Admin, job: Row, action: string, detail: string, data: Row = {}) {
  const { error } = await admin.from('audit_logs').insert({
    organization_id: job.organization_id,
    actor_name: 'Sistema',
    actor_type: 'system',
    action,
    detail,
    entity_table: 'whatsapp_accounts',
    entity_id: job.whatsapp_account_id,
    // Never place the generated instance UUID, token, webhook token, base URL,
    // provider response, or platform credential in the audit payload.
    event_data: { provider: 'evolution_go', provisioning_job_id: job.id, ...data },
  });
  if (error) console.error('evolution_go_provisioning_audit_failed', { action, jobId: job.id });
}

async function claimProvisioningJob(admin: Admin, job: Row): Promise<Row | null> {
  const { data, error } = await admin.from('evolution_go_seller_provisioning_jobs').update({
    state: 'processing',
    attempt_count: Number(job.attempt_count ?? 0) + 1,
    processing_started_at: new Date().toISOString(),
    last_error_code: null,
    updated_at: new Date().toISOString(),
  }).eq('id', job.id).eq('organization_id', job.organization_id)
    .in('state', ['queued', 'failed']).select('*').maybeSingle();
  if (error) throw new Error('evolution_go_provisioning_claim_failed');
  return data ? data as Row : null;
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

function provisioningConfigurationErrorCode(error: unknown): string {
  const candidate = safeError(error).replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 100);
  const allowed = new Set([
    'evolution_go_global_account_lookup_failed',
    'evolution_go_global_integration_lookup_failed',
    'evolution_go_global_secret_read_failed',
    'evolution_go_global_credentials_missing',
    'evolution_go_provisioning_secret_read_failed',
    'evolution_go_allowed_origins_required',
    'evolution_go_base_url_invalid',
    'evolution_go_base_url_unsafe',
    'evolution_go_base_url_not_allowed',
  ]);
  return allowed.has(candidate) ? candidate : 'evolution_go_provisioning_configuration_invalid';
}

async function processProvisioningOne(admin: Admin, job: Row) {
  const claimed = await claimProvisioningJob(admin, job);
  if (!claimed) return { skipped: true };
  const attempts = Number(claimed.attempt_count ?? 1);
  // This UUID is only the durable local provisioning correlation. Evolution GO
  // creates its own instance identifier and it must never be sent as if it
  // were a provider-supported field.
  const provisioningId = text(claimed.instance_id, 80);
  const instanceName = text(claimed.instance_name, 120);
  const integrationId = text(claimed.integration_id, 80);
  const accountId = text(claimed.whatsapp_account_id, 80);

  if (!UUID.test(provisioningId) || !instanceName || !UUID.test(integrationId) || !UUID.test(accountId)) {
    await updateProvisioningState(admin, claimed, 'needs_review', {
      completed_at: new Date().toISOString(), last_error_code: 'evolution_go_provisioning_job_invalid',
    });
    await auditProvisioning(admin, claimed, 'whatsapp.evolution_go_seller_provisioning_review_required', 'Canal individual requer revisão antes de criar a instância.', { reason: 'invalid_job' });
    return { failed: true, review: true };
  }

  let baseUrl: string;
  let globalApiKey: string;
  let existingSecret: Row;
  try {
    const globalCredentials = await loadGlobalProvisioningCredentials(admin, text(claimed.organization_id, 80));
    baseUrl = normalizeEvolutionGoBaseUrl(globalCredentials.baseUrlInput, allowedOrigins());
    globalApiKey = globalCredentials.globalApiKey;
    existingSecret = await loadProvisioningSecret(admin, integrationId);
  } catch (error) {
    const code = provisioningConfigurationErrorCode(error);
    await updateProvisioningState(admin, claimed, 'failed', { next_attempt_at: retryAt(attempts), last_error_code: code });
    await auditProvisioning(admin, claimed, 'whatsapp.evolution_go_seller_provisioning_blocked', 'Canal individual aguardando uma configuração segura do provedor.', { reason: code });
    return { failed: true, retryable: true };
  }

  const instanceToken = text(existingSecret.instance_token, 1_000) || randomSecret();
  const webhookSecret = text(existingSecret.webhook_secret, 256) || randomSecret();
  // Store the generated per-instance token *before* the remote POST. If the
  // network becomes uncertain, an operator can reconcile the exact intended
  // instance without showing or regenerating credentials in the browser.
  const sellerSecret = {
    base_url: baseUrl,
    instance_name: instanceName,
    // Evolution GO assigns the real ID. Keep this null until the provider
    // confirms it, rather than persisting the local provisioning UUID as a
    // false remote identifier.
    instance_id: null,
    instance_token: instanceToken,
    webhook_secret: webhookSecret,
    timeout_ms: 12_000,
    retry_attempts: 0,
  };
  const { error: vaultError } = await admin.rpc('store_integration_secret', {
    p_integration: integrationId,
    p_secret: sellerSecret,
  });
  if (vaultError) {
    await updateProvisioningState(admin, claimed, 'failed', {
      next_attempt_at: retryAt(attempts), last_error_code: 'evolution_go_provisioning_secret_save_failed',
    });
    return { failed: true, retryable: true };
  }

  let response: Response;
  try {
    response = await fetch(new URL('/instance/create', baseUrl), {
      method: 'POST',
      headers: { apikey: globalApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: instanceName, token: instanceToken }),
      signal: AbortSignal.timeout(20_000),
      redirect: 'error',
    });
  } catch {
    await updateProvisioningState(admin, claimed, 'needs_review', {
      completed_at: new Date().toISOString(), last_error_code: 'evolution_go_instance_create_uncertain',
    });
    await auditProvisioning(admin, claimed, 'whatsapp.evolution_go_seller_provisioning_review_required', 'A criação da instância não teve confirmação conclusiva e requer revisão.', { reason: 'remote_result_uncertain' });
    return { failed: true, review: true };
  }

  if (!response.ok) {
    const code = response.status >= 500
      ? 'evolution_go_instance_create_uncertain'
      : `evolution_go_instance_create_${response.status}`;
    await updateProvisioningState(admin, claimed, 'needs_review', {
      completed_at: new Date().toISOString(), last_error_code: code,
    });
    await auditProvisioning(admin, claimed, 'whatsapp.evolution_go_seller_provisioning_review_required', 'A instância individual não foi confirmada e requer revisão.', { reason: code });
    return { failed: true, review: true };
  }

  let providerInstanceId: string;
  try {
    providerInstanceId = providerInstanceIdFromResponse(await response.json().catch(() => null), instanceName);
  } catch (error) {
    const code = safeError(error).replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 100) || 'evolution_go_instance_create_response_invalid';
    await updateProvisioningState(admin, claimed, 'needs_review', {
      completed_at: new Date().toISOString(), last_error_code: code,
    });
    await auditProvisioning(admin, claimed, 'whatsapp.evolution_go_seller_provisioning_review_required', 'A instância foi criada, mas sua identificação não pôde ser validada localmente.', { reason: code });
    return { failed: true, review: true };
  }

  // Do not resurrect a channel if its invitation was cancelled while Evolution
  // processed the request. The remote account remains disabled and auditable.
  const { data: stillProcessing, error: statusReadError } = await admin.from('evolution_go_seller_provisioning_jobs')
    .select('id').eq('id', claimed.id).eq('organization_id', claimed.organization_id).eq('state', 'processing').maybeSingle();
  if (statusReadError) throw new Error('evolution_go_provisioning_state_read_failed');
  if (!stillProcessing) return { cancelled: true };

  // This second Vault write happens only after a confirmed response. If it
  // fails, do not retry the POST: the remote instance may already exist.
  const { error: providerIdSaveError } = await admin.rpc('store_integration_secret', {
    p_integration: integrationId,
    p_secret: { ...sellerSecret, instance_id: providerInstanceId },
  });
  if (providerIdSaveError) {
    await updateProvisioningState(admin, claimed, 'needs_review', {
      completed_at: new Date().toISOString(), last_error_code: 'evolution_go_provider_instance_id_save_failed',
    });
    await auditProvisioning(admin, claimed, 'whatsapp.evolution_go_seller_provisioning_review_required', 'A instância foi criada, mas sua identificação segura requer revisão.', { reason: 'provider_instance_id_save_failed' });
    return { failed: true, review: true };
  }

  try {
    const { data: storedIntegration, error: integrationReadError } = await admin.from('integrations')
      .select('configuration').eq('id', integrationId).eq('organization_id', claimed.organization_id).maybeSingle();
    const { data: account, error: accountReadError } = await admin.from('whatsapp_accounts')
      .select('provider_metadata').eq('id', accountId).eq('organization_id', claimed.organization_id).maybeSingle();
    if (integrationReadError || accountReadError || !storedIntegration || !account) throw new Error('evolution_go_provisioning_record_read_failed');
    const now = new Date().toISOString();
    const [integrationUpdate, accountUpdate] = await Promise.all([
      admin.from('integrations').update({
        connected: false, enabled: false, paused: true, last_error: null, last_error_at: null,
        status_detail: 'Instância individual criada. O vendedor deve conectar o WhatsApp por QR Code antes da validação.',
        configuration: {
          ...object(storedIntegration.configuration), configured: true, base_url_configured: true,
          instance_name: instanceName, provider_version: '0.7.2', provisioning_state: 'awaiting_qr',
        }, updated_at: now,
      }).eq('id', integrationId).eq('organization_id', claimed.organization_id),
      admin.from('whatsapp_accounts').update({
        enabled: false, connection_status: 'configured', status_checked_at: now,
        provider_metadata: { ...object(account.provider_metadata), provider_version: '0.7.2', provisioning_state: 'awaiting_qr' },
        updated_at: now,
      }).eq('id', accountId).eq('organization_id', claimed.organization_id),
    ]);
    if (integrationUpdate.error || accountUpdate.error) throw new Error('evolution_go_provisioning_record_save_failed');
    const saved = await updateProvisioningState(admin, claimed, 'awaiting_qr', {
      completed_at: now, next_attempt_at: now, last_error_code: null,
    });
    if (!saved) return { cancelled: true };
  } catch (error) {
    const code = safeError(error).replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 100) || 'evolution_go_provisioning_finalize_failed';
    await updateProvisioningState(admin, claimed, 'needs_review', {
      completed_at: new Date().toISOString(), last_error_code: code,
    });
    await auditProvisioning(admin, claimed, 'whatsapp.evolution_go_seller_provisioning_review_required', 'A instância foi criada, mas a finalização local requer revisão.', { reason: code });
    return { failed: true, review: true };
  }

  await auditProvisioning(admin, claimed, 'whatsapp.evolution_go_seller_instance_created', 'Instância individual criada automaticamente; aguardando conexão por QR Code.', { state: 'awaiting_qr' });
  return { provisioned: true };
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
      let query = admin.from('evolution_go_webhook_events').select('*').in('processing_status', ['queued', 'failed'])
        .lte('next_retry_at', now).order('created_at', { ascending: true }).limit(20);
      if (UUID.test(eventId)) query = query.eq('id', eventId);
      if (UUID.test(organizationId)) query = query.eq('organization_id', organizationId);
      const { data, error } = await query;
      if (error) throw new Error('evolution_go_queue_read_failed');
      for (const event of data ?? []) eventResults.push(await processOne(admin, event as Row));
    }

    const provisioningResults: Row[] = [];
    if (shouldProcessProvisioning) {
      let query = admin.from('evolution_go_seller_provisioning_jobs').select('*').in('state', ['queued', 'failed'])
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
