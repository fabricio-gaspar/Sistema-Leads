import { createAdminClient } from '../_shared/auth.ts';
import { json, safeError } from '../_shared/http.ts';
import { parseWaAkgEvent, sanitizeWaAkgPayload } from '../_shared/waAkgInbound.ts';

type Row = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown, max = 1_000): string => typeof value === 'string' ? value.trim().slice(0, max) : '';

function secureEqual(left: string, right: string): boolean {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function wakeWorker(eventId: string): void {
  const baseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!baseUrl || !serviceRole) return;
  const pending = fetch(`${baseUrl}/functions/v1/wa-akg-worker`, {
    method: 'POST', headers: { Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_id: eventId }), signal: AbortSignal.timeout(30_000),
  }).catch(() => undefined);
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil: (task: Promise<unknown>) => void } }).EdgeRuntime;
  runtime?.waitUntil(pending);
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (Number.isFinite(contentLength) && contentLength > 1_000_000) return json({ ok: false, error: 'payload_too_large' }, 413);
    const integrationId = new URL(request.url).searchParams.get('integration_id') ?? '';
    if (!UUID.test(integrationId)) return json({ ok: false, error: 'integration_required' }, 400);
    const raw = await request.text();
    if (!raw || raw.length > 1_000_000) return json({ ok: false, error: 'payload_invalid' }, 400);

    const admin = createAdminClient();
    const { data: integration, error: integrationError } = await admin.from('integrations')
      .select('id,organization_id').eq('id', integrationId).maybeSingle();
    if (integrationError || !integration) return json({ ok: false, error: 'integration_not_found' }, 404);
    const { data: account, error: accountError } = await admin.from('whatsapp_accounts')
      .select('id,integration_id,enabled,connection_status').eq('organization_id', integration.organization_id)
      .eq('integration_id', integrationId).eq('provider', 'wa_akg').is('archived_at', null).maybeSingle();
    if (accountError || !account) return json({ ok: false, error: 'account_not_found' }, 404);
    const { data: credentials, error: secretError } = await admin.rpc('read_integration_secret', { p_integration: integrationId });
    const secret = object(credentials);
    if (secretError || !text(secret.webhook_secret, 256) || !text(secret.session_id, 120)) {
      return json({ ok: false, error: 'webhook_not_configured' }, 503);
    }

    const provided = text(request.headers.get('x-webhook-signature'), 256).replace(/^sha256=/i, '').toLowerCase();
    const expected = await hmacHex(text(secret.webhook_secret, 256), raw);
    if (!secureEqual(provided, expected)) return json({ ok: false, error: 'signature_invalid' }, 401);

    const payload = object(JSON.parse(raw));
    const receivedSession = text(payload.sessionId ?? payload.session_id ?? object(payload.data).sessionId, 120);
    if (!receivedSession || !secureEqual(receivedSession, text(secret.session_id, 120))) {
      return json({ ok: false, error: 'session_mismatch' }, 403);
    }
    const parsed = parseWaAkgEvent(payload);
    const sanitized = sanitizeWaAkgPayload(payload);
    const kind = parsed.kind === 'ignored' ? 'ignored' : parsed.kind;
    const { data: inserted, error } = await admin.from('wa_akg_webhook_events').upsert({
      organization_id: integration.organization_id, whatsapp_account_id: account.id,
      integration_id: integrationId, external_event_id: parsed.externalId, event_kind: kind,
      payload_hash: await sha256Hex(raw), sanitized_payload: sanitized,
      processing_status: parsed.kind === 'ignored' ? 'ignored' : 'queued',
      processed_at: parsed.kind === 'ignored' ? new Date().toISOString() : null,
      error_code: parsed.kind === 'ignored' ? parsed.reason : null,
      occurred_at: parsed.occurredAt, next_retry_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,whatsapp_account_id,external_event_id', ignoreDuplicates: true })
      .select('id,processing_status').maybeSingle();
    if (error) throw new Error('wa_akg_webhook_persist_failed');
    if (inserted?.id && inserted.processing_status === 'queued') wakeWorker(String(inserted.id));
    return json({ ok: true, accepted: Boolean(inserted), duplicate: !inserted }, 202);
  } catch (error) {
    const code = safeError(error).replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 120);
    console.error('wa_akg_webhook_failed', { code });
    return json({ ok: false, error: code }, 400);
  }
});
