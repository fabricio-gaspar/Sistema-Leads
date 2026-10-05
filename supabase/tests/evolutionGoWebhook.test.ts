import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
type Result = { data: unknown; error: null };

const organizationId = 'a1111111-1111-4111-8111-111111111111';
const integrationId = 'b1111111-1111-4111-8111-111111111111';
const accountId = 'c1111111-1111-4111-8111-111111111111';
const webhookSecret = 'synthetic-evolution-webhook-secret';

const state = vi.hoisted(() => ({ admin: {} as { from: (table: string) => unknown; rpc: (name: string, value: Row) => Promise<Result> } }));

vi.mock('../functions/_shared/auth.ts', () => ({
  createAdminClient: () => state.admin,
}));

let handler: (request: Request) => Promise<Response>;
let queued: Row[];
let tablesRead: string[];
let integration: Row;
let account: Row;

function ok(data: unknown): Result {
  return { data, error: null };
}

function queryFor(table: string) {
  const query: { operation: 'select' | 'upsert'; value?: Row } = { operation: 'select' };
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.is = () => chain;
  chain.maybeSingle = () => chain;
  chain.upsert = (value: Row) => { query.operation = 'upsert'; query.value = value; return chain; };
  chain.then = (resolve: (result: Result) => unknown, reject: (error: unknown) => unknown) => {
    tablesRead.push(table);
    if (query.operation === 'upsert') {
      queued.push(query.value ?? {});
      return Promise.resolve(ok({ id: 'd1111111-1111-4111-8111-111111111111', processing_status: 'queued' })).then(resolve, reject);
    }
    if (table === 'integrations') return Promise.resolve(ok(integration)).then(resolve, reject);
    if (table === 'whatsapp_accounts') return Promise.resolve(ok(account)).then(resolve, reject);
    return Promise.resolve(ok(null)).then(resolve, reject);
  };
  return chain;
}

function request(body: Row): Request {
  return new Request(`https://example.invalid/webhook-evolution-go?integration_id=${integrationId}&token=${webhookSecret}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetModules();
  queued = [];
  tablesRead = [];
  integration = {
    id: integrationId,
    organization_id: organizationId,
    provider: 'Evolution GO',
    enabled: false,
    connected: false,
    paused: true,
  };
  account = { id: accountId, enabled: false };
  state.admin = {
    from: queryFor,
    rpc: async (name: string) => name === 'read_integration_secret' ? ok({ webhook_secret: webhookSecret }) : ok({}),
  };
  vi.stubGlobal('Deno', {
    env: { get: () => undefined },
    serve: (callback: typeof handler) => { handler = callback; },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('Evolution GO webhook readiness boundary', () => {
  it('queues a signed connection callback before activation so the seller sees a completed scan', async () => {
    await import('../functions/webhook-evolution-go/index');

    const response = await handler(request({ event: 'Connected', data: { timestamp: 1_772_494_009 } }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ accepted: true, queued: true, ignored: false });
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      organization_id: organizationId,
      whatsapp_account_id: accountId,
      integration_id: integrationId,
      event_kind: 'connection',
      processing_status: 'queued',
      sanitized_payload: { state: 'connected' },
    });
    expect(tablesRead).not.toContain('messaging_provider_controls');
  });

  it('continues to ignore inbound customer data until the account route is active', async () => {
    await import('../functions/webhook-evolution-go/index');

    const response = await handler(request({
      event: 'Message',
      data: {
        key: { id: 'inbound-1', remoteJid: '5511999990000@s.whatsapp.net', fromMe: false },
        message: { conversation: 'Olá' },
      },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ accepted: true, ignored: true, reason: 'evolution_go_account_disabled' });
    expect(queued).toHaveLength(0);
  });
});
