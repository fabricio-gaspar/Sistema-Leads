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
    await admin.from('audit_logs').insert({ organization_id: integration.organization_id, action: 'webhook.received', detail: 'Evento de WhatsApp recebido e colocado na fila.', entity_table: 'webhook_events', entity_id: event?.id ?? null, event_data: { provider: integration.provider, event_type: eventType } });
    return json({ accepted: true }, 202);
  } catch (error) { return json({ error: safeError(error) }, 400); }
});
