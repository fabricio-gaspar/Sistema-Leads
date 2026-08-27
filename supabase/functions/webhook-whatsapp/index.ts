import { createAdminClient } from '../_shared/auth.ts';
import { json, safeError } from '../_shared/http.ts';

function secureEqual(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function requiredConnectionId(request: Request): string {
  const value = new URL(request.url).searchParams.get('connection_id') ?? '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('invalid_connection_id');
  }
  return value;
}

async function externalEventId(payload: Record<string, unknown>, body: string): Promise<string> {
  const candidate = payload.messageId ?? payload.id ?? payload.zeventId;
  if (typeof candidate === 'string' && candidate.length <= 255 && candidate.length > 0) return candidate;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!secureEqual(request.headers.get('x-leadai-webhook-secret'), Deno.env.get('WHATSAPP_WEBHOOK_SHARED_SECRET'))) {
    return json({ error: 'invalid_webhook_signature' }, 401);
  }

  try {
    const connectionId = requiredConnectionId(request);
    const rawBody = await request.text();
    if (!rawBody || rawBody.length > 32_768) throw new Error('invalid_payload');
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    if (!payload || Array.isArray(payload)) throw new Error('invalid_payload');

    const admin = createAdminClient();
    const { data: connection, error: connectionError } = await admin
      .from('integration_connections')
      .select('id, organization_id, provider, status')
      .eq('id', connectionId)
      .maybeSingle();
    if (connectionError || !connection || connection.provider !== 'whatsapp_zapi' || connection.status !== 'connected') {
      return json({ error: 'connection_not_found' }, 404);
    }

    const eventId = await externalEventId(payload, rawBody);
    const eventType = typeof payload.type === 'string' ? payload.type.slice(0, 120) : 'unknown';
    const { data: event, error: eventError } = await admin
      .from('webhook_events')
      .upsert(
        {
          organization_id: connection.organization_id,
          integration_connection_id: connection.id,
          provider: 'whatsapp_zapi',
          external_event_id: eventId,
          event_type: eventType,
          payload,
          processed_at: new Date().toISOString(),
        },
        { onConflict: 'integration_connection_id,external_event_id', ignoreDuplicates: true },
      )
      .select('id')
      .maybeSingle();
    if (eventError) throw new Error('event_persist_failed');

    await admin.from('audit_logs').insert({
      organization_id: connection.organization_id,
      action: 'webhook.received',
      entity_type: 'webhook_event',
      entity_id: event?.id ?? null,
      metadata: { provider: 'whatsapp_zapi', connection_id: connection.id, event_type: eventType },
    });

    // Delivery is intentionally not executed inside the webhook. A later worker
    // reads the idempotent event and performs lead matching, consent checks,
    // handoff rules and an optional AI response inside the correct tenant.
    return json({ accepted: true }, 202);
  } catch (error) {
    return json({ error: safeError(error) }, 400);
  }
});
