import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readAnaKnowledgeFence, type AnaKnowledgeSnapshot } from '../functions/_shared/anaKnowledgeFence';

type Row = Record<string, unknown>;
type Query = { table: string; operation: string; value?: Row; filters: Record<string, unknown> };
type Result = { data: unknown; error: null | { message: string; code?: string }; count?: number };
const state = vi.hoisted(() => ({ admin: {} as object, deleteUser: vi.fn(), updateUser: vi.fn(), storageRemove: vi.fn() }));
vi.mock('../functions/_shared/auth.ts', () => ({
  createAdminClient: () => state.admin,
  hasOrganizationPermission: async () => true,
  requireUser: async (request: Request) => {
    if (!request.headers.get('Authorization')) throw new Error('authentication_required');
    return { user: { id: 'owner' }, client: state.admin };
  },
  requireOrganizationRole: async () => undefined,
  requireOrganizationPermission: async () => undefined,
}));

const org = 'a1111111-1111-4111-8111-111111111111';
const leadId = 'b1111111-1111-4111-8111-111111111111';
const integrationId = 'c1111111-1111-4111-8111-111111111111';
const whatsappAccountId = 'e2222222-2222-4222-8222-222222222222';
const anaConfigurationVersionId = 'd1111111-1111-4111-8111-111111111111';
const readyCompany = { active: true, sandbox_mode: false, can_use_ia: true, ai_actions_enabled: true };
const readyIntegration = { id: integrationId, organization_id: org, provider: 'zapi', enabled: true, connected: true, paused: false };
const readyLead = { id: leadId, organization_id: org, owner_id: 'owner', assigned_to: 'owner', modo_atendimento: 'ia', ai_paused: false, opt_out: false, contact_approval_status: 'approved', ana_stage: 'novo', score: 0, active_channel: 'whatsapp', phone: '(11) 99999-0000', first_inbound_at: null, whatsapp_account_id: whatsappAccountId };
const readyAnaConfiguration = {
  dailyMessageLimit: 5,
  allowedChannels: ['whatsapp', 'email'],
  cadencePolicy: { firstFollowUpHours: 24, secondFollowUpHours: 72, timeoutHours: 120, businessHoursOnly: true },
};
const readyRuntime = {
  killSwitchGlobal: false,
  diasSemana: [
    { dia: 'Segunda-feira', ativo: true, inicio: '00:00', fim: '23:59' },
    { dia: 'Terça-feira', ativo: true, inicio: '00:00', fim: '23:59' },
    { dia: 'Quarta-feira', ativo: true, inicio: '00:00', fim: '23:59' },
    { dia: 'Quinta-feira', ativo: true, inicio: '00:00', fim: '23:59' },
    { dia: 'Sexta-feira', ativo: true, inicio: '00:00', fim: '23:59' },
    { dia: 'Sábado', ativo: true, inicio: '00:00', fim: '23:59' },
    { dia: 'Domingo', ativo: true, inicio: '00:00', fim: '23:59' },
  ],
  feriados: [],
};

let calls: Query[];
let override: ((query: Query) => Result | undefined) | undefined;
let handler: (request: Request) => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn>;
let acceptedLeadState: Row;
const ok = (data: unknown): Result => ({ data, error: null });

function execute(query: Query): Result {
  calls.push({ ...query, filters: { ...query.filters } });
  const overridden = override?.(query);
  if (overridden) return overridden;
  if (query.operation === 'rpc') {
    if (query.table === 'resolve_whatsapp_lead_for_account') return ok([{ lead_id: leadId, reason: 'account_identity' }]);
    if (query.table === 'resolve_lead_whatsapp_account') return ok([{ account_id: whatsappAccountId, integration_id: integrationId, owner_user_id: null, is_default: true, connection_status: 'connected' }]);
    if (query.table === 'reserve_ana_outbound_policy') return ok([{ allowed: true, reason: 'ana_policy_reserved', used_count: 1 }]);
    if (query.table === 'record_outreach_provider_acceptance') {
      acceptedLeadState = {
        last_contact: query.value?.p_sent_at,
        no_reply_deadline_at: query.value?.p_no_reply_deadline_at,
      };
      return ok({});
    }
    if (query.table === 'list_user_owned_storage') return ok([]);
    if (query.table === 'revoke_user_auth_sessions') return ok(0);
    if (query.table === 'reserve_prospecting_run') {
      return ok([{
        run_id: 'reserved-run',
        run_status: 'running',
        provider_run_id: null,
        result_cache_id: null,
        provider_start_state: 'attempting',
        reused: false,
        start_claimed: true,
      }]);
    }
    return ok({});
  }
  if (query.table === 'leads' && query.operation === 'update') acceptedLeadState = { ...acceptedLeadState, ...query.value };
  if (query.operation !== 'select') return ok({ id: `${query.table}-id` });
  switch (query.table) {
    case 'profiles': return ok({ active_organization_id: org, name: 'Synthetic user' });
    case 'organization_members': return ok({ role: 'admin', status: 'active' });
    case 'company_settings': return ok(readyCompany);
    case 'organization_module_data': return ok({ data: query.filters.module_key === 'commercial_catalog_policy' ? {} : readyRuntime });
    case 'leads': {
      const lead = { ...readyLead, ...acceptedLeadState };
      return ok('id' in query.filters ? lead : [lead]);
    }
    case 'lead_handoffs': return ok(null);
    case 'integrations': return ok(readyIntegration);
    case 'whatsapp_accounts': return 'owner_user_id' in query.filters
      ? ok([])
      : ok({ id: whatsappAccountId, integration_id: integrationId, owner_user_id: null, is_default: true, enabled: true, connection_status: 'connected', archived_at: null });
    case 'agent_runs': return ok(null);
    case 'lead_messages': return ok([{ sender: 'lead', type: 'received', text: 'Qual o valor?', sent_at: '2026-09-08T00:00:00Z' }]);
    case 'ai_agents': return ok({ active_version_id: anaConfigurationVersionId });
    case 'ai_agent_versions': return ok({ configuration: readyAnaConfiguration });
    default: return ok([]);
  }
}

