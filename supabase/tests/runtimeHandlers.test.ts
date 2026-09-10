import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
type Query = { table: string; operation: string; value?: Row; filters: Record<string, unknown> };
type Result = { data: unknown; error: null | { message: string; code?: string }; count?: number };
const state = vi.hoisted(() => ({ admin: {} as object }));
vi.mock('../functions/_shared/auth.ts', () => ({
  createAdminClient: () => state.admin,
  requireUser: async (request: Request) => {
    if (!request.headers.get('Authorization')) throw new Error('authentication_required');
    return { user: { id: 'owner' } };
  },
  requireOrganizationRole: async () => undefined,
}));

const org = 'a1111111-1111-4111-8111-111111111111';
const leadId = 'b1111111-1111-4111-8111-111111111111';
const integrationId = 'c1111111-1111-4111-8111-111111111111';
const readyCompany = { active: true, sandbox_mode: false, can_use_ia: true, ai_actions_enabled: true };
const readyIntegration = { id: integrationId, organization_id: org, provider: 'zapi', enabled: true, connected: true, paused: false };
const readyLead = { id: leadId, organization_id: org, owner_id: 'owner', assigned_to: 'owner', modo_atendimento: 'ia', ai_paused: false, opt_out: false, ana_stage: 'novo', score: 0, active_channel: 'whatsapp', phone: '(11) 99999-0000', first_inbound_at: null };

let calls: Query[];
let override: ((query: Query) => Result | undefined) | undefined;
let handler: (request: Request) => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn>;
const ok = (data: unknown): Result => ({ data, error: null });

function execute(query: Query): Result {
  calls.push({ ...query, filters: { ...query.filters } });
  const overridden = override?.(query);
  if (overridden) return overridden;
  if (query.operation === 'rpc') {
    if (query.table === 'resolve_whatsapp_lead') return ok([{ lead_id: leadId, reason: 'unique_phone_identity' }]);
    return ok({});
  }
  if (query.operation !== 'select') return ok({ id: `${query.table}-id` });
  switch (query.table) {
    case 'profiles': return ok({ active_organization_id: org, name: 'Synthetic user' });
    case 'organization_members': return ok({ role: 'admin', status: 'active' });
    case 'company_settings': return ok(readyCompany);
    case 'organization_module_data': return ok({ data: { killSwitchGlobal: false } });
    case 'leads': return ok('id' in query.filters ? readyLead : [readyLead]);
    case 'integrations': return ok(readyIntegration);
    case 'agent_runs': return ok(null);
    case 'lead_messages': return ok([{ sender: 'lead', type: 'received', text: 'Qual o valor?', sent_at: '2026-09-08T00:00:00Z' }]);
    case 'ai_agents': return ok(null);
    default: return ok([]);
  }
}

