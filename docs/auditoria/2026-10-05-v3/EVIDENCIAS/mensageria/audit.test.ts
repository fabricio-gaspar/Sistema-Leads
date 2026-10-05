import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseWaAkgEvent, sanitizeWaAkgPayload } from '../../../../../supabase/functions/_shared/waAkgInbound.ts';

// Audit-only test harness. No real DB, credentials, provider or paid model.
type Row = Record<string, any>;
const ids = { org: 'a1111111-1111-4111-8111-111111111111', user: 'a2222222-2222-4222-8222-222222222222', account: 'b1111111-1111-4111-8111-111111111111', integration: 'c1111111-1111-4111-8111-111111111111', event: 'd1111111-1111-4111-8111-111111111111', lead: 'e1111111-1111-4111-8111-111111111111' };
const state = vi.hoisted(() => ({ admin: {} as Row, user: 'a2222222-2222-4222-8222-222222222222' }));
vi.mock('../../../../../supabase/functions/_shared/auth.ts', () => ({
  createAdminClient: () => state.admin,
  requireUser: async () => ({ user: { id: state.user } }),
  hasOrganizationPermission: async (_a: unknown, _o: string, _u: string, permission: string) => ['channels.view_own', 'channels.connect_own'].includes(permission),
}));

let tables: Record<string, Row[]>;
let handler: (r: Request) => Promise<Response>;
let calls: Row[];
let failInsertMessage = false;
let failAccountUpdate = false;
let fetchMock: ReturnType<typeof vi.fn>;

function query(table: string) {
  const q: Row = { table, operation: 'select', filters: [], single: false };
  const c: Row = {};
  for (const method of ['eq', 'is', 'in', 'lte']) c[method] = (key: string, value: unknown) => { q.filters.push([method, key, value]); return c; };
  c.select = (_columns?: string, options?: Row) => { q.count = options?.count; return c; };
  c.order = c.limit = () => c;
  c.maybeSingle = c.single = () => { q.single = true; return c; };
  for (const method of ['update', 'insert', 'upsert']) c[method] = (value: Row, options?: Row) => { q.operation = method; q.value = value; q.options = options; return c; };
  c.then = (resolve: (r: Row) => unknown, reject: (e: unknown) => unknown) => Promise.resolve().then(() => {
    calls.push(structuredClone(q));
    if (q.operation === 'insert' && table === 'lead_messages' && failInsertMessage) { failInsertMessage = false; return { data: null, error: { code: 'synthetic_failure', message: 'failure after durable inbox' } }; }
    if (q.operation === 'update' && table === 'whatsapp_accounts' && failAccountUpdate) return { data: null, error: { code: 'synthetic_failure' } };
    const rows = tables[table] ?? (tables[table] = []);
    let selected = rows.filter(row => q.filters.every(([method, key, value]: any[]) => method === 'in' ? value.includes(row[key]) : method === 'lte' ? row[key] <= value : row[key] === value));
    if (q.operation === 'update') for (const row of selected) Object.assign(row, q.value);
    if (q.operation === 'insert') { const row = { id: 'f1111111-1111-4111-8111-111111111111', ...q.value }; rows.push(row); selected = [row]; }
    if (q.operation === 'upsert') {
      const keys = (q.options?.onConflict ?? 'id').split(',');
      const existing = rows.find(row => keys.every((key: string) => row[key] === q.value[key]));
      if (existing && q.options?.ignoreDuplicates) selected = [];
      else if (existing) { Object.assign(existing, q.value); selected = [existing]; }
      else { const row = { id: 'f1111111-1111-4111-8111-111111111111', ...q.value }; rows.push(row); selected = [row]; }
    }
    return { data: q.single ? selected[0] ?? null : selected, count: selected.length, error: null };
  }).then(resolve, reject);
  return c;
}

function request(action: string, worker = false) {
  return new Request('https://example.invalid/function', { method: 'POST', headers: { Authorization: 'Bearer synthetic-service', 'Content-Type': 'application/json' }, body: JSON.stringify(worker ? { event_id: ids.event } : { action, account_id: ids.account }) });
}