function queryFor(table: string) {
  const query: Query = { table, operation: 'select', filters: {} };
  const chain: Record<string, unknown> = {};
  for (const method of ['eq', 'is', 'in', 'not', 'gt', 'gte', 'lte', 'neq', 'ilike', 'or', 'order', 'limit', 'range']) {
    chain[method] = (key: string, value: unknown) => {
      if (method === 'eq') query.filters[key] = value;
      if (method === 'neq') query.filters[`neq:${key}`] = value;
      if (method === 'or') query.filters.or = key;
      return chain;
    };
  }
  chain.select = () => chain;
  for (const method of ['insert', 'update', 'upsert']) chain[method] = (value: Row) => { query.operation = method; query.value = value; return chain; };
  chain.delete = () => { query.operation = 'delete'; return chain; };
  chain.single = chain.maybeSingle = () => chain;
  chain.then = (resolve: (result: Result) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(execute(query)).then(resolve, reject);
  return chain;
}

beforeEach(() => {
  vi.resetModules(); calls = []; override = undefined; acceptedLeadState = {};
  state.deleteUser = vi.fn(async () => ({ data: { user: { id: 'deleted-user' } }, error: null }));
  state.updateUser = vi.fn(async () => ({ data: { user: { id: 'updated-user' } }, error: null }));
  state.storageRemove = vi.fn(async () => ({ data: [], error: null }));
  state.admin = {
    from: queryFor,
    rpc: (name: string, value: Row) => Promise.resolve(execute({ table: name, operation: 'rpc', value, filters: {} })),
    storage: { from: () => ({ remove: state.storageRemove }) },
    auth: { admin: { deleteUser: state.deleteUser, updateUserById: state.updateUser } },
  };
  vi.stubGlobal('Deno', { env: { get: (name: string) => ({ SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-jwt', WHATSAPP_WEBHOOK_SHARED_SECRET: 'synthetic-internal-secret' } as Record<string, string>)[name] }, serve: (callback: typeof handler) => { handler = callback; } });
  fetchMock = vi.fn(async () => { throw new Error('Unexpected external call in safety test'); });
  vi.stubGlobal('fetch', fetchMock);
});

describe('R4 team membership and identity boundary — mocked HTTP', () => {
  const target = 'e1111111-1111-4111-8111-111111111111';
  const request = (action: string, fields: Row = {}) => new Request('https://example.invalid/team-members', {
    method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, user_id: target, ...fields }),
  });
  for (const action of ['create', 'update_member', 'reset_password']) it(action + ' refuses global identity mutation', async () => {
    await import('../functions/team-members/index');
    const response = await handler(request(action, { name: 'Synthetic', email: 'synthetic@example.test', password: 'synthetic-password', role: 'vendedor' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ erro: 'global_identity_self_service_required' });
    expect(state.updateUser).not.toHaveBeenCalled(); expect(state.deleteUser).not.toHaveBeenCalled();
    expect(calls.some(q => q.operation !== 'select')).toBe(false);
  });
  for (const action of ['remove', 'set_status', 'update_role']) it(action + ' uses caller-scoped transaction, never global Auth/Storage', async () => {
    override = q => q.table === 'team_member_change' ? ok({ deleted_identity: false, membership_removed: action === 'remove' }) : undefined;
    await import('../functions/team-members/index');
    const response = await handler(request(action, { enabled: false, role: 'cx' }));
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ ok: true, deleted_identity: false });
    expect(calls.find(q => q.table === 'team_member_change')?.value).toMatchObject({ p_org: org, p_user: target, p_action: action });
    expect(state.deleteUser).not.toHaveBeenCalled(); expect(state.updateUser).not.toHaveBeenCalled(); expect(state.storageRemove).not.toHaveBeenCalled();
    expect(calls.some(q => q.table === 'revoke_user_auth_sessions')).toBe(false);
  });
  it('does not turn a failed transaction into success', async () => {
    override = q => q.table === 'team_member_change' ? { data: null, error: { message: 'organization_access_denied' } } : undefined;
    await import('../functions/team-members/index');
    expect((await handler(request('remove'))).status).toBe(400); expect(state.deleteUser).not.toHaveBeenCalled();
  });
  it('requires an explicit invite revision, never autoaccepts latest', async () => {
    await import('../functions/team-members/index');
    const response = await handler(request('activate_invite'));
    expect(response.status).toBe(400); expect(await response.json()).toMatchObject({ erro: 'invite_revision_required' });
    expect(calls.some(q => q.operation !== 'select')).toBe(false);
  });
  it('acceptance uses the authenticated RPC and does not overwrite profiles/memberships from Edge', async () => {
    override = q => q.table === 'team_invite_accept' ? ok({ activated: true, organization_id: org, role: 'cx' }) : undefined;
    await import('../functions/team-members/index');
    const response = await handler(request('activate_invite', { invite_id: target, revision: 3 }));
    expect(response.status).toBe(200); expect(calls.find(q => q.table === 'team_invite_accept')?.value).toEqual({ p_id: target, p_revision: 3 });
    expect(calls.some(q => ['profiles', 'organization_members'].includes(q.table) && q.operation !== 'select')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('cancel/expired acceptance error causes no provisioning or compensating deletion', async () => {
    override = q => q.table === 'team_invite_accept' ? { data: null, error: { message: 'invite_not_current' } } : undefined;
    await import('../functions/team-members/index');
    expect((await handler(request('activate_invite', { invite_id: target, revision: 1 }))).status).toBe(400);
    expect(calls.some(q => q.table === 'enqueue_evolution_go_seller_provisioning')).toBe(false); expect(state.deleteUser).not.toHaveBeenCalled();
  });
  it('accepted seller reports durable provisioning failure honestly, without rolling back identity', async () => {
    override = q => q.table === 'team_invite_accept' ? ok({ activated: true, organization_id: org, role: 'vendedor' }) : undefined;
    await import('../functions/team-members/index');
    const response = await handler(request('activate_invite', { invite_id: target, revision: 1 }));
    expect(await response.json()).toMatchObject({ ok: true, provisioning_warning: 'seller_provisioning_pending_review' });
    expect(state.deleteUser).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it('accepted seller enqueues only the Evolution GO job and wakes only its worker', async () => {
    override = q => q.table === 'team_invite_accept'
      ? ok({ activated: true, organization_id: org, role: 'vendedor' })
      : q.table === 'enqueue_evolution_go_seller_provisioning'
        ? ok([{ job_id: target, whatsapp_account_id: whatsappAccountId, integration_id: integrationId, instance_name: 'wf-synthetic', state: 'queued' }])
        : undefined;
    await import('../functions/team-members/index');
    const response = await handler(request('activate_invite', { invite_id: target, revision: 2 }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, provisioning_warning: null });
    expect(calls.find(q => q.table === 'enqueue_evolution_go_seller_provisioning')?.value).toMatchObject({
      p_organization_id: org, p_user_id: 'owner', p_created_by: 'owner', p_source: 'invite', p_invite_id: target,
    });
    expect(calls.some(q => q.table === 'enqueue_wa_akg_seller_provisioning')).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/evolution-go-worker'))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/wa-akg-worker'))).toBe(false);
  });
  it('administrator effective permissions remain total despite misleading old false overrides', async () => {
    override = q => q.table === 'organization_members' ? ok({ role: 'administrador', status: 'active' })
      : q.table === 'team_member_permissions' ? ok([{ permission: 'team.manage', allowed: false }]) : undefined;
    await import('../functions/team-members/index');
    expect(await (await handler(request('permissions_get'))).json()).toMatchObject({ permissions: { 'team.manage': true } });
    expect((await handler(request('permissions_set', { permissions: { 'team.manage': false } }))).status).toBe(400);
  });
  it('cancel uses transaction and surfaces already accepted conflict', async () => {
    override = q => q.table === 'team_invite_cancel' ? { data: null, error: { message: 'invite_already_accepted' } } : undefined;
    await import('../functions/team-members/index');
    expect((await handler(request('invite_cancel', { invite_id: target }))).status).toBe(400);
    expect(calls.some(q => q.table === 'organization_invites' && q.operation === 'update')).toBe(false);
  });
});

describe('Prospecting handler persistence contract', () => {
  it('creates an executable Apify run with every required database field before contacting the provider', async () => {
    override = (q) => {
      if (q.table === 'lead_source_configs' && q.operation === 'select') {
        return ok({ id: 'source-config', enabled: true, mode: 'production', connection_status: 'connected' });
      }
      if (q.table === 'integrations' && q.operation === 'select') {
        return ok({ id: integrationId, provider: 'Apify', enabled: true, connected: true, paused: false });
      }
      if (q.table === 'read_integration_secret' && q.operation === 'rpc') {
        return ok({ api_token: 'synthetic-apify-token', actor_id: 'synthetic-google-maps-actor' });
      }
      if (q.table === 'finalize_prospecting_run' && q.operation === 'rpc') return ok([{ cache_id: 'result-cache', newly_completed: true }]);
      return undefined;
    };
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'provider-run', status: 'SUCCEEDED', defaultDatasetId: 'dataset-id' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        title: 'Borracharia de teste',
        placeId: 'maps-place-1',
        categoryName: 'Borracharia',
        city: 'São Paulo',
        state: 'São Paulo',
        emails: ['contato@example.invalid'],
        location: { lat: '-23.5505', lng: '-46.6333' },
      }]), { status: 200 }));

    await import('../functions/prospectar-leads/index');
    const response = await handler(new Request('https://example.invalid/prospectar-leads', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceKey: 'apify', mode: 'production', idempotencyKey: '11111111-1111-4111-8111-111111111111', filters: { cidade: 'São Paulo', estado: 'SP', atividades: ['Indústria'], volumeMaximo: 30 } }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      sourceKey: 'apify',
      leads: [{ razao_social: 'Borracharia de teste', latitude: -23.5505, longitude: -46.6333, uf: 'SP', email: 'contato@example.invalid', whatsapp: null, contact_approval_status: 'pending' }],
    });
    expect(calls.find((q) => q.table === 'reserve_prospecting_run' && q.operation === 'rpc')?.value).toMatchObject({
      p_requested_quantity: 30,
      p_mode: 'production',
      p_idempotency_key: 'manual:owner:11111111-1111-4111-8111-111111111111',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string)).toMatchObject({ searchStringsArray: ['Indústria'], maxCrawledPlacesPerSearch: 30 });
    expect(calls.find((q) => q.table === 'finalize_prospecting_run' && q.operation === 'rpc')?.value)
      .toMatchObject({ p_run_id: 'reserved-run', p_results: [{ source_record_id: 'maps-place-1' }] });
  });

  it('keeps a long-running Apify execution resumable instead of holding the browser request open', async () => {
    override = (q) => {
      if (q.table === 'lead_source_configs' && q.operation === 'select') return ok({ id: 'source-config', enabled: true, mode: 'production', connection_status: 'connected' });
      if (q.table === 'integrations' && q.operation === 'select') return ok({ id: integrationId, provider: 'Apify', enabled: true, connected: true, paused: false });
      if (q.table === 'read_integration_secret' && q.operation === 'rpc') return ok({ api_token: 'synthetic-apify-token', actor_id: 'synthetic-google-maps-actor' });
      return undefined;
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'provider-run', status: 'RUNNING', defaultDatasetId: 'dataset-id' } }), { status: 200 }));

    await import('../functions/prospectar-leads/index');
    const response = await handler(new Request('https://example.invalid/prospectar-leads', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceKey: 'apify', mode: 'production', idempotencyKey: '22222222-2222-4222-8222-222222222222', filters: { cidade: 'São Paulo', estado: 'SP', atividades: ['Indústria'], volumeMaximo: 5 } }),
    }));

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ ok: true, pending: true, sourceKey: 'apify' });
    expect(calls.find((q) => q.table === 'prospecting_runs' && q.operation === 'update')?.value).toMatchObject({ provider_run_id: 'provider-run' });
    expect(calls.some((q) => q.table === 'prospecting_cache' && q.operation === 'insert')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an unbounded fresh search before reserving or calling Apify', async () => {
    override = (q) => {
      if (q.table === 'lead_source_configs' && q.operation === 'select') return ok({ id: 'source-config', enabled: true, mode: 'production', connection_status: 'connected' });
      if (q.table === 'integrations' && q.operation === 'select') return ok({ id: integrationId, provider: 'Apify', enabled: true, connected: true, paused: false });
      if (q.table === 'read_integration_secret' && q.operation === 'rpc') return ok({ api_token: 'synthetic-apify-token', actor_id: 'synthetic-google-maps-actor' });
      return undefined;
    };

    await import('../functions/prospectar-leads/index');
    const response = await handler(new Request('https://example.invalid/prospectar-leads', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceKey: 'apify', mode: 'production', idempotencyKey: '77777777-7777-4777-8777-777777777777', filters: { cidade: 'São Paulo', estado: 'SP' } }),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: 'prospecting_terms_required' });
    expect(calls.some((q) => q.table === 'reserve_prospecting_run')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reuses a reserved equivalent run without posting another paid Apify start', async () => {
    override = (q) => {
      if (q.table === 'lead_source_configs' && q.operation === 'select') return ok({ id: 'source-config', enabled: true, mode: 'production', connection_status: 'connected' });
      if (q.table === 'integrations' && q.operation === 'select') return ok({ id: integrationId, provider: 'Apify', enabled: true, connected: true, paused: false });
      if (q.table === 'read_integration_secret' && q.operation === 'rpc') return ok({ api_token: 'synthetic-apify-token', actor_id: 'synthetic-google-maps-actor' });
      if (q.table === 'reserve_prospecting_run' && q.operation === 'rpc') return ok([{
        run_id: 'already-running', run_status: 'running', provider_run_id: 'provider-run', result_cache_id: null,
        provider_start_state: 'accepted', reused: true, start_claimed: false,
      }]);
      return undefined;
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'provider-run', status: 'RUNNING', defaultDatasetId: 'dataset-id' } }), { status: 200 }));

    await import('../functions/prospectar-leads/index');
    const response = await handler(new Request('https://example.invalid/prospectar-leads', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceKey: 'apify', mode: 'production', idempotencyKey: '44444444-4444-4444-8444-444444444444', filters: { cidade: 'São Paulo', estado: 'SP', atividades: ['Indústria'] } }),
    }));

    expect(response.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/v2/actor-runs/provider-run');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.method).not.toBe('POST');
  });

  it('recovers a proved legacy provider run without starting another actor', async () => {
    override = (q) => {
      if (q.table === 'lead_source_configs' && q.operation === 'select') return ok({ id: 'source-config', enabled: true, mode: 'production', connection_status: 'connected' });
      if (q.table === 'integrations' && q.operation === 'select') return ok({ id: integrationId, provider: 'Apify', enabled: true, connected: true, paused: false });
      if (q.table === 'read_integration_secret' && q.operation === 'rpc') return ok({ api_token: 'synthetic-apify-token', actor_id: 'synthetic-google-maps-actor' });
      if (q.table === 'reserve_prospecting_run' && q.operation === 'rpc') return ok([{
        run_id: 'legacy-provider-run', run_status: 'running', provider_run_id: 'provider-run', result_cache_id: null,
        provider_start_state: 'ready', reused: true, start_claimed: false,
      }]);
      return undefined;
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'provider-run', status: 'RUNNING', defaultDatasetId: 'dataset-id' } }), { status: 200 }));

    await import('../functions/prospectar-leads/index');
    const response = await handler(new Request('https://example.invalid/prospectar-leads', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceKey: 'apify', mode: 'production', idempotencyKey: '99999999-9999-4999-8999-999999999999', filters: { cidade: 'São Paulo', estado: 'SP', atividades: ['Indústria'] } }),
    }));

    expect(response.status).toBe(202);
    expect(calls.find((q) => q.table === 'prospecting_runs' && q.operation === 'update')?.value)
      .toMatchObject({ provider_start_state: 'accepted' });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/v2/actor-runs/provider-run');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.method).not.toBe('POST');
  });

  it('does not call Apify again when the provider start is unconfirmed', async () => {
    override = (q) => {
      if (q.table === 'lead_source_configs' && q.operation === 'select') return ok({ id: 'source-config', enabled: true, mode: 'production', connection_status: 'connected' });
      if (q.table === 'integrations' && q.operation === 'select') return ok({ id: integrationId, provider: 'Apify', enabled: true, connected: true, paused: false });
      if (q.table === 'read_integration_secret' && q.operation === 'rpc') return ok({ api_token: 'synthetic-apify-token', actor_id: 'synthetic-google-maps-actor' });
      if (q.table === 'reserve_prospecting_run' && q.operation === 'rpc') return ok([{
        run_id: 'uncertain-start', run_status: 'running', provider_run_id: null, result_cache_id: null,
        provider_start_state: 'unknown', reused: true, start_claimed: false,
      }]);
      return undefined;
    };

    await import('../functions/prospectar-leads/index');
    const response = await handler(new Request('https://example.invalid/prospectar-leads', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceKey: 'apify', mode: 'production', idempotencyKey: '55555555-5555-4555-8555-555555555555', filters: { cidade: 'São Paulo', estado: 'SP', atividades: ['Indústria'] } }),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: 'prospecting_start_unconfirmed', runId: 'uncertain-start' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('marks a malformed start response as unknown instead of assuming no paid run exists', async () => {
    override = (q) => {
      if (q.table === 'lead_source_configs' && q.operation === 'select') return ok({ id: 'source-config', enabled: true, mode: 'production', connection_status: 'connected' });
      if (q.table === 'integrations' && q.operation === 'select') return ok({ id: integrationId, provider: 'Apify', enabled: true, connected: true, paused: false });
      if (q.table === 'read_integration_secret' && q.operation === 'rpc') return ok({ api_token: 'synthetic-apify-token', actor_id: 'synthetic-google-maps-actor' });
      return undefined;
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: { status: 'RUNNING' } }), { status: 200 }));

    await import('../functions/prospectar-leads/index');
    const response = await handler(new Request('https://example.invalid/prospectar-leads', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceKey: 'apify', mode: 'production', idempotencyKey: '66666666-6666-4666-8666-666666666666', filters: { cidade: 'São Paulo', estado: 'SP', atividades: ['Indústria'] } }),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: 'provider_invalid_response', runId: 'reserved-run', recoverable: true });
    expect(calls.find((q) => q.table === 'prospecting_runs' && q.operation === 'update')?.value)
      .toMatchObject({ provider_start_state: 'unknown', last_error: 'provider_invalid_response' });
    expect(calls.find((q) => q.table === 'prospecting_runs' && q.operation === 'update')?.value)
      .not.toHaveProperty('status');
  });

  it('treats a non-auth provider HTTP error after a start attempt as ambiguous', async () => {
    override = (q) => {
      if (q.table === 'lead_source_configs' && q.operation === 'select') return ok({ id: 'source-config', enabled: true, mode: 'production', connection_status: 'connected' });
      if (q.table === 'integrations' && q.operation === 'select') return ok({ id: integrationId, provider: 'Apify', enabled: true, connected: true, paused: false });
      if (q.table === 'read_integration_secret' && q.operation === 'rpc') return ok({ api_token: 'synthetic-apify-token', actor_id: 'synthetic-google-maps-actor' });
      return undefined;
    };
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 400 }));

    await import('../functions/prospectar-leads/index');
    const response = await handler(new Request('https://example.invalid/prospectar-leads', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceKey: 'apify', mode: 'production', idempotencyKey: '88888888-8888-4888-8888-888888888888', filters: { cidade: 'São Paulo', estado: 'SP', atividades: ['Indústria'] } }),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: 'apify_http_400', runId: 'reserved-run', recoverable: true });
    expect(calls.find((q) => q.table === 'prospecting_runs' && q.operation === 'update')?.value)
      .toMatchObject({ provider_start_state: 'unknown', last_error: 'apify_http_400' });
  });

  it('does not treat a zero-row provider-id persistence update as confirmed', async () => {
    override = (q) => {
      if (q.table === 'lead_source_configs' && q.operation === 'select') return ok({ id: 'source-config', enabled: true, mode: 'production', connection_status: 'connected' });
      if (q.table === 'integrations' && q.operation === 'select') return ok({ id: integrationId, provider: 'Apify', enabled: true, connected: true, paused: false });
      if (q.table === 'read_integration_secret' && q.operation === 'rpc') return ok({ api_token: 'synthetic-apify-token', actor_id: 'synthetic-google-maps-actor' });
      if (q.table === 'prospecting_runs' && q.operation === 'update') return ok(null);
      return undefined;
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'provider-run', status: 'RUNNING', defaultDatasetId: 'dataset-id' } }), { status: 200 }));

    await import('../functions/prospectar-leads/index');
    const response = await handler(new Request('https://example.invalid/prospectar-leads', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceKey: 'apify', mode: 'production', idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', filters: { cidade: 'São Paulo', estado: 'SP', atividades: ['Indústria'] } }),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: 'prospecting_provider_id_not_saved', runId: 'reserved-run', recoverable: true });
    const updates = calls.filter((q) => q.table === 'prospecting_runs' && q.operation === 'update');
    expect(updates[0]?.value).toMatchObject({ provider_start_state: 'accepted', provider_run_id: 'provider-run' });
    expect(updates[updates.length - 1]?.value).toMatchObject({ provider_start_state: 'unknown', last_error: 'prospecting_provider_id_not_saved' });
  });

  it('uses the same reservation hash when search terms arrive in a different order', async () => {
    override = (q) => {
      if (q.table === 'lead_source_configs' && q.operation === 'select') return ok({ id: 'source-config', enabled: true, mode: 'production', connection_status: 'connected' });
      if (q.table === 'integrations' && q.operation === 'select') return ok({ id: integrationId, provider: 'Apify', enabled: true, connected: true, paused: false });
      if (q.table === 'read_integration_secret' && q.operation === 'rpc') return ok({ api_token: 'synthetic-apify-token', actor_id: 'synthetic-google-maps-actor' });
      if (q.table === 'reserve_prospecting_run' && q.operation === 'rpc') return ok([{
        run_id: 'same-filters', run_status: 'running', provider_run_id: null, result_cache_id: null,
        provider_start_state: 'unknown', reused: true, start_claimed: false,
      }]);
      return undefined;
    };

    await import('../functions/prospectar-leads/index');
    for (const [idempotencyKey, atividades] of [
      ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', ['Vedação', 'Indústria']],
      ['cccccccc-cccc-4ccc-8ccc-cccccccccccc', ['industria', 'vedação']],
    ] as const) {
      await handler(new Request('https://example.invalid/prospectar-leads', {
        method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceKey: 'apify', mode: 'production', idempotencyKey, filters: { cidade: 'São Paulo', estado: 'SP', atividades } }),
      }));
    }
    const hashes = calls.filter((q) => q.table === 'reserve_prospecting_run').map((q) => q.value?.p_filters_hash);
    expect(hashes).toEqual([hashes[0], hashes[0]]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('finalizes a pending Apify run only after the provider reports completion', async () => {
    override = (q) => {
      if (q.table === 'lead_source_configs' && q.operation === 'select') return ok({ id: 'source-config', enabled: true, mode: 'production', connection_status: 'connected' });
      if (q.table === 'integrations' && q.operation === 'select') return ok({ id: integrationId, provider: 'Apify', enabled: true, connected: true, paused: false });
      if (q.table === 'read_integration_secret' && q.operation === 'rpc') return ok({ api_token: 'synthetic-apify-token', actor_id: 'synthetic-google-maps-actor' });
      if (q.table === 'prospecting_runs' && q.operation === 'select') return ok({ id: 'existing-run', source_key: 'apify', source_config_id: 'source-config', status: 'running', filters: { cidade: 'São Paulo', estado: 'SP', volumeMaximo: 5 }, provider_run_id: 'provider-run', requested_by: 'owner' });
      if (q.table === 'finalize_prospecting_run' && q.operation === 'rpc') return ok([{ cache_id: 'result-cache', newly_completed: true }]);
      return undefined;
    };
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'provider-run', status: 'SUCCEEDED', defaultDatasetId: 'dataset-id' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ title: 'Empresa concluída', placeId: 'maps-place-2', location: { lat: -23.5, lng: -46.6 } }]), { status: 200 }));

    await import('../functions/prospectar-leads/index');
    const response = await handler(new Request('https://example.invalid/prospectar-leads', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceKey: 'apify', mode: 'production', runId: 'existing-run' }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, pending: false, runId: 'existing-run', leads: [{ razao_social: 'Empresa concluída' }] });
    expect(calls.some((q) => q.table === 'prospecting_runs' && q.operation === 'insert')).toBe(false);
    expect(calls.find((q) => q.table === 'finalize_prospecting_run' && q.operation === 'rpc')?.value).toMatchObject({ p_run_id: 'existing-run', p_provider_run_id: 'provider-run' });
    expect(calls.some((q) => q.table === 'prospecting_cache' && q.operation === 'insert')).toBe(false);
  });

  it('lists only the signed-in user’s runs without contacting the provider', async () => {
    override = (q) => {
      if (q.table === 'organization_members' && q.operation === 'select') return ok({ role: 'seller', status: 'active' });
      if (q.table === 'prospecting_runs' && q.operation === 'select') return ok([{ id: 'existing-run', status: 'running', source_key: 'apify', started_at: '2026-09-23T18:22:53Z', result_count: 0, result_cache_id: null, provider_run_id: 'provider-run', last_error: null, filters: { cidade: 'São Paulo', estado: 'SP' } }]);
      return undefined;
    };
    await import('../functions/prospectar-leads/index');
    const response = await handler(new Request('https://example.invalid/prospectar-leads', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list_runs', sourceKey: 'apify', mode: 'production' }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, runs: [{ id: 'existing-run', status: 'running', hasProvider: true, location: 'São Paulo, SP, Brasil' }] });
    expect(calls.find((q) => q.table === 'prospecting_runs' && q.operation === 'select')?.filters).toMatchObject({ organization_id: org, requested_by: 'owner', source_key: 'apify' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls.some((q) => q.table === 'read_integration_secret')).toBe(false);
  });

  it('lets an organization administrator see team results without crossing organizations', async () => {
    override = (q) => {
      if (q.table === 'prospecting_runs' && q.operation === 'select') return ok([{ id: 'team-run', status: 'completed', source_key: 'apify', started_at: '2026-09-23T18:22:53Z', result_count: 5, result_cache_id: 'team-cache', provider_run_id: 'provider-run', last_error: null, filters: { cidade: 'São Paulo', estado: 'SP' }, requested_by: 'teammate' }]);
      if (q.table === 'prospecting_cache' && q.operation === 'select' && q.filters.id === 'team-cache') return ok({ results: [{ razao_social: 'Empresa da equipe' }] });
      if (q.table === 'prospecting_cache' && q.operation === 'select') return ok([{ id: 'team-cache', total_found: 5, created_at: '2026-09-23T18:23:16Z', filters: { municipio: 'São Paulo' }, user_id: 'teammate' }]);
      return undefined;
    };
    await import('../functions/prospectar-leads/index');
    const list = await handler(new Request('https://example.invalid/prospectar-leads', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list_runs', sourceKey: 'apify', mode: 'production' }),
    }));
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ runs: [{ id: 'team-run', fromTeam: true, resultCount: 5 }] });
    const runQuery = calls.find((q) => q.table === 'prospecting_runs' && q.operation === 'select');
    expect(runQuery?.filters).toMatchObject({ organization_id: org, source_key: 'apify' });
    expect(runQuery?.filters).not.toHaveProperty('requested_by');
    const open = await handler(new Request('https://example.invalid/prospectar-leads', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'open_cache', sourceKey: 'apify', mode: 'production', cacheId: 'team-cache' }),
    }));
    expect(open.status).toBe(200);
    expect(await open.json()).toMatchObject({ leads: [{ razao_social: 'Empresa da equipe' }] });
    expect(calls.find((q) => q.table === 'prospecting_cache' && q.operation === 'select' && q.filters.id === 'team-cache')?.filters).not.toHaveProperty('user_id');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('opens a completed run from the saved cache without starting or polling Apify again', async () => {
    override = (q) => {
      if (q.table === 'prospecting_runs' && q.operation === 'select') return ok({ id: 'existing-run', source_key: 'apify', source_config_id: 'source-config', status: 'completed', filters: {}, provider_run_id: 'provider-run', result_cache_id: 'cached-results' });
      if (q.table === 'prospecting_cache' && q.operation === 'select') return ok({ results: [{ razao_social: 'Empresa salva' }] });
      return undefined;
    };
    await import('../functions/prospectar-leads/index');
    const response = await handler(new Request('https://example.invalid/prospectar-leads', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceKey: 'apify', mode: 'production', runId: 'existing-run' }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, cacheId: 'cached-results', leads: [{ razao_social: 'Empresa salva' }] });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls.some((q) => q.table === 'prospecting_runs' && q.operation === 'update')).toBe(false);
  });

  it('surfaces an unlinked historical cache separately and opens it without mutating a failed run', async () => {
    override = (q) => {
      if (q.table === 'organization_members' && q.operation === 'select') return ok({ role: 'seller', status: 'active' });
      if (q.table === 'prospecting_runs' && q.operation === 'select') return ok([]);
      if (q.table === 'prospecting_cache' && q.operation === 'select' && q.filters.id === 'historical-cache') return ok({ results: [{ razao_social: 'Empresa anterior' }] });
      if (q.table === 'prospecting_cache' && q.operation === 'select') return ok([{ id: 'historical-cache', total_found: 1, created_at: '2026-09-11T18:37:10Z', filters: { municipio: 'São Paulo', uf: 'SP' }, user_id: 'owner' }]);
      return undefined;
    };
    await import('../functions/prospectar-leads/index');
    const list = await handler(new Request('https://example.invalid/prospectar-leads', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list_runs', sourceKey: 'apify', mode: 'production' }),
    }));
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ runs: [{ id: 'historical-cache', status: 'cached', resultCount: 1, location: 'São Paulo, SP, Brasil' }] });
    const open = await handler(new Request('https://example.invalid/prospectar-leads', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'open_cache', sourceKey: 'apify', mode: 'production', cacheId: 'historical-cache' }),
    }));
    expect(open.status).toBe(200);
    expect(await open.json()).toMatchObject({ ok: true, cacheId: 'historical-cache', leads: [{ razao_social: 'Empresa anterior' }] });
    expect(calls.find((q) => q.table === 'prospecting_cache' && q.operation === 'select' && q.filters.id === 'historical-cache')?.filters)
      .toMatchObject({ organization_id: org, user_id: 'owner', source: 'apify' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls.some((q) => q.operation === 'update' || q.operation === 'insert')).toBe(false);
  });

  it('keeps a recoverable provider error pending and leaves integration connectivity untouched', async () => {
    override = (q) => {
      if (q.table === 'lead_source_configs' && q.operation === 'select') return ok({ id: 'source-config', enabled: true, mode: 'production', connection_status: 'connected' });
      if (q.table === 'integrations' && q.operation === 'select') return ok({ id: integrationId, provider: 'Apify', enabled: true, connected: true, paused: false });
      if (q.table === 'read_integration_secret' && q.operation === 'rpc') return ok({ api_token: 'synthetic-apify-token' });
      if (q.table === 'prospecting_runs' && q.operation === 'select') return ok({ id: 'existing-run', source_key: 'apify', source_config_id: 'source-config', status: 'running', filters: { volumeMaximo: 5 }, provider_run_id: 'provider-run', requested_by: 'owner' });
      return undefined;
    };
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 429 }));
    await import('../functions/prospectar-leads/index');
    const response = await handler(new Request('https://example.invalid/prospectar-leads', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceKey: 'apify', mode: 'production', runId: 'existing-run' }),
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: 'apify_rate_limited', recoverable: true, runId: 'existing-run' });
    expect(calls.some((q) => q.table === 'prospecting_runs' && q.operation === 'update')).toBe(false);
    expect(calls.some((q) => q.table === 'integrations' && q.operation === 'update')).toBe(false);
    expect(calls.some((q) => q.table === 'lead_source_configs' && q.operation === 'update')).toBe(false);
  });

  it('does not fabricate source identity or geographic coordinates for incomplete records', async () => {
    override = (q) => {
      if (q.table === 'lead_source_configs' && q.operation === 'select') return ok({ id: 'source-config', enabled: true, mode: 'production', connection_status: 'connected' });
      if (q.table === 'integrations' && q.operation === 'select') return ok({ id: integrationId, provider: 'Apify', enabled: true, connected: true, paused: false });
      if (q.table === 'read_integration_secret' && q.operation === 'rpc') return ok({ api_token: 'synthetic-apify-token', actor_id: 'synthetic-google-maps-actor' });
      if (q.table === 'finalize_prospecting_run' && q.operation === 'rpc') return ok([{ cache_id: 'result-cache', newly_completed: true }]);
      return undefined;
    };
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'provider-run', status: 'SUCCEEDED', defaultDatasetId: 'dataset-id' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ title: 'Sem identificação' }, { title: 'Empresa com ID', placeId: 'maps-place-3' }]), { status: 200 }));
    await import('../functions/prospectar-leads/index');
    const response = await handler(new Request('https://example.invalid/prospectar-leads', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceKey: 'apify', mode: 'production', idempotencyKey: '33333333-3333-4333-8333-333333333333', filters: { cidade: 'São Paulo', estado: 'SP', segmentos: ['Indústria'], volumeMaximo: 4 } }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ leads: [{ razao_social: 'Empresa com ID', municipio: null, uf: null, latitude: null, longitude: null, cnae_descricao: null }] });
  });
});

