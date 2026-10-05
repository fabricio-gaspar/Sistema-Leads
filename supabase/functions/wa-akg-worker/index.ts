import { createAdminClient } from '../_shared/auth.ts';
import { json, safeError } from '../_shared/http.ts';
import { WaAkgProvider, normalizeWaAkgBaseUrl } from '../_shared/messaging/WaAkgProvider.ts';

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

async function markEvent(admin: Admin, event: Row, state: string, values: Row = {}) {
  const { error } = await admin.from('wa_akg_webhook_events').update({
    processing_status: state,
    processed_at: ['processed', 'ignored', 'needs_review', 'dead_letter'].includes(state) ? new Date().toISOString() : null,
    ...values,
  }).eq('id', event.id).eq('organization_id', event.organization_id);
  if (error) throw new Error('wa_akg_event_state_save_failed');
}

async function route(admin: Admin, event: Row, direction: 'inbound' | 'send') {
  const { data: account, error: accountError } = await admin.from('whatsapp_accounts')
    .select('id,integration_id,enabled,connection_status').eq('organization_id', event.organization_id)
    .eq('id', event.whatsapp_account_id).eq('provider', 'wa_akg').is('archived_at', null).maybeSingle();
  if (accountError || !account || account.integration_id !== event.integration_id) throw new Error('wa_akg_account_not_ready');
  const { data: integration, error: integrationError } = await admin.from('integrations')
    .select('id,enabled,connected,paused').eq('organization_id', event.organization_id)
    .eq('id', event.integration_id).maybeSingle();
  if (integrationError || !integration) throw new Error('wa_akg_integration_not_ready');
  const { data: controls, error: controlsError } = await admin.from('messaging_provider_controls')
    .select('inbound_enabled,send_enabled,automation_enabled,kill_switch')
    .eq('organization_id', event.organization_id).eq('provider', 'wa_akg').maybeSingle();
  if (controlsError || !controls) throw new Error('wa_akg_controls_not_ready');
  if (!account.enabled || account.connection_status !== 'connected'
    || !integration.enabled || !integration.connected || integration.paused || controls.kill_switch) {
    throw new Error('wa_akg_route_not_ready');
  }
  if (direction === 'inbound' && !controls.inbound_enabled) throw new Error('wa_akg_inbound_disabled');
  if (direction === 'send' && !controls.send_enabled) throw new Error('wa_akg_send_disabled');
  return { account, integration, controls };
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
  await route(admin, event, 'send');
  const ids = Array.isArray(payload.provider_message_ids)
    ? payload.provider_message_ids.filter((value): value is string => typeof value === 'string' && value.length <= 300).slice(0, 100)
    : [];
  const status = text(payload.status, 30);
  if (!ids.length || !['sent', 'delivered', 'read', 'failed'].includes(status)) {
    await markEvent(admin, event, 'ignored', { error_code: 'receipt_payload_invalid' });
    return;
  }
  const { data, error } = await admin.rpc('reconcile_whatsapp_receipt', {
    p_organization_id: event.organization_id, p_provider_message_ids: ids,
    p_expected_message_count: ids.length, p_status: status,
    p_occurred_at: text(payload.occurred_at, 80) || new Date().toISOString(),
  });
  if (error) throw new Error('wa_akg_receipt_reconciliation_failed');
  if (!Array.isArray(data) || !data.length) {
    await markEvent(admin, event, 'needs_review', { error_code: 'outbound_message_not_matched' });
    return;
  }
  await markEvent(admin, event, 'processed');
}

