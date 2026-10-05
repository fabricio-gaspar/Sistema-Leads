import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
type Result = { data: unknown; error: null | { message: string; code?: string } };
type Query = {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete' | 'rpc';
  value?: Row;
  selection?: string;
  filters: Record<string, unknown>;
  or?: string;
  single?: boolean;
  limit?: number;
};

const organizationId = 'a1111111-1111-4111-8111-111111111111';
const administratorId = 'a2222222-2222-4222-8222-222222222222';
const ownerId = 'a3333333-3333-4333-8333-333333333333';
const otherSellerId = 'a4444444-4444-4444-8444-444444444444';
const newSellerOwnerId = 'a5555555-5555-4555-8555-555555555555';
const corporateAccountId = 'b1111111-1111-4111-8111-111111111111';
const secondCorporateAccountId = 'b2222222-2222-4222-8222-222222222222';
const ownerAccountId = 'b3333333-3333-4333-8333-333333333333';
const otherAccountId = 'b4444444-4444-4444-8444-444444444444';
const corporateIntegrationId = 'c1111111-1111-4111-8111-111111111111';
const secondCorporateIntegrationId = 'c2222222-2222-4222-8222-222222222222';
const ownerIntegrationId = 'c3333333-3333-4333-8333-333333333333';
const otherIntegrationId = 'c4444444-4444-4444-8444-444444444444';

const state = vi.hoisted(() => ({
  admin: {} as object,
  userId: 'a3333333-3333-4333-8333-333333333333',
  permissions: {} as Record<string, boolean>,
}));

vi.mock('../functions/_shared/auth.ts', () => ({
  createAdminClient: () => state.admin,
  hasOrganizationPermission: async (_admin: unknown, _organizationId: string, _userId: string, permission: string) =>
    state.permissions[permission] === true,
  requireUser: async (request: Request) => {
    if (!request.headers.get('Authorization')) throw new Error('authentication_required');
    return { user: { id: state.userId } };
  },
}));

let accounts: Row[];
let integrations: Row[];
let controls: Row;
let calls: Query[];
let handler: (request: Request) => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn>;
let secrets: Map<string, Row>;
let failQuery: ((query: Query) => Result | null) | null;

const ok = (data: unknown): Result => ({ data, error: null });

function account(input: {
  id: string;
  integrationId: string;
  type: 'corporate' | 'seller';
  ownerUserId?: string;
  label: string;
  isDefault?: boolean;
  enabled?: boolean;
}): Row {
  return {
    id: input.id,
    organization_id: organizationId,
    integration_id: input.integrationId,
    owner_user_id: input.ownerUserId ?? null,
    label: input.label,
    provider: 'evolution_go',
    account_type: input.type,
    is_default: input.isDefault === true,
    enabled: input.enabled === true,
    connection_status: 'connected',
    connected_phone_suffix: input.enabled ? '7788' : null,
    connected_at: input.enabled ? '2026-10-03T12:00:00.000Z' : null,
    status_checked_at: '2026-10-03T12:00:00.000Z',
    webhook_registered_at: '2026-10-03T12:00:00.000Z',
    last_error_code: null,
    provider_metadata: { provider_version: '0.7.2' },
    created_at: '2026-10-03T12:00:00.000Z',
    archived_at: null,
  };
}

function integration(id: string, label: string, enabled = false): Row {
  return {
    id,
    organization_id: organizationId,
    key: `whatsapp_evolution_go:${id}`,
    label,
    provider: 'Evolution GO',
    connected: true,
    enabled,
    paused: !enabled,
    last_tested_at: '2026-10-03T12:00:00.000Z',
    last_success_at: '2026-10-03T12:00:00.000Z',
    last_error: null,
    status_detail: enabled ? 'Operacional' : 'Protegido',
    configuration: {
      configured: true,
      base_url_configured: true,
      instance_name: label,
      provider_version: '0.7.2',
      secret_ref: 'vault-ref-must-not-leak',
    },
  };
}

