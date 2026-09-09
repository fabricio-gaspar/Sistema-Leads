import { createAdminClient } from '../_shared/auth.ts';
import { json, safeError } from '../_shared/http.ts';
import { anaResponseSucceeded } from '../_shared/runtimeSafety.ts';
import { parseZapiEvent, storedPhone } from '../_shared/zapiInbound.ts';

function secureEqual(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected || actual.length !== expected.length) return false;
  let difference = 0; for (let index = 0; index < actual.length; index += 1) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const requestUrl = new URL(request.url);
  const integrationFromUrl = requestUrl.searchParams.get('integration_id') ?? '';
  const tokenFromUrl = requestUrl.searchParams.get('token') ?? '';
  const internalSignature = secureEqual(request.headers.get('x-leadai-webhook-secret'), Deno.env.get('WHATSAPP_WEBHOOK_SHARED_SECRET'));
  let authenticatedIntegrationId = '';
  let authenticatedAdmin: ReturnType<typeof createAdminClient> | null = null;
  if (!internalSignature) {
    if (!/^[0-9a-f-]{36}$/i.test(integrationFromUrl) || !tokenFromUrl) return json({ error: 'invalid_webhook_signature' }, 401);
    authenticatedAdmin = createAdminClient();
    const { data: storedSecret } = await authenticatedAdmin.rpc('read_integration_secret', { p_integration: integrationFromUrl });
    const configuredToken = typeof storedSecret === 'object' && storedSecret !== null && 'webhook_token' in storedSecret
      ? String((storedSecret as Record<string, unknown>).webhook_token ?? '') : '';
    if (!secureEqual(tokenFromUrl, configuredToken)) return json({ error: 'invalid_webhook_signature' }, 401);
    authenticatedIntegrationId = integrationFromUrl;
  }
  let eventId: string | null = null;
  let eventOrg: string | null = null;
  let inboundId: string | null = null;
  try {
    const integrationId = authenticatedIntegrationId || integrationFromUrl;
    if (!/^[0-9a-f-]{36}$/i.test(integrationId)) throw new Error('invalid_integration_id');
    const raw = await request.text();
    if (!raw || raw.length > 32_768) throw new Error('invalid_payload');
    const payload = JSON.parse(raw) as Record<string, unknown>;
    if (!payload || Array.isArray(payload)) throw new Error('invalid_payload');
    const admin = authenticatedAdmin ?? createAdminClient();
    const { data: integration, error: integrationError } = await admin.from('integrations')
      .select('id,organization_id,provider,connected,enabled,paused').eq('id', integrationId).maybeSingle();
    if (integrationError || !integration) return json({ error: 'integration_not_ready' }, 409);
    // Pausing outbound must not make us lose incoming replies or opt-out requests.
    if (!['zapi', 'z-api'].includes(String(integration.provider).toLowerCase())) return json({ error: 'unsupported_provider' }, 409);
    authenticatedAdmin = admin;
    eventOrg = integration.organization_id;
    const normalized = parseZapiEvent(payload);
    const payloadSha = await sha256(raw);
    const suppliedId = [payload.message_id, payload.messageId, payload.id].find((value) => typeof value === 'string' && value.length > 0 && value.length < 256) as string | undefined;
    // Retain old inbound IDs so deploying this fix cannot replay previously seen callbacks.
    const externalId = normalized.kind === 'receipt' ? `receipt:${payloadSha}` : suppliedId ?? payloadSha;
    const eventType = typeof payload.type === 'string' ? payload.type.slice(0, 120) : 'message';
    const { data: event, error: eventError } = await admin.from('webhook_events').upsert({
      organization_id: integration.organization_id, provider: integration.provider || 'whatsapp', external_id: externalId,
      event_type: eventType, payload_sha: payloadSha, payload, status: 'received',
    }, { onConflict: 'organization_id,provider,external_id', ignoreDuplicates: true }).select('id').maybeSingle();
    if (eventError) throw new Error('event_persist_failed');
    if (!event) {
      // Durable uniqueness is the claim. Replays do not reset status or rerun the AI.
      // Failed/stale events require the future controlled retry queue, not blind replay.
      return json({ accepted: true, duplicate: true, processed: false }, 202);
    }
    eventId = event.id;
    if (normalized.kind !== 'inbound') {
      const { error } = await admin.from('webhook_events').update({ status: 'ignored', processed_at: new Date().toISOString(), error: normalized.reason }).eq('id', event.id).eq('organization_id', eventOrg);
      if (error) throw error;
      return json({ accepted: true, ignored: true, reason: normalized.reason }, 202);
    }
    const { phone, text: message } = normalized;
    // Candidate search tolerates formatting; final comparison is exact international
    // identity. Multiple matches are a conflict, never "pick the first".
    const pattern = `%${phone.slice(-10).split('').join('%')}%`;
    const { data: candidates, error: lookupError } = await admin.from('leads').select('id,modo_atendimento,owner_id,phone,whatsapp,first_inbound_at')
      .eq('organization_id', integration.organization_id).or(`phone.ilike.${pattern},whatsapp.ilike.${pattern}`).limit(101);
    if (lookupError) throw new Error('lead_lookup_failed');
    if ((candidates?.length ?? 0) > 100) throw new Error('lead_lookup_limit_requires_index');
    const matches = candidates?.filter((item) => [storedPhone(item.phone), storedPhone(item.whatsapp)].includes(phone)) ?? [];
    if (matches.length > 1) throw new Error('ambiguous_lead_identity');
    const lead = matches[0] ?? null;
    if (!lead) {
      const { error } = await admin.from('webhook_events').update({ status: 'failed', error: 'lead_not_matched', processed_at: new Date().toISOString() }).eq('id', event.id).eq('organization_id', eventOrg);
      if (error) throw error;
      await admin.from('audit_logs').insert({ organization_id: integration.organization_id, action: 'webhook.unmatched', detail: 'Mensagem recebida sem lead correspondente.', entity_table: 'webhook_events', entity_id: event?.id ?? null, event_data: { provider: integration.provider, phone_suffix: phone.slice(-4) } });
      return json({ accepted: true, matched: false }, 202);
    }
    const { data: inbound, error: inboundError } = await admin.from('channel_inbound_events').upsert({ organization_id: integration.organization_id, provider: integration.provider, event_type: eventType, external_id: externalId, lead_id: lead.id, payload, status: 'received' }, { onConflict: 'organization_id,provider,external_id', ignoreDuplicates: true }).select('id').maybeSingle();
    if (inboundError) throw new Error('inbound_persist_failed');
    if (!inbound) throw new Error('inbound_already_exists_requires_reconciliation');
    inboundId = inbound.id;
    const receivedAt = new Date().toISOString();
    const { data: storedMessage, error: messageError } = await admin.from('lead_messages').insert({ organization_id: integration.organization_id, lead_id: lead.id, sender: 'lead', sender_name: 'Lead', type: 'received', text: message, sent_at: receivedAt, provider_message_id: normalized.messageId }).select('id').single();
    if (messageError || !storedMessage) throw new Error('inbound_message_persist_failed');
    const { error: leadUpdateError } = await admin.from('leads').update({
      first_inbound_at: lead.first_inbound_at ?? receivedAt,
      last_contact: receivedAt,
      no_reply_deadline_at: null,
      no_reply_processed_at: null,
    }).eq('organization_id', integration.organization_id).eq('id', lead.id);
    if (leadUpdateError) throw new Error('inbound_lead_update_failed');
    const serviceJwt = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const internalSecret = Deno.env.get('WHATSAPP_WEBHOOK_SHARED_SECRET');
    if (!serviceJwt || !internalSecret) throw new Error('internal_auth_not_configured');
    const anaResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ana-run`, { method: 'POST', headers: { Authorization: `Bearer ${serviceJwt}`, 'Content-Type': 'application/json', 'x-internal-worker-secret': internalSecret }, body: JSON.stringify({ event: 'message.received', message_id: normalized.messageId, lead_id: lead.id, modo: lead.modo_atendimento, organization_id: integration.organization_id, contexto: { channel: 'whatsapp', inbound_event_id: externalId, media_requires_review: normalized.mediaRequiresReview } }), signal: AbortSignal.timeout(45_000) });
    const anaResult = await anaResponse.json().catch(() => null);
    const succeeded = anaResponseSucceeded(anaResponse.status, anaResult);
    const state = { status: succeeded ? 'processed' : 'failed', error: succeeded ? null : `ana_not_completed_${anaResponse.status}`, processed_at: new Date().toISOString() };
    const { error: inboundStateError } = await admin.from('channel_inbound_events').update(state).eq('id', inbound.id).eq('organization_id', eventOrg);
    if (inboundStateError) throw new Error('inbound_state_persist_failed');
    const { error: eventStateError } = await admin.from('webhook_events').update({ ...state, lead_id: lead.id }).eq('id', event.id).eq('organization_id', eventOrg);
    if (eventStateError) throw new Error('event_state_persist_failed');
    // A conexão de saída e a entrada são estados diferentes. Só considerar a
    // entrada homologada após o callback real ter sido associado ao lead e
    // passado pela Ana, sem precisar expor URL ou token ao painel.
    const { error: webhookHealthError } = await admin.from('integrations').update({
      connected: succeeded,
      enabled: true,
      paused: false,
      last_tested_at: receivedAt,
      last_success_at: succeeded ? receivedAt : null,
      last_error: succeeded ? null : `ana_not_completed_${anaResponse.status}`,
      status_detail: succeeded
        ? 'Resposta recebida, vinculada ao lead e processada pela Ana.'
        : 'Resposta recebida, mas o processamento da Ana precisa de reconciliação.',
      updated_at: receivedAt,
    }).eq('organization_id', eventOrg).eq('key', 'zapi_webhook');
    if (webhookHealthError) throw new Error('webhook_health_persist_failed');
    await admin.from('audit_logs').insert({ organization_id: integration.organization_id, action: succeeded ? 'webhook.processed' : 'webhook.failed', detail: succeeded ? 'Mensagem vinculada ao lead; Ana avaliou o evento (incluindo bloqueios de segurança).' : 'Mensagem salva; execução da Ana pendente de reconciliação.', entity_table: 'leads', entity_id: lead.id, event_data: { provider: integration.provider, event_type: eventType, ana_status: anaResponse.status, skipped: anaResult?.skipped === true } });
    return json({ accepted: true, matched: true, processed: succeeded, skipped: anaResult?.skipped === true }, 202);
  } catch (error) {
    const code = safeError(error).replace(/[^a-z0-9_]/gi, '_').slice(0, 100);
    if (authenticatedAdmin && eventId && eventOrg) {
      await authenticatedAdmin.from('webhook_events').update({ status: 'failed', error: code, processed_at: new Date().toISOString() }).eq('id', eventId).eq('organization_id', eventOrg);
      if (inboundId) await authenticatedAdmin.from('channel_inbound_events').update({ status: 'failed', error: code, processed_at: new Date().toISOString() }).eq('id', inboundId).eq('organization_id', eventOrg);
    }
    return json({ error: code, accepted: Boolean(eventId), requires_reconciliation: Boolean(eventId) }, eventId ? 202 : 400);
  }
});