describe('Integration configuration secret boundary', () => {
  it('replaces only the incompatible Apify actor in the Vault and exposes no token', async () => {
    override = (q) => {
      if (q.table === 'integrations' && q.operation === 'select') return ok({ id: integrationId, configuration: {} });
      if (q.table === 'read_integration_secret' && q.operation === 'rpc') {
        return ok({ api_token: 'synthetic-apify-token', actor_id: 'apify/google-search-scraper', task_id: 'old-task', input_json: '{"language":"pt-BR"}' });
      }
      if (q.table === 'lead_source_configs' && q.operation === 'select') return ok({ id: 'source-config' });
      return undefined;
    };

    await import('../functions/configurar-integracao/index');
    const response = await handler(new Request('https://example.invalid/configurar-integracao', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ canal: 'apify', credenciais: { usar_actor_google_maps: true } }),
    }));

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, mensagem: expect.stringContaining('Actor Google Maps') });
    expect(JSON.stringify(payload)).not.toContain('synthetic-apify-token');
    expect(calls.find((q) => q.table === 'store_integration_secret' && q.operation === 'rpc')?.value).toMatchObject({
      p_integration: integrationId,
      p_secret: {
        api_token: 'synthetic-apify-token',
        actor_id: 'compass/google-maps-extractor',
        task_id: '',
      },
    });
    expect(calls.find((q) => q.table === 'lead_source_configs' && q.operation === 'update')?.value).toMatchObject({
      enabled: false,
      connection_status: 'configured',
      configuration: { actor_id: 'compass/google-maps-extractor', task_id: null },
    });
  });
});

describe('R4 invitation delivery — mocked Auth, no emails sent', () => {
  for (const delivery of ['sent', 'existing_account', 'failed']) it('keeps canonical invite and reports ' + delivery, async () => {
    const inviteUserByEmail = vi.fn(async () => ({ data: { user: delivery === 'sent' ? { id: 'new-user' } : null }, error: delivery === 'sent' ? null : delivery === 'existing_account' ? { code: 'email_exists', message: 'already registered' } : { message: 'smtp unavailable' } }));
    state.admin = { from: queryFor, rpc: (name: string, value: Row) => Promise.resolve(execute({ table: name, operation: 'rpc', value, filters: {} })), auth: { admin: { inviteUserByEmail, deleteUser: state.deleteUser } } };
    override = q => q.table === 'team_invite_prepare' ? ok({ id: 'synthetic-invite', email: 'existing@example.test', revision: 2 }) : undefined;
    await import('../functions/team-members/index');
    const response = await handler(new Request('https://example.invalid/team-members', { method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'invite', name: 'Synthetic', email: 'existing@example.test', role: 'vendedor' }) }));
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ ok: true, delivery });
    expect(inviteUserByEmail).toHaveBeenCalledTimes(1); expect(state.deleteUser).not.toHaveBeenCalled();
    expect(calls.some(q => q.table === 'enqueue_evolution_go_seller_provisioning')).toBe(false);
    expect(calls.some(q => q.table === 'organization_members' && q.operation !== 'select')).toBe(false);
    expect(calls.some(q => q.table === 'organization_invites' && q.operation === 'delete')).toBe(false);
  });
});

describe('Team member access security policy', () => {
  it('keeps every built-in role available when the organization has no saved policy', async () => {
    override = (query) => query.table === 'organization_module_data'
      && query.operation === 'select'
      && query.filters.module_key === 'access_security_policy'
      ? ok(null)
      : undefined;

    await import('../functions/team-members/index');
    const response = await handler(new Request('https://example.invalid/team-members', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'policy_get' }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      policy: {
        availableRoles: { administrador: true, vendedor: true, sdr: true, cx: true },
      },
    });
  });
});
afterEach(() => vi.unstubAllGlobals());

function anaRequest(patch: Row = {}) {
  return new Request('https://example.invalid/ana-run', { method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: leadId, event: 'message.received', message_id: 'synthetic-inbound-1', ...patch }) });
}
function expectNoBusinessWrites() {
  expect(calls.filter((call) => ['insert', 'update', 'upsert'].includes(call.operation) && call.table !== 'agent_runs')).toEqual([]);
  expect(fetchMock).not.toHaveBeenCalled();
}

function openAiDecisionResponse(decision: Row) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(decision) } }] }), { status: 200 });
}

function safeInbound(text = 'Gostaria de conhecer as soluções disponíveis.') {
  return [{ sender: 'lead', type: 'received', text, sent_at: '2026-09-08T00:00:00Z' }];
}

function configuredOpenAiSecret() {
  return { openai_key: 'synthetic-openai-key', provedor_principal: 'openai', openai_model: 'gpt-4.1-mini' };
}

