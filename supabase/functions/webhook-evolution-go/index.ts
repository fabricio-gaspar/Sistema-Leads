import { createAdminClient } from '../_shared/auth.ts';
import { json, safeError } from '../_shared/http.ts';
import { parseEvolutionGoEvent, sanitizeEvolutionGoPayload } from '../_shared/evolutionGoInbound.ts';

type Row = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value: unknown, max = 1_000): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};

function secureEqual(actual: string | null, expected: string): boolean {
  if (!actual || !expected || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function externalId(payloadHash: string, parsed: ReturnType<typeof parseEvolutionGoEvent>): string {
  if (parsed.kind === 'inbound') return `message:${parsed.messageId}`;
  if (parsed.kind === 'receipt') return `receipt:${parsed.status}:${parsed.providerMessageIds.slice().sort().join('|')}`.slice(0, 300);
  if (parsed.kind === 'connection') return `connection:${parsed.state}:${parsed.occurredAt ?? payloadHash.slice(0, 32)}`;
  return `unknown:${payloadHash}`;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ accepted: false, error: 'method_not_allowed' }, 405);
  const requestUrl = new URL(request.url);
  const integrationId = requestUrl.searchParams.get('integration_id') ?? '';
  const token = requestUrl.searchParams.get('token') ?? '';
  if (!UUID.test(integrationId) || !token) return json({ accepted: false, error: 'invalid_webhook_signature' }, 401);

  try {
    const raw = await request.text();
    if (!raw || raw.length > 128_000) throw new Error('evolution_go_payload_invalid');
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('evolution_go_payload_invalid');
    const parsed = parseEvolutionGoEvent(payload);
    const admin = createAdminClient();
    const { data: integration, error: integrationError } = await admin.from('integrations')
      .select('id,organization_id,provider,enabled,connected,paused').eq('id', integrationId).maybeSingle();
    if (integrationError || !integration || integration.provider !== 'Evolution GO') return json({ accepted: false, error: 'integration_not_ready' }, 409);
    const { data: secret, error: secretError } = await admin.rpc('read_integration_secret', { p_integration: integrationId });
    const webhookSecret = text(object(secret).webhook_secret, 256);
    if (secretError || !secureEqual(token, webhookSecret)) return json({ accepted: false, error: 'invalid_webhook_signature' }, 401);

    const { data: account, error: accountError } = await admin.from('whatsapp_accounts')
      .select('id,enabled').eq('organization_id', integration.organization_id).eq('integration_id', integrationId)
      .eq('provider', 'evolution_go').is('archived_at', null).maybeSingle();
    if (accountError || !account) return json({ accepted: false, error: 'whatsapp_account_not_ready' }, 409);
    if (parsed.kind !== 'connection') {
      if (account.enabled !== true || integration.enabled !== true || integration.connected !== true || integration.paused === true) {
        // Authenticate first, then acknowledge callbacks for a disabled account
        // without persisting customer data. Provider controls are organization-
        // wide, so they cannot replace this per-account readiness gate.
        return json({ accepted: true, ignored: true, reason: 'evolution_go_account_disabled' });
      }
      const { data: control, error: controlError } = await admin.from('messaging_provider_controls')
        .select('inbound_enabled,kill_switch').eq('organization_id', integration.organization_id).eq('provider', 'evolution_go').maybeSingle();
      if (controlError) throw new Error('evolution_go_control_read_failed');
      if (control?.inbound_enabled !== true || control.kill_switch === true) {
        // Acknowledge a disabled route so Evolution does not create a retry storm,
        // but do not persist customer data or wake automations while it is off.
        return json({ accepted: true, ignored: true, reason: 'evolution_go_provider_disabled' });
      }
    }

    const payloadHash = await sha256(raw);
    const now = new Date().toISOString();
    const kind = parsed.kind === 'ignored' ? 'unknown' : parsed.kind;
    const { data: event, error: eventError } = await admin.from('evolution_go_webhook_events').upsert({
      organization_id: integration.organization_id,
      whatsapp_account_id: account.id,
      integration_id: integrationId,
      external_event_id: externalId(payloadHash, parsed),
      event_kind: kind,
      payload_hash: payloadHash,
      sanitized_payload: sanitizeEvolutionGoPayload(payload),
      processing_status: parsed.kind === 'ignored' ? 'ignored' : 'queued',
      occurred_at: parsed.kind === 'ignored' ? null : parsed.occurredAt ?? null,
      processed_at: parsed.kind === 'ignored' ? now : null,
      error_code: parsed.kind === 'ignored' ? parsed.reason : null,
    }, { onConflict: 'organization_id,whatsapp_account_id,external_event_id', ignoreDuplicates: true })
      .select('id,processing_status').maybeSingle();
    if (eventError) throw new Error('evolution_go_event_persist_failed');
    if (!event) return json({ accepted: true, duplicate: true });

    // Supabase documents EdgeRuntime.waitUntil for a fast webhook acknowledgement.
    // The durable queue remains the source of truth; an operator/scheduled worker can
    // retry any event that does not complete in the background task.
    if (parsed.kind !== 'ignored') {
      const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (serviceRole) {
        EdgeRuntime.waitUntil(fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/evolution-go-worker`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRole}` },
          body: JSON.stringify({ event_id: event.id }), signal: AbortSignal.timeout(45_000),
        }).catch(() => undefined));
      }
    }
    return json({ accepted: true, queued: parsed.kind !== 'ignored', ignored: parsed.kind === 'ignored' });
  } catch (error) {
    const code = safeError(error).replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 100) || 'evolution_go_webhook_failed';
    return json({ accepted: false, error: code }, 400);
  }
});