beforeEach(() => {
  vi.resetModules(); calls = []; failInsertMessage = false; failAccountUpdate = false;
  tables = {
    profiles: [{ id: ids.user, active_organization_id: ids.org, name: 'Synthetic owner' }],
    organization_members: [{ organization_id: ids.org, user_id: ids.user, status: 'active' }],
    whatsapp_accounts: [{ id: ids.account, organization_id: ids.org, owner_user_id: ids.user, integration_id: ids.integration, provider: 'wa_akg', account_type: 'seller', enabled: true, connection_status: 'connected', archived_at: null }],
    integrations: [{ id: ids.integration, organization_id: ids.org, configuration: { session_name: 'seller_synthetic' }, enabled: true, connected: true, paused: false }],
    messaging_provider_controls: [{ organization_id: ids.org, provider: 'wa_akg', inbound_enabled: true, send_enabled: true, automation_enabled: true, kill_switch: false }],
    leads: [{ id: ids.lead, organization_id: ids.org, modo_atendimento: 'ia', ai_paused: false, automation_status: 'running' }],
    wa_akg_webhook_events: [{ id: ids.event, organization_id: ids.org, whatsapp_account_id: ids.account, integration_id: ids.integration, event_kind: 'inbound', processing_status: 'queued', attempt_count: 0, next_retry_at: '2026-01-01T00:00:00Z', sanitized_payload: { message_id: 'message-synthetic', phone: '5511999990000', text: 'Mensagem sintética', message_type: 'text', occurred_at: '2026-10-05T12:00:00Z' } }],
  };
  state.admin = { from: query, rpc: async (name: string) => {
    calls.push({ rpc: name });
    return { error: null, data: name === 'read_integration_secret' ? { session_id: 'seller_synthetic', webhook_secret: 'synthetic-secret-no-real-value', access_token: 'synthetic', phone_number_id: '123456789', graph_api_version: 'v23.0' } : name === 'resolve_whatsapp_lead_for_account' ? [{ lead_id: ids.lead, reason: 'account_history_identity' }] : [] };
  } };
  vi.stubGlobal('Deno', { env: { get: (name: string) => ({ SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service', WA_AKG_ALLOWED_ORIGINS: 'https://wa.example.invalid', WA_AKG_BASE_URL: 'https://wa.example.invalid', WA_AKG_API_KEY: 'synthetic', META_WORKER_TOKEN: 'synthetic-worker' } as Row)[name] }, serve: (callback: typeof handler) => { handler = callback; } });
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { status: 'CONNECTED' }, ok: true }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

describe('V3 desired invariants — failures preserve audit evidence, not product changes', () => {
  it('T-MSG-001 seller activation must preserve an administrative kill switch', async () => {
    Object.assign(tables.messaging_provider_controls[0], { inbound_enabled: false, send_enabled: false, automation_enabled: false, kill_switch: true, reason: 'admin_emergency' });
    await import('../../../../../supabase/functions/wa-akg/index.ts');
    await handler(request('activate'));
    expect(tables.messaging_provider_controls[0].kill_switch).toBe(true);
  });
  it('T-MSG-002 disconnect must block local dispatch even when provider is unavailable', async () => {
    fetchMock.mockRejectedValue(new Error('synthetic_provider_unavailable'));
    await import('../../../../../supabase/functions/wa-akg/index.ts');
    await handler(request('disconnect'));
    expect(tables.whatsapp_accounts[0].enabled).toBe(false);
  });
  it('T-MSG-003 activation must not report success after account persistence fails', async () => {
    failAccountUpdate = true;
    await import('../../../../../supabase/functions/wa-akg/index.ts');
    const response = await handler(request('activate'));
    expect(response.status).not.toBe(200);
  });
  it('T-MSG-004 official receipt keyId must resolve to the receipt message', () => {
    expect(parseWaAkgEvent({ event: 'message.status', sessionId: 'seller_synthetic', timestamp: '2026-10-05T12:00:00Z', data: { keyId: 'message-synthetic', status: 'READ' } })).toMatchObject({ kind: 'receipt', providerMessageIds: ['message-synthetic'], status: 'read' });
  });
  it('T-MSG-005 distinct delivered/read updates must have distinct inbox identities', () => {
    const payload = { event: 'message.status', sessionId: 'seller_synthetic', timestamp: '2026-10-05T12:00:00Z', data: { key: { id: 'message-synthetic' }, status: 'DELIVERED' } };
    expect(parseWaAkgEvent(payload).externalId).not.toBe(parseWaAkgEvent({ ...payload, data: { ...payload.data, status: 'READ' } }).externalId);
  });
  it('T-MSG-006 LID without explicit phone mapping must not be interpreted as a phone', () => {
    const value = parseWaAkgEvent({ event: 'message.received', data: { key: { id: 'lid-message', remoteJid: '1234567890123@lid' }, content: 'Olá' } });
    expect(value.kind).toBe('ignored');
  });
  it('T-MSG-007 media without caption must preserve an attachment reference for review', () => {
    const value = sanitizeWaAkgPayload({ event: 'message.received', data: { key: { id: 'audio-message', remoteJid: '5511999990000@s.whatsapp.net' }, type: 'AUDIO', fileUrl: '/api/media/synthetic.mp3' } });
    expect(JSON.stringify(value)).toContain('synthetic.mp3');
  });
  it('T-MSG-008 retry after inbox persistence must complete the missing message stage', async () => {
    failInsertMessage = true;
    await import('../../../../../supabase/functions/wa-akg-worker/index.ts');
    await handler(request('', true));
    expect(tables.wa_akg_webhook_events[0].processing_status).toBe('failed');
    tables.wa_akg_webhook_events[0].next_retry_at = '2026-01-01T00:00:00Z';
    await handler(request('', true));
    expect(tables.wa_akg_webhook_events[0]).toMatchObject({ processing_status: 'processed', error_code: 'duplicate_inbound' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(tables.lead_messages ?? []).toHaveLength(1);
  });
  it('T-MSG-009 receipts for disabled transport must still reconcile history', async () => {
    tables.whatsapp_accounts[0].enabled = false;
    Object.assign(tables.wa_akg_webhook_events[0], { event_kind: 'receipt', sanitized_payload: { provider_message_ids: ['message-synthetic'], status: 'read', occurred_at: '2026-10-05T12:00:00Z' } });
    await import('../../../../../supabase/functions/wa-akg-worker/index.ts');
    await handler(request('', true));
    expect(calls.some(call => call.rpc === 'reconcile_whatsapp_receipt')).toBe(true);
  });
  it('T-MSG-010 recovered connection must not re-enable a disabled account', async () => {
    tables.whatsapp_accounts[0].enabled = false;
    Object.assign(tables.wa_akg_webhook_events[0], { event_kind: 'connection', sanitized_payload: { state: 'connected' } });
    await import('../../../../../supabase/functions/wa-akg-worker/index.ts');
    await handler(request('', true));
    expect(tables.whatsapp_accounts[0]).toMatchObject({ enabled: false, connection_status: 'connected' });
  });
  it('T-MSG-011 stale processing events must be recovered after worker interruption', async () => {
    Object.assign(tables.wa_akg_webhook_events[0], { processing_status: 'processing', updated_at: '2026-01-01T00:00:00Z' });
    await import('../../../../../supabase/functions/wa-akg-worker/index.ts');
    await handler(request('', true));
    expect(tables.wa_akg_webhook_events[0].processing_status).not.toBe('processing');
  });
  it('T-MSG-012 newer deactivate must prevail over an older pending activation', async () => {
    let releaseStatus!: () => void;
    let statusReached!: () => void;
    const reached = new Promise<void>(resolve => { statusReached = resolve; });
    fetchMock.mockImplementation(() => { statusReached(); return new Promise<Response>(resolve => { releaseStatus = () => resolve(new Response(JSON.stringify({ data: { status: 'CONNECTED' } }), { status: 200 })); }); });
    await import('../../../../../supabase/functions/wa-akg/index.ts');
    const older = handler(request('activate'));
    await reached;
    await handler(request('deactivate'));
    expect(tables.whatsapp_accounts[0].enabled).toBe(false);
    releaseStatus();
    await older;
    expect(tables.whatsapp_accounts[0].enabled).toBe(false);
  });
  it('T-MSG-013 ambiguous Meta send must not be dispatched again without reconciliation', async () => {
    tables.organization_feature_flags = [{ organization_id: ids.org, flag_key: 'meta_coexistence', enabled: true }];
    tables.messaging_provider_controls[0].provider = 'meta_cloud';
    tables.whatsapp_accounts[0].provider = 'meta_cloud';
    tables.leads[0].whatsapp_account_id = ids.account;
    tables.whatsapp_conversations = [{ organization_id: ids.org, whatsapp_account_id: ids.account, lead_id: ids.lead, last_inbound_at: new Date().toISOString() }];
    tables.messaging_outbox = [{ id: ids.event, organization_id: ids.org, whatsapp_account_id: ids.account, lead_id: ids.lead, origin: 'human', message_kind: 'text', content: { text: 'Sintética' }, recipient_identity: '5511999990000', idempotency_key: 'synthetic-outbox', status: 'queued', run_at: '2026-01-01T00:00:00Z', attempt_count: 0 }];
    fetchMock.mockRejectedValue(new DOMException('response lost after possible provider acceptance', 'TimeoutError'));
    await import('../../../../../supabase/functions/meta-whatsapp-worker/index.ts');
    const workerRequest = () => new Request('https://example.invalid/meta-worker', { method: 'POST', headers: { 'x-meta-worker-token': 'synthetic-worker', 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: ids.event }) });
    await handler(workerRequest());
    expect(tables.messaging_outbox[0].status).toBe('failed');
    tables.messaging_outbox[0].run_at = '2026-01-01T00:00:00Z';
    await handler(workerRequest());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