describe('Ana handler safety — mocked persistence, no real providers', () => {
  it.each([
    ['company_settings', { ...readyCompany, sandbox_mode: true }, 'sandbox_mode'],
    ['leads', { ...readyLead, ai_paused: true }, 'lead_paused'],
    ['integrations', { ...readyIntegration, enabled: false }, 'ai_integration_not_ready'],
    ['organization_module_data', { data: { killSwitchGlobal: true } }, 'kill_switch_or_config_missing'],
  ])('stops before business writes: %s', async (table, data, reason) => {
    override = (q) => q.table === table && q.operation === 'select' ? ok(data) : undefined;
    await import('../functions/ana-run/index');
    const response = await handler(anaRequest());
    expect(await response.json()).toMatchObject({ ok: true, skipped: true, reason });
    expectNoBusinessWrites();
  });
  it('fails closed when context storage fails', async () => {
    override = (q) => q.table === 'contact_suppressions' ? { data: null, error: { message: 'synthetic database failure' } } : undefined;
    await import('../functions/ana-run/index');
    expect((await handler(anaRequest())).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls.find((q) => q.table === 'domain_events' && q.operation === 'upsert')?.value).toMatchObject({ event_name: 'lead.analysis.failed' });
    expect(calls.some((q) => ['leads', 'lead_messages', 'outreach_jobs', 'lead_handoffs'].includes(q.table) && ['insert', 'update', 'upsert'].includes(q.operation))).toBe(false);
  });
  it('does not call an AI provider or mutate the lead during simulation', async () => {
    await import('../functions/ana-run/index');
    const response = await handler(anaRequest({ contexto: { dry_run: true } }));
    expect(await response.json()).toMatchObject({ ok: true, dry_run: true, acoes_aplicadas: [], status_canal: 'simulacao_sem_alteracoes' });
    expectNoBusinessWrites();
  });
  it('reconciles a concurrent idempotency insert instead of starting a second Ana execution', async () => {
    let runReads = 0;
    override = (q) => {
      if (q.table === 'agent_runs' && q.operation === 'select') {
        runReads += 1;
        return runReads === 1 ? ok(null) : ok({ id: 'a1111111-1111-4111-8111-111111111111', status: 'running', result: {}, error_code: null, error_message: null });
      }
      if (q.table === 'agent_runs' && q.operation === 'insert') return { data: null, error: { code: '23505', message: 'synthetic idempotency collision' } };
      return undefined;
    };
    await import('../functions/ana-run/index');
    const response = await handler(anaRequest({ event: 'manual.run', request_id: 'same-request' }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ ok: false, duplicate: true, in_progress: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('enforces the published operation simulation mode even without a dry-run flag', async () => {
    override = (q) => q.table === 'company_settings' && q.operation === 'select'
      ? ok({ ...readyCompany, ana_operation_enabled: true, ana_operation_mode: 'simulation' })
      : undefined;
    await import('../functions/ana-run/index');
    const response = await handler(anaRequest());
    expect(await response.json()).toMatchObject({ ok: true, dry_run: true, status_canal: 'simulacao_sem_alteracoes' });
    expectNoBusinessWrites();
  });
  it('keeps a supervised reply and meeting request pending approval without calling Calendar or the outbound queue', async () => {
    override = (q) => {
      if (q.table === 'company_settings' && q.operation === 'select') return ok({ ...readyCompany, ana_operation_enabled: true, ana_operation_mode: 'supervised' });
      if (q.table === 'lead_messages' && q.operation === 'select') return ok([{ id: 'a1111111-1111-4111-8111-111111111111', ...safeInbound()[0] }]);
      if (q.table === 'read_integration_secret') return ok(configuredOpenAiSecret());
      return undefined;
    };
    fetchMock.mockResolvedValue(openAiDecisionResponse({
      proximo_estagio: 'apresentado', outcome: null, score: 90, motivo: 'Lead pediu reunião', precisa_humano: false,
      mensagem_sugerida: 'Posso preparar os próximos passos.', acoes: [{ tipo: 'agendar_reuniao', payload: { starts_at: '2026-09-15T10:00:00-03:00' } }],
    }));
    await import('../functions/ana-run/index');
    const response = await handler(anaRequest());
    expect(await response.json()).toMatchObject({ ok: true, supervised: true, status_canal: 'aguardando_aprovacao' });
    expect(calls.find((q) => q.table === 'lead_messages' && q.operation === 'insert')?.value).toMatchObject({ type: 'pending_approval', sent_at: null });
    expect(calls.some((q) => q.table === 'outreach_jobs' && q.operation === 'upsert')).toBe(false);
    expect(calls.some((q) => q.table === 'appointments' && q.operation === 'insert')).toBe(false);
    expect(calls.some((q) => q.table === 'lead_qualifications' && q.operation === 'upsert')).toBe(true);
    expect(calls.some((q) => q.table === 'domain_events' && q.operation === 'upsert')).toBe(true);
  });
  it('fails closed when the active Ana version has no allowed channels', async () => {
    override = (q) => q.table === 'ai_agent_versions' && q.operation === 'select'
      ? ok({ configuration: { ...readyAnaConfiguration, allowedChannels: [] } })
      : undefined;
    await import('../functions/ana-run/index');
    const response = await handler(anaRequest());
    expect(await response.json()).toMatchObject({
      ok: true,
      skipped: true,
      reason: 'channel_not_allowed_by_ana_configuration',
    });
    expectNoBusinessWrites();
  });
  it('moves an authorized new WhatsApp lead to Apresentado and queues the canonical presentation without invoking a model', async () => {
    override = (q) => q.table === 'lead_messages' && q.operation === 'select' ? ok([]) : undefined;
    await import('../functions/ana-run/index');
    const response = await handler(anaRequest({
      event: 'lead.created',
      modo: 'ia',
      request_id: `lead-created:${leadId}:whatsapp`,
    }));

    expect(await response.json()).toMatchObject({
      ok: true,
      proximo_estagio: 'Apresentado',
      status_canal: 'enfileirado',
      mensagem_sugerida: expect.stringContaining('Sou a Ana, assistente virtual da Wayflex'),
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls.find((q) => q.table === 'leads' && q.operation === 'update')?.value).toMatchObject({
      ana_stage: 'apresentado', stage: 'Prospecção', ai_paused: false,
    });
    expect(calls.find((q) => q.table === 'outreach_jobs' && q.operation === 'upsert')?.value).toMatchObject({
      channel: 'whatsapp', status: 'queued',
      payload: expect.objectContaining({ text: expect.stringContaining('Soluções em borracha, silicone e poliuretano') }),
    });
  });
  it('hands off a pricing request before invoking a model or creating an outbound message', async () => {
    await import('../functions/ana-run/index');
    const response = await handler(anaRequest());
    expect(await response.json()).toMatchObject({ ok: true, precisa_humano: true, status_canal: 'atendimento_humano' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls.some((q) => q.table === 'lead_messages' && q.operation === 'insert')).toBe(false);
    expect(calls.some((q) => q.table === 'outreach_jobs' && q.operation === 'upsert')).toBe(false);
    expect(calls.find((q) => q.table === 'lead_handoffs' && q.operation === 'insert')?.value?.reason)
      .toContain('Demanda comercial ou sensível');
    expect(calls.find((q) => q.table === 'domain_events' && q.operation === 'insert')?.value)
      .toMatchObject({ event_name: 'lead.handoff.requested', idempotency_key: expect.stringContaining(':lead.handoff.requested') });
  });
  it('hands off a model decision below the active configuration confidence threshold without queueing it', async () => {
    override = (q) => {
      if (q.table === 'lead_messages' && q.operation === 'select') return ok(safeInbound());
      if (q.table === 'read_integration_secret') return ok(configuredOpenAiSecret());
      return undefined;
    };
    fetchMock.mockResolvedValue(openAiDecisionResponse({
      proximo_estagio: 'novo', outcome: null, score: 40, motivo: 'Modelo pouco confiante', precisa_humano: false,
      mensagem_sugerida: 'Posso entender melhor a sua necessidade?', acoes: [{ tipo: 'enviar_mensagem', payload: {} }],
    }));
    await import('../functions/ana-run/index');
    const response = await handler(anaRequest());
    expect(await response.json()).toMatchObject({
      ok: true,
      precisa_humano: true,
      status_canal: 'atendimento_humano',
      motivo: 'Confiança da decisão (40%) abaixo do mínimo configurado (70%).',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls.some((q) => q.table === 'lead_messages' && q.operation === 'insert')).toBe(false);
    expect(calls.some((q) => q.table === 'outreach_jobs' && q.operation === 'upsert')).toBe(false);
  });
  it('keeps a model-requested proposal in human review and never queues its response', async () => {
    override = (q) => {
      if (q.table === 'lead_messages' && q.operation === 'select') return ok(safeInbound());
      if (q.table === 'read_integration_secret') return ok(configuredOpenAiSecret());
      if (q.table === 'proposals' && q.operation === 'select') return ok(null);
      return undefined;
    };
    fetchMock.mockResolvedValue(openAiDecisionResponse({
      proximo_estagio: 'novo', outcome: null, score: 90, motivo: 'Preparar rascunho', precisa_humano: false,
      mensagem_sugerida: 'Vou verificar os detalhes com a equipe.', acoes: [{ tipo: 'gerar_orcamento', payload: {} }],
    }));
    await import('../functions/ana-run/index');
    const response = await handler(anaRequest());
    expect(await response.json()).toMatchObject({
      ok: true,
      precisa_humano: true,
      status_canal: 'atendimento_humano',
      motivo: 'Orçamento ou proposta requer revisão humana antes de qualquer resposta automática.',
    });
    expect(calls.some((q) => q.table === 'lead_messages' && q.operation === 'insert')).toBe(false);
    expect(calls.some((q) => q.table === 'outreach_jobs' && q.operation === 'upsert')).toBe(false);
    expect(calls.find((q) => q.table === 'proposals' && q.operation === 'insert')?.value)
      .toMatchObject({ status: 'pending', need_approval: true });
  });
  it('fails closed when a model proposes unsafe commercial content', async () => {
    override = (q) => {
      if (q.table === 'lead_messages' && q.operation === 'select') return ok(safeInbound());
      if (q.table === 'read_integration_secret') return ok(configuredOpenAiSecret());
      return undefined;
    };
    fetchMock.mockResolvedValue(openAiDecisionResponse({
      proximo_estagio: 'novo', outcome: null, score: 90, motivo: 'Resposta sugerida', precisa_humano: false,
      mensagem_sugerida: 'O prazo de fabricação é de cinco dias.', acoes: [{ tipo: 'enviar_mensagem', payload: {} }],
    }));
    await import('../functions/ana-run/index');
    const response = await handler(anaRequest());
    expect(await response.json()).toMatchObject({
      ok: true,
      precisa_humano: true,
      status_canal: 'atendimento_humano',
      motivo: 'Conteúdo comercial sensível requer revisão humana antes de qualquer resposta automática.',
    });
    expect(calls.some((q) => q.table === 'lead_messages' && q.operation === 'insert')).toBe(false);
    expect(calls.some((q) => q.table === 'outreach_jobs' && q.operation === 'upsert')).toBe(false);
  });
  it('uses only approved company facts in the model context and records an automatic draft as unsent', async () => {
    const legacyPrompt = 'LEGACY_PROMPT_MUST_NOT_REACH_THE_MODEL';
    override = (q) => {
      if (q.table === 'company_settings' && q.operation === 'select') return ok({
        ...readyCompany,
        name: 'Wayflex',
        description: 'Soluções técnicas aprovadas.',
        ai_prompt: legacyPrompt,
      });
      if (q.table === 'lead_messages' && q.operation === 'select') return ok(safeInbound());
      if (q.table === 'read_integration_secret') return ok(configuredOpenAiSecret());
      return undefined;
    };
    fetchMock.mockResolvedValue(openAiDecisionResponse({
      proximo_estagio: 'novo', outcome: null, score: 90, motivo: 'Qualificar necessidade', precisa_humano: false,
      mensagem_sugerida: 'Qual aplicação você precisa atender?', acoes: [{ tipo: 'enviar_mensagem', payload: {} }],
    }));
    await import('../functions/ana-run/index');
    const response = await handler(anaRequest());
    expect(await response.json()).toMatchObject({ ok: true, precisa_humano: false, status_canal: 'enfileirado' });
    const draft = calls.find((q) => q.table === 'lead_messages' && q.operation === 'insert')?.value;
    expect(draft).toMatchObject({ type: 'draft', sent_at: null });
    const aiRequest = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(aiRequest.messages[0].content).not.toContain(legacyPrompt);
    expect(aiRequest.messages[1].content).not.toContain(legacyPrompt);
    expect(aiRequest.messages[1].content).toContain('Wayflex');
    expect(calls.find((q) => q.table === 'outreach_jobs' && q.operation === 'upsert')?.value?.payload).toMatchObject({
      configuration_version_id: anaConfigurationVersionId,
    });
  });
  it('does not race the existing transactional timeout scheduler', async () => {
    await import('../functions/ana-run/index');
    expect(await (await handler(anaRequest({ event: 'timeout.48h' }))).json()).toMatchObject({ ok: true, skipped: true, reason: 'timeout_owned_by_server_scheduler' });
    expect(calls.some((q) => q.table === 'agent_runs')).toBe(false);
    expectNoBusinessWrites();
  });
  it('reports a previous failed run as failure, not successful processing', async () => {
    override = (q) => q.table === 'agent_runs' && q.operation === 'select' ? ok({ id: 'prior-run', status: 'failed' }) : undefined;
    await import('../functions/ana-run/index');
    const response = await handler(anaRequest());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ ok: false, duplicate: true });
    expectNoBusinessWrites();
  });
  it('restricts sellers to their assigned lead', async () => {
    override = (q) => q.table === 'organization_members' ? ok({ role: 'seller' }) : q.table === 'leads' ? ok({ ...readyLead, owner_id: 'someone-else', assigned_to: 'someone-else' }) : undefined;
    await import('../functions/ana-run/index');
    expect(await (await handler(anaRequest())).json()).toMatchObject({ ok: false, erro: 'lead_access_denied' });
    expectNoBusinessWrites();
  });
});

const callback = { type: 'ReceivedCallback', messageId: 'synthetic-zapi-message', fromMe: false, isGroup: false, phone: '5511999990000', text: { message: 'Olá' } };
function webhookRequest(payload: Row = callback) {
  return new Request(`https://example.invalid/webhook-whatsapp?integration_id=${integrationId}`, { method: 'POST', headers: { 'x-leadai-webhook-secret': 'synthetic-internal-secret' }, body: JSON.stringify(payload) });
}
describe('Webhook handler contract — synthetic callbacks', () => {
  it('does not rerun or overwrite a duplicate callback', async () => {
    override = (q) => q.table === 'webhook_events' && q.operation === 'upsert' ? ok(null) : undefined;
    await import('../functions/webhook-whatsapp/index');
    const response = await handler(webhookRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ value: true, accepted: true, duplicate: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls.some((q) => q.table === 'lead_messages')).toBe(false);
  });
  it('stores inbound with a valid state and calls Ana with JWT plus internal auth', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, skipped: true, reason: 'sandbox_mode' }), { status: 200 }));
    await import('../functions/webhook-whatsapp/index');
    expect(await (await handler(webhookRequest())).json()).toMatchObject({ processed: true, skipped: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { Authorization: 'Bearer synthetic-service-jwt', 'x-internal-worker-secret': 'synthetic-internal-secret' } });
    expect(calls.find((q) => q.table === 'channel_inbound_events' && q.operation === 'upsert')?.value?.status).toBe('received');
    expect(calls.find((q) => q.table === 'lead_messages' && q.operation === 'insert')?.value?.provider_message_id).toBe(callback.messageId);
  });
  it('does not equate HTTP 200 with a successful Ana run', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status: 200 }));
    await import('../functions/webhook-whatsapp/index');
    expect(await (await handler(webhookRequest())).json()).toMatchObject({ processed: false });
    expect(calls.find((q) => q.table === 'channel_inbound_events' && q.operation === 'update')?.value?.status).toBe('failed');
  });
  it('does not pick one of two leads sharing a phone number', async () => {
    override = (q) => q.table === 'resolve_whatsapp_lead_for_account' ? ok([{ lead_id: null, reason: 'ambiguous_identity' }]) : undefined;
    await import('../functions/webhook-whatsapp/index');
    expect(await (await handler(webhookRequest())).json()).toMatchObject({ accepted: true, matched: false, resolution: 'ambiguous_identity' });
    expect(calls.find((q) => q.table === 'webhook_events' && q.operation === 'update')?.value).toMatchObject({ status: 'failed', error: 'lead_identity_ambiguous' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('records unmatched without the invalid unmatched status', async () => {
    override = (q) => q.table === 'resolve_whatsapp_lead_for_account' ? ok([{ lead_id: null, reason: 'not_found' }]) : undefined;
    await import('../functions/webhook-whatsapp/index');
    expect(await (await handler(webhookRequest())).json()).toMatchObject({ matched: false });
    expect(calls.find((q) => q.table === 'webhook_events' && q.operation === 'update')?.value).toMatchObject({ status: 'failed', error: 'lead_not_matched' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('creates a lead only for a matching active site-entry marker and hides the marker from the conversation', async () => {
    override = (q) => {
      if (q.table === 'resolve_whatsapp_lead_for_account') return ok([{ lead_id: null, reason: 'not_found' }]);
      if (q.table === 'whatsapp_site_entries') return ok({ id: 'site-entry-1', source_label: 'Formulário institucional' });
      return undefined;
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, skipped: true, reason: 'sandbox_mode' }), { status: 200 }));
    await import('../functions/webhook-whatsapp/index');
    const response = await handler(webhookRequest({
      ...callback,
      messageId: 'synthetic-website-entry',
      text: { message: 'Preciso de uma vedação industrial [WF:ABCDEF123456]' },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ matched: true, processed: true, resolution: 'site_entry_created' });
    expect(calls.find((q) => q.table === 'leads' && q.operation === 'insert')?.value).toMatchObject({
      company: 'Contato do site',
      origin: 'Formulário institucional',
      source_record_id: 'website-whatsapp:site-entry-1',
    });
    expect(calls.find((q) => q.table === 'lead_messages' && q.operation === 'insert')?.value?.text)
      .toBe('Preciso de uma vedação industrial');
  });
  it('ignores outgoing echoes without running Ana', async () => {
    await import('../functions/webhook-whatsapp/index');
    const response = await handler(webhookRequest({ ...callback, fromMe: true }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ value: true, accepted: true, ignored: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('does not claim an inbound callback that another handler is already processing', async () => {
    override = (q) => {
      if (q.table === 'channel_inbound_events' && q.operation === 'upsert') return ok(null);
      if (q.table === 'channel_inbound_events' && q.operation === 'select') return ok({ id: 'inbound-in-progress', status: 'received', error: null });
      return undefined;
    };
    await import('../functions/webhook-whatsapp/index');
    const response = await handler(webhookRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      value: true,
      accepted: true,
      duplicate: true,
      processed: false,
      processing: true,
      requires_reconciliation: true,
    });
    expect(calls.some((q) => q.table === 'channel_inbound_events' && q.operation === 'update')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('reclaims an inbound callback only when its prior attempt explicitly failed', async () => {
    override = (q) => {
      if (q.table === 'channel_inbound_events' && q.operation === 'upsert') return ok(null);
      if (q.table === 'channel_inbound_events' && q.operation === 'select') return ok({ id: 'inbound-failed', status: 'failed', error: 'synthetic_error' });
      return undefined;
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, skipped: true, reason: 'sandbox_mode' }), { status: 200 }));
    await import('../functions/webhook-whatsapp/index');
    const response = await handler(webhookRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ value: true, accepted: true, processed: true });
    const claim = calls.find((q) => q.table === 'channel_inbound_events' && q.operation === 'update' && q.value?.status === 'received');
    expect(claim?.filters).toMatchObject({ id: 'inbound-failed', status: 'failed' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('reconciles a receipt through the database without invoking Ana or an outbound provider', async () => {
    override = (q) => q.table === 'reconcile_whatsapp_receipt_for_account' && q.operation === 'rpc'
      ? ok([{ outreach_id: 'outreach-1', lead_id: leadId, current_status: 'read', changed: true }])
      : undefined;
    await import('../functions/webhook-whatsapp/index');
    const response = await handler(webhookRequest({
      type: 'MessageStatusCallback', status: 'READ', ids: ['synthetic-provider-message'], momment: 1_772_494_009_341,
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      value: true,
      accepted: true,
      matched: true,
      processed: true,
      status: 'read',
      expected_count: 1,
    });
    expect(calls.find((q) => q.table === 'reconcile_whatsapp_receipt_for_account' && q.operation === 'rpc')?.value).toMatchObject({
      p_organization_id: org,
      p_whatsapp_account_id: whatsappAccountId,
      p_provider_message_ids: ['synthetic-provider-message'],
      p_expected_message_count: 1,
      p_status: 'read',
    });
    expect(calls.some((q) => q.table === 'lead_outreach')).toBe(false);
    expect(calls.some((q) => q.table === 'channel_inbound_events')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('accepts an unmatched receipt for reconciliation without retrying or sending anything', async () => {
    override = (q) => q.table === 'reconcile_whatsapp_receipt_for_account' && q.operation === 'rpc' ? ok([]) : undefined;
    await import('../functions/webhook-whatsapp/index');
    const response = await handler(webhookRequest({ type: 'DeliveryCallback', messageId: 'synthetic-unmatched-receipt' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      value: true,
      accepted: true,
      matched: false,
      reason: 'outbound_message_not_matched',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls.some((q) => q.table === 'outreach_jobs')).toBe(false);
    expect(calls.some((q) => q.table === 'lead_messages')).toBe(false);
  });
  it('acknowledges an ambiguous receipt for manual reconciliation without invoking any sender', async () => {
    override = (q) => q.table === 'reconcile_whatsapp_receipt_for_account' && q.operation === 'rpc'
      ? { data: null, error: { message: 'receipt_identity_ambiguous' } }
      : undefined;
    await import('../functions/webhook-whatsapp/index');
    const response = await handler(webhookRequest({ type: 'DeliveryCallback', messageId: 'synthetic-ambiguous-receipt' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      value: true,
      accepted: true,
      processed: false,
      requires_reconciliation: true,
      error: 'receipt_identity_ambiguous',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls.some((q) => q.table === 'outreach_jobs')).toBe(false);
  });
  it('keeps a partial receipt pending while preserving the provider acknowledgement', async () => {
    override = (q) => q.table === 'reconcile_whatsapp_receipt_for_account' && q.operation === 'rpc'
      ? ok([{ outreach_id: 'outreach-1', lead_id: leadId, current_status: 'delivered', changed: true }])
      : undefined;
    await import('../functions/webhook-whatsapp/index');
    const response = await handler(webhookRequest({
      type: 'MessageStatusCallback', status: 'RECEIVED', ids: ['provider-1', 'provider-2'], momment: 1_772_494_009_341,
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      value: true,
      accepted: true,
      matched: true,
      processed: false,
      expected_count: 2,
      matched_count: 1,
    });
    expect(calls.find((q) => q.table === 'webhook_events' && q.operation === 'update')?.value).toMatchObject({
      status: 'failed',
      error: 'receipt_targets_pending',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Central manual WhatsApp gateway', () => {
  function manualWhatsAppRequest(body: Row = {}) {
    return new Request('https://example.invalid/enviar-whatsapp', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId,
        para: '5511999990000',
        texto: 'Oi',
        modo: 'humano',
        request_id: 'e1111111-1111-4111-8111-111111111111',
        ...body,
      }),
    });
  }

  it('keeps ordinary manual messages blocked in sandbox before queue writes', async () => {
    override = (q) => {
      if (q.table === 'company_settings') return ok({ ...readyCompany, sandbox_mode: true });
      if (q.table === 'outreach_jobs' && q.operation === 'select') return ok(null);
      return undefined;
    };
    await import('../functions/enviar-whatsapp/index');
    const response = await handler(manualWhatsAppRequest());
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, erro: 'operational_mode_protected' });
    expect(calls.some((q) => q.table === 'lead_messages' && q.operation === 'insert')).toBe(false);
    expect(calls.some((q) => q.table === 'outreach_jobs' && q.operation === 'insert')).toBe(false);
  });

  it('queues an explicitly confirmed controlled test using the outbound WhatsApp integration', async () => {
    override = (q) => {
      if (q.table === 'company_settings') return ok({ ...readyCompany, sandbox_mode: true });
      if (q.table === 'outreach_jobs' && q.operation === 'select') return ok(null);
      if (q.table === 'queue_human_whatsapp_message' && q.operation === 'rpc') {
        return ok([{ job_id: 'synthetic-human-job', message_id: 'synthetic-human-message', duplicate: false, job_status: 'queued' }]);
      }
      return undefined;
    };
    await import('../functions/enviar-whatsapp/index');
    const response = await handler(manualWhatsAppRequest({ teste_controlado: true }));
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ ok: true, teste_controlado: true });
    expect(calls.find((q) => q.table === 'integrations' && q.operation === 'select')?.filters).toMatchObject({ id: integrationId });
    expect(calls.find((q) => q.table === 'queue_human_whatsapp_message' && q.operation === 'rpc')?.value).toMatchObject({
      p_controlled_test: true,
      p_organization_id: org,
      p_lead_id: leadId,
    });
  });
});

describe('Lead workflow compatibility', () => {
  it('forwards a stable request id to the canonical Ana authority', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, run_id: 'synthetic-run' }), { status: 200 }));
    await import('../functions/lead-workflow/index');
    const requestId = 'f1111111-1111-4111-8111-111111111111';
    const response = await handler(new Request('https://example.invalid/lead-workflow', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start_ai', lead_id: leadId, request_id: requestId,
        whatsapp: '11999990000', approve_whatsapp_contact: true,
        approval_reason: 'Teste autorizado.',
      }),
    }));
    expect(await response.json()).toMatchObject({ ok: true, canonical_authority: 'ana-run' });
    const anaPayload = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(anaPayload).toMatchObject({ event: 'lead.created', lead_id: leadId, request_id: requestId });
  });

  it('clears an old human-transfer policy in the same server activation command', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, run_id: 'synthetic-run' }), { status: 200 }));
    await import('../functions/lead-workflow/index');
    const response = await handler(new Request('https://example.invalid/lead-workflow', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start_ai', lead_id: leadId, clear_handoff_policy: true,
        whatsapp: '11999990000', approve_whatsapp_contact: true,
        approval_reason: 'Teste autorizado.',
      }),
    }));
    expect(await response.json()).toMatchObject({ ok: true, canonical_authority: 'ana-run' });
    expect(calls.find((query) => query.table === 'lead_handoff_policies' && query.operation === 'delete')?.filters)
      .toMatchObject({ organization_id: org, lead_id: leadId });
  });
});

