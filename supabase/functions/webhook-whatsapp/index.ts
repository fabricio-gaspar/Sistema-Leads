import { createAdminClient } from '../_shared/auth.ts';
import { json, safeError } from '../_shared/http.ts';
import { anaResponseSucceeded } from '../_shared/runtimeSafety.ts';
import { parseZapiEvent, type ZapiEvent } from '../_shared/zapiInbound.ts';

type Admin = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value: unknown, max = 1_000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const acceptedWebhook = (payload: Row) => json({ value: true, ...payload }, 200);

function secureEqual(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function siteEntryCode(message: string): string | null {
  const found = message.match(/\[WF:([a-z0-9]{8,32})\]/i);
  return found ? found[1].toUpperCase() : null;
}

function messageWithoutSiteEntryCode(message: string): string {
  return message.replace(/\s*\[WF:[a-z0-9]{8,32}\]\s*/ig, ' ').replace(/\s{2,}/g, ' ').trim();
}

async function createLeadFromWebsiteEntry(
  admin: Admin,
  organizationId: string,
  whatsappAccountId: string,
  phone: string,
  message: string,
): Promise<Row | null> {
  const entryCode = siteEntryCode(message);
  if (!entryCode) return null;
  const { data: entry, error: entryError } = await admin.from('whatsapp_site_entries')
    .select('id,source_label').eq('organization_id', organizationId).eq('entry_code', entryCode).eq('active', true).maybeSingle();
  if (entryError) throw new Error('site_entry_lookup_failed');
  if (!entry) return null;
  const identity = `whatsapp:${phone.replace(/\D/g, '')}`;
  const now = new Date().toISOString();
  const { data: lead, error: leadError } = await admin.from('leads').insert({
    organization_id: organizationId,
    company: 'Contato do site',
    contact: 'Visitante do site',
    phone,
    whatsapp: phone,
    segment: 'Site',
    score: 50,
    temp: 'warm',
    stage: 'Prospecção',
    value: 0,
    owner: 'ia',
    origin: entry.source_label,
    active_channel: 'whatsapp',
    whatsapp_account_id: whatsappAccountId,
    contact_approval_status: 'approved',
    contact_approval_reason: 'Contato iniciou conversa pelo botão do site.',
    contact_approved_at: now,
    first_inbound_at: now,
    last_contact: now,
    modo_atendimento: 'ia',
    automation_status: 'running',
    deduplication_key: identity,
    prospect_identity: identity,
    source_record_id: `website-whatsapp:${entry.id}`,
    source_metadata: { website_entry_id: entry.id, entry_channel: 'whatsapp' },
    score_snapshot: { fit: 50, contactability: 100, engagement: 50 },
    score_source: 'website_whatsapp',
    score_verified_at: now,
  }).select('id,modo_atendimento,ai_paused,automation_status,owner_id,first_inbound_at').maybeSingle();
  if (leadError) {
    if (leadError.code === '23505') return null;
    throw new Error('site_entry_lead_creation_failed');
  }
  if (!lead) throw new Error('site_entry_lead_missing');
  await admin.from('audit_logs').insert({
    organization_id: organizationId,
    action: 'webhook.site_lead_created',
    detail: 'Lead criado a partir da entrada de WhatsApp do site.',
    entity_table: 'leads',
    entity_id: lead.id,
    event_data: { source: 'website_whatsapp', phone_suffix: phone.slice(-4), whatsapp_account_id: whatsappAccountId },
  });
  return lead as Row;
}

function firstRow(value: unknown): Row | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && typeof candidate === 'object' ? candidate as Row : null;
}