async function processInbound(admin: Admin, event: Row, payload: Row) {
  const active = await route(admin, event, 'inbound');
  const messageId = text(payload.message_id, 300);
  const phone = text(payload.phone, 20).replace(/\D/g, '');
  const message = text(payload.text, 4_096);
  if (!messageId || !/^[1-9]\d{7,14}$/.test(phone) || !message) {
    await markEvent(admin, event, 'ignored', { error_code: 'inbound_payload_invalid' });
    return;
  }
  const { data: resolvedRows, error: resolveError } = await admin.rpc('resolve_whatsapp_lead_for_account', {
    p_organization_id: event.organization_id, p_account_id: active.account.id, p_phone: phone,
  });
  if (resolveError) throw new Error('wa_akg_lead_resolution_failed');
  const resolution = object(Array.isArray(resolvedRows) ? resolvedRows[0] : resolvedRows);
  const leadId = text(resolution.lead_id, 80);
  const reason = text(resolution.reason, 100) || 'not_found';
  if (!UUID.test(leadId)) {
    await markEvent(admin, event, 'needs_review', { error_code: reason === 'ambiguous_identity' ? 'lead_identity_ambiguous' : 'lead_not_matched' });
    await admin.from('audit_logs').insert({
      organization_id: event.organization_id, actor_name: 'Sistema', actor_type: 'system',
      action: 'webhook.unmatched', detail: 'Mensagem WA-AKG recebida sem lead vinculado automaticamente.',
      entity_table: 'wa_akg_webhook_events', entity_id: event.id,
      event_data: { provider: 'wa_akg', phone_suffix: phone.slice(-4), resolution: reason },
    });
    return;
  }
  const { data: lead, error: leadError } = await admin.from('leads')
    .select('id,modo_atendimento,ai_paused,automation_status,first_inbound_at')
    .eq('organization_id', event.organization_id).eq('id', leadId).maybeSingle();
  if (leadError || !lead) throw new Error('wa_akg_resolved_lead_missing');

  const externalId = `message:${messageId}`;
  const { data: inbound, error: inboundError } = await admin.from('channel_inbound_events').upsert({
    organization_id: event.organization_id, whatsapp_account_id: active.account.id, provider: 'wa_akg',
    event_type: 'message', external_id: externalId, lead_id: lead.id, payload,
    status: 'received', error: null, processed_at: null,
  }, { onConflict: 'organization_id,provider,external_id', ignoreDuplicates: true }).select('id').maybeSingle();
  if (inboundError) throw new Error('wa_akg_inbound_persist_failed');
  if (!inbound) { await markEvent(admin, event, 'processed', { error_code: 'duplicate_inbound' }); return; }

  const occurredAt = text(payload.occurred_at, 80) || new Date().toISOString();
  const { error: messageError } = await admin.from('lead_messages').insert({
    organization_id: event.organization_id, lead_id: lead.id, whatsapp_account_id: active.account.id,
    sender: 'lead', sender_name: 'Lead', type: 'received', text: message, sent_at: occurredAt,
    provider: 'wa_akg', message_origin: 'customer', provider_message_id: messageId, provider_occurred_at: occurredAt,
  });
  if (messageError && messageError.code !== '23505') throw new Error('wa_akg_message_persist_failed');
  const { error: leadUpdateError } = await admin.from('leads').update({
    first_inbound_at: lead.first_inbound_at ?? occurredAt, last_contact: occurredAt,
    no_reply_deadline_at: null, no_reply_processed_at: null,
    contact_approval_status: 'approved', contact_approval_reason: 'Contato iniciou uma conversa individual pelo WhatsApp.',
    contact_approved_at: occurredAt, ...(reason === 'account_history_identity' ? {} : { whatsapp_account_id: active.account.id }),
  }).eq('organization_id', event.organization_id).eq('id', lead.id);
  if (leadUpdateError) throw new Error('wa_akg_lead_update_failed');

  const { data: queued, error: queuedError } = await admin.from('outreach_jobs').select('id,payload')
    .eq('organization_id', event.organization_id).eq('lead_id', lead.id).in('status', ['queued', 'retry']);
  if (queuedError) throw new Error('wa_akg_pending_jobs_read_failed');
  const automaticIds = (queued ?? []).filter((job) => object(job.payload).manual !== true).map((job) => job.id);
  if (automaticIds.length) await admin.from('outreach_jobs').update({
    status: 'cancelled', processed_at: occurredAt, error: 'cancelled_by_inbound_reply',
  }).eq('organization_id', event.organization_id).in('id', automaticIds).in('status', ['queued', 'retry']);

  const human = lead.ai_paused === true || lead.modo_atendimento === 'humano' || lead.automation_status === 'human';
  let anaCompleted = true;
  if (!human && active.controls.automation_enabled === true && active.controls.send_enabled === true) {
    const { data: credentials, error: secretError } = await admin.rpc('read_integration_secret', { p_integration: active.integration.id });
    const webhookSecret = text(object(credentials).webhook_secret, 256);
    if (secretError || !webhookSecret) throw new Error('wa_akg_ana_credential_missing');
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ana-run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
        'Content-Type': 'application/json', 'x-internal-worker-secret': webhookSecret,
      },
      body: JSON.stringify({
        event: 'message.received', message_id: messageId, request_id: `wa-akg:${messageId}`,
        retry_failed: true, lead_id: lead.id, modo: lead.modo_atendimento,
        organization_id: event.organization_id, source_integration_id: active.integration.id,
        contexto: { channel: 'whatsapp', inbound_event_id: externalId,
          media_requires_review: text(payload.message_type, 30) !== 'text' },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const result = object(await response.json().catch(() => null));
    anaCompleted = response.ok && (result.ok === true || result.duplicate === true);
  }
  await admin.from('channel_inbound_events').update({
    status: anaCompleted ? 'processed' : 'failed', error: anaCompleted ? null : 'ana_not_completed',
    processed_at: new Date().toISOString(),
  }).eq('id', inbound.id).eq('organization_id', event.organization_id);
  if (!anaCompleted) throw new Error('wa_akg_ana_not_completed');
  await markEvent(admin, event, 'processed');
}

async function processEvent(admin: Admin, event: Row): Promise<Row> {
  const { data: claimed, error } = await admin.from('wa_akg_webhook_events').update({
    processing_status: 'processing', attempt_count: Number(event.attempt_count ?? 0) + 1, error_code: null,
  }).eq('id', event.id).eq('organization_id', event.organization_id).in('processing_status', ['queued', 'failed'])
    .select('*').maybeSingle();
  if (error) throw new Error('wa_akg_event_claim_failed');
  if (!claimed) return { skipped: true };
  try {
    const payload = object(claimed.sanitized_payload);
    if (claimed.event_kind === 'inbound') await processInbound(admin, claimed, payload);
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
  const baseUrlInput = text(stored.base_url, 500) || text(Deno.env.get('WA_AKG_BASE_URL'), 500);
  const apiKey = text(stored.api_key, 1_000) || text(Deno.env.get('WA_AKG_API_KEY'), 1_000);
  if (!baseUrlInput || !apiKey) throw new Error('wa_akg_gateway_not_configured');
  return { baseUrl: normalizeWaAkgBaseUrl(baseUrlInput, allowedOrigins()), apiKey };
}

async function updateJob(admin: Admin, job: Row, state: string, values: Row = {}) {
  const { error } = await admin.from('wa_akg_seller_provisioning_jobs').update({
    state, updated_at: new Date().toISOString(), ...values,
  }).eq('id', job.id).eq('organization_id', job.organization_id).eq('state', 'processing');
  if (error) throw new Error('wa_akg_provisioning_state_save_failed');
}

async function processProvisioning(admin: Admin, job: Row): Promise<Row> {
  const { data: claimed, error } = await admin.from('wa_akg_seller_provisioning_jobs').update({
    state: 'processing', attempt_count: Number(job.attempt_count ?? 0) + 1,
    locked_at: new Date().toISOString(), locked_by: crypto.randomUUID(), error_code: null,
  }).eq('id', job.id).eq('organization_id', job.organization_id).in('state', ['queued', 'failed'])
    .select('*').maybeSingle();
  if (error) throw new Error('wa_akg_provisioning_claim_failed');
  if (!claimed) return { skipped: true };
  const accountId = text(claimed.account_id, 80);
  const integrationId = text(claimed.integration_id, 80);
  const sessionId = text(claimed.session_name, 120);
  if (!UUID.test(accountId) || !UUID.test(integrationId) || !sessionId) {
    await updateJob(admin, claimed, 'needs_review', { completed_at: new Date().toISOString(), error_code: 'wa_akg_job_invalid' });
    return { failed: true, review: true };
  }
  let gateway: { baseUrl: string; apiKey: string };
  try { gateway = await globalCredentials(admin, text(claimed.organization_id, 80)); }
  catch (error) {
    const code = safeError(error).replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 100);
    await updateJob(admin, claimed, 'failed', { next_attempt_at: retryAt(Number(claimed.attempt_count ?? 1)), error_code: code });
    return { failed: true, retryable: true, code };
  }
  const { data: previousData, error: previousError } = await admin.rpc('read_integration_secret', { p_integration: integrationId });
  if (previousError) throw new Error('wa_akg_provisioning_secret_read_failed');
  const previous = object(previousData);
  const webhookSecret = text(previous.webhook_secret, 256) || randomSecret();
  const secret = { session_id: sessionId, webhook_secret: webhookSecret, timeout_ms: 15_000 };
  const { error: preSaveError } = await admin.rpc('store_integration_secret', { p_integration: integrationId, p_secret: secret });
  if (preSaveError) throw new Error('wa_akg_provisioning_secret_save_failed');
  const provider = new WaAkgProvider({
    baseUrl: gateway.baseUrl, apiKey: gateway.apiKey, sessionId, allowedOrigins: allowedOrigins(), timeoutMs: 15_000,
  });
  try {
    if (previous.remote_created !== true) {
      try { await provider.create('WhatsApp do vendedor'); }
      catch (error) { if (safeError(error) !== 'wa_akg_request_rejected_409') throw error; }
    }
    await provider.configureSafety();
    await provider.registerWebhook(callbackUrl(integrationId), webhookSecret);
    await provider.start();
  } catch (error) {
    const code = safeError(error).replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 100) || 'wa_akg_remote_provision_uncertain';
    await updateJob(admin, claimed, 'needs_review', { completed_at: new Date().toISOString(), error_code: code });
    return { failed: true, review: true, code };
  }
  const { error: secretSaveError } = await admin.rpc('store_integration_secret', {
    p_integration: integrationId, p_secret: { ...secret, remote_created: true, webhook_registered: true },
  });
  if (secretSaveError) throw new Error('wa_akg_provisioning_secret_finalize_failed');
  const { data: integration } = await admin.from('integrations').select('configuration')
    .eq('id', integrationId).eq('organization_id', claimed.organization_id).maybeSingle();
  const now = new Date().toISOString();
  const [integrationUpdate, accountUpdate] = await Promise.all([
    admin.from('integrations').update({
      connected: false, enabled: false, paused: true,
      status_detail: 'Sessão individual criada. O vendedor deve ler o QR Code em Meu WhatsApp.',
      configuration: { ...object(integration?.configuration), configured: true, base_url_configured: true,
        session_name: sessionId, provider_version: '1.7.0-beta.1', provisioning_state: 'awaiting_qr' },
      updated_at: now,
    }).eq('id', integrationId).eq('organization_id', claimed.organization_id),
    admin.from('whatsapp_accounts').update({
      enabled: false, connection_status: 'qr', webhook_registered_at: now, status_checked_at: now,
      last_error_code: null, provider_metadata: { session_name: sessionId, provisioning_state: 'awaiting_qr' },
      updated_at: now,
    }).eq('id', accountId).eq('organization_id', claimed.organization_id),
  ]);
  if (integrationUpdate.error || accountUpdate.error) throw new Error('wa_akg_provisioning_finalize_failed');
  await updateJob(admin, claimed, 'completed', { completed_at: now, error_code: null });
  await admin.from('audit_logs').insert({
    organization_id: claimed.organization_id, actor_name: 'Sistema', actor_type: 'system',
    action: 'whatsapp.wa_akg_seller_session_created',
    detail: 'Sessão individual WA-AKG criada automaticamente; aguarda QR Code do vendedor.',
    entity_table: 'whatsapp_accounts', entity_id: accountId,
    event_data: { provider: 'wa_akg', provisioning_job_id: claimed.id, state: 'awaiting_qr' },
  });
  return { provisioned: true };
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
      let query = admin.from('wa_akg_webhook_events').select('*').in('processing_status', ['queued', 'failed'])
        .lte('next_retry_at', now).order('created_at').limit(20);
      if (UUID.test(eventId)) query = query.eq('id', eventId);
      if (UUID.test(organizationId)) query = query.eq('organization_id', organizationId);
      const { data, error } = await query;
      if (error) throw new Error('wa_akg_event_queue_read_failed');
      for (const event of data ?? []) events.push(await processEvent(admin, event as Row));
    }
    if (jobId || !eventId) {
      let query = admin.from('wa_akg_seller_provisioning_jobs').select('*').in('state', ['queued', 'failed'])
        .lte('next_attempt_at', now).order('created_at').limit(20);
      if (UUID.test(jobId)) query = query.eq('id', jobId);
      if (UUID.test(organizationId)) query = query.eq('organization_id', organizationId);
      const { data, error } = await query;
      if (error) throw new Error('wa_akg_provisioning_queue_read_failed');
      for (const job of data ?? []) jobs.push(await processProvisioning(admin, job as Row));
    }
    return json({
      ok: true, processed: events.filter((item) => item.processed).length,
      failed: events.filter((item) => item.failed).length,
      provisioned: jobs.filter((item) => item.provisioned).length,
      provisioning_failed: jobs.filter((item) => item.failed).length,
    });
  } catch (error) {
    const code = safeError(error).replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 120);
    return json({ ok: false, error: code }, 500);
  }
});
