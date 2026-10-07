import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
const org = 'a1ea4d91-3d09-4052-9759-3009b442e6cb';
const actor = '11111111-1111-4111-8111-111111111111';
const seller = '86457c84-639c-4fb4-9749-6e1af363aa89';
const corporateIntegration = '22222222-2222-4222-8222-222222222222';
const sellerIntegration = '33333333-3333-4333-8333-333333333333';
const accountId = '44444444-4444-4444-8444-444444444444';
const remoteId = '55555555-5555-4555-8555-555555555555';
const instanceName = 'wf-a1ea4d913d09-86457c84639c';

const state = vi.hoisted(() => ({ admin: {} as object }));
vi.mock('../functions/_shared/auth.ts', () => ({
  createAdminClient: () => state.admin,
  requireUser: async () => ({ user: { id: actor } }),
  requireOrganizationPermission: async () => undefined,
}));

let handler: (request: Request) => Promise<Response>;
let operations: Array<{ table: string; operation: string; filters: Row; value?: Row }>;
let remotePresent: boolean;
let badJob: boolean;
let includeAccount: boolean;
let missingMetadata: boolean;
let sharedIntegration: boolean;
let failFinalize: boolean;
let failPreflight: boolean;
let sharedCompanyData: boolean;
let failIdentityDelete: boolean;
let memberPresent: boolean;
let claim: Row | null;
let fetchMock: ReturnType<typeof vi.fn>;
let rpcCalls: string[];

function queryFor(table: string) {
  const query: { operation: string; filters: Row; value?: Row } = { operation: 'select', filters: {} };
  const chain: Record<string, unknown> = {};
  chain.eq = (key: string, value: unknown) => { query.filters[key] = value; return chain; };
  chain.is = (key: string, value: unknown) => { query.filters[key] = value; return chain; };
  chain.neq = (key: string, value: unknown) => { query.filters[`not_${key}`] = value; return chain; };
  chain.limit = () => chain;
  chain.in = () => chain;
  chain.select = () => chain;
  chain.insert = (value: Row) => { query.operation = 'insert'; query.value = value; return chain; };
  chain.update = (value: Row) => { query.operation = 'update'; query.value = value; return chain; };
  const execute = () => {
    operations.push({ table, operation: query.operation, filters: { ...query.filters }, value: query.value });
    if (table === 'team_member_evolution_removal_claims') {
      if (query.operation === 'insert') {
        claim = { ...query.value, claimed_at: new Date().toISOString() };
        return { data: claim, error: null };
      }
      if (query.operation === 'update') {
        claim = { ...claim, ...query.value };
        return { data: claim, error: null };
      }
      return { data: claim, error: null };
    }
    if (query.operation === 'update') return { data: {}, error: null };
    if (table === 'profiles') return { data: { active_organization_id: org }, error: null };
    if (table === 'organization_members') return { data: !memberPresent && query.filters.user_id === seller ? null : {
      role: query.filters.user_id === actor ? 'administrador' : 'vendedor', status: 'active',
    }, error: null };
    if (table === 'whatsapp_accounts') {
      if (query.filters.account_type === 'corporate') return { data: { integration_id: corporateIntegration }, error: null };
      if (query.filters.integration_id) return { data: sharedIntegration ? [{ id: corporateIntegration }] : [], error: null };
      return { data: includeAccount ? {
        id: accountId, integration_id: sellerIntegration, enabled: false,
        provider_metadata: missingMetadata ? {} : { instance_name: instanceName },
      } : null, error: null };
    }
    if (table === 'evolution_go_seller_provisioning_jobs') return {
      data: includeAccount ? { id: remoteId, instance_name: badJob ? 'wrong-instance' : instanceName,
        integration_id: sellerIntegration, whatsapp_account_id: accountId } : null,
      error: null,
    };
    if (table === 'integrations') return { data: { configuration: {}, key: `whatsapp_evolution_go:${accountId}` }, error: null };
    throw new Error(`Unexpected table: ${table}`);
  };
  chain.maybeSingle = () => Promise.resolve(execute());
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(execute()).then(resolve);
  return chain;
}

