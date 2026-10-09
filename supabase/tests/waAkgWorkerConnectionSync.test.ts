import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
type Query = { table: string; operation: string; value?: Row; filters: Record<string, unknown> };
type Result = { data: unknown; error: null };

const org = 'a1ea4d91-3d09-4052-9759-3009b442e6cb';
const accountId = 'c828ecce-b41f-4816-95e3-83440a86b428';
const accountIntegrationId = '17fb9960-6f9c-4b6f-95da-92cb370e58df';
const gatewayIntegrationId = 'eb1d83c2-dbed-4292-82a5-ab579fa627f9';
const sessionId = 'wf_a1ea4d913d09405297593009b442e6cb_c828ecceb41f481695e383440a86b428';

let handler: (request: Request) => Promise<Response>;
let calls: Query[];

function ok(data: unknown): Result { return { data, error: null }; }

function queryFor(table: string) {
  const query: Query = { table, operation: 'select', filters: {} };
  const chain: Record<string, unknown> = {};
  for (const method of ['eq', 'is', 'in', 'lte', 'order', 'limit']) {
    chain[method] = (key: string, value: unknown) => {
      if (method === 'eq') query.filters[key] = value;
      return chain;
    };
  }
  chain.select = () => chain;
  chain.update = (value: Row) => { query.operation = 'update'; query.value = value; return chain; };
  chain.maybeSingle = () => chain;
  chain.then = (resolve: (result: Result) => unknown) => {
    calls.push({ ...query, filters: { ...query.filters } });
    if (table === 'wa_akg_webhook_events' || table === 'wa_akg_seller_provisioning_jobs') return Promise.resolve(ok([])).then(resolve);
    if (table === 'whatsapp_accounts' && query.operation === 'select' && query.filters.account_type === 'seller') {
      return Promise.resolve(ok([{ id: accountId, integration_id: accountIntegrationId, organization_id: org, connection_status: 'qr', enabled: false }])).then(resolve);
    }
    if (table === 'whatsapp_accounts' && query.operation === 'select' && query.filters.account_type === 'corporate') {
      return Promise.resolve(ok({ integration_id: gatewayIntegrationId })).then(resolve);
    }
    return Promise.resolve(ok({})).then(resolve);
  };
  return chain;
}

beforeEach(() => {
  vi.resetModules();
  calls = [];
  vi.stubGlobal('Deno', {
    env: { get: (name: string) => ({
      SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role',
      WA_AKG_ALLOWED_ORIGINS: 'https://wa.example.test',
    } as Record<string, string>)[name] },
    serve: (callback: typeof handler) => { handler = callback; },
  });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    expect(url).toBe(`https://wa.example.test/api/sessions/${sessionId}`);
    return new Response(JSON.stringify({ success: true, data: {
      sessionId, status: 'CONNECTED', me: { id: '5511997441875:1@s.whatsapp.net' },
    } }), { status: 200 });
  }));
  vi.doMock('../functions/_shared/auth.ts', () => ({
    createAdminClient: () => ({
      from: queryFor,
      rpc: (name: string, input: Row) => {
        calls.push({ table: name, operation: 'rpc', value: input, filters: {} });
        if (name === 'read_integration_secret') {
          return Promise.resolve(ok(input.p_integration === gatewayIntegrationId
            ? { base_url: 'https://wa.example.test', api_key: 'synthetic-key' }
            : { session_id: sessionId }));
        }
        return Promise.resolve(ok({}));
      },
    }),
  }));
});

describe('WA-AKG worker connection synchronization', () => {
  it('promotes a confirmed connected session and stores only the phone suffix without enabling operation', async () => {
    await import('../functions/wa-akg-worker/index.ts');

    const response = await handler(new Request('https://example.test/wa-akg-worker', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-service-role' },
      body: JSON.stringify({ organization_id: org }),
    }));

    expect(response.status).toBe(200);
    const accountUpdate = calls.find((call) => call.table === 'whatsapp_accounts' && call.operation === 'update');
    expect(accountUpdate?.value).toMatchObject({
      connection_status: 'connected', connected_phone_suffix: '1875', enabled: false,
    });
    const integrationUpdate = calls.find((call) => call.table === 'integrations' && call.operation === 'update');
    expect(integrationUpdate?.value).toMatchObject({ connected: true, enabled: false, paused: true });
  });
});