function matches(row: Row, query: Query): boolean {
  for (const [key, value] of Object.entries(query.filters)) {
    if (key.startsWith('neq:')) {
      if (row[key.slice(4)] === value) return false;
    } else if (key.startsWith('in:')) {
      if (!(value as unknown[]).includes(row[key.slice(3)])) return false;
    } else if (key.startsWith('is:')) {
      if (row[key.slice(3)] !== value) return false;
    } else if (row[key] !== value) {
      return false;
    }
  }
  if (query.or) {
    const visible = row.account_type === 'corporate' || row.owner_user_id === state.userId;
    if (!visible) return false;
  }
  return true;
}

function selected(rows: Row[], query: Query): Row | Row[] | null {
  const result = rows.filter((row) => matches(row, query)).slice(0, query.limit ?? Number.POSITIVE_INFINITY);
  return query.single ? result[0] ?? null : result;
}

function execute(query: Query): Result {
  calls.push({ ...query, filters: { ...query.filters }, value: query.value ? { ...query.value } : undefined });
  const failure = failQuery?.(query);
  if (failure) return failure;
  if (query.operation === 'rpc') {
    if (query.table === 'read_integration_secret') {
      return ok(secrets.get(String(query.value?.p_integration)) ?? {});
    }
    if (query.table === 'store_integration_secret') {
      secrets.set(String(query.value?.p_integration), query.value?.p_secret as Row);
      return ok({});
    }
    return ok({});
  }

  if (query.operation === 'select') {
    if (query.table === 'profiles') {
      return ok({ active_organization_id: organizationId, name: 'Usuário sintético' });
    }
    if (query.table === 'organization_members') {
      const member = [administratorId, ownerId, otherSellerId, newSellerOwnerId].includes(String(query.filters.user_id))
        ? { status: 'active' }
        : null;
      return ok(query.single ? member : member ? [member] : []);
    }
    if (query.table === 'whatsapp_accounts') return ok(selected(accounts, query));
    if (query.table === 'integrations') return ok(selected(integrations, query));
    if (query.table === 'messaging_provider_controls') return ok(query.single ? controls : [controls]);
    return ok(query.single ? null : []);
  }

  if (query.table === 'whatsapp_accounts') {
    if (query.operation === 'insert') accounts.push({ archived_at: null, ...query.value });
    if (query.operation === 'update') {
      accounts = accounts.map((row) => matches(row, query) ? { ...row, ...query.value } : row);
    }
    if (query.operation === 'delete') accounts = accounts.filter((row) => !matches(row, query));
    return ok(query.value ?? {});
  }

  if (query.table === 'integrations') {
    if (query.operation === 'insert') integrations.push({ ...query.value });
    if (query.operation === 'update') {
      integrations = integrations.map((row) => matches(row, query) ? { ...row, ...query.value } : row);
    }
    if (query.operation === 'delete') integrations = integrations.filter((row) => !matches(row, query));
    return ok(query.value ?? {});
  }

  if (query.table === 'messaging_provider_controls' && query.operation === 'upsert') {
    controls = { ...controls, ...query.value };
    return ok(controls);
  }

  return ok(query.value ?? {});
}

function queryFor(table: string) {
  const query: Query = { table, operation: 'select', filters: {} };
  const chain: Record<string, unknown> = {};
  chain.select = (selection?: string) => { query.selection = selection; return chain; };
  chain.eq = (key: string, value: unknown) => { query.filters[key] = value; return chain; };
  chain.neq = (key: string, value: unknown) => { query.filters[`neq:${key}`] = value; return chain; };
  chain.in = (key: string, value: unknown[]) => { query.filters[`in:${key}`] = value; return chain; };
  chain.is = (key: string, value: unknown) => { query.filters[`is:${key}`] = value; return chain; };
  chain.or = (value: string) => { query.or = value; return chain; };
  chain.order = () => chain;
  chain.limit = (value: number) => { query.limit = value; return chain; };
  chain.insert = (value: Row) => { query.operation = 'insert'; query.value = value; return chain; };
  chain.update = (value: Row) => { query.operation = 'update'; query.value = value; return chain; };
  chain.upsert = (value: Row) => { query.operation = 'upsert'; query.value = value; return chain; };
  chain.delete = () => { query.operation = 'delete'; return chain; };
  chain.maybeSingle = () => { query.single = true; return chain; };
  chain.then = (resolve: (result: Result) => unknown, reject: (error: unknown) => unknown) =>
    Promise.resolve(execute(query)).then(resolve, reject);
  return chain;
}

