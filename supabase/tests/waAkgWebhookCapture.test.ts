import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
type Query = { table: string; operation: string; value?: Row; filters: Record<string, unknown> };
type Result = { data: unknown; error: null };

const organizationId = 'a1ea4d91-3d09-4052-9759-3009b442e6cb';
const integrationId = 'eb1d83c2-dbed-4292-82a5-ab579fa627f9';
const accountId = 'c828ecce-b41f-4816-95e3-83440a86b428';
const sessionId = 'wf_a1ea4d913d09405297593009b442e6cb_c828ecceb41f481695e383440a86b428';
const webhookSecret = 'synthetic-webhook-secret';

let handler: (request: Request) => Promise<Response>;
let calls: Query[];
let captureOnly: boolean;
let fetchMock: ReturnType<typeof vi.fn>;

function ok(data: unknown): Result { return { data, error: null }; }

function queryFor(table: string) {
  const query: Query = { table, operation: 'select', filters: {} };
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = (key: string, value: unknown) => {
    query.filters[key] = value;
    return chain;
  };
  chain.is = (key: string, value: unknown) => {
    query.filters[key] = value;
    return chain;
  };
  chain.upsert = (value: Row) => {
    query.operation = 'upsert';
    query.value = value;
    return chain;
  };
  chain.maybeSingle = () => chain;
  chain.then = (resolve: (result: Result) => unknown) => {
    calls.push({ ...query, filters: { ...query.filters } });
    if (table === 'integrations') return Promise.resolve(ok({ id: integrationId, organization_id: organizationId })).then(resolve);
    if (table === 'whatsapp_accounts') {
      return Promise.resolve(ok({ id: accountId, integration_id: integrationId, enabled: true, connection_status: 'connected' })).then(resolve);
    }
    if (table === 'messaging_provider_controls') {
      return Promise.resolve(ok({ capture_only: captureOnly })).then(resolve);
    }
    if (table === 'wa_akg_webhook_events') return Promise.resolve(ok({ id: 'event-captured', processing_status: 'queued' })).then(resolve);
    return Promise.resolve(ok(null)).then(resolve);
  };
  return chain;
}

async function sign(body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(signed), (value) => value.toString(16).padStart(2, '0')).join('');
}

function incomingPayload() {
  return {
    event: 'message.received', sessionId,
    timestamp: '2026-10-14T15:00:00.000Z',
    data: {
      key: { id: 'wamid-capture-only', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
      type: 'text', content: { text: 'Preciso de atendimento' },
    },
  };
}

async function webhookRequest() {
  const body = JSON.stringify(incomingPayload());
  return new Request(`https://example.test/webhook-wa-akg?integration_id=${integrationId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-signature': `sha256=${await sign(body)}` },
    body,
  });
}

beforeEach(() => {
  vi.resetModules();
  calls = [];
  captureOnly = false;
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('Deno', {
    env: { get: (name: string) => ({ SUPABASE_URL: 'https://supabase.example.test', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role' } as Record<string, string>)[name] },
    serve: (callback: typeof handler) => { handler = callback; },
  });
  vi.doMock('../functions/_shared/auth.ts', () => ({
    createAdminClient: () => ({
      from: queryFor,
      rpc: (name: string) => {
        calls.push({ table: name, operation: 'rpc', filters: {} });
        if (name === 'read_integration_secret') return Promise.resolve(ok({ webhook_secret: webhookSecret, session_id: sessionId }));
        return Promise.resolve(ok(null));
      },
    }),
  }));
});

afterEach(() => vi.unstubAllGlobals());

describe('WA-AKG webhook capture-only maintenance', () => {
  it('persists a signed callback as queued without waking worker or provider processing', async () => {
    captureOnly = true;
    await import('../functions/webhook-wa-akg/index.ts');

    const response = await handler(await webhookRequest());

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ ok: true, accepted: true, duplicate: false, captured: true });
    const persisted = calls.find((call) => call.table === 'wa_akg_webhook_events' && call.operation === 'upsert');
    expect(persisted?.value).toMatchObject({
      organization_id: organizationId,
      whatsapp_account_id: accountId,
      integration_id: integrationId,
      external_event_id: 'message.received:wamid-capture-only',
      event_kind: 'inbound',
      processing_status: 'queued',
    });
    expect(persisted?.value?.processed_at).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls.filter((call) => call.table === 'read_integration_secret' && call.operation === 'rpc')).toHaveLength(1);
  });

  it('persists a normal callback for the scheduler without waking a worker directly', async () => {
    await import('../functions/webhook-wa-akg/index.ts');

    const response = await handler(await webhookRequest());

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ ok: true, accepted: true, captured: false, queued: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
