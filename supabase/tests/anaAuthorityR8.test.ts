import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readAnaKnowledgeFence, assertAnaKnowledgeSnapshot } from '../functions/_shared/anaKnowledgeFence';
import { normalizeCommercialCatalogPolicy } from '../functions/_shared/commercialCatalogPolicy';
import { validatedAnaMeetingRequest } from '../functions/_shared/anaMeetingRequest';

type Row = Record<string, any>;
type Query = { table: string; operation: string; value?: Row; filters: Row; single: boolean; columns: string };
const state = vi.hoisted(() => ({ admin: {} as any }));
vi.mock('../functions/_shared/auth.ts', () => ({ createAdminClient: () => state.admin,
  requireUser: async () => ({ user: { id: 'owner' }, client: state.admin }), requireOrganizationRole: async () => undefined }));
const org = 'a1111111-1111-4111-8111-111111111111';
const leadId = 'b1111111-1111-4111-8111-111111111111';
const versionId = 'c1111111-1111-4111-8111-111111111111';
const docId = 'd1111111-1111-4111-8111-111111111111';
const itemId = 'e1111111-1111-4111-8111-111111111111';
const sourceId = 'f1111111-1111-4111-8111-111111111111';
let db: Record<string, Row[]>; let writes: Query[]; let reads: Query[];
let handler: (request: Request) => Promise<Response>; let network: ReturnType<typeof vi.fn>;
let inbound: string; let decision: Row;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
const response = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
const aiResponse = () => response({ choices: [{ message: { content: JSON.stringify(decision) } }] });
const tomorrowAtTen = () => new Date(Date.now() + 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) + 'T10:00:00-03:00';
function queryFor(table: string) {
  const query: Query = { table, operation: 'select', filters: {}, single: false, columns: '*' }; const chain: Row = {};
  for (const op of ['eq', 'is', 'in', 'not', 'contains']) chain[op] = (key: string, value: unknown) => { query.filters[`${op}:${key}`] = value; return chain; };
  for (const op of ['or', 'order', 'limit']) chain[op] = (value: unknown) => { query.filters[op] = value; return chain; };
  chain.select = (columns: string) => { query.columns = columns; return chain; };
  for (const op of ['insert', 'update', 'upsert']) chain[op] = (value: Row) => { query.operation = op; query.value = structuredClone(value); return chain; };
  chain.single = chain.maybeSingle = () => { query.single = true; return chain; };
  chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve().then(() => {
    const entries = db[table] ?? [];
    const rows = entries.filter(row => Object.entries(query.filters).every(([key, value]) => {
      if (key === 'eq:documents.status') return db.documents.find(doc => doc.id === row.document_id)?.status === value;
      if (key.startsWith('eq:')) return row[key.slice(3)] === value;
      if (key.startsWith('in:')) return (value as unknown[]).includes(row[key.slice(3)]);
      if (key.startsWith('is:')) return (row[key.slice(3)] ?? null) === value;
      if (key.startsWith('contains:')) return Object.entries(value as Row).every(([name, expected]) => row[key.slice(9)]?.[name] === expected);
      return true;
    }));
    if (query.operation === 'select') {
      reads.push(structuredClone(query));
      const projected = rows.map(row => query.columns === '*' ? structuredClone(row) : Object.fromEntries(query.columns.split(',').filter(key => key in row).map(key => [key, structuredClone(row[key])])));
      // PostgREST document join only for the initial search; the fence reads canonical tables separately.
      if (table === 'knowledge_chunks' && query.columns.includes('documents!inner')) for (let i = 0; i < projected.length; i++) projected[i].documents = db.documents.find(doc => doc.id === rows[i].document_id);
      return { data: query.single ? projected[0] ?? null : projected, error: null };
    }
    writes.push(structuredClone(query));
    if (query.operation === 'update') { rows.forEach(row => Object.assign(row, query.value)); return { data: query.single ? rows[0] ?? null : rows, error: null }; }
    const row = { id: `${table}-synthetic`, ...query.value }; (db[table] ??= []).push(row);
    return { data: query.single ? row : [row], error: null };
  }).then(resolve, reject);
  return chain;
}
beforeEach(() => {
  vi.resetModules(); writes = []; reads = []; inbound = 'Gostaria de conhecer as soluções disponíveis.';
  db = {
    profiles: [{ id: 'owner', active_organization_id: org, name: 'Synthetic' }], organization_members: [{ organization_id: org, user_id: 'owner', role: 'admin', status: 'active' }],
    leads: [{ id: leadId, organization_id: org, company: 'Synthetic', owner_id: 'owner', assigned_to: 'owner', active_channel: 'email', email: 'lead@example.test', modo_atendimento: 'ia', ai_paused: false, opt_out: false, contact_approval_status: 'approved', ana_stage: 'novo', score: 0, updated_at: '2026-10-05T10:00:00Z' }],
    company_settings: [{ organization_id: org, active: true, sandbox_mode: false, can_use_ia: true, ai_actions_enabled: true, ana_operation_enabled: true, ana_operation_mode: 'automatic', ui_settings: {} }],
    organization_module_data: [{ organization_id: org, module_key: 'configuracao_runtime', data: { killSwitchGlobal: false } }, { organization_id: org, module_key: 'commercial_catalog_policy', data: {} }],
    integrations: ['ai', 'email', 'google_calendar'].map(key => ({ id: `${key}-integration`, organization_id: org, key, enabled: true, connected: true, paused: false })),
    ai_agents: [{ organization_id: org, key: 'ana', active_version_id: versionId }], ai_agent_versions: [{ id: versionId, organization_id: org, configuration: { allowedChannels: ['email'], handoffPolicy: { lowConfidenceThreshold: 70 } } }],
    documents: [], knowledge_catalog_items: [], knowledge_chunks: [], knowledge_sources: [],
  };
  state.admin = { from: queryFor, rpc: vi.fn(async (name: string, args: Row) => {
    if (name === 'read_integration_secret') return { data: args.p_integration === 'google_calendar-integration' ? { access_token: 'synthetic-calendar' } : { openai_key: 'synthetic-ai', provedor_principal: 'openai' }, error: null };
    if (name === 'match_knowledge_chunks') return { data: db.knowledge_chunks.map(row => ({ ...row, document_name: 'Synthetic doc', similarity: .9 })), error: null };
    throw new Error(`unexpected_rpc:${name}`);
  }) };
  decision = { proximo_estagio: 'apresentado', outcome: null, score: 90, motivo: 'Conhecimento consultado.', precisa_humano: false, mensagem_sugerida: 'Posso ajudar com as soluções disponíveis.', acoes: [{ tipo: 'enviar_mensagem', payload: {} }] };
  vi.stubGlobal('Deno', { env: { get: () => undefined }, serve: (callback: typeof handler) => { handler = callback; } });
  network = vi.fn(async (url: string) => {
    if (url.includes('/chat/completions')) return aiResponse();
    if (url.includes('/embeddings')) return response({ data: [{ embedding: Array(1536).fill(0) }] });
    if (url.includes('privateExtendedProperty')) return response({ items: [] });
    if (url.endsWith('/freeBusy')) return response({ calendars: { primary: { busy: [] } } });
    if (url.includes('sendUpdates=none')) return response({ id: 'calendar-event-synthetic', htmlLink: 'https://calendar.google.com/synthetic' });
    throw new Error(`unexpected_network:${url}`);
  }); vi.stubGlobal('fetch', network);
});
afterEach(() => vi.unstubAllGlobals());
async function run() {
  db.lead_messages = [{ id: 'inbound', organization_id: org, lead_id: leadId, sender: 'lead', text: inbound, sent_at: '2026-10-05T10:00:01Z' }];
  await import('../functions/ana-run/index');
  return handler(new Request('https://example.invalid/ana-run', { method: 'POST', headers: { Authorization: 'Bearer synthetic' }, body: JSON.stringify({ lead_id: leadId, event: 'message.received', message_id: 'synthetic-inbound' }) }));
}
function seedKnowledge(type = 'product') {
  db.documents = [{ id: docId, organization_id: org, name: 'Synthetic doc', status: 'active', source_type: 'commercial_catalog', metadata: { commercial_item_id: itemId } }];
  db.knowledge_catalog_items = [{ id: itemId, organization_id: org, document_id: docId, item_type: type, name: 'Peça demonstrativa', short_description: 'Solução descritiva sem preço.', status: 'active', ana_enabled: true, source_id: sourceId, image_url: 'https://example.test/part.png' }];
  db.knowledge_sources = [{ id: sourceId, organization_id: org, enabled: true, sync_status: 'healthy' }];
  db.knowledge_chunks = [{ id: 'chunk', organization_id: org, document_id: docId, chunk_index: 0, status: 'active', content: 'Soluções disponíveis para uma peça demonstrativa em silicone.', metadata: {} }];
}
const businessWrites = () => writes.filter(q => !['agent_runs', 'domain_events', 'audit_logs'].includes(q.table));
const queued = () => writes.find(q => q.table === 'outreach_jobs');
const modelContext = () => {
  const call = network.mock.calls.find(([url]) => String(url).includes('/chat/completions'));
  const body = JSON.parse((call as unknown as [string, RequestInit])[1].body as string);
  const text = body.messages[1].content as string; return JSON.parse(text.slice(text.indexOf('\n') + 1));
};