async function persistWebhookEvent(
  admin: Admin,
  input: { organizationId: string; whatsappAccountId: string; provider: string; externalId: string; eventType: string; payloadSha: string; payload: Row; strictPayload: boolean },
): Promise<{ event: Row | null; duplicate: boolean }> {
  const { data, error } = await admin.from('webhook_events').upsert({
    organization_id: input.organizationId,
    whatsapp_account_id: input.whatsappAccountId,
    provider: input.provider,
    external_id: input.externalId,
    event_type: input.eventType,
    payload_sha: input.payloadSha,
    payload: input.payload,
    status: 'received',
    error: null,
    processed_at: null,
  }, {
    onConflict: 'organization_id,provider,external_id',
    ignoreDuplicates: true,
  }).select('id,status,error,lead_id,outreach_id,payload_sha,whatsapp_account_id').maybeSingle();
  if (error) throw new Error('event_persist_failed');
  const inserted = firstRow(data);
  if (inserted) return { event: inserted, duplicate: false };

  const { data: prior, error: priorError } = await admin.from('webhook_events')
    .select('id,status,error,lead_id,outreach_id,payload_sha,whatsapp_account_id')
    .eq('organization_id', input.organizationId)
    .eq('provider', input.provider)
    .eq('external_id', input.externalId)
    .maybeSingle();
  if (priorError) throw new Error('event_reconciliation_read_failed');
  const previous = firstRow(prior);
  if (input.strictPayload && previous && previous.payload_sha !== input.payloadSha) throw new Error('event_identity_conflict');
  if (previous?.status !== 'failed') return { event: previous, duplicate: true };

  const { data: claimed, error: claimError } = await admin.from('webhook_events').update({
    status: 'received', error: null, processed_at: null, payload_sha: input.payloadSha, payload: input.payload,
    whatsapp_account_id: input.whatsappAccountId,
  }).eq('id', previous.id).eq('organization_id', input.organizationId).eq('status', 'failed')
    .select('id,status,error,lead_id,outreach_id,payload_sha,whatsapp_account_id').maybeSingle();
  if (claimError) throw new Error('event_reconciliation_claim_failed');
  return { event: firstRow(claimed), duplicate: !claimed };
}

async function processReceipt(
  admin: Admin,
  organizationId: string,
  event: Row,
  receipt: Extract<ZapiEvent, { kind: 'receipt' }>,
): Promise<Response> {
  const { data, error } = await admin.rpc('reconcile_whatsapp_receipt', {
    p_organization_id: organizationId,
    p_provider_message_ids: receipt.providerMessageIds,
    p_expected_message_count: receipt.expectedMessageCount,
    p_status: receipt.status,
    p_occurred_at: receipt.occurredAt,
  });
  if (error) {
    if (safeError(error).includes('receipt_identity_ambiguous')) throw new Error('receipt_identity_ambiguous');
    throw new Error('receipt_reconciliation_failed');
  }
  const reconciledRows = (Array.isArray(data) ? data : data ? [data] : [])
    .filter((row): row is Row => Boolean(row && typeof row === 'object'));
  const reconciled = reconciledRows[0] ?? null;
  if (!reconciled) {
    const { error: stateError } = await admin.from('webhook_events').update({
      status: 'failed', error: 'outbound_message_not_matched', processed_at: new Date().toISOString(),
    }).eq('id', event.id).eq('organization_id', organizationId);
    if (stateError) throw new Error('receipt_state_persist_failed');
    return acceptedWebhook({ accepted: true, matched: false, reason: 'outbound_message_not_matched' });
  }

  const changed = reconciledRows.some((row) => row.changed === true);
  const partial = reconciledRows.length < receipt.expectedMessageCount;
  const { error: eventError } = await admin.from('webhook_events').update({
    status: partial ? 'failed' : 'processed',
    error: partial ? 'receipt_targets_pending' : changed ? null : 'receipt_already_reconciled',
    processed_at: new Date().toISOString(),
    lead_id: reconciled.lead_id ?? null, outreach_id: reconciled.outreach_id ?? null,
  }).eq('id', event.id).eq('organization_id', organizationId);
  if (eventError) throw new Error('receipt_state_persist_failed');
  return acceptedWebhook({ accepted: true, matched: true, processed: !partial, updated: changed, matched_count: reconciledRows.length, expected_count: receipt.expectedMessageCount, status: reconciled.current_status });
}