function request(action: string, input: Row = {}) {
  return new Request('https://example.invalid/evolution-go', {
    method: 'POST',
    headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...input }),
  });
}

beforeEach(() => {
  vi.resetModules();
  calls = [];
  state.userId = ownerId;
  state.permissions = { 'channels.view_own': true, 'channels.connect_own': true };
  accounts = [
    account({ id: corporateAccountId, integrationId: corporateIntegrationId, type: 'corporate', label: 'Corporativa', isDefault: true, enabled: true }),
    account({ id: secondCorporateAccountId, integrationId: secondCorporateIntegrationId, type: 'corporate', label: 'Corporativa 2' }),
    account({ id: ownerAccountId, integrationId: ownerIntegrationId, type: 'seller', ownerUserId: ownerId, label: 'Minha conta' }),
    account({ id: otherAccountId, integrationId: otherIntegrationId, type: 'seller', ownerUserId: otherSellerId, label: 'Conta alheia' }),
  ];
  integrations = [
    integration(corporateIntegrationId, 'Corporativa', true),
    integration(secondCorporateIntegrationId, 'Corporativa 2'),
    integration(ownerIntegrationId, 'Minha conta'),
    integration(otherIntegrationId, 'Conta alheia'),
  ];
  controls = {
    organization_id: organizationId,
    provider: 'evolution_go',
    inbound_enabled: true,
    send_enabled: true,
    automation_enabled: true,
    kill_switch: false,
    reason: 'synthetic-ready',
  };
  failQuery = null;
  secrets = new Map(integrations.map((item) => [String(item.id), {
    base_url: 'https://evo-eisenflow.kz3solucoes.cloud',
    global_api_key: 'synthetic-global-key-must-not-leak',
    instance_token: 'synthetic-instance-token-must-not-leak',
    webhook_secret: 'synthetic-webhook-secret-must-not-leak',
    instance_name: item.label,
  }]));
  state.admin = {
    from: queryFor,
    rpc: (name: string, value: Row) => Promise.resolve(execute({
      table: name,
      operation: 'rpc',
      value,
      filters: {},
    })),
  };
  vi.stubGlobal('Deno', {
    env: {
      get: (name: string) => ({
        SUPABASE_URL: 'https://example.invalid',
        SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role',
        EVOLUTION_GO_ALLOWED_ORIGINS: 'https://evo-eisenflow.kz3solucoes.cloud',
      } as Record<string, string>)[name],
    },
    serve: (callback: typeof handler) => { handler = callback; },
  });
  fetchMock = vi.fn(async (url: string | URL) => {
    const path = new URL(String(url)).pathname;
    const data = path.endsWith('/instance/qr')
      ? { qrcode: 'data:image/png;base64,synthetic-qr', code: 'QR-CODE' }
      : path.endsWith('/instance/pair')
        ? { pairingCode: 'PAIR-123' }
        : { connected: true, loggedIn: true, myJid: '5511999997788@s.whatsapp.net', name: 'Synthetic' };
    return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
});

describe('Evolution GO multi-account handler', () => {
  it('persists the provider-issued ID after creating an instance without unsupported fields', async () => {
    state.userId = administratorId;
    state.permissions = { 'channels.manage_all': true };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'provider-instance-id', name: 'Corporativa 2' } }), { status: 200 }));
    await import('../functions/evolution-go/index');

    const response = await handler(request('create_instance', {
      account_id: secondCorporateAccountId,
      base_url: 'https://evo-eisenflow.kz3solucoes.cloud',
      global_api_key: 'synthetic-global-key-must-not-leak',
    }));

    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
    const providerRequest = fetchMock.mock.calls.find(([url]) => new URL(String(url)).pathname === '/instance/create');
    expect(providerRequest).toBeDefined();
    expect(JSON.parse(String(providerRequest?.[1]?.body))).toEqual({ name: 'Corporativa 2', token: expect.any(String) });
    expect(secrets.get(secondCorporateIntegrationId)).toMatchObject({
      instance_id: 'provider-instance-id',
      instance_name: 'Corporativa 2',
    });
  });

  it('lists shared corporate accounts plus only the caller-owned seller account without exposing secrets', async () => {
    await import('../functions/evolution-go/index');
    const response = await handler(request('list'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.accounts.map((item: Row) => (item.account as Row).id)).toEqual([
      corporateAccountId,
      ownerAccountId,
    ]);
    expect(body.accounts.find((item: Row) => (item.account as Row).id === corporateAccountId))
      .toMatchObject({ canManage: false, canConnect: false, canViewQr: false });
    expect(body.accounts.find((item: Row) => (item.account as Row).id === ownerAccountId))
      .toMatchObject({ canManage: false, canConnect: true, canViewQr: true });
    expect(JSON.stringify(body)).not.toMatch(/synthetic-global-key|synthetic-instance-token|synthetic-webhook-secret|vault-ref/);
    expect(calls.find((call) => call.table === 'whatsapp_accounts'
      && call.operation === 'select' && call.or)?.selection).toContain('is_default');
  });

  it('returns only the authenticated owner account for self-service, never a corporate or another seller account', async () => {
    await import('../functions/evolution-go/index');
    const response = await handler(request('my_account'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, canManage: false, account: { id: ownerAccountId, accountType: 'seller', ownerUserId: ownerId } });
    expect(JSON.stringify(body)).not.toMatch(/Corporativa|Conta alheia|synthetic-global-key|synthetic-instance-token|synthetic-webhook-secret|vault-ref/);
    const ownAccountQuery = calls.find((call) => call.table === 'whatsapp_accounts'
      && call.operation === 'select'
      && call.filters.owner_user_id === ownerId
      && call.filters.account_type === 'seller');
    expect(ownAccountQuery).toBeDefined();

    state.userId = administratorId;
    state.permissions = { 'channels.manage_all': true };
    const administratorResponse = await handler(request('my_account'));
    expect(administratorResponse.status).toBe(200);
    expect(await administratorResponse.json()).toMatchObject({ ok: true, account: null, canManage: false });
  });

  it('requires account_id before any secret read or provider request', async () => {
    await import('../functions/evolution-go/index');
    const response = await handler(request('status'));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: 'evolution_go_account_required' });
    expect(calls.some((call) => call.table === 'read_integration_secret')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns QR only to an administrator or the private-account owner and never reveals another seller account', async () => {
    fetchMock.mockImplementation(async (url: string | URL) => {
      const path = new URL(String(url)).pathname;
      const data = path.endsWith('/instance/status')
        ? { Connected: true, LoggedIn: false }
        : path.endsWith('/instance/qr')
          ? { qrcode: 'data:image/png;base64,synthetic-qr', code: 'QR-CODE' }
          : {};
      return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    await import('../functions/evolution-go/index');

    const deniedOther = await handler(request('qr', { account_id: otherAccountId }));
    expect(deniedOther.status).toBe(400);
    expect(await deniedOther.json()).toMatchObject({ ok: false, error: 'evolution_go_account_not_found' });

    const deniedCorporate = await handler(request('qr', { account_id: corporateAccountId }));
    expect(deniedCorporate.status).toBe(400);
    expect(await deniedCorporate.json()).toMatchObject({ ok: false, error: 'evolution_go_account_not_found' });
    expect(calls.some((call) => call.table === 'read_integration_secret')).toBe(false);

    const allowed = await handler(request('qr', { account_id: ownerAccountId }));
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get('Cache-Control')).toBe('no-store');
    expect(await allowed.json()).toMatchObject({
      ok: true,
      qr: { qrcode: 'data:image/png;base64,synthetic-qr', pairingCode: 'QR-CODE' },
    });

    state.userId = administratorId;
    state.permissions = { 'channels.manage_all': true };
    const administratorQr = await handler(request('qr', { account_id: corporateAccountId }));
    expect(administratorQr.status).toBe(200);
    expect(administratorQr.headers.get('Cache-Control')).toBe('no-store');
    expect(calls.filter((call) => call.table === 'read_integration_secret')).toHaveLength(2);
  });

  it('lets Evolution GO establish an unauthenticated runtime before requesting one pairing code', async () => {
    fetchMock.mockImplementation(async (url: string | URL) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith('/instance/connect')) return new Response(JSON.stringify({ data: {} }), { status: 200 });
      if (path.endsWith('/instance/status')) {
        return new Response(JSON.stringify({ data: { Connected: true, LoggedIn: false } }), { status: 200 });
      }
      if (path.endsWith('/instance/pair')) {
        return new Response(JSON.stringify({ data: { PairingCode: 'PAIR-123' } }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: {} }), { status: 200 });
    });
    await import('../functions/evolution-go/index');

    const response = await handler(request('pair', {
      account_id: ownerAccountId,
      phone: '5511999997788',
    }));

    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, pairingCode: 'PAIR-123' });
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/instance/status', '/instance/connect', '/instance/pair',
    ]);
    const pairCall = fetchMock.mock.calls.find(([url]) => new URL(String(url)).pathname === '/instance/pair');
    expect(JSON.parse(String(pairCall?.[1]?.body))).toEqual({ phone: '5511999997788' });
  });

  it('requests a fresh QR even while Evolution GO still reports its startup status as disconnected', async () => {
    fetchMock.mockImplementation(async (url: string | URL) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith('/instance/status')) {
        return new Response(JSON.stringify({ data: { Connected: false, LoggedIn: false } }), { status: 200 });
      }
      if (path.endsWith('/instance/connect')) return new Response(JSON.stringify({ data: {} }), { status: 200 });
      if (path.endsWith('/instance/qr')) {
        return new Response(JSON.stringify({ data: { code: 'data:image/png;base64,fresh-qr' } }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: {} }), { status: 200 });
    });
    await import('../functions/evolution-go/index');

    const response = await handler(request('qr', { account_id: ownerAccountId }));

    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, qr: { qrcode: 'data:image/png;base64,fresh-qr' } });
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/instance/status', '/instance/connect', '/instance/qr',
    ]);
  });

  it('recovers one stale Evolution GO runtime before returning a QR', async () => {
    let qrCalls = 0;
    fetchMock.mockImplementation(async (url: string | URL) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith('/instance/status')) {
        return new Response(JSON.stringify({ data: { Connected: false, LoggedIn: false } }), { status: 200 });
      }
      if (path.endsWith('/instance/qr')) {
        qrCalls += 1;
        return qrCalls === 1
          ? new Response(JSON.stringify({ error: 'try again' }), { status: 400 })
          : new Response(JSON.stringify({ data: { code: 'data:image/png;base64,recovered-qr' } }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: {} }), { status: 200 });
    });
    await import('../functions/evolution-go/index');

    const response = await handler(request('qr', { account_id: ownerAccountId }));

    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, qr: { qrcode: 'data:image/png;base64,recovered-qr' } });
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/instance/status', '/instance/connect', '/instance/qr', '/instance/reconnect', '/instance/connect', '/instance/qr',
    ]);
  });

  it('creates corporate and seller accounts in the canonical tables with the correct ownership', async () => {
    state.userId = administratorId;
    state.permissions = { 'channels.manage_all': true };
    await import('../functions/evolution-go/index');
    const newCorporateId = 'd1111111-1111-4111-8111-111111111111';
    const newSellerId = 'd2222222-2222-4222-8222-222222222222';

    const corporateResponse = await handler(request('create_account', {
      account_id: newCorporateId,
      account_type: 'corporate',
      owner_user_id: otherSellerId,
      label: 'Nova corporativa',
    }));
    expect(corporateResponse.status, JSON.stringify(await corporateResponse.clone().json())).toBe(200);
    expect(accounts.find((item) => item.id === newCorporateId)).toMatchObject({
      account_type: 'corporate', owner_user_id: null, provider: 'evolution_go', is_default: false,
    });

    expect((await handler(request('create_account', {
      account_id: newSellerId,
      account_type: 'seller',
      owner_user_id: newSellerOwnerId,
      label: 'Privada vendedor',
    }))).status).toBe(200);
    expect(accounts.find((item) => item.id === newSellerId)).toMatchObject({
      account_type: 'seller', owner_user_id: newSellerOwnerId, provider: 'evolution_go', is_default: false,
    });
  });

  it('lets the owner activate their seller account and open the validated Evolution route', async () => {
    controls = {
      ...controls,
      inbound_enabled: false,
      send_enabled: false,
      automation_enabled: false,
      kill_switch: true,
      reason: 'provider_not_validated',
    };
    await import('../functions/evolution-go/index');
    const response = await handler(request('activate', { account_id: ownerAccountId }));
    expect(response.status).toBe(200);
    expect(accounts.find((item) => item.id === ownerAccountId)).toMatchObject({ enabled: true, is_default: false });
    expect(controls).toMatchObject({
      inbound_enabled: true,
      send_enabled: true,
      automation_enabled: true,
      kill_switch: false,
    });
    expect(calls.some((call) => call.table === 'messaging_provider_controls'
      && call.operation === 'upsert' && call.value?.reason === 'seller_account_activated')).toBe(true);
  });

  it('activates a seller account without changing the corporate default', async () => {
    state.userId = administratorId;
    state.permissions = { 'channels.manage_all': true };
    await import('../functions/evolution-go/index');
    const response = await handler(request('activate', { account_id: ownerAccountId }));
    expect(response.status).toBe(200);
    expect(accounts.find((item) => item.id === ownerAccountId)).toMatchObject({ enabled: true, is_default: false });
    expect(accounts.find((item) => item.id === corporateAccountId)).toMatchObject({ enabled: true, is_default: true });
    expect(accounts.find((item) => item.id === otherAccountId)).toMatchObject({ enabled: false, is_default: false });
    expect(calls.some((call) => call.table === 'whatsapp_accounts'
      && call.operation === 'update' && call.filters.account_type === 'corporate')).toBe(false);
  });

  it('switches the corporate default without modifying private seller accounts', async () => {
    state.userId = administratorId;
    state.permissions = { 'configuration.manage': true };
    await import('../functions/evolution-go/index');
    const response = await handler(request('activate', { account_id: secondCorporateAccountId }));
    expect(response.status).toBe(200);
    expect(accounts.find((item) => item.id === corporateAccountId)).toMatchObject({ is_default: false });
    expect(accounts.find((item) => item.id === secondCorporateAccountId)).toMatchObject({ enabled: true, is_default: true });
    expect(accounts.find((item) => item.id === ownerAccountId)).toMatchObject({ enabled: false, is_default: false });
    expect(accounts.find((item) => item.id === otherAccountId)).toMatchObject({ enabled: false, is_default: false });
  });

  it('fails closed and does not audit activation success when account state persistence fails', async () => {
    state.userId = administratorId;
    state.permissions = { 'channels.manage_all': true };
    controls = {
      ...controls,
      inbound_enabled: false,
      send_enabled: false,
      automation_enabled: false,
      kill_switch: true,
      reason: 'provider_not_validated',
    };
    failQuery = (query) => query.table === 'whatsapp_accounts'
      && query.operation === 'update'
      && query.filters.id === ownerAccountId
      && query.value?.enabled === true
      ? { data: null, error: { message: 'synthetic update failure' } }
      : null;
    await import('../functions/evolution-go/index');

    const response = await handler(request('activate', { account_id: ownerAccountId }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: 'evolution_go_activation_state_save_failed',
    });
    expect(controls).toMatchObject({
      inbound_enabled: false,
      send_enabled: false,
      automation_enabled: false,
      kill_switch: true,
    });
    expect(calls.some((call) => call.table === 'audit_logs'
      && call.operation === 'insert'
      && call.value?.action === 'whatsapp.evolution_go_activated')).toBe(false);
  });
});
