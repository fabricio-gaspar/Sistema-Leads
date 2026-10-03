import { createAdminClient } from '../_shared/auth.ts';
import { json, safeError } from '../_shared/http.ts';

type Admin = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown, max = 4_000): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function processConnection(admin: Admin, event: Row, payload: Row) {
  const { account, integration } = await accountIntegration(admin, event);
  const state = text(payload.state, 40);
  const connected = state === 'connected';
  const now = new Date().toISOString();
  const { error: accountError } = await admin.from('whatsapp_accounts').update({
    connection_status: connected ? 'connected' : 'disconnected', status_checked_at: now,
    connected_at: connected ? now : null, last_error_code: connected ? null : `provider_${state || 'disconnected'}`,
  }).eq('id', account.id).eq('organization_id', event.organization_id);
  const { error: integrationError } = await admin.from('integrations').update({
    connected, enabled: connected ? integration.enabled : false, paused: connected ? integration.paused : true,
    last_tested_at: now, last_success_at: connected ? now : null,
    last_error: connected ? null : `provider_${state || 'disconnected'}`,
    status_detail: connected ? 'Evolution GO confirmou a conexão.' : 'Evolution GO informou que a sessão foi desconectada.',
  }).eq('id', integration.id).eq('organization_id', event.organization_id);
  if (accountError || integrationError) throw new Error('evolution_go_connection_state_save_failed');
  await mark(admin, event, 'processed');
}

async function processReceipt(admin: Admin, event: Row, payload: Row) {
  const messageIds = Array.isArray(payload.provider_message_ids)
    ? [...new Set(payload.provider_message_ids.filter((value): value is string => typeof value === 'string' && value.length <= 300))].slice(0, 100)
    : [];
  const status = text(payload.status, 30);
  if (!messageIds.length || !['sent', 'delivered', 'read', 'failed'].includes(status)) {
    await mark(admin, event, 'ignored', { error_code: 'receipt_payload_invalid' });
    return;
  }
  const { data, error } = await admin.rpc('reconcile_whatsapp_receipt', {
    p_organization_id: event.organization_id, p_provider_message_ids: messageIds,
    p_expected_message_count: messageIds.length, p_status: status,
    p_occurred_at: text(payload.timestamp, 80) || new Date().toISOString(),
  });
  if (error) throw new Error('evolution_go_receipt_reconciliation_failed');
  if (!Array.isArray(data) || !data.length) {
    await mark(admin, event, 'needs_review', { error_code: 'outbound_message_not_matched' });
    return;
  }
  await mark(admin, event, 'processed');
}

async function processInbound(admin: Admin, event: Row, payload: Row) {
  const { account, integration } = await accountIntegration(admin, event);
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
    .select('id,modo_atendimento,ai_paused,automation_status,first_inbound_at').eq('organization_id', event.organization_id).eq('id', leadId).maybeSingle();
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

  const { error: leadUpdateError } = await admin.from('leads').update({
    first_inbound_at: lead.first_inbound_at ?? occurredAt, last_contact: occurredAt, no_reply_deadline_at: null,
    no_reply_processed_at: null, contact_approval_status: 'approved',
    contact_approval_reason: 'Contato iniciou uma conversa individual pelo WhatsApp.', contact_approved_at: occurredAt,
    whatsapp_account_id: account.id,
  }).eq('organization_id', event.organization_id).eq('id', lead.id);
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
    const { data: secret, error: secretError } = await admin.rpc('read_integration_secret', { p_integration: integration.id });
    const webhookSecret = text(object(secret).webhook_secret, 256);
    if (secretError || !webhookSecret) throw new Error('evolution_go_ana_credential_missing');
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ana-run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`, 'Content-Type': 'application/json', 'x-internal-worker-secret': webhookSecret },
      body: JSON.stringify({ event: 'message.received', message_id: messageId, request_id: `evolution:${messageId}`,
        retry_failed: true, lead_id: lead.id, modo: lead.modo_atendimento, organization_id: event.organization_id,
        source_integration_id: integration.id, contexto: { channel: 'whatsapp', inbound_event_id: externalId, media_requires_review: Boolean(text(payload.media_kind, 30)) },
      }), signal: AbortSignal.timeout(45_000),
    });
    const result = object(await response.json().catch(() => null));
    // The Ana endpoint's idempotent duplicate is already a completed delivery;
    // retrying it would only create queue noise and cannot generate a second reply.
    anaCompleted = response.ok && (result.ok === true || result.duplicate === true);
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
    const attempts = Number(owned.attempt_count ?? 1);
    await mark(admin, owned, attempts >= 5 ? 'dead_letter' : 'failed', { error_code: code, next_retry_at: retryAt(attempts) });
    return { failed: true, code };
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  if (!serviceRoleAuthorized(request) && !secureEqual(request.headers.get('x-evolution-go-worker-token'), Deno.env.get('EVOLUTION_GO_WORKER_TOKEN'))) {
    return json({ ok: false, error: 'worker_auth_required' }, 401);
  }
  try {
    const body = object(await request.json().catch(() => ({})));
    const eventId = text(body.event_id, 80);
    const organizationId = text(body.organization_id, 80);
    const admin = createAdminClient();
    let query = admin.from('evolution_go_webhook_events').select('*').in('processing_status', ['queued', 'failed'])
      .lte('next_retry_at', new Date().toISOString()).order('created_at', { ascending: true }).limit(20);
    if (UUID.test(eventId)) query = query.eq('id', eventId);
    if (UUID.test(organizationId)) query = query.eq('organization_id', organizationId);
    const { data, error } = await query;
    if (error) throw new Error('evolution_go_queue_read_failed');
    const results = [];
    for (const event of data ?? []) results.push(await processOne(admin, event as Row));
    return json({ ok: true, processed: results.filter((result) => result.processed).length, failed: results.filter((result) => result.failed).length, skipped: results.filter((result) => result.skipped).length });
  } catch (error) {
    return json({ ok: false, error: safeError(error).replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 100) }, 500);
  }
});