async function markInboundState(
  admin: Admin,
  organizationId: string,
  eventId: unknown,
  inboundId: unknown,
  leadId: unknown,
  succeeded: boolean,
  code: string | null,
) {
  const state = { status: succeeded ? 'processed' : 'failed', error: succeeded ? null : code, processed_at: new Date().toISOString() };
  const { error: inboundError } = await admin.from('channel_inbound_events').update(state)
    .eq('id', inboundId).eq('organization_id', organizationId);
  if (inboundError) throw new Error('inbound_state_persist_failed');
  const { error: eventError } = await admin.from('webhook_events').update({ ...state, lead_id: leadId })
    .eq('id', eventId).eq('organization_id', organizationId);
  if (eventError) throw new Error('event_state_persist_failed');
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const requestUrl = new URL(request.url);
  const integrationFromUrl = requestUrl.searchParams.get('integration_id') ?? '';
  const tokenFromUrl = requestUrl.searchParams.get('token') ?? '';
  const environmentSecret = Deno.env.get('WHATSAPP_WEBHOOK_SHARED_SECRET');
  const internalSignature = secureEqual(request.headers.get('x-leadai-webhook-secret'), environmentSecret);
  let authenticatedIntegrationId = '';
  let authenticatedAdmin: Admin | null = null;
  let internalCredential = internalSignature ? environmentSecret ?? '' : '';

  if (!internalSignature) {
    if (!UUID.test(integrationFromUrl) || !tokenFromUrl) return json({ error: 'invalid_webhook_signature' }, 401);
    authenticatedAdmin = createAdminClient();
    const { data: storedSecret, error: secretError } = await authenticatedAdmin.rpc('read_integration_secret', { p_integration: integrationFromUrl });
    const configuredToken = text(object(storedSecret).webhook_token, 1_000);
    if (secretError || !secureEqual(tokenFromUrl, configuredToken)) return json({ error: 'invalid_webhook_signature' }, 401);
    authenticatedIntegrationId = integrationFromUrl;
    internalCredential = tokenFromUrl;
  }

  let eventId: string | null = null;
  let eventOrg: string | null = null;
  let inboundId: string | null = null;
  try {
    const integrationId = authenticatedIntegrationId || integrationFromUrl;
    if (!UUID.test(integrationId)) throw new Error('invalid_integration_id');
    const raw = await request.text();
    if (!raw || raw.length > 32_768) throw new Error('invalid_payload');
    const payload = JSON.parse(raw) as Row;
    if (!payload || Array.isArray(payload) || typeof payload !== 'object') throw new Error('invalid_payload');

    const admin = authenticatedAdmin ?? createAdminClient();
    const { data: integration, error: integrationError } = await admin.from('integrations')
      .select('id,organization_id,provider,connected,enabled,paused').eq('id', integrationId).maybeSingle();
    if (integrationError || !integration) return json({ error: 'integration_not_ready' }, 409);
    if (!['zapi', 'z-api'].includes(String(integration.provider).toLowerCase())) return json({ error: 'unsupported_provider' }, 409);
    const { data: whatsappAccount, error: accountError } = await admin.from('whatsapp_accounts')
      .select('id,is_default,owner_user_id,enabled').eq('organization_id', integration.organization_id)
      .eq('integration_id', integration.id).is('archived_at', null).maybeSingle();
    if (accountError || !whatsappAccount) return json({ error: 'whatsapp_account_not_ready' }, 409);

    const { data: providerControl, error: providerControlError } = await admin.from('messaging_provider_controls')
      .select('inbound_enabled,kill_switch').eq('organization_id', integration.organization_id).eq('provider', 'zapi').maybeSingle();
    if (providerControlError) throw new Error('provider_control_read_failed');
    const hasExplicitProviderControl = providerControl
      && typeof providerControl.inbound_enabled === 'boolean'
      && typeof providerControl.kill_switch === 'boolean';
    if (hasExplicitProviderControl && (providerControl.inbound_enabled !== true || providerControl.kill_switch === true)) {
      // Confirmamos o callback para que o provedor não repita tentativas, porém
      // não persistimos nem roteamos a mensagem e jamais reativamos a conta.
      return acceptedWebhook({ accepted: true, ignored: true, reason: 'whatsapp_provider_disabled' });
    }

    authenticatedAdmin = admin;
    eventOrg = integration.organization_id;
    const normalized = parseZapiEvent(payload);
    const payloadSha = await sha256(raw);
    const suppliedId = [payload.message_id, payload.messageId, payload.id]
      .find((value) => typeof value === 'string' && value.length > 0 && value.length < 256) as string | undefined;
    const externalId = normalized.kind === 'receipt'
      ? `receipt:${normalized.status}:${await sha256(normalized.providerMessageIds.slice().sort().join('|'))}`
      : suppliedId ?? payloadSha;
    const eventType = text(payload.type, 120) || 'message';
    const persisted = await persistWebhookEvent(admin, {
      organizationId: integration.organization_id,
      whatsappAccountId: whatsappAccount.id,
      provider: integration.provider || 'whatsapp',
      externalId,
      eventType,
      payloadSha,
      payload,
      strictPayload: normalized.kind !== 'receipt',
    });
    if (!persisted.event || persisted.duplicate) return acceptedWebhook({ accepted: true, duplicate: true, processed: false });
    const event = persisted.event;
    eventId = String(event.id);

    if (normalized.kind === 'receipt') return await processReceipt(admin, integration.organization_id, event, normalized);
    if (normalized.kind === 'ignored') {
      const { error } = await admin.from('webhook_events').update({
        status: 'ignored', processed_at: new Date().toISOString(), error: normalized.reason,
      }).eq('id', event.id).eq('organization_id', eventOrg);
      if (error) throw new Error('ignored_event_state_persist_failed');
      return acceptedWebhook({ accepted: true, ignored: true, reason: normalized.reason });
    }

    const { phone, text: rawMessage } = normalized;
    const message = messageWithoutSiteEntryCode(rawMessage) || rawMessage;
    const { data: resolutionRows, error: resolutionError } = await admin.rpc('resolve_whatsapp_lead_for_account', {
      p_organization_id: integration.organization_id,
      p_account_id: whatsappAccount.id,
      p_phone: phone,
    });
    if (resolutionError) throw new Error('lead_resolution_failed');
    const resolution = firstRow(resolutionRows);
    let resolvedLeadId = text(resolution?.lead_id, 80);
    let resolutionReason = text(resolution?.reason, 120) || 'not_found';

    if (!resolvedLeadId && resolutionReason !== 'ambiguous_identity') {
      const websiteLead = await createLeadFromWebsiteEntry(admin, integration.organization_id, whatsappAccount.id, phone, rawMessage);
      if (websiteLead) {
        resolvedLeadId = text(websiteLead.id, 80);
        resolutionReason = 'site_entry_created';
      }
    }

    if (!resolvedLeadId) {
      const code = resolutionReason === 'ambiguous_identity' ? 'lead_identity_ambiguous' : 'lead_not_matched';
      const { error } = await admin.from('webhook_events').update({
        status: 'failed', error: code, processed_at: new Date().toISOString(),
      }).eq('id', event.id).eq('organization_id', eventOrg);
      if (error) throw new Error('unmatched_event_state_persist_failed');
      await admin.from('audit_logs').insert({
        organization_id: integration.organization_id,
        action: code === 'lead_identity_ambiguous' ? 'webhook.ambiguous' : 'webhook.unmatched',
        detail: code === 'lead_identity_ambiguous'
          ? 'Mensagem recebida para uma identidade compartilhada por mais de um lead e sem vínculo ativo de conversa.'
          : 'Mensagem recebida sem lead correspondente.',
        entity_table: 'webhook_events',
        entity_id: event.id,
        event_data: { provider: integration.provider, phone_suffix: phone.slice(-4), resolution: resolutionReason, whatsapp_account_id: whatsappAccount.id },
      });
      return acceptedWebhook({ accepted: true, matched: false, resolution: resolutionReason });
    }

    const { data: lead, error: leadError } = await admin.from('leads')
      .select('id,modo_atendimento,ai_paused,automation_status,owner_id,first_inbound_at,whatsapp_account_id')
      .eq('organization_id', integration.organization_id).eq('id', resolvedLeadId).maybeSingle();
    if (leadError || !lead) throw new Error('resolved_lead_not_found');

    const { data: insertedInbound, error: inboundError } = await admin.from('channel_inbound_events').upsert({
      organization_id: integration.organization_id,
      whatsapp_account_id: whatsappAccount.id,
      provider: integration.provider,
      event_type: eventType,
      external_id: externalId,
      lead_id: lead.id,
      payload,
      status: 'received',
      error: null,
      processed_at: null,
    }, { onConflict: 'organization_id,provider,external_id', ignoreDuplicates: true }).select('id,status,error').maybeSingle();
    if (inboundError) throw new Error('inbound_persist_failed');
    let inbound = firstRow(insertedInbound);
    if (!inbound) {
      const { data: priorInbound, error: priorInboundError } = await admin.from('channel_inbound_events')
        .select('id,status,error').eq('organization_id', integration.organization_id)
        .eq('provider', integration.provider).eq('external_id', externalId).maybeSingle();
      if (priorInboundError) throw new Error('inbound_reconciliation_read_failed');
      const previousInbound = firstRow(priorInbound);
      if (previousInbound?.status === 'processed' || previousInbound?.status === 'ignored') {
        await admin.from('webhook_events').update({ status: 'processed', error: 'duplicate_inbound_already_processed', processed_at: new Date().toISOString(), lead_id: lead.id })
          .eq('id', event.id).eq('organization_id', integration.organization_id);
        return acceptedWebhook({ accepted: true, duplicate: true, processed: true });
      }
      if (!previousInbound) throw new Error('inbound_reconciliation_missing');
      // A `received` row is already owned by a concurrent handler. Do not turn
      // it back into a new claim: doing so could run Ana twice for one message.
      // Only a handler that has explicitly recorded `failed` is eligible to retry.
      if (previousInbound.status !== 'failed') {
        return acceptedWebhook({
          accepted: true,
          duplicate: true,
          processed: false,
          processing: previousInbound.status === 'received',
          requires_reconciliation: true,
        });
      }
      const { data: claimedInbound, error: claimInboundError } = await admin.from('channel_inbound_events').update({
        status: 'received', error: null, processed_at: null, payload, lead_id: lead.id,
        whatsapp_account_id: whatsappAccount.id,
      }).eq('id', previousInbound.id).eq('organization_id', integration.organization_id)
        .eq('status', 'failed').select('id,status,error').maybeSingle();
      if (claimInboundError) throw new Error('inbound_reconciliation_claim_failed');
      inbound = firstRow(claimedInbound);
    }
    if (!inbound) throw new Error('inbound_reconciliation_claim_not_acquired');
    inboundId = String(inbound.id);

    const receivedAt = new Date().toISOString();
    const { data: insertedMessage, error: messageError } = await admin.from('lead_messages').insert({
      organization_id: integration.organization_id,
      lead_id: lead.id,
      whatsapp_account_id: whatsappAccount.id,
      sender: 'lead',
      sender_name: 'Lead',
      type: 'received',
      text: message,
      sent_at: receivedAt,
      provider_message_id: normalized.messageId,
    }).select('id').maybeSingle();
    if (messageError && messageError.code !== '23505') throw new Error('inbound_message_persist_failed');
    let storedMessage = firstRow(insertedMessage);
    if (!storedMessage) {
      const { data: priorMessage, error: priorMessageError } = await admin.from('lead_messages').select('id,lead_id,sender,type,text')
        .eq('organization_id', integration.organization_id).eq('provider_message_id', normalized.messageId).maybeSingle();
      if (priorMessageError || !priorMessage || priorMessage.lead_id !== lead.id
        || priorMessage.sender !== 'lead' || priorMessage.type !== 'received' || priorMessage.text !== message) {
        throw new Error('inbound_message_reconciliation_failed');
      }
      storedMessage = priorMessage;
    }

    const { data: cancellableJobs, error: jobsError } = await admin.from('outreach_jobs').select('id,payload')
      .eq('organization_id', integration.organization_id).eq('lead_id', lead.id).in('status', ['queued', 'retry']);
    if (jobsError) throw new Error('inbound_jobs_read_failed');
    const automatedJobIds = (cancellableJobs ?? []).filter((job) => object(job.payload).manual !== true).map((job) => job.id);
    if (automatedJobIds.length) {
      const { error: cancelError } = await admin.from('outreach_jobs').update({
        status: 'cancelled', processed_at: receivedAt, error: 'cancelled_by_inbound_reply',
      }).eq('organization_id', integration.organization_id).eq('lead_id', lead.id)
        .in('id', automatedJobIds).in('status', ['queued', 'retry']);
      if (cancelError) throw new Error('inbound_jobs_cancel_failed');
    }

    const { data: latestOutreach, error: outreachError } = await admin.from('lead_outreach')
      .select('id').eq('organization_id', integration.organization_id).eq('lead_id', lead.id)
      .eq('whatsapp_account_id', whatsappAccount.id)
      .in('status', ['sent', 'delivered', 'read']).order('sent_at', { ascending: false }).limit(1).maybeSingle();
    if (outreachError) throw new Error('inbound_outreach_read_failed');
    if (latestOutreach) {
      const { error: replyError } = await admin.from('lead_outreach').update({ status: 'replied', replied_at: receivedAt, updated_at: receivedAt })
        .eq('id', latestOutreach.id).eq('organization_id', integration.organization_id);
      if (replyError) throw new Error('inbound_outreach_update_failed');
    }

    const leadUpdate: Row = {
      first_inbound_at: lead.first_inbound_at ?? receivedAt,
      last_contact: receivedAt,
      no_reply_deadline_at: null,
      no_reply_processed_at: null,
      contact_approval_status: 'approved',
      contact_approval_reason: 'Contato iniciou uma conversa individual no WhatsApp.',
      contact_approved_at: receivedAt,
    };
    // A resposta pode chegar pelo número anterior depois de uma transferência.
    // Ela pertence ao mesmo histórico, mas não pode desfazer o novo canal ativo.
    if (resolutionReason !== 'account_history_identity') {
      leadUpdate.whatsapp_account_id = whatsappAccount.id;
    }
    const { error: leadUpdateError } = await admin.from('leads').update(leadUpdate)
      .eq('organization_id', integration.organization_id).eq('id', lead.id);
    if (leadUpdateError) throw new Error('inbound_lead_update_failed');

    const humanResponsible = lead.ai_paused === true || lead.modo_atendimento === 'humano' || lead.automation_status === 'human';
    let succeeded = true;
    let skipped = humanResponsible;
    let skipReason = humanResponsible ? 'human_responsible' : null;
    let anaStatus: number | null = null;
    if (!humanResponsible) {
      const serviceJwt = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!serviceJwt || !internalCredential) throw new Error('internal_auth_not_configured');
      const anaResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ana-run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceJwt}`,
          'Content-Type': 'application/json',
          'x-internal-worker-secret': internalCredential,
        },
        body: JSON.stringify({
          event: 'message.received',
          message_id: normalized.messageId,
          request_id: `inbound:${normalized.messageId}`,
          retry_failed: true,
          lead_id: lead.id,
          modo: lead.modo_atendimento,
          organization_id: integration.organization_id,
          source_integration_id: integration.id,
          contexto: {
            channel: 'whatsapp',
            inbound_event_id: externalId,
            inbound_row_id: inbound.id,
            stored_message_id: storedMessage.id,
            media_requires_review: normalized.mediaRequiresReview,
            lead_resolution: resolutionReason,
          },
        }),
        signal: AbortSignal.timeout(45_000),
      });
      anaStatus = anaResponse.status;
      const anaResult = await anaResponse.json().catch(() => null) as Row | null;
      succeeded = anaResponseSucceeded(anaResponse.status, anaResult);
      skipped = anaResult?.skipped === true;
      skipReason = skipped ? text(anaResult?.reason, 120) || 'ana_skipped' : null;
    }

    const stateError = succeeded ? null : `ana_not_completed_${anaStatus ?? 'unknown'}`;
    await markInboundState(admin, integration.organization_id, event.id, inbound.id, lead.id, succeeded, stateError);

    const healthDetail = humanResponsible
      ? 'Resposta recebida e vinculada ao lead; a Ana não foi acionada porque o atendimento está com uma pessoa.'
      : succeeded && skipped
        ? `Resposta recebida e vinculada; a Ana não enviou resposta (${skipReason}).`
        : succeeded
          ? 'Resposta recebida, vinculada ao lead e processada pela Ana.'
          : 'Resposta recebida, mas o processamento da Ana precisa de reconciliação.';
    const { error: accountIntegrationHealthError } = await admin.from('integrations').update({
      connected: true,
      enabled: integration.enabled === true,
      paused: integration.paused === true,
      last_tested_at: receivedAt,
      last_success_at: receivedAt,
      last_error: stateError,
      status_detail: healthDetail,
      updated_at: receivedAt,
    }).eq('id', integration.id).eq('organization_id', eventOrg);
    const { error: accountHealthError } = await admin.from('whatsapp_accounts').update({
      enabled: whatsappAccount.enabled === true,
      connection_status: 'connected',
      connected_at: receivedAt,
      status_checked_at: receivedAt,
      webhook_registered_at: receivedAt,
      last_error_code: stateError,
      updated_at: receivedAt,
    }).eq('id', whatsappAccount.id).eq('organization_id', eventOrg);
    if (accountIntegrationHealthError || accountHealthError) throw new Error('whatsapp_account_health_persist_failed');
    const webhookHealth = whatsappAccount.is_default ? await admin.from('integrations').update({
      connected: true,
      enabled: integration.enabled === true,
      paused: integration.paused === true,
      last_tested_at: receivedAt,
      last_success_at: receivedAt,
      last_error: stateError,
      status_detail: healthDetail,
      updated_at: receivedAt,
    }).eq('organization_id', eventOrg).eq('key', 'zapi_webhook') : { error: null };
    if (webhookHealth.error) throw new Error('webhook_health_persist_failed');

    await admin.from('audit_logs').insert({
      organization_id: integration.organization_id,
      action: succeeded ? 'webhook.processed' : 'webhook.failed',
      detail: healthDetail,
      entity_table: 'leads',
      entity_id: lead.id,
      event_data: {
        provider: integration.provider,
        event_type: eventType,
        ana_status: anaStatus,
        skipped,
        skip_reason: skipReason,
        cancelled_automatic_jobs: automatedJobIds.length,
        lead_resolution: resolutionReason,
        whatsapp_account_id: whatsappAccount.id,
      },
    });
    return acceptedWebhook({ accepted: true, matched: true, processed: succeeded, skipped, skip_reason: skipReason, resolution: resolutionReason });
  } catch (error) {
    const code = safeError(error).replace(/[^a-z0-9_]/gi, '_').slice(0, 100);
    if (authenticatedAdmin && eventId && eventOrg) {
      await authenticatedAdmin.from('webhook_events').update({
        status: 'failed', error: code, processed_at: new Date().toISOString(),
      }).eq('id', eventId).eq('organization_id', eventOrg);
      if (inboundId) await authenticatedAdmin.from('channel_inbound_events').update({
        status: 'failed', error: code, processed_at: new Date().toISOString(),
      }).eq('id', inboundId).eq('organization_id', eventOrg);
    }
    return eventId
      ? acceptedWebhook({ accepted: true, processed: false, requires_reconciliation: true, error: code })
      : json({ error: code, accepted: false, requires_reconciliation: false }, 400);
  }
});
