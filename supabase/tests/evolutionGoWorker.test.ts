import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
type Result = { data: unknown; error: null | { message: string; code?: string } };
type Query = {
  table: string;
  operation: 'select' | 'update' | 'insert' | 'rpc';
  value?: Row;
  filters: Record<string, unknown>;
  single?: boolean;
};

const organizationId = 'a1111111-1111-4111-8111-111111111111';
const provisioningJobId = 'b1111111-1111-4111-8111-111111111111';
const localProvisioningId = 'c1111111-1111-4111-8111-111111111111';
const corporateAccountId = 'd1111111-1111-4111-8111-111111111111';
const corporateIntegrationId = 'e1111111-1111-4111-8111-111111111111';
const sellerAccountId = 'f1111111-1111-4111-8111-111111111111';
const sellerIntegrationId = 'a2222222-2222-4222-8222-222222222222';
const webhookEventId = 'b2222222-2222-4222-8222-222222222222';

const state = vi.hoisted(() => ({ admin: {} as object }));

vi.mock('../functions/_shared/auth.ts', () => ({
  createAdminClient: () => state.admin,
}));

let calls: Query[];
let jobs: Row[];
let events: Row[];
let accounts: Row[];
let integrations: Row[];
let providerControls: Row | null;
let secrets: Map<string, Row>;
let auditLogs: Row[];
let edgeEnv: Record<string, string | undefined>;
let handler: (request: Request) => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn>;

const ok = (data: unknown): Result => ({ data, error: null });

function matches(row: Row, query: Query): boolean {
  for (const [key, value] of Object.entries(query.filters)) {
    if (key.startsWith('in:')) {
      if (!(value as unknown[]).includes(row[key.slice(3)])) return false;
      continue;
    }
    if (key.startsWith('is:')) {
      if (row[key.slice(3)] !== value) return false;
      continue;
    }
    if (key.startsWith('lte:')) continue;
    if (row[key] !== value) return false;
  }
  return true;
}

function selected(rows: Row[], query: Query): Row | Row[] | null {
  const found = rows.filter((row) => matches(row, query));
  return query.single ? found[0] ?? null : found;
}

function updateRows(rows: Row[], query: Query): Row[] {
  const updated: Row[] = [];
  const next = rows.map((row) => {
    if (!matches(row, query)) return row;
    const value = { ...row, ...query.value };
    updated.push(value);
    return value;
  });
  if (rows === jobs) jobs = next;
  if (rows === events) events = next;
  if (rows === accounts) accounts = next;
  if (rows === integrations) integrations = next;
  return updated;
}

function execute(query: Query): Result {
  calls.push({ ...query, filters: { ...query.filters }, value: query.value ? { ...query.value } : undefined });
  if (query.operation === 'rpc') {
    if (query.table === 'read_integration_secret') {
      return ok(secrets.get(String(query.value?.p_integration)) ?? {});
    }
    if (query.table === 'store_integration_secret') {
      secrets.set(String(query.value?.p_integration), { ...(query.value?.p_secret as Row) });
      return ok({});
    }
    return ok({});
  }

  if (query.operation === 'select') {
    if (query.table === 'evolution_go_seller_provisioning_jobs') return ok(selected(jobs, query));
    if (query.table === 'evolution_go_webhook_events') return ok(selected(events, query));
    if (query.table === 'whatsapp_accounts') return ok(selected(accounts, query));
    if (query.table === 'integrations') return ok(selected(integrations, query));
    if (query.table === 'messaging_provider_controls') return ok(query.single ? providerControls : providerControls ? [providerControls] : []);
    return ok(query.single ? null : []);
  }

  if (query.operation === 'update') {
    if (query.table === 'evolution_go_seller_provisioning_jobs') {
      const updated = updateRows(jobs, query);
      return ok(query.single ? updated[0] ?? null : updated);
    }
    if (query.table === 'whatsapp_accounts') {
      const updated = updateRows(accounts, query);
      return ok(query.single ? updated[0] ?? null : updated);
    }
    if (query.table === 'evolution_go_webhook_events') {
      const updated = updateRows(events, query);
      return ok(query.single ? updated[0] ?? null : updated);
    }
    if (query.table === 'integrations') {
      const updated = updateRows(integrations, query);
      return ok(query.single ? updated[0] ?? null : updated);
    }
    return ok(query.single ? { id: `${query.table}-id` } : []);
  }

  if (query.table === 'audit_logs' && query.operation === 'insert') auditLogs.push(query.value ?? {});
  return ok(query.value ?? {});
}