function queryFor(table: string) {
  const query: Query = { table, operation: 'select', filters: {} };
  const chain: Record<string, unknown> = {};
  for (const method of ['eq', 'is', 'in', 'not', 'gte', 'lte', 'ilike', 'or', 'order', 'limit']) {
    chain[method] = (key: string, value: unknown) => { if (method === 'eq') query.filters[key] = value; return chain; };
  }
  chain.select = () => chain;
  for (const method of ['insert', 'update', 'upsert']) chain[method] = (value: Row) => { query.operation = method; query.value = value; return chain; };
  chain.single = chain.maybeSingle = () => chain;
  chain.then = (resolve: (result: Result) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(execute(query)).then(resolve, reject);
  return chain;
}

beforeEach(() => {
  vi.resetModules(); calls = []; override = undefined;
  state.admin = { from: queryFor, rpc: (name: string, value: Row) => Promise.resolve(execute({ table: name, operation: 'rpc', value, filters: {} })) };
  vi.stubGlobal('Deno', { env: { get: (name: string) => ({ SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-jwt', WHATSAPP_WEBHOOK_SHARED_SECRET: 'synthetic-internal-secret' } as Record<string, string>)[name] }, serve: (callback: typeof handler) => { handler = callback; } });
  fetchMock = vi.fn(async () => { throw new Error('Unexpected external call in safety test'); });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function anaRequest(patch: Row = {}) {
  return new Request('https://example.invalid/ana-run', { method: 'POST', headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: leadId, event: 'message.received', message_id: 'synthetic-inbound-1', ...patch }) });
}
function expectNoBusinessWrites() {
  expect(calls.filter((call) => ['insert', 'update', 'upsert'].includes(call.operation) && call.table !== 'agent_runs')).toEqual([]);
  expect(fetchMock).not.toHaveBeenCalled();
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
    expectNoBusinessWrites();
  });
  it('does not mutate the lead or create a task/quote/message during simulation', async () => {
    await import('../functions/ana-run/index');
    const response = await handler(anaRequest({ contexto: { dry_run: true } }));
    expect(await response.json()).toMatchObject({ ok: true, dry_run: true, acoes_aplicadas: [], status_canal: 'simulacao_sem_alteracoes' });
    expectNoBusinessWrites();
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
    expect(await (await handler(webhookRequest())).json()).toMatchObject({ accepted: true, duplicate: true });
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
    override = (q) => q.table === 'resolve_whatsapp_lead' ? ok([{ lead_id: null, reason: 'ambiguous_identity' }]) : undefined;
    await import('../functions/webhook-whatsapp/index');
    expect(await (await handler(webhookRequest())).json()).toMatchObject({ accepted: true, matched: false, resolution: 'ambiguous_identity' });
    expect(calls.find((q) => q.table === 'webhook_events' && q.operation === 'update')?.value).toMatchObject({ status: 'failed', error: 'lead_identity_ambiguous' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('records unmatched without the invalid unmatched status', async () => {
    override = (q) => q.table === 'resolve_whatsapp_lead' ? ok([{ lead_id: null, reason: 'not_found' }]) : undefined;
    await import('../functions/webhook-whatsapp/index');
    expect(await (await handler(webhookRequest())).json()).toMatchObject({ matched: false });
    expect(calls.find((q) => q.table === 'webhook_events' && q.operation === 'update')?.value).toMatchObject({ status: 'failed', error: 'lead_not_matched' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('ignores outgoing echoes without running Ana', async () => {
    await import('../functions/webhook-whatsapp/index');
    expect(await (await handler(webhookRequest({ ...callback, fromMe: true }))).json()).toMatchObject({ ignored: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Central manual WhatsApp gateway', () => {
  function manualWhatsAppRequest(body: Row = {}) {
    return new Request('https://example.invalid/enviar-whatsapp', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, para: '5511999990000', texto: 'Oi', modo: 'humano', ...body }),
    });
  }

  it('keeps ordinary manual messages blocked in sandbox before queue writes', async () => {
    override = (q) => q.table === 'company_settings' ? ok({ ...readyCompany, sandbox_mode: true }) : undefined;
    await import('../functions/enviar-whatsapp/index');
    const response = await handler(manualWhatsAppRequest());
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, erro: 'operational_mode_protected' });
    expect(calls.some((q) => q.table === 'lead_messages' && q.operation === 'insert')).toBe(false);
    expect(calls.some((q) => q.table === 'outreach_jobs' && q.operation === 'insert')).toBe(false);
  });

  it('queues an explicitly confirmed controlled test using the outbound WhatsApp integration', async () => {
    override = (q) => q.table === 'company_settings' ? ok({ ...readyCompany, sandbox_mode: true }) : undefined;
    await import('../functions/enviar-whatsapp/index');
    const response = await handler(manualWhatsAppRequest({ teste_controlado: true }));
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ ok: true, teste_controlado: true });
    expect(calls.find((q) => q.table === 'integrations' && q.operation === 'select')?.filters).toMatchObject({ key: 'whatsapp' });
    expect(calls.find((q) => q.table === 'outreach_jobs' && q.operation === 'insert')?.value?.payload).toMatchObject({
      controlled_test: true,
      manual: true,
    });
  });
});

describe('Worker safety handler', () => {
  const job = { id: 'synthetic-job', lead_id: leadId, channel: 'whatsapp', attempt: 0, payload: { text: 'Mensagem sintética', message_id: 'synthetic-draft', agent_run_id: 'synthetic-run', context_last_contact: null } };
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
    expect(calls.find((q) => q.table === 'lead_messages' && q.operation === 'update')?.value).toMatchObject({ type: 'sent', provider_message_id: 'synthetic-receipt' });
    expect(calls.find((q) => q.table === 'lead_outreach' && q.operation === 'update')?.value).toMatchObject({ status: 'sent', provider_message_id: 'synthetic-receipt' });
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
    expect(calls.find((q) => q.table === 'lead_messages' && q.operation === 'update')?.value).toMatchObject({ type: 'sent', provider_message_id: 'synthetic-human-receipt' });
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
    setupQueue((q) => q.table === 'lead_messages' && q.operation === 'update' ? { data: null, error: { message: 'synthetic database outage' } } : undefined);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ messageId: 'synthetic-receipt' }), { status: 200 }));
    await import('../functions/automation-worker/index');
    expect(await (await handler(workerRequest())).json()).toMatchObject({ failed_jobs: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls.filter((q) => q.table === 'outreach_jobs' && q.operation === 'update').at(-1)?.value).toMatchObject({ status: 'reconciliation_required', payload: { provider_message_id: 'synthetic-receipt' } });
  });
});

describe('Z-API credential configuration contract', () => {
  it('stores credentials without attempting to mutate the provider webhook', async () => {
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
      p_secret: expect.objectContaining({ instancia_id: 'synthetic-instance' }),
    });
    expect(fetchMock).not.toHaveBeenCalled();
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
    expect(await response.json()).toMatchObject({ ok: true, pronto: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.z-api.io/instances/synthetic-instance/token/synthetic-instance-token/status',
      expect.objectContaining({ headers: { 'Content-Type': 'application/json', 'Client-Token': 'synthetic-client-token' } }),
    );
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Accept');
    expect(calls.find((q) => q.table === 'company_settings' && q.operation === 'update')?.value).toMatchObject({ sandbox_mode: false });
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
        { ...readyIntegration, key: 'zapi_webhook', label: 'Webhook', connected: false, enabled: true, last_tested_at: null, last_error: null, configuration: { registered_at: recent } },
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

  it('registers only the inbound Z-API webhook using the documented PUT contract', async () => {
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
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.z-api.io/instances/synthetic-instance/token/synthetic-instance-token/update-webhook-received',
      expect.objectContaining({ method: 'PUT', headers: { 'Content-Type': 'application/json', 'Client-Token': 'synthetic-client-token' } }),
    );
    expect(fetchMock.mock.calls[0][1].body).toContain('integration_id=');
    expect(calls.find((q) => q.table === 'integrations' && q.operation === 'update')?.value).toMatchObject({ enabled: true, connected: false });
  });

  it('reports that the provider has not delivered a callback yet instead of blaming Ana or the lead', async () => {
    override = (q) => {
      if (q.table === 'integrations' && q.operation === 'select') return ok([
        { ...readyIntegration, key: 'ai', label: 'IA', last_tested_at: recent, last_error: null },
        { ...readyIntegration, key: 'whatsapp', label: 'WhatsApp', last_tested_at: recent, last_error: null },
        { ...readyIntegration, key: 'zapi_webhook', label: 'Entrada', connected: false, enabled: true, last_tested_at: null, last_error: null, configuration: { registered_at: recent } },
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

  it('explains that a group callback cannot homologate an individual lead conversation', async () => {
    override = (q) => {
      if (q.table === 'integrations' && q.operation === 'select') return ok([
        { ...readyIntegration, key: 'ai', label: 'IA', last_tested_at: recent, last_error: null },
        { ...readyIntegration, key: 'whatsapp', label: 'WhatsApp', last_tested_at: recent, last_error: null },
        { ...readyIntegration, key: 'zapi_webhook', label: 'Entrada', connected: false, enabled: true, last_tested_at: null, last_error: null, configuration: { registered_at: recent } },
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