describe('Worker safety handler', () => {
  const job = { id: 'synthetic-job', lead_id: leadId, channel: 'whatsapp', attempt: 0, payload: { text: 'Mensagem sintética', message_id: 'synthetic-draft', agent_run_id: 'synthetic-run', context_last_contact: null, configuration_version_id: anaConfigurationVersionId, ana_knowledge_snapshot: undefined as AnaKnowledgeSnapshot | undefined } };
  beforeEach(async () => { job.payload.ana_knowledge_snapshot = (await readAnaKnowledgeFence(state.admin as never, org)).snapshot; });
  function workerRequest() {
    return new Request('https://example.invalid/automation-worker', { method: 'POST', headers: { Authorization: 'Bearer synthetic-user' }, body: JSON.stringify({ run: 'outreach' }) });
  }
  function setupQueue(extra?: (q: Query) => Result | undefined) {
    override = (q) => {
      const custom = extra?.(q);
      if (custom) return custom;
      if (q.table === 'outreach_jobs' && q.operation === 'select') return q.filters.status === 'queued' ? ok([job]) : { ...ok(null), count: 0 };
      if (q.table === 'read_integration_secret') return ok({ instancia_id: 'synthetic-instance', token: 'synthetic-token', client_token: 'synthetic-client' });
      if (q.table === 'agent_runs' && q.operation === 'select') return ok({ id: 'synthetic-run', status: 'completed', result: { status_canal: 'enfileirado' } });
      if (q.table === 'lead_messages' && q.operation === 'select') return ok({ id: 'synthetic-draft', text: 'Mensagem sintética', type: 'draft' });
      return undefined;
    };
  }
  it.each(['missing', 'changed'])('R8 holds an Ana job with %s knowledge authority for review without dispatch', async (mode) => {
    setupQueue((q) => mode === 'changed' && q.table === 'organization_module_data' && q.filters.module_key === 'commercial_catalog_policy'
      ? ok({ data: { catalogEnabled: false } }) : undefined);
    if (mode === 'missing') job.payload.ana_knowledge_snapshot = undefined;
    await import('../functions/automation-worker/index');
    expect(await (await handler(workerRequest())).json()).toMatchObject({ ok: true, sent_jobs: 0, failed_jobs: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls.filter(q => q.table === 'outreach_jobs' && q.operation === 'update').at(-1)?.value).toMatchObject({
      status: 'reconciliation_required', error: mode === 'missing' ? 'ana_knowledge_snapshot_missing' : 'ana_knowledge_context_changed',
    });
  });
  it('does not read/send the queue while sandbox is on', async () => {
    override = (q) => q.table === 'company_settings' ? ok({ ...readyCompany, sandbox_mode: true }) : undefined;
    await import('../functions/automation-worker/index');
    const response = await handler(new Request('https://example.invalid/automation-worker', { method: 'POST', headers: { Authorization: 'Bearer synthetic-user' }, body: JSON.stringify({ run: 'all' }) }));
    expect(await response.json()).toMatchObject({ ok: true, skipped: true, reason: 'sandbox_mode', sent_jobs: 0 });
    expect(calls.filter((q) => q.table === 'outreach_jobs' && q.operation === 'select')).toHaveLength(1);
    expectNoBusinessWrites();
  });
  it('accepts only the Vault-backed server scheduler and records its heartbeat in demo', async () => {
    override = (q) => {
      if (q.table === 'read_integration_secret') return ok({ scheduler_token: 'a'.repeat(64) });
      if (q.table === 'company_settings') return ok({ ...readyCompany, sandbox_mode: true });
      return undefined;
    };
    await import('../functions/automation-worker/index');
    const response = await handler(new Request('https://example.invalid/automation-worker', {
      method: 'POST',
      headers: { 'x-leadai-scheduler-token': 'a'.repeat(64), 'Content-Type': 'application/json' },
      body: JSON.stringify({ run: 'outreach', organization_id: org, source: 'server_scheduler' }),
    }));
    expect(await response.json()).toMatchObject({ ok: true, skipped: true, reason: 'sandbox_mode', sent_jobs: 0 });
    expect(calls.find((q) => q.table === 'integrations' && q.operation === 'update')?.value).toMatchObject({ connected: true, enabled: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('does not dispatch a job whose claim was won by another worker', async () => {
    setupQueue((q) => q.table === 'outreach_jobs' && q.operation === 'update' && q.value?.status === 'processing' ? ok(null) : undefined);
    await import('../functions/automation-worker/index');
    expect(await (await handler(workerRequest())).json()).toMatchObject({ ok: true, sent_jobs: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('records provider acceptance consistently without claiming delivery/read', async () => {
    setupQueue();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ messageId: 'synthetic-receipt' }), { status: 200 }));
    await import('../functions/automation-worker/index');
    expect(await (await handler(workerRequest())).json()).toMatchObject({ ok: true, sent_jobs: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls.find((q) => q.table === 'record_outreach_provider_acceptance' && q.operation === 'rpc')?.value).toMatchObject({
      p_provider: 'zapi',
      p_provider_message_id: 'synthetic-receipt',
      p_no_reply_deadline_at: expect.any(String),
    });
    const cadenceJobs = calls.filter((q) => q.table === 'outreach_jobs' && q.operation === 'upsert');
    expect(cadenceJobs).toHaveLength(1);
    expect(cadenceJobs[0].value?.payload).toMatchObject({ kind: 'ana_cadence', step: 'first' });
  });
  it('reconciles an early WhatsApp receipt after provider acceptance without resending', async () => {
    const earlyReceipt = {
      id: 'early-receipt-event',
      whatsapp_account_id: whatsappAccountId,
      payload: { type: 'MessageStatusCallback', status: 'READ', ids: ['synthetic-receipt'], momment: 1_772_494_009_341 },
    };
    setupQueue((q) => {
      if (q.table === 'webhook_events' && q.operation === 'select') return ok([earlyReceipt]);
      if (q.table === 'reconcile_whatsapp_receipt_for_account' && q.operation === 'rpc') {
        return ok([{ outreach_id: 'synthetic-job', lead_id: leadId, current_status: 'read', changed: true }]);
      }
      return undefined;
    });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ messageId: 'synthetic-receipt' }), { status: 200 }));
    await import('../functions/automation-worker/index');
    expect(await (await handler(workerRequest())).json()).toMatchObject({ ok: true, sent_jobs: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls.find((q) => q.table === 'reconcile_whatsapp_receipt_for_account' && q.operation === 'rpc')?.value).toMatchObject({
      p_organization_id: org, p_whatsapp_account_id: whatsappAccountId,
      p_provider_message_ids: ['synthetic-receipt'], p_status: 'read',
    });
    expect(calls.find((q) => q.table === 'webhook_events' && q.operation === 'update')?.value).toMatchObject({
      status: 'processed', lead_id: leadId, outreach_id: 'synthetic-job',
    });
    expect(calls.find((q) => q.table === 'audit_logs' && q.operation === 'insert' && q.value?.action === 'whatsapp.early_receipt_reconciled')).toBeTruthy();
  });
  it('does not guess an account for a legacy early receipt without ownership', async () => {
    setupQueue((q) => q.table === 'webhook_events' && q.operation === 'select'
      ? ok([{ id: 'legacy-early-receipt', payload: { type: 'MessageStatusCallback', status: 'READ', ids: ['synthetic-receipt'] } }])
      : undefined);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ messageId: 'synthetic-receipt' }), { status: 200 }));
    await import('../functions/automation-worker/index');
    expect(await (await handler(workerRequest())).json()).toMatchObject({ ok: true, sent_jobs: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls.some((q) => q.operation === 'rpc' && q.table.startsWith('reconcile_whatsapp_receipt'))).toBe(false);
    expect(calls.some((q) => q.table === 'webhook_events' && q.operation === 'update')).toBe(false);
  });
  it('does not schedule a cadence job if a human handoff opens after provider acceptance', async () => {
    let providerAcceptanceRecorded = false;
    setupQueue((q) => {
      if (q.table === 'record_outreach_provider_acceptance' && q.operation === 'rpc') {
        providerAcceptanceRecorded = true;
        return undefined;
      }
      if (q.table === 'lead_handoffs' && q.operation === 'select') {
        return providerAcceptanceRecorded ? ok({ id: 'synthetic-open-handoff' }) : ok(null);
      }
      return undefined;
    });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ messageId: 'synthetic-receipt' }), { status: 200 }));
    await import('../functions/automation-worker/index');
    expect(await (await handler(workerRequest())).json()).toMatchObject({ ok: true, sent_jobs: 1 });
    expect(calls.some((q) => q.table === 'outreach_jobs' && q.operation === 'upsert')).toBe(false);
    expect(calls.find((q) => q.table === 'audit_logs' && q.operation === 'insert')?.value).toMatchObject({
      action: 'ana.cadence_schedule_failed', event_data: { reason: 'lead_handoff_open' },
    });
  });
  it('dispatches a queued human message without requiring an Ana run', async () => {
    const manualJob = {
      ...job,
      payload: { text: 'Mensagem humana sintética', message_id: 'synthetic-human-message', manual: true, context_last_contact: null },
    };
    override = (q) => {
      if (q.table === 'outreach_jobs' && q.operation === 'select') return q.filters.status === 'queued' ? ok([manualJob]) : { ...ok(null), count: 0 };
      if (q.table === 'read_integration_secret') return ok({ instancia_id: 'synthetic-instance', token: 'synthetic-token', client_token: 'synthetic-client' });
      if (q.table === 'lead_messages' && q.operation === 'select') return ok({ id: 'synthetic-human-message', text: 'Mensagem humana sintética', sender: 'human', type: 'queued' });
      return undefined;
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ messageId: 'synthetic-human-receipt' }), { status: 200 }));
    await import('../functions/automation-worker/index');
    expect(await (await handler(workerRequest())).json()).toMatchObject({ ok: true, sent_jobs: 1 });
    expect(calls.some((q) => q.table === 'agent_runs' && q.operation === 'select')).toBe(false);
    expect(calls.find((q) => q.table === 'record_outreach_provider_acceptance' && q.operation === 'rpc')?.value).toMatchObject({
      p_message_id: 'synthetic-human-message',
      p_provider_message_id: 'synthetic-human-receipt',
      p_no_reply_deadline_at: null,
    });
  });
  it('dispatches only the selected human job when the Central requests an immediate send', async () => {
    const selectedJob = {
      ...job,
      id: leadId,
      payload: { text: 'Mensagem humana imediata', message_id: 'synthetic-immediate-message', manual: true, context_last_contact: null },
    };
    override = (q) => {
      if (q.table === 'outreach_jobs' && q.operation === 'select') return q.filters.status === 'queued' && q.filters.id === leadId ? ok([selectedJob]) : { ...ok(null), count: 0 };
      if (q.table === 'read_integration_secret') return ok({ instancia_id: 'synthetic-instance', token: 'synthetic-token', client_token: 'synthetic-client' });
      if (q.table === 'lead_messages' && q.operation === 'select') return ok({ id: 'synthetic-immediate-message', text: 'Mensagem humana imediata', sender: 'human', type: 'queued' });
      return undefined;
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ messageId: 'synthetic-immediate-receipt' }), { status: 200 }));
    await import('../functions/automation-worker/index');
    const response = await handler(new Request('https://example.invalid/automation-worker', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ run: 'outreach', job_id: leadId }),
    }));
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, sent_jobs: 1, job_results: [{ id: leadId, status: 'sent' }] });
    expect(calls.filter((q) => q.table === 'outreach_jobs' && q.operation === 'select').at(-1)?.filters).toMatchObject({ id: leadId, status: 'queued' });
  });
  it('dispatches only an unexpired controlled human test while sandbox is on', async () => {
    const controlledJob = {
      ...job,
      payload: {
        text: 'Oi de teste', message_id: 'synthetic-controlled-message', manual: true,
        controlled_test: true, controlled_test_expires_at: new Date(Date.now() + 60_000).toISOString(), context_last_contact: null,
      },
    };
    override = (q) => {
      if (q.table === 'company_settings') return ok({ ...readyCompany, sandbox_mode: true });
      if (q.table === 'outreach_jobs' && q.operation === 'select') return q.filters.status === 'queued' ? ok([controlledJob]) : { ...ok(null), count: 0 };
      if (q.table === 'read_integration_secret') return ok({ instancia_id: 'synthetic-instance', token: 'synthetic-token', client_token: 'synthetic-client' });
      if (q.table === 'lead_messages' && q.operation === 'select') return ok({ id: 'synthetic-controlled-message', text: 'Oi de teste', sender: 'human', type: 'queued' });
      return undefined;
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ messageId: 'synthetic-controlled-receipt' }), { status: 200 }));
    await import('../functions/automation-worker/index');
    expect(await (await handler(workerRequest())).json()).toMatchObject({ ok: true, sent_jobs: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls.find((q) => q.table === 'lead_outreach' && q.operation === 'upsert')?.value?.metadata).toMatchObject({ controlled_test: true });
  });
  it('holds an ambiguous network failure for reconciliation instead of retrying', async () => {
    setupQueue();
    fetchMock.mockRejectedValue(new TypeError('Synthetic timeout after sending bytes'));
    await import('../functions/automation-worker/index');
    expect(await (await handler(workerRequest())).json()).toMatchObject({ failed_jobs: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls.filter((q) => q.table === 'outreach_jobs' && q.operation === 'update').at(-1)?.value).toMatchObject({ status: 'reconciliation_required', error: 'delivery_unknown_reconciliation_required' });
  });
  it('preserves the receipt when persistence fails after provider acceptance', async () => {
    setupQueue((q) => q.table === 'record_outreach_provider_acceptance' && q.operation === 'rpc' ? { data: null, error: { message: 'synthetic database outage' } } : undefined);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ messageId: 'synthetic-receipt' }), { status: 200 }));
    await import('../functions/automation-worker/index');
    expect(await (await handler(workerRequest())).json()).toMatchObject({ failed_jobs: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls.filter((q) => q.table === 'outreach_jobs' && q.operation === 'update').at(-1)?.value).toMatchObject({ status: 'reconciliation_required', payload: { provider_message_id: 'synthetic-receipt' } });
  });
  it('defers automatic output at the published daily limit before the provider call', async () => {
    setupQueue((q) => q.table === 'reserve_ana_outbound_policy'
      ? ok([{ allowed: false, reason: 'ana_daily_message_limit_reached', used_count: 5 }])
      : undefined);
    await import('../functions/automation-worker/index');
    const response = await handler(workerRequest());
    expect(await response.json()).toMatchObject({ ok: true, sent_jobs: 0, job_results: [{ id: job.id, status: 'deferred', error: 'ana_daily_message_limit_reached' }] });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls.find((q) => q.table === 'outreach_jobs' && q.operation === 'update' && q.value?.status === 'queued')?.value).toMatchObject({
      error: 'ana_daily_message_limit_reached', locked_at: null, locked_by: null,
    });
    expect(calls.find((q) => q.table === 'reserve_ana_outbound_policy' && q.operation === 'rpc')?.value).toMatchObject({
      p_lead_id: leadId,
    });
  });
  it('fails closed before the provider when business-hours data is unavailable', async () => {
    setupQueue((q) => q.table === 'organization_module_data'
      ? ok({ data: { killSwitchGlobal: false, diasSemana: [], feriados: [] } })
      : undefined);
    await import('../functions/automation-worker/index');
    expect(await (await handler(workerRequest())).json()).toMatchObject({ ok: true, failed_jobs: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls.filter((q) => q.table === 'outreach_jobs' && q.operation === 'update').at(-1)?.value).toMatchObject({
      status: 'failed', error: 'business_hours_configuration_missing',
    });
  });
  it('blocks automatic dispatch when the final safety read finds an open human handoff', async () => {
    setupQueue((q) => q.table === 'lead_handoffs' && q.operation === 'select'
      ? ok({ id: 'synthetic-open-handoff' })
      : undefined);
    await import('../functions/automation-worker/index');
    expect(await (await handler(workerRequest())).json()).toMatchObject({ ok: true, failed_jobs: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls.find((q) => q.table === 'lead_outreach' && q.operation === 'update')?.value).toMatchObject({
      status: 'failed', error: 'lead_handoff_open',
    });
  });
  it('blocks an initial automatic output if its published Ana version changed before dispatch', async () => {
    setupQueue((q) => q.table === 'ai_agents' && q.operation === 'select'
      ? ok({ active_version_id: 'e1111111-1111-4111-8111-111111111111' })
      : undefined);
    await import('../functions/automation-worker/index');
    expect(await (await handler(workerRequest())).json()).toMatchObject({ ok: true, failed_jobs: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls.filter((q) => q.table === 'outreach_jobs' && q.operation === 'update').at(-1)?.value).toMatchObject({
      status: 'failed', error: 'ana_configuration_changed_before_dispatch',
    });
  });
  it('blocks a queued cadence output if its published Ana version changed before dispatch', async () => {
    const queuedCadence = {
      ...job,
      payload: {
        ...job.payload,
        no_reply_deadline_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        cadence: {
          step: 'first', target_channel: 'whatsapp', expected_last_contact: new Date().toISOString(),
          no_reply_deadline_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          configuration_version_id: anaConfigurationVersionId,
        },
      },
    };
    setupQueue((q) => {
      if (q.table === 'outreach_jobs' && q.operation === 'select' && q.filters.status === 'queued') return ok([queuedCadence]);
      if (q.table === 'ai_agents' && q.operation === 'select') return ok({ active_version_id: 'e1111111-1111-4111-8111-111111111111' });
      return undefined;
    });
    await import('../functions/automation-worker/index');
    expect(await (await handler(workerRequest())).json()).toMatchObject({ ok: true, failed_jobs: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls.filter((q) => q.table === 'outreach_jobs' && q.operation === 'update').at(-1)?.value).toMatchObject({
      status: 'failed', error: 'ana_configuration_changed_before_cadence',
    });
  });
  it('chains the second follow-up only after the accepted first follow-up', async () => {
    const initialSentAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const firstSentAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const deadlineAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const firstFollowUpJob = {
      ...job,
      payload: {
        ...job.payload,
        context_last_contact: firstSentAt,
        no_reply_deadline_at: deadlineAt,
        cadence: {
          step: 'first', target_channel: 'whatsapp', source_job_id: 'synthetic-initial-job',
          source_message_id: 'synthetic-initial-message', initial_sent_at: initialSentAt,
          expected_last_contact: firstSentAt, no_reply_deadline_at: deadlineAt,
          configuration_version_id: anaConfigurationVersionId,
        },
      },
    };
    setupQueue((q) => {
      if (q.table === 'outreach_jobs' && q.operation === 'select' && q.filters.status === 'queued') return ok([firstFollowUpJob]);
      if (q.table === 'leads' && q.operation === 'select') return ok({
        ...readyLead,
        last_contact: acceptedLeadState.last_contact ?? firstSentAt,
        no_reply_deadline_at: acceptedLeadState.no_reply_deadline_at ?? deadlineAt,
      });
      return undefined;
    });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ messageId: 'synthetic-first-follow-up-receipt' }), { status: 200 }));
    await import('../functions/automation-worker/index');
    expect(await (await handler(workerRequest())).json()).toMatchObject({ ok: true, sent_jobs: 1 });
    const cadenceJobs = calls.filter((q) => q.table === 'outreach_jobs' && q.operation === 'upsert');
    expect(cadenceJobs).toHaveLength(1);
    expect(cadenceJobs[0].value?.payload).toMatchObject({
      kind: 'ana_cadence', step: 'second', source_job_id: 'synthetic-initial-job', initial_sent_at: initialSentAt,
    });
    expect(Date.parse(String(cadenceJobs[0].value?.run_at))).toBeGreaterThanOrEqual(Date.parse(firstSentAt));
  });
  it('does not schedule a third step after the accepted second follow-up', async () => {
    const secondSentAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const deadlineAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const secondFollowUpJob = {
      ...job,
      payload: {
        ...job.payload,
        context_last_contact: secondSentAt,
        no_reply_deadline_at: deadlineAt,
        cadence: {
          step: 'second', target_channel: 'whatsapp', source_job_id: 'synthetic-initial-job',
          source_message_id: 'synthetic-first-message', initial_sent_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          expected_last_contact: secondSentAt, no_reply_deadline_at: deadlineAt,
          configuration_version_id: anaConfigurationVersionId,
        },
      },
    };
    setupQueue((q) => {
      if (q.table === 'outreach_jobs' && q.operation === 'select' && q.filters.status === 'queued') return ok([secondFollowUpJob]);
      if (q.table === 'leads' && q.operation === 'select') return ok({ ...readyLead, last_contact: secondSentAt, no_reply_deadline_at: deadlineAt });
      return undefined;
    });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ messageId: 'synthetic-second-follow-up-receipt' }), { status: 200 }));
    await import('../functions/automation-worker/index');
    expect(await (await handler(workerRequest())).json()).toMatchObject({ ok: true, sent_jobs: 1 });
    expect(calls.some((q) => q.table === 'outreach_jobs' && q.operation === 'upsert')).toBe(false);
  });
});