function queryFor(table: string) {
  const query: Query = { table, operation: 'select', filters: {} };
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = (key: string, value: unknown) => { query.filters[key] = value; return chain; };
  chain.is = (key: string, value: unknown) => { query.filters[`is:${key}`] = value; return chain; };
  chain.in = (key: string, value: unknown[]) => { query.filters[`in:${key}`] = value; return chain; };
  chain.lte = (key: string, value: unknown) => { query.filters[`lte:${key}`] = value; return chain; };
  chain.order = () => chain;
  chain.limit = () => chain;
  chain.update = (value: Row) => { query.operation = 'update'; query.value = value; return chain; };
  chain.insert = (value: Row) => { query.operation = 'insert'; query.value = value; return chain; };
  chain.maybeSingle = () => { query.single = true; return chain; };
  chain.then = (resolve: (result: Result) => unknown, reject: (error: unknown) => unknown) =>
    Promise.resolve(execute(query)).then(resolve, reject);
  return chain;
}

function workerRequest() {
  return new Request('https://example.invalid/evolution-go-worker', {
    method: 'POST',
    headers: { Authorization: 'Bearer synthetic-service-role', 'Content-Type': 'application/json' },
    body: JSON.stringify({ provisioning_job_id: provisioningJobId }),
  });
}

function eventRequest(eventId = webhookEventId) {
  return new Request('https://example.invalid/evolution-go-worker', {
    method: 'POST',
    headers: { Authorization: 'Bearer synthetic-service-role', 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_id: eventId }),
  });
}

