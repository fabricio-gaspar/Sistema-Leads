import { createAdminClient } from '../_shared/auth.ts';
import { json, safeError } from '../_shared/http.ts';
import { WaAkgProvider, normalizeWaAkgBaseUrl, waAkgSessionName } from '../_shared/messaging/WaAkgProvider.ts';
import { runProvisioningWork } from '../_shared/provisioningWork.ts';
import { claimInboundWork, finishInboundWork, processInboundWork } from '../_shared/inboundWork.ts';

type Admin = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown, max = 4_096): string => typeof value === 'string' ? value.trim().slice(0, max) : '';

function secureEqual(left: string | null, right: string | undefined): boolean {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function authorized(request: Request): boolean {
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
  return secureEqual(bearer, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
    || secureEqual(request.headers.get('x-wa-akg-worker-token'), Deno.env.get('WA_AKG_WORKER_TOKEN'));
}

function allowedOrigins(): string[] {
  return (Deno.env.get('WA_AKG_ALLOWED_ORIGINS') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
}

function retryAt(attempt: number): string {
  return new Date(Date.now() + Math.min(60_000 * 2 ** Math.max(0, attempt - 1), 30 * 60_000)).toISOString();
}

function callbackUrl(integrationId: string): string {
  const url = new URL(`${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-wa-akg`);
  url.searchParams.set('integration_id', integrationId);
  return url.toString();
}

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function phoneSuffix(value: string | undefined): string | null {
  const bareJid = (value ?? '').split(':', 1)[0] ?? '';
  const digits = bareJid.replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

async function markEvent(admin: Admin, event: Row, state: string, values: Row = {}) {
  await finishInboundWork(admin, 'wa_akg', event, state, values.error_code);
}

async function accountIntegration(admin: Admin, event: Row) {
  const { data: account, error: accountError } = await admin.from('whatsapp_accounts')
    .select('id,integration_id,enabled,connection_status').eq('organization_id', event.organization_id)
    .eq('id', event.whatsapp_account_id).eq('provider', 'wa_akg').is('archived_at', null).maybeSingle();
  if (accountError || !account || account.integration_id !== event.integration_id) throw new Error('wa_akg_account_not_ready');
  const { data: integration, error: integrationError } = await admin.from('integrations')
    .select('id,enabled,connected,paused').eq('organization_id', event.organization_id)
    .eq('id', event.integration_id).maybeSingle();
  if (integrationError || !integration) throw new Error('wa_akg_integration_not_ready');
  return { account, integration };
}

async function processConnection(admin: Admin, event: Row, payload: Row) {
  const state = text(payload.state, 40);
  const connected = state === 'connected';
  const now = new Date().toISOString();
  const [accountUpdate, integrationUpdate] = await Promise.all([
    admin.from('whatsapp_accounts').update({
      connection_status: connected ? 'connected' : state === 'qr' ? 'qr' : 'disconnected',
      status_checked_at: now, connected_at: connected ? now : null,
      ...(!connected ? { enabled: false } : {}),
      last_error_code: connected ? null : `provider_${state || 'disconnected'}`,
    }).eq('id', event.whatsapp_account_id).eq('organization_id', event.organization_id),
    admin.from('integrations').update({
      connected, ...(!connected ? { enabled: false, paused: true } : {}),
      last_tested_at: now, last_success_at: connected ? now : null,
      status_detail: connected ? 'WA-AKG confirmou a conexão.' : 'WA-AKG informou que a sessão requer nova conexão.',
    }).eq('id', event.integration_id).eq('organization_id', event.organization_id),
  ]);
  if (accountUpdate.error || integrationUpdate.error) throw new Error('wa_akg_connection_state_save_failed');
  await markEvent(admin, event, 'processed');
}

async function processReceipt(admin: Admin, event: Row, payload: Row) {
  // Authenticate ownership, not permission to send. A paused transport still
  // owns historical receipts; this path never dispatches inbound/AI/outbound.
  const { account } = await accountIntegration(admin, event);
  const ids = Array.isArray(payload.provider_message_ids)
    ? [...new Set(payload.provider_message_ids.filter((value): value is string => typeof value === 'string' && value.length > 0 && value.length <= 300))].slice(0, 100)
    : [];
  const status = text(payload.status, 30);
  if (!ids.length || !['sent', 'delivered', 'read', 'failed'].includes(status)) {
    await markEvent(admin, event, 'ignored', { error_code: 'receipt_payload_invalid' });
    return;
  }
  const { data, error } = await admin.rpc('reconcile_whatsapp_receipt_for_account', {
    p_whatsapp_account_id: account.id,
    p_organization_id: event.organization_id, p_provider_message_ids: ids,
    p_expected_message_count: ids.length, p_status: status,
    p_occurred_at: text(payload.occurred_at, 80) || new Date().toISOString(),
  });
  if (error) throw new Error('wa_akg_receipt_reconciliation_failed');
  if (!Array.isArray(data) || !data.length) {
    await markEvent(admin, event, 'needs_review', { error_code: 'outbound_message_not_matched' });
    return;
  }
  await markEvent(admin, event, data.length < ids.length ? 'needs_review' : 'processed', {
    error_code: data.length < ids.length ? 'receipt_targets_pending' : null,
  });
}

async function processInbound(admin: Admin, event: Row) {
  const payload = object(event.sanitized_payload);
  await upsertObservedContact(admin, event, payload);
  const result = await processInboundWork(admin, 'wa_akg', event);
  const leadId = text(result.lead_id, 80);
  if (leadId) await admin.rpc('apply_whatsapp_directory_name', { p_organization_id: event.organization_id, p_account_id: event.whatsapp_account_id, p_lead_id: leadId });
  return result;
}

async function upsertObservedContact(admin: Admin, event: Row, payload: Row) {
  const phone = text(payload.phone, 20), remoteJid = text(payload.remote_jid, 200);
  const name = text(payload.whatsapp_name, 160);
  if (!/^[1-9][0-9]{7,14}$/.test(phone) || !/^[1-9][0-9]{7,14}(:[0-9]{1,5})?@(s\.whatsapp\.net|c\.us)$/.test(remoteJid)) return;
  const { error } = await admin.from('whatsapp_contact_directory').upsert({ organization_id: event.organization_id,
    whatsapp_account_id: event.whatsapp_account_id, remote_jid: remoteJid, phone, whatsapp_name: name || null,
    last_synced_at: new Date().toISOString() }, { onConflict: 'organization_id,whatsapp_account_id,remote_jid' });
  if (error) throw new Error('wa_akg_contact_directory_save_failed');
}

async function processOutbound(admin: Admin, event: Row, payload: Row) {
  const { account } = await accountIntegration(admin, event);
  const args = { p_organization_id: event.organization_id, p_account_id: account.id,
    p_message_id: text(payload.message_id, 300), p_remote_jid: text(payload.remote_jid, 200), p_from_me: true,
    p_text: text(payload.text, 4096), p_occurred_at: text(payload.occurred_at, 80) || new Date().toISOString() };
  const { data, error } = await admin.rpc('persist_wa_akg_synced_message', args);
  if (error || !data) throw new Error('wa_akg_outbound_persistence_failed');
  const result = object(data);
  if (result.review === true) { await markEvent(admin, event, 'needs_review', { error_code: text(result.reason, 100) || 'outbound_identity_unresolved' }); return; }
  await markEvent(admin, event, 'processed');
}

async function processEvent(admin: Admin, event: Row): Promise<Row> {
  const claimed = await claimInboundWork(admin, 'wa_akg', event);
  if (!claimed) return { skipped: true };
  try {
    const payload = object(claimed.sanitized_payload);
    if (claimed.event_kind === 'inbound') return await processInbound(admin, claimed);
    else if (claimed.event_kind === 'outbound') await processOutbound(admin, claimed, payload);
    else if (claimed.event_kind === 'receipt') await processReceipt(admin, claimed, payload);
    else if (claimed.event_kind === 'connection') await processConnection(admin, claimed, payload);
    else await markEvent(admin, claimed, 'ignored', { error_code: 'unsupported_event_kind' });
    return { processed: true };
  } catch (error) {
    const code = safeError(error).replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 100) || 'wa_akg_worker_failed';
    const terminal = ['wa_akg_account_not_ready', 'wa_akg_integration_not_ready', 'wa_akg_controls_not_ready',
      'wa_akg_route_not_ready', 'wa_akg_inbound_disabled', 'wa_akg_send_disabled'].includes(code);
    if (terminal) {
      await markEvent(admin, claimed, 'ignored', { error_code: code });
      return { ignored: true, code };
    }
    const attempts = Number(claimed.attempt_count ?? 1);
    await markEvent(admin, claimed, attempts >= 5 ? 'dead_letter' : 'failed', {
      error_code: code, next_retry_at: retryAt(attempts),
    });
    return { failed: true, code };
  }
}

async function globalCredentials(admin: Admin, organizationId: string): Promise<{ baseUrl: string; apiKey: string }> {
  const { data, error } = await admin.from('whatsapp_accounts').select('integration_id')
    .eq('organization_id', organizationId).eq('provider', 'wa_akg').eq('account_type', 'corporate')
    .is('archived_at', null).order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (error) throw new Error('wa_akg_gateway_lookup_failed');
  const stored = data?.integration_id
    ? object((await admin.rpc('read_integration_secret', { p_integration: data.integration_id })).data)
    : {};
  const storedUrl = text(stored.base_url, 500), storedKey = text(stored.api_key, 1_000);
  if (Boolean(storedUrl) !== Boolean(storedKey)) throw new Error('wa_akg_gateway_configuration_incomplete');
  const baseUrlInput = storedUrl || text(Deno.env.get('WA_AKG_BASE_URL'), 500);
  const apiKey = storedKey || text(Deno.env.get('WA_AKG_API_KEY'), 1_000);
  if (!baseUrlInput || !apiKey) throw new Error('wa_akg_gateway_not_configured');
  return { baseUrl: normalizeWaAkgBaseUrl(baseUrlInput, allowedOrigins()), apiKey };
}

/**
 * Webhooks are the preferred path, but the upstream can omit connection.update
 * while restoring a linked device and replaying its history. This read-only
 * provider probe closes that gap: it only promotes a locally inactive session
 * after the gateway confirms the expected, scoped session is CONNECTED.
 */
async function reconcileConnectedSessions(admin: Admin, organizationId?: string): Promise<number> {
  let query = admin.from('whatsapp_accounts')
    .select('id,organization_id,integration_id,connection_status')
    .eq('provider', 'wa_akg').eq('account_type', 'seller').is('archived_at', null)
    .in('connection_status', ['configured', 'qr', 'disconnected']).order('status_checked_at', { ascending: true }).limit(20);
  if (organizationId) query = query.eq('organization_id', organizationId);
  const { data, error } = await query;
  if (error) throw new Error('wa_akg_connection_reconciliation_read_failed');

  let reconciled = 0;
  for (const candidate of data ?? []) {
    const organization = text(candidate.organization_id, 80);
    const accountId = text(candidate.id, 80);
    const integrationId = text(candidate.integration_id, 80);
    if (!UUID.test(organization) || !UUID.test(accountId) || !UUID.test(integrationId)) continue;
    try {
      const [gateway, secretRead] = await Promise.all([
        globalCredentials(admin, organization),
        admin.rpc('read_integration_secret', { p_integration: integrationId }),
      ]);
      if (secretRead.error) throw new Error('wa_akg_connection_reconciliation_secret_read_failed');
      const secret = object(secretRead.data);
      const expectedSession = waAkgSessionName(organization, accountId);
      const sessionId = text(secret.session_id, 120) || expectedSession;
      if (sessionId !== expectedSession) continue;
      const provider = new WaAkgProvider({ ...gateway, sessionId, allowedOrigins: allowedOrigins(), timeoutMs: 15_000 });
      const status = await provider.status();
      if (!status.confirmed || !status.connected) continue;

      const now = new Date().toISOString();
      const [accountUpdate, integrationUpdate] = await Promise.all([
        admin.from('whatsapp_accounts').update({
          connection_status: 'connected', connected_phone_suffix: phoneSuffix(status.phone), connected_at: now,
          status_checked_at: now, enabled: false, last_error_code: null, updated_at: now,
        }).eq('id', accountId).eq('organization_id', organization),
        admin.from('integrations').update({
          connected: true, enabled: false, paused: true, last_tested_at: now, last_success_at: now,
          status_detail: 'Sessão WA-AKG conectada; uso local permanece desativado até liberação administrativa.',
          last_error: null, last_error_at: null, updated_at: now,
        }).eq('id', integrationId).eq('organization_id', organization),
      ]);
      if (accountUpdate.error || integrationUpdate.error) throw new Error('wa_akg_connection_reconciliation_save_failed');
      reconciled += 1;
    } catch {
      // A failed probe must not downgrade an existing session or trigger a retrying mutation.
    }
  }
  return reconciled;
}

async function processProvisioning(admin: Admin, job: Row): Promise<Row> {
  return runProvisioningWork(admin, 'wa_akg', job, async (claimed, step, saveSecret) => {
    const organizationId = text(claimed.organization_id, 80);
    const accountId = text(claimed.account_id, 80);
    const integrationId = text(claimed.integration_id, 80);
    const expectedSession = waAkgSessionName(organizationId, accountId);
    const gateway = await globalCredentials(admin, organizationId);
    const previousRead = await admin.rpc('read_integration_secret', { p_integration: integrationId });
    if (previousRead.error) throw new Error('wa_akg_provisioning_secret_read_failed');
    const previous = object(previousRead.data);
    const sessionId = text(previous.session_id, 120) || expectedSession;
    if (sessionId !== expectedSession || text(claimed.session_name, 120) !== expectedSession) throw new Error('wa_akg_legacy_session_requires_review');
    const webhookSecret = text(previous.webhook_secret, 256) || randomSecret();
    const secret = { ...previous, session_id: sessionId, webhook_secret: webhookSecret, timeout_ms: 15_000 };
    await saveSecret(secret);
    const provider = new WaAkgProvider({ ...gateway, sessionId, allowedOrigins: allowedOrigins(), timeoutMs: 15_000 });
    if (previous.remote_created === true) {
      await step('verify_session', () => provider.verifyOwnedSession(callbackUrl(integrationId), webhookSecret));
    } else {
      try { await step('create_session', () => provider.create('WhatsApp do vendedor'), true); }
      catch (error) {
        if (safeError(error) !== 'wa_akg_request_rejected_409') throw error;
        await step('verify_session', () => provider.verifyOwnedSession(callbackUrl(integrationId), webhookSecret));
      }
    }
    await step('configure_safety', () => provider.configureSafety(), true);
    await step('register_webhook', () => provider.registerWebhook(callbackUrl(integrationId), webhookSecret,
      () => step('register_webhook_post', async () => undefined, true)), true);
    await step('start_session', () => provider.start(), true);
    await saveSecret({ ...secret, remote_created: true, webhook_registered: true });
    return { connection_status: 'qr', webhook_registered: true,
      configuration: { configured: true, base_url_configured: true, session_name: sessionId,
        provider_version: '1.7.0-beta.1', provider_revision: 'c7dd01a04339e4363b549beb3a41fe02cf131acb', provisioning_state: 'awaiting_qr' } };
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  if (!authorized(request)) return json({ ok: false, error: 'worker_auth_required' }, 401);
  try {
    const body = object(await request.json().catch(() => ({})));
    const eventId = text(body.event_id, 80);
    const jobId = text(body.provisioning_job_id, 80);
    const organizationId = text(body.organization_id, 80);
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const events: Row[] = [];
    const jobs: Row[] = [];
    if (eventId || !jobId) {
      let query = admin.from('wa_akg_webhook_events').select('*').in('processing_status', ['queued', 'failed', 'processing'])
        .lte('next_retry_at', now).order('created_at').limit(20);
      if (UUID.test(eventId)) query = query.eq('id', eventId);
      if (UUID.test(organizationId)) query = query.eq('organization_id', organizationId);
      const { data, error } = await query;
      if (error) throw new Error('wa_akg_event_queue_read_failed');
      for (const event of data ?? []) events.push(await processEvent(admin, event as Row));
    }
    if (jobId || !eventId) {
      let query = admin.from('wa_akg_seller_provisioning_jobs').select('*').in('state', ['queued', 'failed', 'processing'])
        .lte('next_attempt_at', now).order('created_at').limit(20);
      if (UUID.test(jobId)) query = query.eq('id', jobId);
      if (UUID.test(organizationId)) query = query.eq('organization_id', organizationId);
      const { data, error } = await query;
      if (error) throw new Error('wa_akg_provisioning_queue_read_failed');
      for (const job of data ?? []) jobs.push(await processProvisioning(admin, job as Row));
    }
    const reconciled = await reconcileConnectedSessions(admin, UUID.test(organizationId) ? organizationId : undefined);
    return json({
      ok: true, processed: events.filter((item) => item.processed).length,
      failed: events.filter((item) => item.failed).length,
      provisioned: jobs.filter((item) => item.provisioned).length,
      provisioning_failed: jobs.filter((item) => item.failed).length,
      reconciled,
    });
  } catch (error) {
    const code = safeError(error).replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 120);
    return json({ ok: false, error: code }, 500);
  }
});