beforeEach(() => {
  vi.resetModules(); operations = []; remotePresent = false; badJob = false;
  includeAccount = false; missingMetadata = false; sharedIntegration = false; failFinalize = false;
  failPreflight = false; sharedCompanyData = false; failIdentityDelete = false; memberPresent = true; claim = null;
  rpcCalls = [];
  state.admin = {
    from: queryFor,
    storage: { from: () => ({ remove: async () => ({ error: null }) }) },
    rpc: async (name: string) => { rpcCalls.push(name); return name === 'read_integration_secret'
      ? { data: { base_url: 'https://evo-eisenflow.kz3solucoes.cloud', global_api_key: 'synthetic-key' }, error: null }
      : name === 'team_member_identity_erasure_preflight'
        ? failPreflight ? { data: null, error: { message: 'another organization' } }
          : { data: { ready: true }, error: null }
      : name === 'team_member_shared_data_preflight'
        ? sharedCompanyData ? { data: null, error: { message: 'member_shared_company_data_requires_reassignment' } }
          : { data: { ready: true }, error: null }
      : name === 'team_member_identity_erasure_finalize'
        ? failIdentityDelete ? { data: null, error: { message: 'identity delete failed' } }
          : { data: { identity_deleted: true }, error: null }
      : name === 'list_user_owned_storage'
        ? { data: [], error: null }
      : name === 'revoke_user_auth_sessions'
        ? { data: 1, error: null }
      : name === 'team_member_evolution_remove_finalize'
        ? failFinalize ? { data: null, error: { message: 'transaction failed' } }
          : { data: { membership_removed: true, history_preserved: true }, error: null }
        : { data: null, error: { message: 'unexpected RPC' } }; },
  };
  vi.stubGlobal('Deno', { env: { get: () => undefined }, serve: (callback: typeof handler) => { handler = callback; } });
  fetchMock = vi.fn(async (url: URL, init?: RequestInit) => {
    if (url.pathname === '/instance/all') return new Response(JSON.stringify({ data: remotePresent
      ? [{ id: remoteId, name: instanceName }] : [] }), { status: 200 });
    if (url.pathname === `/instance/delete/${remoteId}` && init?.method === 'DELETE') {
      remotePresent = false;
      return new Response('{}', { status: 200 });
    }
    throw new Error('Unexpected provider request');
  });
  vi.stubGlobal('fetch', fetchMock);
});

const request = () => new Request('http://127.0.0.1:4173/functions/v1/team-member-evolution-removal', {
  method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'remove', user_id: seller }),
});

describe('team-member Evolution GO removal boundary', () => {
  it('reconciles a remote orphan after a previous partial deletion without touching history', async () => {
    await import('../functions/team-member-evolution-removal/index');
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, history_preserved: true, identity_deleted: true });
    expect(rpcCalls).toContain('team_member_identity_erasure_finalize');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(operations.some((item) => item.operation === 'delete')).toBe(false);
    expect(operations.map((item) => item.table)).not.toContain('whatsapp_conversations');
    expect(operations.map((item) => item.table)).not.toContain('leads');
    expect(claim?.state).toBe('remote_absent');
  });

  it('deletes only the exact tenant-and-seller remote instance once, then finalizes', async () => {
    includeAccount = true; remotePresent = true;
    await import('../functions/team-member-evolution-removal/index');
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(rpcCalls).toContain('team_member_identity_erasure_finalize');
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1);
    expect(operations.find((item) => item.table === 'whatsapp_accounts' && item.operation === 'update')?.value)
      .toMatchObject({ enabled: false, connection_status: 'disconnected' });
  });

  it('accepts a queued seller account whose instance name exists only in the provisioning job', async () => {
    includeAccount = true; missingMetadata = true;
    await import('../functions/team-member-evolution-removal/index');
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, history_preserved: true });
  });

  it('rejects mismatched local identity before provider deletion or local mutation', async () => {
    includeAccount = true; badJob = true; remotePresent = true;
    await import('../functions/team-member-evolution-removal/index');
    const response = await handler(request());
    expect(await response.json()).toMatchObject({ erro: 'member_instance_identity_mismatch' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(operations.some((item) => item.operation !== 'select')).toBe(false);
  });

  it('does not disable a connector shared with another account', async () => {
    includeAccount = true; sharedIntegration = true; remotePresent = true;
    await import('../functions/team-member-evolution-removal/index');
    const response = await handler(request());
    expect(await response.json()).toMatchObject({ erro: 'member_integration_not_individual' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(operations.some((item) => item.operation !== 'select')).toBe(false);
  });

  it('keeps a resumable remote-absent claim if the database transaction fails', async () => {
    failFinalize = true;
    await import('../functions/team-member-evolution-removal/index');
    const response = await handler(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ erro: 'member_local_finalize_failed' });
    expect(claim?.state).toBe('remote_absent');
    expect(rpcCalls).not.toContain('team_member_identity_erasure_finalize');
  });

  it('blocks cross-tenant identity deletion before any provider mutation', async () => {
    failPreflight = true; remotePresent = true;
    await import('../functions/team-member-evolution-removal/index');
    const response = await handler(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ erro: 'member_identity_erasure_preflight_failed' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rpcCalls).not.toContain('team_member_identity_erasure_finalize');
  });

  it('preserves company records by blocking deletion before touching the remote instance', async () => {
    sharedCompanyData = true; remotePresent = true;
    await import('../functions/team-member-evolution-removal/index');
    const response = await handler(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ erro: 'member_shared_company_data_requires_reassignment' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(operations.some((item) => item.operation !== 'select')).toBe(false);
  });

  it('can finish identity erasure after a previously finalized membership removal', async () => {
    memberPresent = false;
    claim = { state: 'finalized', instance_name: instanceName };
    await import('../functions/team-member-evolution-removal/index');
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ identity_deleted: true });
    expect(rpcCalls).toContain('team_member_identity_erasure_finalize');
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(0);
  });

  it('reports an Auth deletion failure without pretending that the identity was erased', async () => {
    failIdentityDelete = true;
    await import('../functions/team-member-evolution-removal/index');
    const response = await handler(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ erro: 'member_identity_deletion_failed' });
    expect(rpcCalls).toContain('team_member_identity_erasure_finalize');
  });
});
