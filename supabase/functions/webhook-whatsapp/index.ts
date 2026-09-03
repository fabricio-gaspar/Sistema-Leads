import { createAdminClient } from '../_shared/auth.ts';
import { json, safeError } from '../_shared/http.ts';

function secureEqual(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected || actual.length !== expected.length) return false;
  let difference = 0; for (let index = 0; index < actual.length; index += 1) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
const digits = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value).replace(/\D/g, '') : '';
const textValue = (payload: Record<string, unknown>): string => {
  const text = payload.text;
  if (typeof text === 'string') return text.trim().slice(0, 4_000);
  if (text && typeof text === 'object' && !Array.isArray(text) && typeof (text as Record<string, unknown>).message === 'string') return String((text as Record<string, unknown>).message).trim().slice(0, 4_000);
  return typeof payload.message === 'string' ? payload.message.trim().slice(0, 4_000) : '';
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!secureEqual(request.headers.get('x-leadai-webhook-secret'), Deno.env.get('WHATSAPP_WEBHOOK_SHARED_SECRET'))) return json({ error: 'invalid_webhook_signature' }, 401);
  try {
    const integrationId = new URL(request.url).searchParams.get('integration_id') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(integrationId)) throw new Error('invalid_integration_id');
    const raw = await request.text();
    if (!raw || raw.length > 32_768) throw new Error('invalid_payload');
    const payload = JSON.parse(raw) as Record<string, unknown>;
    if (!payload || Array.isArray(payload)) throw new Error('invalid_payload');
    const admin = createAdminClient();
    const { data: integration, error: integrationError } = await admin.from('integrations')
      .select('id,organization_id,provider,connected,enabled,paused').eq('id', integrationId).maybeSingle();
    if (integrationError || !integration || !integration.connected || !integration.enabled || integration.paused) return json({ error: 'integration_not_ready' }, 409);
    const payloadSha = await sha256(raw);
    const suppliedId = [payload.message_id, payload.messageId, payload.id].find((value) => typeof value === 'string' && value.length > 0 && value.length < 256) as string | undefined;
    const externalId = suppliedId ?? payloadSha;
    const eventType = typeof payload.type === 'string' ? payload.type.slice(0, 120) : 'message';
    const { data: event, error: eventError } = await admin.from('webhook_events').upsert({
      organization_id: integration.organization_id, provider: integration.provider || 'whatsapp', external_id: externalId,
      event_type: eventType, payload_sha: payloadSha, payload, status: 'received',
    }, { onConflict: 'organization_id,provider,external_id', ignoreDuplicates: true }).select('id').maybeSingle();
    if (eventError) throw new Error('event_persist_failed');
    const phone = digits(payload.phone ?? payload.senderPhone ?? payload.from);
    const message = textValue(payload);
    if (!phone || !message) {
      await admin.from('webhook_events').update({ status: 'ignored' }).eq('organization_id', integration.organization_id).eq('provider', integration.provider).eq('external_id', externalId);
      return json({ accepted: true, ignored: true }, 202);
    }
    const { data: candidates } = await admin.from('leads').select('id,modo_atendimento,owner_id,phone,whatsapp,first_inbound_at')
      .eq('organization_id', integration.organization_id).or(`phone.ilike.%${phone.slice(-11)}%,whatsapp.ilike.%${phone.slice(-11)}%`).limit(2);
    const lead = candidates?.find((item) => [digits(item.phone), digits(item.whatsapp)].some((candidate) => candidate.endsWith(phone.slice(-11)))) ?? null;
    if (!lead) {
      await admin.from('webhook_events').update({ status: 'unmatched' }).eq('organization_id', integration.organization_id).eq('provider', integration.provider).eq('external_id', externalId);
      await admin.from('audit_logs').insert({ organization_id: integration.organization_id, action: 'webhook.unmatched', detail: 'Mensagem recebida sem lead correspondente.', entity_table: 'webhook_events', entity_id: event?.id ?? null, event_data: { provider: integration.provider, phone_suffix: phone.slice(-4) } });
      return json({ accepted: true, matched: false }, 202);
    }
    await admin.from('channel_inbound_events').upsert({ organization_id: integration.organization_id, provider: integration.provider, event_type: eventType, external_id: externalId, lead_id: lead.id, payload, status: 'processing' }, { onConflict: 'organization_id,provider,external_id', ignoreDuplicates: true });
    const receivedAt = new Date().toISOString();
    await admin.from('lead_messages').insert({ organization_id: integration.organization_id, lead_id: lead.id, sender: 'lead', sender_name: 'Lead', type: 'received', text: message, sent_at: receivedAt });
    await admin.from('leads').update({
      first_inbound_at: lead.first_inbound_at ?? receivedAt,
      last_contact: receivedAt,
      no_reply_deadline_at: null,
      no_reply_processed_at: null,
    }).eq('organization_id', integration.organization_id).eq('id', lead.id);
    const anaResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ana-run`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-internal-worker-secret': Deno.env.get('WHATSAPP_WEBHOOK_SHARED_SECRET') ?? '' }, body: JSON.stringify({ event: 'message.received', lead_id: lead.id, modo: lead.modo_atendimento, organization_id: integration.organization_id, contexto: { channel: 'whatsapp', inbound_event_id: externalId } }) });
    await admin.from('channel_inbound_events').update({ status: anaResponse.ok ? 'processed' : 'failed', error: anaResponse.ok ? null : `ana_http_${anaResponse.status}`, processed_at: new Date().toISOString() }).eq('organization_id', integration.organization_id).eq('provider', integration.provider).eq('external_id', externalId);
    await admin.from('webhook_events').update({ status: anaResponse.ok ? 'processed' : 'failed' }).eq('organization_id', integration.organization_id).eq('provider', integration.provider).eq('external_id', externalId);
    await admin.from('audit_logs').insert({ organization_id: integration.organization_id, action: 'webhook.processed', detail: 'Mensagem de WhatsApp vinculada ao lead e entregue à Ana.', entity_table: 'leads', entity_id: lead.id, event_data: { provider: integration.provider, event_type: eventType, ana_status: anaResponse.status } });
    return json({ accepted: true, matched: true, processed: anaResponse.ok }, 202);
  } catch (error) { return json({ error: safeError(error) }, 400); }
});