describe('R8 actual Ana handler — synthetic DB and provider transports', () => {
  it.each([false, true])('T-R8-012: first WhatsApp binding adopts only its own delta; concurrent human=%s', async humanChanged => {
    db.leads[0].active_channel = 'whatsapp'; db.leads[0].phone = '5511999999999';
    db.ai_agent_versions[0].configuration.allowedChannels = ['whatsapp'];
    db.whatsapp_accounts = [{ id: itemId, organization_id: org, integration_id: 'whatsapp-integration', is_default: true, enabled: true, archived_at: null }];
    db.integrations.push({ id: 'whatsapp-integration', organization_id: org, key: 'whatsapp', enabled: true, connected: true, paused: false });
    const rpc = state.admin.rpc.getMockImplementation();
    state.admin.rpc.mockImplementation(async (name: string, args: Row) => {
      if (name !== 'resolve_lead_whatsapp_account') return rpc(name, args);
      db.leads[0].whatsapp_account_id = itemId; db.leads[0].updated_at = '2026-10-05T10:00:02Z';
      if (humanChanged) db.leads[0].ai_paused = true;
      return { data: [{ account_id: itemId, integration_id: 'whatsapp-integration' }], error: null };
    });
    const result = await run(); const body = await result.text(); expect(result.status, body).toBe(humanChanged ? 400 : 200);
    if (humanChanged) { expect(network).not.toHaveBeenCalled(); expect(queued()).toBeUndefined(); }
    else expect(queued()?.value?.whatsapp_account_id).toBe(itemId);
  });
  it.each(['missing_source', 'disabled_source', 'source_changed'])( 'T-R8-013: imported document %s cannot bypass provenance', async mode => {
    seedKnowledge(); db.knowledge_catalog_items = []; db.documents[0].source_type = 'url';
    db.documents[0].metadata = mode === 'missing_source' ? {} : { source_id: sourceId };
    if (mode === 'disabled_source') db.knowledge_sources[0].enabled = false;
    if (mode === 'source_changed') {
      const entered = deferred<void>(); const model = deferred<Response>(); network.mockImplementation(async () => { entered.resolve(); return model.promise; });
      const pending = run(); await entered.promise; db.knowledge_sources[0].enabled = false; model.resolve(aiResponse());
      expect((await pending).status).toBe(400); expect(businessWrites()).toEqual([]);
    } else { expect((await run()).status).toBe(200); expect(modelContext().knowledge).toEqual([]); }
  });
  it.each(['pause', 'human', 'optout', 'owner', 'version', 'kill', 'operation', 'policy', 'source'])(
    'T-R8-001: %s while model awaits prevents new business effects', async change => {
      seedKnowledge(); const entered = deferred<void>(); const model = deferred<Response>();
      network.mockImplementation(async () => { entered.resolve(); return model.promise; });
      const pending = run(); await entered.promise;
      if (change === 'pause') db.leads[0].ai_paused = true;
      if (change === 'human') db.leads[0].modo_atendimento = 'humano';
      if (change === 'optout') db.leads[0].opt_out = true;
      if (change === 'owner') db.leads[0].owner_id = 'another';
      if (change === 'version') db.ai_agents[0].active_version_id = docId;
      if (change === 'kill') db.organization_module_data[0].data.killSwitchGlobal = true;
      if (change === 'operation') db.company_settings[0].ana_operation_enabled = false;
      if (change === 'policy') db.organization_module_data[1].data.catalogEnabled = false;
      if (change === 'source') db.knowledge_sources[0].enabled = false;
      model.resolve(aiResponse()); const result = await pending;
      expect(result.status).toBe(400); expect(businessWrites()).toEqual([]); expect(queued()).toBeUndefined();
    });
  it.each(['catalog', 'product', 'service', 'usage', 'source', 'source_usage', 'document', 'semantic'])(
    'T-R8-002: %s denial filters real model input without falling back to services prices', async restriction => {
      seedKnowledge(restriction === 'service' ? 'service' : 'product');
      if (restriction === 'catalog') db.organization_module_data[1].data.catalogEnabled = false;
      if (restriction === 'product') db.organization_module_data[1].data.productsForAna = false;
      if (restriction === 'service') db.organization_module_data[1].data.servicesForAna = false;
      if (restriction === 'usage') db.company_settings[0].ui_settings.knowledge_usage = { products: false };
      if (restriction === 'source') db.knowledge_sources[0].enabled = false;
      if (restriction === 'source_usage') db.company_settings[0].ui_settings.knowledge_usage = { sources: false };
      if (restriction === 'document') { db.documents[0].source_type = 'upload'; db.documents[0].metadata = {}; db.company_settings[0].ui_settings.knowledge_usage = { documents: false }; db.knowledge_catalog_items = []; }
      if (restriction === 'semantic') { inbound = 'Qual o material da peça?'; db.organization_module_data[1].data.productsForAna = false; }
      const result = await run(); expect(result.status).toBe(200);
      if (restriction === 'semantic') { expect(network.mock.calls.some(([url]) => String(url).includes('/chat/completions'))).toBe(false); expect(queued()).toBeUndefined(); }
      else expect(modelContext().knowledge).toEqual([]);
      expect(reads.some(q => q.table === 'services')).toBe(false);
    });
  it('T-R8-003: canonical approved text is passed to model; queue gets a real reproducible snapshot', async () => {
    seedKnowledge(); const result = await run(); expect(result.status, await result.text()).toBe(200); expect(modelContext().knowledge[0].content).toContain('peça demonstrativa');
    expect(queued()?.value?.payload.ana_knowledge_snapshot.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    await expect(assertAnaKnowledgeSnapshot(state.admin, org, queued()?.value?.payload.ana_knowledge_snapshot)).resolves.toBeUndefined();
    expect(reads.filter(q => ['documents', 'knowledge_chunks', 'knowledge_catalog_items', 'knowledge_sources'].includes(q.table)).every(q => q.filters['eq:organization_id'] === org)).toBe(true);
  });
  it.each([true, false])('T-R8-004: draftEnabled=%s controls empty human-review proposal; never automated quote', async enabled => {
    db.organization_module_data[1].data.draftEnabled = enabled;
    decision.acoes = [{ tipo: 'gerar_orcamento', payload: { price: 123, discount: 10 } }];
    expect((await run()).status).toBe(200);
    const proposal = writes.find(q => q.table === 'proposals');
    if (enabled) expect(proposal?.value).toMatchObject({ items: [], value: 0, status: 'pending', need_approval: true });
    else expect(proposal).toBeUndefined();
    expect(queued()).toBeUndefined();
  });
  it('T-R8-005: model cannot mark a sale won', async () => {
    decision.outcome = 'ganho'; expect((await run()).status).toBe(400); expect(businessWrites()).toEqual([]);
  });
  it.each(['lead', 'kill', 'calendar'])( 'T-R8-006: %s cutoff while freeBusy awaits prevents Calendar create', async cutoff => {
    inbound = 'Quero uma reunião amanhã às 10:00.';
    decision.acoes = [{ tipo: 'agendar_reuniao', payload: { starts_at: tomorrowAtTen(), duration_minutes: 30 } }];
    const entered = deferred<void>(); const availability = deferred<Response>(); const original = network.getMockImplementation()!;
    network.mockImplementation(async (url: string) => { if (url.endsWith('/freeBusy')) { entered.resolve(); return availability.promise; } return original(url); });
    const pending = run(); await entered.promise;
    if (cutoff === 'lead') db.leads[0].ai_paused = true;
    if (cutoff === 'kill') db.organization_module_data[0].data.killSwitchGlobal = true;
    if (cutoff === 'calendar') db.integrations.find(row => row.key === 'google_calendar')!.enabled = false;
    availability.resolve(response({ calendars: { primary: { busy: [] } } })); await pending;
    expect(network.mock.calls.some(([url]) => String(url).includes('sendUpdates=none'))).toBe(false);
    expect(writes.some(q => q.table === 'appointments')).toBe(false); expect(queued()).toBeUndefined();
  });
  it('T-R8-007: healthy explicit meeting creates one event, no invitation emails', async () => {
    inbound = 'Quero uma reunião amanhã às 10:00.';
    decision.acoes = [{ tipo: 'agendar_reuniao', payload: { starts_at: tomorrowAtTen(), duration_minutes: 30 } }];
    const result = await run(); const body = await result.text(); expect(result.status, body).toBe(200);
    expect(network.mock.calls.filter(([url]) => String(url).includes('sendUpdates=none')), body).toHaveLength(1);
    expect(writes.filter(q => q.table === 'appointments')).toHaveLength(1);
  });
  it.each(['missing_date', 'low_confidence', 'missing_availability'])( 'T-R8-008: %s cannot authorize Calendar create', async reason => {
    inbound = reason === 'missing_date' ? 'Vamos reunir às 10:00.' : 'Quero uma reunião amanhã às 10:00.';
    decision.acoes = [{ tipo: 'agendar_reuniao', payload: { starts_at: tomorrowAtTen(), duration_minutes: 30 } }];
    if (reason === 'low_confidence') decision.score = 10;
    if (reason === 'missing_availability') { const original = network.getMockImplementation()!; network.mockImplementation(async (url: string) => url.endsWith('/freeBusy') ? response({ calendars: {} }) : original(url)); }
    await run(); expect(network.mock.calls.some(([url]) => String(url).includes('sendUpdates=none'))).toBe(false); expect(queued()).toBeUndefined();
  });
});
describe('R8 canonical policy and dispatch snapshot helper', () => {
  it('T-R8-014: model date/time must exactly match the explicit local request, not merely be future', () => {
    const now = Date.parse('2026-10-05T12:00:00-03:00');
    expect(validatedAnaMeetingRequest({ starts_at: '2026-10-06T10:00:00-03:00' }, 'amanhã às 10:00', now)).not.toBeNull();
    expect(validatedAnaMeetingRequest({ starts_at: '2026-10-06T11:00:00-03:00' }, 'amanhã às 10:00', now)).toBeNull();
    expect(validatedAnaMeetingRequest({ starts_at: '2026-10-07T10:00:00-03:00' }, 'amanhã às 10:00', now)).toBeNull();
    expect(validatedAnaMeetingRequest({ starts_at: '2026-10-06T10:00:00-03:00' }, 'amanhã às 10:00 ou 11:00', now)).toBeNull();
  });
  it('T-R8-015: an invalid calendar literal cannot authorize Date.UTC overflow', () => {
    const now = Date.parse('2026-10-05T12:00:00-03:00');
    expect(validatedAnaMeetingRequest({ starts_at: '2026-12-01T13:00:00Z' }, 'reunião 31/11/2026 às 10:00', now)).toBeNull();
    expect(validatedAnaMeetingRequest({ starts_at: '2026-12-01T13:00:00Z' }, 'reunião 2026-11-31 às 10:00', now)).toBeNull();
  });
  it('T-R8-009: legacy flags never grant quote/discount approval and malformed flags fail closed', () => {
    expect(normalizeCommercialCatalogPolicy({ automaticSendEnabled: true, discountApprovalRequired: false, productsForAna: 'false' })).toMatchObject({ automaticSendEnabled: false, discountApprovalRequired: true, productsForAna: false });
  });
  it('T-R8-010: missing/forged snapshot never passes and unchanged genuine snapshot does', async () => {
    await expect(assertAnaKnowledgeSnapshot(state.admin, org, undefined)).rejects.toThrow('ana_knowledge_snapshot_missing');
    const { snapshot } = await readAnaKnowledgeFence(state.admin, org);
    await expect(assertAnaKnowledgeSnapshot(state.admin, org, snapshot)).resolves.toBeUndefined();
    await expect(assertAnaKnowledgeSnapshot(state.admin, org, { ...snapshot, fingerprint: '0'.repeat(64) })).rejects.toThrow('ana_knowledge_context_changed');
  });
  it.each(['content', 'item', 'source', 'org'])( 'T-R8-011: snapshot rejects changed %s at dispatch time', async change => {
    seedKnowledge(); const { snapshot } = await readAnaKnowledgeFence(state.admin, org, [docId], [itemId]);
    if (change === 'content') db.knowledge_chunks[0].content = 'Changed';
    if (change === 'item') db.knowledge_catalog_items[0].ana_enabled = false;
    if (change === 'source') db.knowledge_sources[0].enabled = false;
    await expect(assertAnaKnowledgeSnapshot(state.admin, change === 'org' ? docId : org, snapshot)).rejects.toThrow('ana_knowledge_context_changed');
  });
});
