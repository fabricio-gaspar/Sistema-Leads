import { createAdminClient } from '../_shared/auth.ts';
import { json, safeError } from '../_shared/http.ts';
import { sha256Hex, verifyMetaSignature } from '../_shared/messaging/metaSignature.ts';
import { parseMetaWebhook, type MetaWebhookEvent } from '../_shared/messaging/metaWebhookParser.ts';

type Admin = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;

function asObject(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
}

function asText(value: unknown, maximum = 4_096): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function secureEqual(left: string | null, right: string | undefined): boolean {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function sanitizedMetadata(event: MetaWebhookEvent): Row {
  if (event.kind === 'ignored') return { reason: event.reason };
  if (event.kind === 'status') return {
    phone_number_id: event.phoneNumberId,
    provider_message_id: event.providerMessageId,
    recipient_id: event.recipientId,
    status: event.status,
    error: event.error,
    pricing_category: event.pricingCategory,
  };
  if (event.kind === 'inbound') return {
    phone_number_id: event.phoneNumberId,
    provider_message_id: event.providerMessageId,
    from: event.from,
    message_type: event.messageType,
    has_text: Boolean(event.text),
    has_media: Boolean(event.mediaId),
    media_id: event.mediaId,
  };
  if (event.kind === 'message_echo') return {
    phone_number_id: event.phoneNumberId,
    provider_message_id: event.providerMessageId,
    to: event.to,
    message_type: event.messageType,
    has_text: Boolean(event.text),
    has_media: Boolean(event.mediaId),
    media_id: event.mediaId,
  };
  return { phone_number_id: event.phoneNumberId, cursor_present: Boolean(event.cursor) };
}

async function accountForEvent(admin: Admin, event: MetaWebhookEvent) {
  if (event.kind === 'ignored') return null;
  const { data, error } = await admin.from('whatsapp_accounts')
    .select('id,organization_id,integration_id,owner_user_id,provider,enabled,connection_status')
    .eq('provider', 'meta_cloud').eq('phone_number_id', event.phoneNumberId)
    .is('archived_at', null).maybeSingle();
  if (error) throw new Error('meta_account_lookup_failed');
  return data as Row | null;
}

async function processingEnabled(admin: Admin, organizationId: string): Promise<{ inbound: boolean; automation: boolean }> {
  const [flagRead, controlRead] = await Promise.all([
    admin.from('organization_feature_flags').select('enabled')
      .eq('organization_id', organizationId).eq('flag_key', 'meta_coexistence').maybeSingle(),
    admin.from('messaging_provider_controls').select('inbound_enabled,automation_enabled,kill_switch')
      .eq('organization_id', organizationId).eq('provider', 'meta_cloud').maybeSingle(),
  ]);
  if (flagRead.error || controlRead.error) throw new Error('meta_provider_control_read_failed');
  const flag = flagRead.data?.enabled === true;
  const control = controlRead.data;
  const live = flag && control?.kill_switch === false;
  return { inbound: live && control?.inbound_enabled === true, automation: live && control?.automation_enabled === true };
}

async function reserveEvent(
  admin: Admin,
  event: MetaWebhookEvent,
  account: Row | null,
  payloadHash: string,
): Promise<{ id: string; duplicateComplete: boolean }> {
  const organizationId = asText(account?.organization_id, 80) || null;
  const accountId = asText(account?.id, 80) || null;
  const occurredAt = event.kind === 'ignored' ? null : event.occurredAt;
  const { data, error } = await admin.from('messaging_webhook_events').insert({
    organization_id: organizationId,
    whatsapp_account_id: accountId,
    provider: 'meta_cloud',
    external_event_id: event.externalEventId,
    event_kind: event.kind === 'message_echo' ? 'message_echo' : event.kind === 'ignored' ? 'unknown' : event.kind,
    payload_hash: payloadHash,
    sanitized_metadata: sanitizedMetadata(event),
    processing_status: 'received',
    occurred_at: occurredAt,
  }).select('id').single();
  if (!error && data?.id) return { id: data.id as string, duplicateComplete: false };
  if (error?.code !== '23505') throw new Error('meta_webhook_event_reservation_failed');
  const { data: existing, error: existingError } = await admin.from('messaging_webhook_events')
    .select('id,processing_status').eq('provider', 'meta_cloud')
    .eq('external_event_id', event.externalEventId).maybeSingle();
  if (existingError || !existing?.id) throw new Error('meta_webhook_event_read_failed');
  return {
    id: existing.id as string,
    duplicateComplete: ['processed', 'ignored', 'needs_review'].includes(asText(existing.processing_status, 40)),
  };
}

async function completeEvent(admin: Admin, id: string, status: 'processed' | 'ignored' | 'needs_review' | 'failed', errorCode?: string) {
  const now = new Date().toISOString();
  const { error } = await admin.from('messaging_webhook_events').update({
    processing_status: status,
    error_code: errorCode || null,
    processed_at: status === 'failed' ? null : now,
    next_retry_at: status === 'failed' ? new Date(Date.now() + 60_000).toISOString() : null,
  }).eq('id', id);
  if (error) throw new Error('meta_webhook_event_completion_failed');
}

async function resolveLead(admin: Admin, organizationId: string, accountId: string, phone: string) {
  const { data, error } = await admin.rpc('resolve_whatsapp_lead_for_account', {
    p_organization_id: organizationId,
    p_account_id: accountId,
    p_phone: phone,
  });
  if (error) throw new Error('meta_lead_resolution_failed');
  const row = Array.isArray(data) ? asObject(data[0]) : asObject(data);
  return { leadId: asText(row.lead_id, 80), reason: asText(row.reason, 120) || 'not_found' };
}

async function upsertConversation(
  admin: Admin,
  account: Row,
  lead: Row,
  customerPhone: string,
  occurredAt: string,
  inbound: boolean,
): Promise<string> {
  const organizationId = asText(account.organization_id, 80);
  const accountId = asText(account.id, 80);
  const { data: current, error: currentError } = await admin.from('whatsapp_conversations')
    .select('id,unread_count,last_message_at').eq('organization_id', organizationId)
    .eq('whatsapp_account_id', accountId).eq('external_conversation_id', customerPhone).maybeSingle();
  if (currentError) throw new Error('meta_conversation_read_failed');
  const existingLast = current?.last_message_at ? new Date(current.last_message_at).getTime() : 0;
  const incomingTime = new Date(occurredAt).getTime();
  const patch: Row = {
    organization_id: organizationId,
    whatsapp_account_id: accountId,
    lead_id: lead.id,
    owner_user_id: lead.assigned_to || lead.owner_id || account.owner_user_id || null,
    external_conversation_id: customerPhone,
    customer_phone_identity: customerPhone,
    status: 'open',
    last_message_at: incomingTime >= existingLast ? occurredAt : current?.last_message_at,
    unread_count: inbound ? Number(current?.unread_count ?? 0) + 1 : Number(current?.unread_count ?? 0),
  };
  if (inbound) {
    patch.last_inbound_at = occurredAt;
    patch.service_window_opened_at = occurredAt;
    patch.service_window_expires_at = new Date(incomingTime + 24 * 60 * 60 * 1_000).toISOString();
  } else patch.last_outbound_at = occurredAt;
  const { data, error } = await admin.from('whatsapp_conversations').upsert(patch, {
    onConflict: 'organization_id,whatsapp_account_id,external_conversation_id',
  }).select('id').single();
  if (error || !data?.id) throw new Error('meta_conversation_write_failed');
  return data.id as string;
}

async function processMessage(
  admin: Admin,
  event: Extract<MetaWebhookEvent, { kind: 'inbound' | 'message_echo' }>,
  account: Row,
  automationEnabled: boolean,
) {
  const organizationId = asText(account.organization_id, 80);
  const accountId = asText(account.id, 80);
  const customerPhone = event.kind === 'inbound' ? event.from : event.to;
  if (!customerPhone) return { status: 'needs_review' as const, reason: 'meta_echo_recipient_missing' };
  const resolution = await resolveLead(admin, organizationId, accountId, customerPhone);
  if (!resolution.leadId) return { status: 'needs_review' as const, reason: `meta_lead_${resolution.reason}`.slice(0, 160) };
  const { data: lead, error: leadError } = await admin.from('leads')
    .select('id,owner_id,assigned_to,modo_atendimento,ai_paused,opt_out,first_inbound_at,whatsapp_account_id')
    .eq('id', resolution.leadId).eq('organization_id', organizationId).maybeSingle();
  if (leadError || !lead) throw new Error('meta_lead_read_failed');

  const { data: duplicate, error: duplicateError } = await admin.from('lead_messages')
    .select('id').eq('organization_id', organizationId)
    .eq('provider_message_id', event.providerMessageId).maybeSingle();
  if (duplicateError) throw new Error('meta_message_duplicate_read_failed');
  if (duplicate?.id) {
    if (event.kind === 'inbound' && automationEnabled) {
      await dispatchAna(admin, account, lead, duplicate.id as string);
    }
    return { status: 'processed' as const, reason: 'meta_message_duplicate' };
  }

  const conversationId = await upsertConversation(admin, account, lead, customerPhone, event.occurredAt, event.kind === 'inbound');
  const content = event.text || `[${event.messageType} recebido; conteúdo disponível para revisão no provedor.]`;
  const { data: message, error: messageError } = await admin.from('lead_messages').insert({
    organization_id: organizationId,
    lead_id: lead.id,
    whatsapp_account_id: accountId,
    conversation_id: conversationId,
    sender: event.kind === 'inbound' ? 'lead' : 'human',
    sender_name: event.kind === 'inbound' ? 'Cliente' : 'WhatsApp Business',
    type: event.kind === 'inbound' ? 'received' : 'sent',
    text: content,
    sent_at: event.occurredAt,
    provider_message_id: event.providerMessageId,
    provider: 'meta_cloud',
    message_origin: event.kind === 'inbound' ? 'customer' : 'business_app',
    message_category: event.messageType,
    delivery_status: event.kind === 'inbound' ? null : 'sent',
    provider_status_at: event.kind === 'inbound' ? null : event.occurredAt,
    provider_occurred_at: event.occurredAt,
    provider_media_id: event.mediaId,
  }).select('id').single();
  if (messageError || !message?.id) throw new Error('meta_message_write_failed');

  if (event.kind === 'inbound') {
    const leadUpdate: Row = {
      active_channel: 'whatsapp',
      first_inbound_at: lead.first_inbound_at || event.occurredAt,
      last_contact: event.occurredAt,
      updated_at: new Date().toISOString(),
    };
    if (resolution.reason !== 'account_history_identity') leadUpdate.whatsapp_account_id = accountId;
    const { error: leadUpdateError } = await admin.from('leads').update(leadUpdate)
      .eq('id', lead.id).eq('organization_id', organizationId);
    if (leadUpdateError) throw new Error('meta_lead_update_failed');

    if (automationEnabled) await dispatchAna(admin, account, lead, message.id as string);
  }
  return { status: 'processed' as const, reason: 'meta_message_recorded' };
}

async function dispatchAna(admin: Admin, account: Row, lead: Row, sourceMessageId: string) {
  if (lead.modo_atendimento !== 'ia' || lead.ai_paused === true || lead.opt_out === true) return;
  const internalSecret = Deno.env.get('WHATSAPP_WEBHOOK_SHARED_SECRET');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const integrationId = asText(account.integration_id, 80);
  if (!internalSecret || !serviceRole || !supabaseUrl || !integrationId) throw new Error('meta_ana_internal_configuration_missing');
  const response = await fetch(`${supabaseUrl}/functions/v1/ana-run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
      'x-internal-worker-secret': internalSecret,
    },
    body: JSON.stringify({
      organization_id: account.organization_id,
      lead_id: lead.id,
      event: 'message.received',
      source_integration_id: integrationId,
      source_message_id: sourceMessageId,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error('meta_ana_dispatch_failed');
}

async function processStatus(admin: Admin, event: Extract<MetaWebhookEvent, { kind: 'status' }>, account: Row) {
  const { error } = await admin.rpc('apply_meta_message_status', {
    p_organization_id: account.organization_id,
    p_whatsapp_account_id: account.id,
    p_provider_message_id: event.providerMessageId,
    p_status: event.status,
    p_occurred_at: event.occurredAt,
    p_sanitized_error: event.error,
  });
  if (error) throw new Error('meta_status_reconciliation_failed');
}

async function processSync(admin: Admin, event: Extract<MetaWebhookEvent, { kind: 'history' | 'sync' }>, account: Row) {
  const { error } = await admin.from('whatsapp_sync_state').upsert({
    whatsapp_account_id: account.id,
    organization_id: account.organization_id,
    sync_kind: event.kind === 'history' ? 'history' : 'coexistence',
    status: 'running',
    cursor_value: event.cursor,
    last_event_at: event.occurredAt,
    last_error_code: null,
  }, { onConflict: 'whatsapp_account_id' });
  if (error) throw new Error('meta_sync_state_write_failed');
}

async function handlePost(request: Request): Promise<Response> {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(length) && length > 2_000_000) return json({ ok: false, error: 'payload_too_large' }, 413);
  const rawBody = await request.text();
  if (rawBody.length > 2_000_000) return json({ ok: false, error: 'payload_too_large' }, 413);
  const appSecret = Deno.env.get('META_APP_SECRET') ?? '';
  const valid = await verifyMetaSignature(rawBody, request.headers.get('x-hub-signature-256'), appSecret);
  if (!valid) return json({ ok: false, error: 'invalid_signature' }, 401);
  const payload = JSON.parse(rawBody) as unknown;
  const events = parseMetaWebhook(payload);
  const payloadHash = await sha256Hex(rawBody);
  const admin = createAdminClient();
  let processed = 0;
  for (const event of events) {
    const account = await accountForEvent(admin, event);
    const reservation = await reserveEvent(admin, event, account, payloadHash);
    if (reservation.duplicateComplete) continue;
    try {
      if (event.kind === 'ignored') {
        await completeEvent(admin, reservation.id, 'ignored', event.reason);
        continue;
      }
      if (!account) {
        await completeEvent(admin, reservation.id, 'needs_review', 'meta_account_not_found');
        continue;
      }
      const control = await processingEnabled(admin, asText(account.organization_id, 80));
      if (!control.inbound) {
        await completeEvent(admin, reservation.id, 'ignored', 'meta_inbound_disabled');
        continue;
      }
      if (event.kind === 'status') await processStatus(admin, event, account);
      else if (event.kind === 'history' || event.kind === 'sync') await processSync(admin, event, account);
      else if (event.kind === 'inbound' || event.kind === 'message_echo') {
        const result = await processMessage(admin, event, account, control.automation);
        await completeEvent(admin, reservation.id, result.status, result.status === 'needs_review' ? result.reason : undefined);
        processed += result.status === 'processed' ? 1 : 0;
        continue;
      }
      else throw new Error('meta_event_kind_unsupported');
      await completeEvent(admin, reservation.id, 'processed');
      processed += 1;
    } catch (error) {
      const code = safeError(error).replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 160);
      await completeEvent(admin, reservation.id, 'failed', code || 'meta_webhook_processing_failed');
      throw error;
    }
  }
  return json({ ok: true, accepted: events.length, processed }, 200);
}

Deno.serve(async (request) => {
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && challenge && secureEqual(token, Deno.env.get('META_WEBHOOK_VERIFY_TOKEN'))) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    return json({ ok: false, error: 'verification_failed' }, 403);
  }
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  try {
    return await handlePost(request);
  } catch (error) {
    return json({ ok: false, error: safeError(error).replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 160) }, 500);
  }
});