beforeEach(() => {
  vi.resetModules();
  calls = [];
  auditLogs = [];
  edgeEnv = {
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role',
    EVOLUTION_GO_ALLOWED_ORIGINS: 'https://evo-eisenflow.kz3solucoes.cloud',
  };
  jobs = [{
    id: provisioningJobId,
    organization_id: organizationId,
    instance_id: localProvisioningId,
    instance_name: 'vendedor-teste',
    integration_id: sellerIntegrationId,
    whatsapp_account_id: sellerAccountId,
    state: 'queued',
    attempt_count: 0,
    next_attempt_at: '2026-10-04T00:00:00.000Z',
  }];
  events = [];
  providerControls = {
    inbound_enabled: true,
    send_enabled: true,
    automation_enabled: true,
    kill_switch: false,
  };
  accounts = [
    {
      id: corporateAccountId,
      organization_id: organizationId,
      integration_id: corporateIntegrationId,
      provider: 'evolution_go',
      account_type: 'corporate',
      is_default: true,
      archived_at: null,
    },
    {
      id: sellerAccountId,
      organization_id: organizationId,
      integration_id: sellerIntegrationId,
      provider: 'evolution_go',
      account_type: 'seller',
      archived_at: null,
      provider_metadata: {},
      enabled: false,
      connection_status: 'configured',
    },
  ];
  integrations = [
    { id: corporateIntegrationId, organization_id: organizationId, provider: 'Evolution GO', configuration: {} },
    { id: sellerIntegrationId, organization_id: organizationId, provider: 'Evolution GO', configuration: {}, enabled: false, connected: false, paused: true },
  ];
  secrets = new Map([
    [corporateIntegrationId, {
      base_url: 'https://evo-eisenflow.kz3solucoes.cloud',
      global_api_key: 'synthetic-global-key-must-not-leak',
    }],
    [sellerIntegrationId, {}],
  ]);
  state.admin = {
    from: queryFor,
    rpc: (name: string, value: Row) => Promise.resolve(execute({ table: name, operation: 'rpc', value, filters: {} })),
  };
  vi.stubGlobal('Deno', {
    env: { get: (name: string) => edgeEnv[name] },
    serve: (callback: typeof handler) => { handler = callback; },
  });
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { id: 'provider-instance-id' } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('Evolution GO seller provisioning worker', () => {
  it('uses only the organization corporate Vault credentials and stores the provider-issued ID', async () => {
    await import('../functions/evolution-go-worker/index');

    const response = await handler(workerRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, provisioned: 1, provisioning_failed: 0 });
    const corporateLookup = calls.find((call) => call.table === 'whatsapp_accounts'
      && call.operation === 'select' && call.filters.account_type === 'corporate');
    expect(corporateLookup?.filters).toMatchObject({
      organization_id: organizationId,
      provider: 'evolution_go',
      account_type: 'corporate',
      'is:archived_at': null,
    });
    expect(calls.filter((call) => call.table === 'read_integration_secret' && call.operation === 'rpc')
      .map((call) => call.value?.p_integration)).toEqual([corporateIntegrationId, sellerIntegrationId]);

    const providerRequest = fetchMock.mock.calls.find(([url]) => new URL(String(url)).pathname === '/instance/create');
    expect(providerRequest).toBeDefined();
    const requestInit = providerRequest?.[1] as RequestInit;
    expect(JSON.parse(String(requestInit.body))).toEqual({ name: 'vendedor-teste', token: expect.any(String) });
    expect(JSON.parse(String(requestInit.body))).not.toHaveProperty('instanceId');
    expect(JSON.parse(String(requestInit.body))).not.toHaveProperty('advancedSettings');
    expect(secrets.get(sellerIntegrationId)).toMatchObject({
      instance_id: 'provider-instance-id',
      instance_name: 'vendedor-teste',
      instance_token: expect.any(String),
      webhook_secret: expect.any(String),
    });
    expect(jobs[0]).toMatchObject({ state: 'awaiting_qr', last_error_code: null });
    expect(JSON.stringify({ body, auditLogs, calls })).not.toContain('synthetic-global-key-must-not-leak');
  });

  it('falls back only when the complete legacy environment pair is configured', async () => {
    secrets.set(corporateIntegrationId, {});
    edgeEnv.EVOLUTION_GO_BASE_URL = 'https://evo-eisenflow.kz3solucoes.cloud';
    edgeEnv.EVOLUTION_GO_GLOBAL_API_KEY = 'synthetic-legacy-global-key-must-not-leak';
    await import('../functions/evolution-go-worker/index');

    const response = await handler(workerRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, provisioned: 1 });
    const providerRequest = fetchMock.mock.calls.find(([url]) => new URL(String(url)).pathname === '/instance/create');
    expect((providerRequest?.[1] as RequestInit).headers).toMatchObject({ apikey: 'synthetic-legacy-global-key-must-not-leak' });
  });

  it('fails safely without contacting Evolution when neither corporate Vault nor legacy environment credentials are complete', async () => {
    secrets.set(corporateIntegrationId, { base_url: 'https://evo-eisenflow.kz3solucoes.cloud' });
    await import('../functions/evolution-go-worker/index');

    const response = await handler(workerRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, provisioned: 0, provisioning_failed: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(jobs[0]).toMatchObject({ state: 'failed', last_error_code: 'evolution_go_global_credentials_missing' });
    expect(JSON.stringify({ body, auditLogs, calls })).not.toContain('evo-eisenflow.kz3solucoes.cloud');
  });

  it('records a connection callback while keeping a disabled seller route disabled', async () => {
    events = [{
      id: webhookEventId,
      organization_id: organizationId,
      whatsapp_account_id: sellerAccountId,
      integration_id: sellerIntegrationId,
      event_kind: 'connection',
      processing_status: 'queued',
      attempt_count: 0,
      sanitized_payload: { state: 'connected' },
    }];
    await import('../functions/evolution-go-worker/index');

    const response = await handler(eventRequest());

    expect(await response.json()).toMatchObject({ ok: true, processed: 1, failed: 0 });
    expect(events[0]).toMatchObject({ processing_status: 'processed' });
    expect(accounts.find((row) => row.id === sellerAccountId)).toMatchObject({
      enabled: false,
      connection_status: 'connected',
    });
    expect(integrations.find((row) => row.id === sellerIntegrationId)).toMatchObject({
      enabled: false,
      connected: true,
      paused: true,
    });
  });

  it('drops a queued inbound event when the seller account was disabled after it was queued', async () => {
    events = [{
      id: webhookEventId,
      organization_id: organizationId,
      whatsapp_account_id: sellerAccountId,
      integration_id: sellerIntegrationId,
      event_kind: 'inbound',
      processing_status: 'queued',
      attempt_count: 0,
      sanitized_payload: {
        message_id: 'inbound-1',
        remote_jid: '5511999990000@s.whatsapp.net',
        text: 'Olá',
      },
    }];
    await import('../functions/evolution-go-worker/index');

    const response = await handler(eventRequest());

    expect(await response.json()).toMatchObject({ ok: true, processed: 0, failed: 0 });
    expect(events[0]).toMatchObject({
      processing_status: 'ignored',
      error_code: 'evolution_go_account_disabled',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