describe('Z-API credential configuration contract', () => {
  it('preserves the webhook credential while saving Z-API settings without mutating the provider webhook', async () => {
    override = (q) => {
      if (q.table === 'integrations' && q.operation === 'select') return ok({ id: integrationId, configuration: {} });
      if (q.table === 'read_integration_secret' && q.operation === 'rpc') {
        return ok({ webhook_token: 'synthetic-existing-webhook-token' });
      }
      return undefined;
    };
    await import('../functions/configurar-integracao/index');
    const request = new Request('https://example.invalid/configurar-integracao', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canal: 'whatsapp',
        credenciais: {
          instancia_id: 'synthetic-instance',
          token: 'synthetic-instance-token',
          client_token: 'synthetic-client-token',
          url_base: 'https://api.z-api.io',
        },
      }),
    });
    const response = await handler(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(calls.find((q) => q.table === 'store_integration_secret' && q.operation === 'rpc')?.value).toMatchObject({
      p_integration: integrationId,
      p_secret: expect.objectContaining({
        instancia_id: 'synthetic-instance',
        webhook_token: 'synthetic-existing-webhook-token',
      }),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('marks the inbound registration pending when the Z-API callback route changes', async () => {
    const webhookIntegrationId = 'f1111111-1111-4111-8111-111111111111';
    override = (q) => {
      if (q.table === 'integrations' && q.operation === 'select') {
        if (q.filters.key === 'whatsapp') return ok({ id: integrationId, configuration: {} });
        if (q.filters.key === 'zapi_webhook') return ok({
          id: webhookIntegrationId,
          configuration: {
            registered_at: '2026-09-17T12:00:00.000Z',
            registration_complete: true,
            registration_endpoints: ['update-webhook-received'],
          },
        });
      }
      if (q.table === 'read_integration_secret' && q.operation === 'rpc') {
        return ok({
          instancia_id: 'old-instance',
          token: 'old-instance-token',
          client_token: 'synthetic-client-token',
          url_base: 'https://api.z-api.io',
          webhook_token: 'synthetic-existing-webhook-token',
        });
      }
      return undefined;
    };
    await import('../functions/configurar-integracao/index');
    const response = await handler(new Request('https://example.invalid/configurar-integracao', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canal: 'whatsapp',
        credenciais: {
          instancia_id: 'new-instance',
          token: 'new-instance-token',
          client_token: 'synthetic-client-token',
          url_base: 'https://api.z-api.io',
        },
      }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, mensagem: expect.stringContaining('Recadastre agora a entrada') });
    expect(calls.find((q) => q.table === 'integrations' && q.operation === 'update' && q.filters.id === webhookIntegrationId)?.value)
      .toMatchObject({
        connected: false,
        last_error: 'whatsapp_credentials_changed',
        configuration: expect.objectContaining({
          registration_complete: false,
          registration_invalidation_reason: 'whatsapp_credentials_changed',
        }),
      });
    expect(calls.find((q) => q.table === 'audit_logs' && q.operation === 'insert')?.value)
      .toMatchObject({ event_data: expect.objectContaining({ webhook_registration_invalidated: true }) });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('WhatsApp channel dashboard contract', () => {
  it('keeps provider acceptance separate from delivery and a missing number incomplete', async () => {
    override = (q) => {
      if (q.table === 'whatsapp_accounts' && q.operation === 'select') return ok([{
        id: whatsappAccountId,
        integration_id: integrationId,
        owner_user_id: null,
        label: 'WhatsApp corporativo',
        provider: 'zapi',
        account_type: 'corporate',
        is_default: true,
        enabled: true,
        connection_status: 'connected',
        connected_phone_suffix: null,
        connected_at: '2026-09-28T10:00:00.000Z',
        status_checked_at: '2026-09-28T10:00:00.000Z',
        webhook_registered_at: '2026-09-28T10:00:00.000Z',
        expires_at: null,
        last_error_code: null,
        onboarding_status: 'not_started',
        sync_status: 'not_started',
        messaging_mode: 'suggestion',
        daily_message_goal: 0,
        verified_name: null,
        quality_rating: null,
        display_phone_number: null,
        phone_number_id: null,
        created_at: '2026-09-28T10:00:00.000Z',
        updated_at: '2026-09-28T10:00:00.000Z',
      }]);
      if (q.table === 'integrations' && q.operation === 'select') return ok([{
        id: integrationId,
        connected: true,
        enabled: true,
        paused: false,
        configuration: { configured: true },
        last_tested_at: '2026-09-28T10:00:00.000Z',
        last_success_at: '2026-09-28T10:00:00.000Z',
      }]);
      if (q.table === 'messaging_provider_controls' && q.operation === 'select') return ok([{
        provider: 'zapi', inbound_enabled: true, send_enabled: true, automation_enabled: true, kill_switch: false,
      }]);
      if (q.table === 'audit_logs' && q.operation === 'select') return ok([{
        id: 'audit-accepted', action: 'outreach.whatsapp_direct_test_provider_accepted',
        detail: 'Mensagem de teste aceita pela Z-API; entrega e leitura não foram confirmadas.',
        actor_name: 'Synthetic user', occurred_at: '2026-09-28T10:01:00.000Z', created_at: '2026-09-28T10:01:00.000Z',
        entity_table: 'integrations', entity_id: integrationId, event_data: {},
      }]);
      if (q.table === 'channel_inbound_events' && q.operation === 'select') return ok([]);
      return undefined;
    };
    await import('../functions/whatsapp-accounts/index');
    const response = await handler(new Request('https://example.invalid/whatsapp-accounts', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'list' }),
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    const overview = body.channelOverviews[whatsappAccountId];
    expect(overview).toMatchObject({ state: 'configuration_incomplete', routing: { active: true, destination: 'Central de Atendimento' } });
    expect(overview.checks.find((check: Row) => check.key === 'number')).toMatchObject({ state: 'attention' });
    expect(overview.checks.find((check: Row) => check.key === 'send_receive')).toMatchObject({ state: 'pending' });
    expect(JSON.stringify(overview)).toContain('entrega, leitura e evento de entrada não são presumidos');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Ana provider configuration contract', () => {
  const existingSecretRef = 'e1111111-1111-4111-8111-111111111111';

  it('preserves blank key fields in Vault while saving only public provider and model state', async () => {
    override = (q) => {
      if (q.table === 'integrations' && q.operation === 'select') {
        return ok({ ...readyIntegration, configuration: { secret_ref: existingSecretRef } });
      }
      if (q.table === 'read_integration_secret') {
        return ok({
          openai_key: 'synthetic-existing-openai-key',
          claude_key: 'synthetic-existing-claude-key',
          provedor_principal: 'openai',
          openai_model: 'gpt-4.1-mini',
          claude_model: 'claude-sonnet-5',
        });
      }
      return undefined;
    };
    await import('../functions/configurar-integracao/index');
    const response = await handler(new Request('https://example.invalid/configurar-integracao', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canal: 'ai',
        credenciais: {
          provedor_principal: 'Claude',
          openai_key: '',
          claude_key: '',
          openai_model: '',
          claude_model: 'claude-haiku-4-5',
        },
      }),
    }));

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toMatchObject({ ok: true });
    expect(JSON.stringify(responseBody)).not.toContain('synthetic-existing-openai-key');
    expect(JSON.stringify(responseBody)).not.toContain('synthetic-existing-claude-key');
    expect(calls.find((q) => q.table === 'store_integration_secret' && q.operation === 'rpc')?.value).toMatchObject({
      p_integration: integrationId,
      p_secret: {
        openai_key: 'synthetic-existing-openai-key',
        claude_key: 'synthetic-existing-claude-key',
        provedor_principal: 'claude',
        openai_model: 'gpt-4.1-mini',
        claude_model: 'claude-haiku-4-5',
      },
    });
    const publicUpdate = calls.find((q) => q.table === 'integrations' && q.operation === 'update')?.value;
    expect(publicUpdate).toMatchObject({
      provider: 'Claude',
      configuration: {
        secret_ref: existingSecretRef,
        provedor_principal: 'claude',
        modelo_principal: 'claude-haiku-4-5',
        openai_model: 'gpt-4.1-mini',
        claude_model: 'claude-haiku-4-5',
        openai_configurado: true,
        claude_configurado: true,
        modelo_principal_validado: false,
      },
    });
    const publicConfiguration = publicUpdate?.configuration as Row;
    expect(publicConfiguration).not.toHaveProperty('openai_key');
    expect(publicConfiguration).not.toHaveProperty('claude_key');
    expect(JSON.stringify(publicUpdate)).not.toContain('synthetic-existing-openai-key');
    expect(JSON.stringify(publicUpdate)).not.toContain('synthetic-existing-claude-key');
    const audit = calls.find((q) => q.table === 'audit_logs' && q.operation === 'insert')?.value;
    expect(JSON.stringify(audit)).not.toContain('synthetic-existing-openai-key');
    expect(JSON.stringify(audit)).not.toContain('synthetic-existing-claude-key');
  });

  it('rejects a model that is not offered by the configuration UI before saving it', async () => {
    await import('../functions/configurar-integracao/index');
    const response = await handler(new Request('https://example.invalid/configurar-integracao', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canal: 'ai',
        credenciais: {
          provedor_principal: 'OpenAI',
          openai_key: 'synthetic-new-openai-key',
          openai_model: 'gpt-not-offered-by-ui',
        },
      }),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, erro: 'ai_model_not_allowed' });
    expect(calls.some((q) => q.table === 'store_integration_secret' && q.operation === 'rpc')).toBe(false);
    expect(calls.some((q) => q.table === 'integrations' && q.operation === 'update')).toBe(false);
  });
});

describe('Z-API status validation contract', () => {
  it('uses the documented status headers and does not send a message', async () => {
    override = (q) => {
      if (q.table === 'read_integration_secret') return ok({
        instancia_id: 'synthetic-instance', token: 'synthetic-instance-token', client_token: 'synthetic-client-token', url_base: 'https://api.z-api.io',
      });
      return undefined;
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ connected: true, smartphoneConnected: true }), { status: 200 }));
    await import('../functions/testar-integracao/index');
    const request = new Request('https://example.invalid/testar-integracao', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ canal: 'whatsapp' }),
    });
    const response = await handler(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, pronto: true, ambienteRealAtivo: false });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.z-api.io/instances/synthetic-instance/token/synthetic-instance-token/status',
      expect.objectContaining({ headers: { 'Content-Type': 'application/json', 'Client-Token': 'synthetic-client-token' } }),
    );
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Accept');
    expect(calls.some((q) => q.table === 'company_settings' && q.operation === 'update')).toBe(false);
  });

  it('keeps a valid remote session separate from an administratively disabled provider', async () => {
    override = (q) => {
      if (q.table === 'read_integration_secret') return ok({
        instancia_id: 'synthetic-instance', token: 'synthetic-instance-token', client_token: 'synthetic-client-token', url_base: 'https://api.z-api.io',
      });
      if (q.table === 'messaging_provider_controls' && q.operation === 'select') {
        return ok({ inbound_enabled: false, send_enabled: false, automation_enabled: false, kill_switch: true });
      }
      return undefined;
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ connected: true, smartphoneConnected: true }), { status: 200 }));
    await import('../functions/testar-integracao/index');
    const response = await handler(new Request('https://example.invalid/testar-integracao', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ canal: 'whatsapp' }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      pronto: true,
      canalPronto: false,
      bloqueioOperacional: 'whatsapp_provider_disabled',
    });
    expect(calls.find((q) => q.table === 'integrations' && q.operation === 'update')?.value)
      .toMatchObject({ connected: true, enabled: false, paused: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('Z-API direct test message contract', () => {
  const directTestRequestId = 'd1111111-1111-4111-8111-111111111111';
  const providerStatusReady = () => new Response(JSON.stringify({ connected: true, smartphoneConnected: true }), { status: 200 });

  function directTestRequest(body: Row = {}) {
    return new Request('https://example.invalid/enviar-teste-whatsapp', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '(11) 99999-0000',
        message: 'Teste controlado',
        confirmation: 'SEND_REAL_WHATSAPP_TEST',
        request_id: directTestRequestId,
        ...body,
      }),
    });
  }

  it('validates the provider and sends one confirmed message without creating a lead or queue job', async () => {
    override = (q) => {
      if (q.table === 'read_integration_secret') return ok({
        instancia_id: 'synthetic-instance', token: 'synthetic-instance-token', client_token: 'synthetic-client-token', url_base: 'https://api.z-api.io',
      });
      if (q.table === 'reserve_whatsapp_direct_test') return ok([{ status: 'reserved' }]);
      if (q.table === 'record_whatsapp_direct_test_provider_acceptance') return ok([{ status: 'provider_accepted' }]);
      return undefined;
    };
    fetchMock
      .mockResolvedValueOnce(providerStatusReady())
      .mockResolvedValueOnce(new Response(JSON.stringify({ messageId: 'synthetic-direct-receipt' }), { status: 200 }));
    await import('../functions/enviar-teste-whatsapp/index');
    const response = await handler(directTestRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true, providerAccepted: true, phoneSuffix: '0000', deliveryConfirmed: false, readConfirmed: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.z-api.io/instances/synthetic-instance/token/synthetic-instance-token/send-text');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ phone: '5511999990000', message: 'Teste controlado' });
    const reservation = calls.find((q) => q.table === 'reserve_whatsapp_direct_test' && q.operation === 'rpc')?.value;
    expect(reservation).toMatchObject({
      p_request_id: directTestRequestId,
      p_phone_suffix: '0000',
      p_message_length: 'Teste controlado'.length,
      p_test_fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(JSON.stringify(reservation)).not.toContain('5511999990000');
    expect(JSON.stringify(reservation)).not.toContain('Teste controlado');
    const acceptance = calls.find((q) => q.table === 'record_whatsapp_direct_test_provider_acceptance' && q.operation === 'rpc')?.value;
    expect(acceptance).toMatchObject({
      p_request_id: directTestRequestId,
      p_integration_id: integrationId,
    });
    expect(acceptance).not.toHaveProperty('p_provider_message_id');
    expect(calls.some((q) => q.table === 'audit_logs' && q.operation === 'insert')).toBe(false);
    expect(calls.some((q) => q.table === 'leads' && q.operation === 'insert')).toBe(false);
    expect(calls.some((q) => q.table === 'outreach_jobs' && q.operation === 'insert')).toBe(false);
  });

  it('does not resend a request already accepted by the provider', async () => {
    override = (q) => {
      if (q.table === 'read_integration_secret') return ok({
        instancia_id: 'synthetic-instance', token: 'synthetic-instance-token', client_token: 'synthetic-client-token', url_base: 'https://api.z-api.io',
      });
      if (q.table === 'reserve_whatsapp_direct_test') return ok([{ status: 'provider_accepted' }]);
      return undefined;
    };
    fetchMock.mockResolvedValueOnce(providerStatusReady());
    await import('../functions/enviar-teste-whatsapp/index');
    const response = await handler(directTestRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true, providerAccepted: true, duplicate: true, resendBlocked: true, deliveryConfirmed: false, readConfirmed: false,
    });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/send-text'))).toBe(false);
  });

  it('blocks a matching unresolved attempt under a different request id without sending again', async () => {
    override = (q) => {
      if (q.table === 'read_integration_secret') return ok({
        instancia_id: 'synthetic-instance', token: 'synthetic-instance-token', client_token: 'synthetic-client-token', url_base: 'https://api.z-api.io',
      });
      if (q.table === 'reserve_whatsapp_direct_test') return ok([{ status: 'reconciliation_required' }]);
      return undefined;
    };
    fetchMock.mockResolvedValueOnce(providerStatusReady());
    await import('../functions/enviar-teste-whatsapp/index');
    const response = await handler(directTestRequest({ request_id: 'd2222222-2222-4222-8222-222222222222' }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false, reconciliationRequired: true, resendBlocked: true,
    });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/send-text'))).toBe(false);
  });

  it('requires reconciliation instead of another send when acceptance persistence fails', async () => {
    override = (q) => {
      if (q.table === 'read_integration_secret') return ok({
        instancia_id: 'synthetic-instance', token: 'synthetic-instance-token', client_token: 'synthetic-client-token', url_base: 'https://api.z-api.io',
      });
      if (q.table === 'reserve_whatsapp_direct_test') return ok([{ status: 'reserved' }]);
      if (q.table === 'record_whatsapp_direct_test_provider_acceptance') {
        return { data: null, error: { message: 'synthetic audit persistence failure' } };
      }
      return undefined;
    };
    fetchMock
      .mockResolvedValueOnce(providerStatusReady())
      .mockResolvedValueOnce(new Response(JSON.stringify({ messageId: 'synthetic-direct-receipt' }), { status: 200 }));
    await import('../functions/enviar-teste-whatsapp/index');
    const response = await handler(directTestRequest());
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      ok: true, providerAccepted: true, reconciliationRequired: true, resendBlocked: true,
      deliveryConfirmed: false, readConfirmed: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('requires an explicit real-send confirmation before contacting the provider', async () => {
    await import('../functions/enviar-teste-whatsapp/index');
    const response = await handler(directTestRequest({ confirmation: undefined }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, erro: 'test_message_confirmation_required' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not contact Z-API when the administrator disabled its provider control', async () => {
    override = (q) => {
      if (q.table === 'messaging_provider_controls' && q.operation === 'select') {
        return ok({ send_enabled: false, kill_switch: true });
      }
      return undefined;
    };
    await import('../functions/enviar-teste-whatsapp/index');
    const response = await handler(directTestRequest());
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, erro: 'whatsapp_provider_disabled' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [{ request_id: undefined }],
    [{ request_id: 'not-a-uuid' }],
  ])('requires a valid explicit request id before contacting the provider', async (body) => {
    await import('../functions/enviar-teste-whatsapp/index');
    const response = await handler(directTestRequest(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, erro: 'test_request_id_invalid' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Test lead cleanup contract', () => {
  const cleanupRequest = (body: Row) => new Request('https://example.invalid/cleanup-test-leads', {
    method: 'POST',
    headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const testLead = {
    id: leadId,
    company: 'Lavanderia de teste',
    contact: 'Fabricio Gaspar',
    phone: '5511999990000',
    whatsapp: '5511999990000',
    origin: 'teste controlado',
    source_record_id: null,
    source_metadata: { test: true },
  };

  it('only previews candidates marked by the approved test criteria', async () => {
    override = (q) => {
      if (q.table === 'leads' && q.operation === 'select') return ok([testLead]);
      if (['lead_messages', 'outreach_jobs', 'agent_runs'].includes(q.table) && q.operation === 'select') return ok([{ lead_id: leadId }]);
      return undefined;
    };
    await import('../functions/cleanup-test-leads/index');
    const response = await handler(cleanupRequest({ action: 'preview' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, candidates: [{ id: leadId, messageCount: 1, jobCount: 1, runCount: 1 }] });
    expect(calls.some((q) => q.table === 'purge_selected_test_leads')).toBe(false);
  });

  it('requires confirmed selected IDs before invoking the transactional purge', async () => {
    override = (q) => {
      if (q.table === 'leads' && q.operation === 'select') return ok([testLead]);
      if (['lead_messages', 'outreach_jobs', 'agent_runs'].includes(q.table) && q.operation === 'select') return ok([]);
      if (q.table === 'purge_selected_test_leads') return ok([{ lead_id: leadId }]);
      return undefined;
    };
    await import('../functions/cleanup-test-leads/index');
    const response = await handler(cleanupRequest({ action: 'delete', leadIds: [leadId], confirmation: 'LIMPAR TESTES' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, deletedCount: 1, deletedIds: [leadId] });
    expect(calls.find((q) => q.table === 'purge_selected_test_leads' && q.operation === 'rpc')?.value).toMatchObject({ p_lead_ids: [leadId], p_organization_id: org });
  });

  it('rejects cleanup without explicit confirmation before any purge', async () => {
    await import('../functions/cleanup-test-leads/index');
    const response = await handler(cleanupRequest({ action: 'delete', leadIds: [leadId] }));
    expect(response.status).toBe(400);
    expect(calls.some((q) => q.table === 'purge_selected_test_leads')).toBe(false);
  });
});

describe('Operational mode authority', () => {
  const recent = new Date().toISOString();
  const zapiCallbackEndpoints = [
    'update-webhook-received',
    'update-webhook-delivery',
    'update-webhook-message-status',
  ];
  const registeredZapiWebhook = () => ({
    registered_at: recent,
    registration_complete: true,
    registration_endpoints: zapiCallbackEndpoints,
  });

  const guidedActivationRequest = () => new Request('https://example.invalid/operational-diagnostics', {
    method: 'POST',
    headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'activate_real' }),
  });

  it('prepares and activates the real environment only after the final server check passes', async () => {
    let sandboxMode = true;
    override = (q) => {
      if (q.table === 'company_settings' && q.operation === 'select') return ok({ ...readyCompany, sandbox_mode: sandboxMode });
      if (q.table === 'company_settings' && q.operation === 'update') {
        sandboxMode = q.value?.sandbox_mode !== false;
        return ok({ id: org });
      }
      if (q.table === 'integrations' && q.operation === 'select') return ok([
        { ...readyIntegration, key: 'ai', label: 'IA', last_tested_at: recent, last_error: null },
        { ...readyIntegration, key: 'whatsapp', label: 'WhatsApp', last_tested_at: recent, last_error: null },
        { ...readyIntegration, key: 'zapi_webhook', label: 'Webhook', last_tested_at: recent, last_error: null },
        { ...readyIntegration, key: 'scheduler', label: 'Worker', last_tested_at: recent, last_error: null },
      ]);
      return undefined;
    };
    await import('../functions/operational-diagnostics/index');
    const response = await handler(guidedActivationRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ activated: true, status: { mode: 'real', productionReady: true } });
    expect(calls.find((q) => q.table === 'company_settings' && q.operation === 'update')?.value).toMatchObject({ sandbox_mode: false });
  });

  it('keeps the real environment in preparation and returns only blockers when external confirmation is still missing', async () => {
    override = (q) => {
      if (q.table === 'company_settings' && q.operation === 'select') return ok({ ...readyCompany, sandbox_mode: true });
      if (q.table === 'integrations' && q.operation === 'select') return ok([
        { ...readyIntegration, key: 'ai', label: 'IA', last_tested_at: recent, last_error: null },
        { ...readyIntegration, key: 'whatsapp', label: 'WhatsApp', last_tested_at: recent, last_error: null },
        { ...readyIntegration, key: 'zapi_webhook', label: 'Webhook', connected: false, enabled: true, last_tested_at: null, last_error: null, configuration: registeredZapiWebhook() },
        { ...readyIntegration, key: 'scheduler', label: 'Worker', last_tested_at: recent, last_error: null },
      ]);
      if (q.table === 'webhook_events') return ok([]);
      return undefined;
    };
    await import('../functions/operational-diagnostics/index');
    const response = await handler(guidedActivationRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      activated: false,
      remaining: [{ id: 'whatsapp_webhook', ok: false }],
      status: { mode: 'setup' },
    });
    expect(calls.some((q) => q.table === 'company_settings' && q.operation === 'update')).toBe(false);
  });

  it('does not expose a manual switch back to the removed Demo mode', async () => {
    await import('../functions/operational-diagnostics/index');
    const response = await handler(new Request('https://example.invalid/operational-diagnostics', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_mode', mode: 'demo' }),
    }));
    expect(response.status).toBe(400);
    expect(calls.some((q) => q.table === 'company_settings' && q.operation === 'update')).toBe(false);
  });

  it('registers all required Z-API callbacks using the documented PUT contract', async () => {
    override = (q) => {
      if (q.table === 'read_integration_secret') return ok({
        instancia_id: 'synthetic-instance', token: 'synthetic-instance-token', client_token: 'synthetic-client-token',
        webhook_token: 'synthetic-webhook-token', url_base: 'https://api.z-api.io',
      });
      if (q.table === 'integrations' && q.operation === 'select') {
        if (q.filters.key === 'whatsapp') return ok({ ...readyIntegration, key: 'whatsapp' });
        if (q.filters.key === 'zapi_webhook') return ok({ ...readyIntegration, key: 'zapi_webhook', configuration: {} });
        return ok([
          { ...readyIntegration, key: 'ai', last_tested_at: recent, last_error: null },
          { ...readyIntegration, key: 'whatsapp', last_tested_at: recent, last_error: null },
          { ...readyIntegration, key: 'zapi_webhook', connected: false, enabled: true, last_tested_at: null, last_error: null, configuration: { registered_at: recent } },
          { ...readyIntegration, key: 'scheduler', last_tested_at: recent, last_error: null },
        ]);
      }
      return undefined;
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ value: true }), { status: 200 }));
    await import('../functions/operational-diagnostics/index');
    const response = await handler(new Request('https://example.invalid/operational-diagnostics', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'configure_whatsapp_webhook' }),
    }));
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'https://api.z-api.io/instances/synthetic-instance/token/synthetic-instance-token/update-webhook-received',
      'https://api.z-api.io/instances/synthetic-instance/token/synthetic-instance-token/update-webhook-delivery',
      'https://api.z-api.io/instances/synthetic-instance/token/synthetic-instance-token/update-webhook-message-status',
    ]);
    for (const [, request] of fetchMock.mock.calls) {
      expect(request).toMatchObject({ method: 'PUT', headers: { 'Content-Type': 'application/json', 'Client-Token': 'synthetic-client-token' } });
      expect(String(request.body)).toContain('integration_id=');
    }
    expect(calls.find((q) => q.table === 'integrations' && q.operation === 'update')?.value).toMatchObject({
      enabled: true,
      connected: false,
      configuration: {
        registration_complete: true,
        registration_endpoints: zapiCallbackEndpoints,
      },
    });
  });

  it('reports that the provider has not delivered a callback yet instead of blaming Ana or the lead', async () => {
    override = (q) => {
      if (q.table === 'integrations' && q.operation === 'select') return ok([
        { ...readyIntegration, key: 'ai', label: 'IA', last_tested_at: recent, last_error: null },
        { ...readyIntegration, key: 'whatsapp', label: 'WhatsApp', last_tested_at: recent, last_error: null },
        { ...readyIntegration, key: 'zapi_webhook', label: 'Entrada', connected: false, enabled: true, last_tested_at: null, last_error: null, configuration: registeredZapiWebhook() },
        { ...readyIntegration, key: 'scheduler', label: 'Worker', last_tested_at: recent, last_error: null },
      ]);
      if (q.table === 'webhook_events') return ok([]);
      return undefined;
    };
    await import('../functions/operational-diagnostics/index');
    const response = await handler(new Request('https://example.invalid/operational-diagnostics', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status' }),
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).status.webhookDiagnostic).toMatchObject({
      state: 'waiting_callback',
      registeredAt: recent,
      lastEventAt: null,
    });
  });

  it('requires a fresh callback registration after the Z-API callback route changes', async () => {
    override = (q) => {
      if (q.table === 'integrations' && q.operation === 'select') return ok([
        { ...readyIntegration, key: 'ai', label: 'IA', last_tested_at: recent, last_error: null },
        { ...readyIntegration, key: 'whatsapp', label: 'WhatsApp', last_tested_at: recent, last_error: null },
        {
          ...readyIntegration,
          key: 'zapi_webhook',
          label: 'Entrada',
          connected: false,
          enabled: true,
          last_tested_at: null,
          last_error: 'whatsapp_credentials_changed',
          configuration: {
            registered_at: recent,
            registration_complete: false,
            registration_invalidated_at: recent,
            registration_invalidation_reason: 'whatsapp_credentials_changed',
          },
        },
        { ...readyIntegration, key: 'scheduler', label: 'Worker', last_tested_at: recent, last_error: null },
      ]);
      return undefined;
    };
    await import('../functions/operational-diagnostics/index');
    const response = await handler(new Request('https://example.invalid/operational-diagnostics', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status' }),
    }));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.status.webhookDiagnostic).toMatchObject({ state: 'credentials_changed', registeredAt: recent });
    const inboundCheck = (payload.status.checks as Array<{ id?: string; ok?: boolean }>)
      .find((check) => check.id === 'whatsapp_webhook');
    expect(inboundCheck).toMatchObject({ id: 'whatsapp_webhook', ok: false });
  });

  it('reports an unmatched callback instead of claiming that Z-API did not call', async () => {
    override = (q) => {
      if (q.table === 'integrations' && q.operation === 'select') return ok([
        { ...readyIntegration, key: 'ai', label: 'IA', last_tested_at: recent, last_error: null },
        { ...readyIntegration, key: 'whatsapp', label: 'WhatsApp', last_tested_at: recent, last_error: null },
        { ...readyIntegration, key: 'zapi_webhook', label: 'Entrada', connected: false, enabled: true, last_tested_at: null, last_error: null, configuration: registeredZapiWebhook() },
        { ...readyIntegration, key: 'scheduler', label: 'Worker', last_tested_at: recent, last_error: null },
      ]);
      if (q.table === 'webhook_events') return ok([{
        status: 'failed',
        error: 'lead_not_matched',
        created_at: recent,
      }]);
      return undefined;
    };
    await import('../functions/operational-diagnostics/index');
    const response = await handler(new Request('https://example.invalid/operational-diagnostics', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status' }),
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).status.webhookDiagnostic).toMatchObject({
      state: 'lead_not_matched',
      lastEventAt: recent,
      detail: expect.stringContaining('não corresponde'),
    });
  });

  it('explains that a group callback cannot homologate an individual lead conversation', async () => {
    override = (q) => {
      if (q.table === 'integrations' && q.operation === 'select') return ok([
        { ...readyIntegration, key: 'ai', label: 'IA', last_tested_at: recent, last_error: null },
        { ...readyIntegration, key: 'whatsapp', label: 'WhatsApp', last_tested_at: recent, last_error: null },
        { ...readyIntegration, key: 'zapi_webhook', label: 'Entrada', connected: false, enabled: true, last_tested_at: null, last_error: null, configuration: registeredZapiWebhook() },
        { ...readyIntegration, key: 'scheduler', label: 'Worker', last_tested_at: recent, last_error: null },
      ]);
      if (q.table === 'webhook_events') return ok([{ status: 'ignored', error: 'non_direct_conversation', created_at: recent }]);
      return undefined;
    };
    await import('../functions/operational-diagnostics/index');
    const response = await handler(new Request('https://example.invalid/operational-diagnostics', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status' }),
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).status.webhookDiagnostic).toMatchObject({
      state: 'unsupported_callback',
      detail: expect.stringContaining('grupo'),
    });
  });
});
