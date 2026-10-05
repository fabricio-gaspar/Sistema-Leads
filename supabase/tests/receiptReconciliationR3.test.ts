import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseWaAkgEvent } from '../functions/_shared/waAkgInbound.ts';

// Local contract harness: in-memory Supabase responses and blocked network.
type Row = Record<string, any>;
const ids = {
  org: 'a1111111-1111-4111-8111-111111111111', orgB: 'a2222222-2222-4222-8222-222222222222',
  account: 'b1111111-1111-4111-8111-111111111111', accountB: 'b2222222-2222-4222-8222-222222222222',
  integration: 'c1111111-1111-4111-8111-111111111111', event: 'd1111111-1111-4111-8111-111111111111',
};
const state = vi.hoisted(() => ({ admin: {} as Row }));
vi.mock('../functions/_shared/auth.ts', () => ({ createAdminClient: () => state.admin }));
let tables: Record<string, Row[]>;
let handler: (r: Request) => Promise<Response>;
let calls: Row[];
let fetchMock: ReturnType<typeof vi.fn>;
let receiptResult: Row[];
let beforeAccountUpdate: (() => void) | undefined;
const secret = 'synthetic-signing-secret';
const session = 'synthetic-session';

function query(table: string) {
  const q: Row = { table, operation: 'select', filters: [], single: false };
  const chain: Row = {};
  for (const method of ['eq', 'is', 'in', 'lte']) chain[method] = (key: string, value: unknown) => {
    q.filters.push([method, key, value]); return chain;
  };
  chain.select = chain.order = chain.limit = () => chain;
  chain.maybeSingle = chain.single = () => { q.single = true; return chain; };
  for (const method of ['insert', 'update', 'upsert']) chain[method] = (value: Row, options?: Row) => {
    Object.assign(q, { operation: method, value, options }); return chain;
  };
  chain.then = (resolve: (v: Row) => unknown, reject: (e: unknown) => unknown) => Promise.resolve().then(() => {
    calls.push(structuredClone(q));
    if (table === 'whatsapp_accounts' && q.operation === 'update' && beforeAccountUpdate) {
      const callback = beforeAccountUpdate; beforeAccountUpdate = undefined; callback();
    }
    const rows = tables[table] ?? (tables[table] = []);
    let selected = rows.filter(row => q.filters.every(([method, key, value]: any[]) =>
      method === 'in' ? value.includes(row[key]) : method === 'lte' ? row[key] <= value : row[key] === value));
    if (q.operation === 'update') selected.forEach(row => Object.assign(row, q.value));
    if (q.operation === 'insert') {
      const row = { id: crypto.randomUUID(), ...q.value }; rows.push(row); selected = [row];
    }
    if (q.operation === 'upsert') {
      const keys = (q.options?.onConflict ?? 'id').split(',');
      const existing = rows.find(row => keys.every((key: string) => row[key] === q.value[key]));
      if (existing && q.options?.ignoreDuplicates) selected = [];
      else if (existing) { Object.assign(existing, q.value); selected = [existing]; }
      else { const row = { id: crypto.randomUUID(), ...q.value }; rows.push(row); selected = [row]; }
    }
    return { data: structuredClone(q.single ? selected[0] ?? null : selected), error: null };
  }).then(resolve, reject);
  return chain;
}

beforeEach(() => {
  vi.resetModules(); calls = []; beforeAccountUpdate = undefined;
  receiptResult = [{ current_status: 'read', changed: true }];
  tables = {
    whatsapp_accounts: [{ id: ids.account, organization_id: ids.org, integration_id: ids.integration,
      provider: 'wa_akg', enabled: false, connection_status: 'disconnected', archived_at: null }],
    integrations: [{ id: ids.integration, organization_id: ids.org, provider: 'WA-AKG', enabled: false,
      connected: false, paused: true }],
    messaging_provider_controls: [{ organization_id: ids.org, provider: 'wa_akg',
      inbound_enabled: false, send_enabled: false, automation_enabled: false, kill_switch: true }],
  };
  state.admin = { from: query, rpc: async (name: string, args: Row) => {
    calls.push({ rpc: name, args });
    const event = tables[`${args.p_provider}_webhook_events`]?.find(row => row.id === args.p_event_id);
    if (name === 'claim_whatsapp_webhook_event') {
      if (!event || event.processing_status !== 'queued') return { error: null, data: null };
      Object.assign(event, { processing_status: 'processing', lease_id: 'synthetic-lease' });
      return { error: null, data: structuredClone(event) };
    }
    if (name === 'finish_whatsapp_webhook_event') {
      Object.assign(event ?? {}, { processing_status: args.p_state, error_code: args.p_error_code });
      return { error: null, data: true };
    }
    if (name === 'persist_whatsapp_inbound') {
      Object.assign(event ?? {}, { processing_status: 'ignored', error_code: 'whatsapp_inbound_route_disabled' });
      return { error: null, data: { review: true, reason: 'whatsapp_inbound_route_disabled' } };
    }
    return { error: null, data: name === 'read_integration_secret'
      ? { webhook_secret: secret, webhook_token: secret, session_id: session }
      : name === 'reconcile_whatsapp_receipt_for_account' ? receiptResult : [] };
  } };
  vi.stubGlobal('Deno', { env: { get: (name: string) => ({
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service', SUPABASE_URL: 'https://example.invalid',
  } as Row)[name] }, serve: (callback: typeof handler) => { handler = callback; } });
  vi.stubGlobal('EdgeRuntime', { waitUntil: () => undefined });
  fetchMock = vi.fn(async () => { throw new Error('network_disabled_by_test'); });
  vi.stubGlobal('fetch', fetchMock);
});

function workerRequest(auth = 'synthetic-service') {
  return new Request('https://example.invalid/worker', { method: 'POST', headers: { Authorization: `Bearer ${auth}` },
    body: JSON.stringify({ event_id: ids.event }) });
}

function seedEvent(provider: 'wa_akg' | 'evolution_go', kind = 'receipt') {
  tables.whatsapp_accounts[0].provider = provider;
  tables.messaging_provider_controls[0].provider = provider;
  tables.integrations[0].provider = provider === 'wa_akg' ? 'WA-AKG' : 'Evolution GO';
  const event = { id: ids.event, organization_id: ids.org, whatsapp_account_id: ids.account,
    integration_id: ids.integration, event_kind: kind, processing_status: 'queued', attempt_count: 0,
    next_retry_at: '2026-01-01T00:00:00Z', sanitized_payload: {
      provider_message_ids: ['historical-id'], status: 'read', occurred_at: '2026-10-05T12:00:00Z',
      timestamp: '2026-10-05T12:00:00Z', message_id: 'incoming-id', phone: '5511999990000',
      remote_jid: '5511999990000@s.whatsapp.net', text: 'Synthetic inbound',
    } };
  tables[`${provider}_webhook_events`] = [event];
  return event;
}

async function loadWorker(provider: 'wa_akg' | 'evolution_go') {
  if (provider === 'wa_akg') await import('../functions/wa-akg-worker/index.ts');
  else await import('../functions/evolution-go-worker/index.ts');
}

function receiptPayload(status = 'READ') {
  return { event: 'message.status', sessionId: session, timestamp: '2026-10-05T12:00:00Z',
    data: { keyId: 'historical-id', status } };
}

async function signedWaRequest(payload: Row, signatureOverride?: string) {
  const raw = JSON.stringify(payload);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const hex = Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
  return new Request(`https://example.invalid/webhook?integration_id=${ids.integration}`, {
    method: 'POST', headers: { 'x-webhook-signature': signatureOverride ?? `sha256=${hex}` }, body: raw,
  });
}

describe('R3 receipt parser and authenticated intake', () => {
  it('T-R3-001 official keyId parses and delivered/read have distinct canonical identities', () => {
    const read = parseWaAkgEvent(receiptPayload());
    expect(read).toMatchObject({ kind: 'receipt', providerMessageIds: ['historical-id'], status: 'read' });
    expect(read.externalId).not.toBe(parseWaAkgEvent(receiptPayload('DELIVERED')).externalId);
    expect(read.externalId).toBe(parseWaAkgEvent({ ...receiptPayload(), timestamp: '2026-10-06T12:00:00Z' }).externalId);
  });

  it('T-R3-010 pending or unknown statuses never fabricate provider acceptance', () => {
    for (const status of ['PENDING', 'NOT_READ', 'UNKNOWN', '']) {
      expect(parseWaAkgEvent(receiptPayload(status))).toMatchObject({ kind: 'ignored', reason: 'receipt_status_unsupported' });
    }
  });

  it('T-R3-002 HMAC-valid paused intake stores read/delivered once each without opening gates', async () => {
    await import('../functions/webhook-wa-akg/index.ts');
    for (const status of ['READ', 'READ', 'DELIVERED', 'DELIVERED']) {
      expect((await handler(await signedWaRequest(receiptPayload(status)))).status).toBe(202);
    }
    expect(tables.wa_akg_webhook_events).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2); // only durable worker wakeups; never Ana/send
    expect(fetchMock.mock.calls.every(([url]) => String(url).endsWith('/wa-akg-worker'))).toBe(true);
    expect(tables.whatsapp_accounts[0].enabled).toBe(false);
    expect(tables.messaging_provider_controls[0].kill_switch).toBe(true);
  });

  it('T-R3-003 wrong HMAC or session cannot persist a receipt', async () => {
    await import('../functions/webhook-wa-akg/index.ts');
    expect((await handler(await signedWaRequest(receiptPayload(), 'wrong'))).status).toBe(401);
    expect((await handler(await signedWaRequest({ ...receiptPayload(), sessionId: 'another-session' }))).status).toBe(403);
    expect(tables.wa_akg_webhook_events ?? []).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe.each(['wa_akg', 'evolution_go'] as const)('R3 %s reconciliation-only worker', provider => {
  it('T-R2-R3-001 connected callback never restores intent captured before a concurrent cutoff', async () => {
    const event = seedEvent(provider, 'connection'); event.sanitized_payload = { state:'connected' };
    Object.assign(tables.whatsapp_accounts[0], { enabled:true, connection_status:'connected' });
    Object.assign(tables.integrations[0], { enabled:true, connected:true, paused:false });
    beforeAccountUpdate = () => {
      tables.whatsapp_accounts[0].enabled = false;
      Object.assign(tables.integrations[0], { enabled:false, paused:true });
    };
    await loadWorker(provider); await handler(workerRequest());
    expect(event.processing_status).toBe('processed');
    expect(tables.whatsapp_accounts[0]).toMatchObject({ enabled:false, connection_status:'connected' });
    expect(tables.integrations[0]).toMatchObject({ enabled:false, paused:true, connected:true });
    for (const call of calls.filter(call => call.operation === 'update' && ['whatsapp_accounts','integrations'].includes(call.table))) {
      expect(call.value).not.toHaveProperty('enabled'); expect(call.value).not.toHaveProperty('paused');
    }
    expect(tables.messaging_provider_controls[0].kill_switch).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('T-R2-R3-002 disconnected callback closes both local transport gates', async () => {
    const event = seedEvent(provider, 'connection'); event.sanitized_payload = { state:'disconnected' };
    Object.assign(tables.whatsapp_accounts[0], { enabled:true, connection_status:'connected' });
    Object.assign(tables.integrations[0], { enabled:true, connected:true, paused:false });
    await loadWorker(provider); await handler(workerRequest());
    expect(tables.whatsapp_accounts[0]).toMatchObject({ enabled:false, connection_status:'disconnected' });
    expect(tables.integrations[0]).toMatchObject({ enabled:false, paused:true, connected:false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('T-R3-004 paused receipt uses exact org/account and never dispatches Ana/output', async () => {
    const event = seedEvent(provider);
    const before = structuredClone({ account: tables.whatsapp_accounts, integration: tables.integrations, controls: tables.messaging_provider_controls });
    await loadWorker(provider); await handler(workerRequest());
    expect(event.processing_status).toBe('processed');
    expect(calls.find(call => call.rpc === 'reconcile_whatsapp_receipt_for_account')?.args).toMatchObject({
      p_organization_id: ids.org, p_whatsapp_account_id: ids.account, p_status: 'read',
    });
    expect({ account: tables.whatsapp_accounts, integration: tables.integrations, controls: tables.messaging_provider_controls }).toEqual(before);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls.filter(call => call.operation && call.operation !== 'select').every(call => call.table === `${provider}_webhook_events`)).toBe(true);
    await handler(workerRequest());
    expect(calls.filter(call => call.rpc === 'reconcile_whatsapp_receipt_for_account')).toHaveLength(1);
  });

  it.each(['organization_id', 'integration_id', 'whatsapp_account_id'])('T-R3-005 ownership mismatch %s rejects reconciliation', async key => {
    const event = seedEvent(provider); event[key] = ids.orgB;
    await loadWorker(provider); await handler(workerRequest());
    expect(calls.some(call => call.rpc === 'reconcile_whatsapp_receipt_for_account')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('T-R3-006 unknown message remains reviewable without creating output', async () => {
    receiptResult = []; const event = seedEvent(provider);
    await loadWorker(provider); await handler(workerRequest());
    expect(event).toMatchObject({ processing_status: 'needs_review', error_code: 'outbound_message_not_matched' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('T-R3-011 partial batch stays reviewable and deduplicates IDs before reconciliation', async () => {
    const event = seedEvent(provider);
    event.sanitized_payload.provider_message_ids = ['historical-id', 'historical-id', 'unknown'];
    await loadWorker(provider); await handler(workerRequest());
    expect(event).toMatchObject({ processing_status: 'needs_review', error_code: 'receipt_targets_pending' });
    expect(calls.find(call => call.rpc === 'reconcile_whatsapp_receipt_for_account')?.args).toMatchObject({
      p_expected_message_count: 2, p_provider_message_ids: ['historical-id', 'unknown'],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('T-R3-007 unauthenticated worker and paused inbound do not reconcile or execute Ana', async () => {
    const event = seedEvent(provider, 'inbound');
    await loadWorker(provider);
    expect((await handler(workerRequest('invalid'))).status).toBe(401);
    expect(event.processing_status).toBe('queued');
    await handler(workerRequest());
    expect(event.processing_status).toBe('ignored');
    expect(calls.some(call => call.rpc === 'reconcile_whatsapp_receipt_for_account')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('R3 Evolution authenticated intake', () => {
  function evolutionRequest(payload: Row, token = secret) {
    return new Request(`https://example.invalid/webhook?integration_id=${ids.integration}&token=${token}`, { method: 'POST', body: JSON.stringify(payload) });
  }
  it('T-R3-012 paused Evolution receipt is persisted; duplicates collapse; normal inbound stays blocked', async () => {
    tables.integrations[0].provider = 'Evolution GO'; tables.whatsapp_accounts[0].provider = 'evolution_go';
    tables.messaging_provider_controls[0].provider = 'evolution_go';
    await import('../functions/webhook-evolution-go/index.ts');
    for (const status of ['read','read','delivered']) {
      expect(await (await handler(evolutionRequest({ event:'receipt', data:{ id:'historical-id', status } }))).json()).toMatchObject({ accepted:true });
    }
    expect(tables.evolution_go_webhook_events).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => String(url).endsWith('/evolution-go-worker'))).toBe(true);
    const inbound = { event:'message', data:{ key:{ id:'incoming', fromMe:false, remoteJid:'5511999990000@s.whatsapp.net' }, message:{ conversation:'synthetic' } } };
    expect(await (await handler(evolutionRequest(inbound))).json()).toMatchObject({ ignored:true, reason:'evolution_go_account_disabled' });
    expect(tables.evolution_go_webhook_events).toHaveLength(2);
    expect((await handler(evolutionRequest({ event:'receipt', data:{ id:'historical-id', status:'read' } }, 'bad'))).status).toBe(401);
    expect(tables.whatsapp_accounts[0].enabled).toBe(false);
    expect(tables.messaging_provider_controls[0].kill_switch).toBe(true);
  });
});

describe('R3 Z-API receipt intake', () => {
  function zapiRequest(payload: Row, token = secret) {
    return new Request(`https://example.invalid/webhook?integration_id=${ids.integration}&token=${token}`, { method: 'POST', body: JSON.stringify(payload) });
  }
  it('T-R3-008 disabled provider accepts authenticated receipt once for exact account', async () => {
    tables.integrations[0].provider = 'zapi'; tables.whatsapp_accounts[0].provider = 'zapi'; tables.messaging_provider_controls[0].provider = 'zapi';
    await import('../functions/webhook-whatsapp/index.ts');
    const payload = { type: 'MessageStatusCallback', messageId: 'historical-id', status: 'READ' };
    expect((await handler(zapiRequest(payload))).status).toBe(200);
    expect(await (await handler(zapiRequest(payload))).json()).toMatchObject({ duplicate: true });
    expect(calls.filter(call => call.rpc === 'reconcile_whatsapp_receipt_for_account')).toHaveLength(1);
    expect(calls.find(call => call.rpc === 'reconcile_whatsapp_receipt_for_account')?.args).toMatchObject({ p_whatsapp_account_id: ids.account, p_organization_id: ids.org });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(tables.messaging_provider_controls[0].kill_switch).toBe(true);
  });
  it('T-R3-009 invalid credential or disabled inbound cannot write business state', async () => {
    tables.integrations[0].provider = 'zapi'; tables.messaging_provider_controls[0].provider = 'zapi';
    await import('../functions/webhook-whatsapp/index.ts');
    expect((await handler(zapiRequest({ type: 'MessageStatusCallback', messageId: 'x', status: 'READ' }, 'bad'))).status).toBe(401);
    expect(await (await handler(zapiRequest({ messageId: 'new', phone: '5511999990000', text: { message: 'synthetic' } }))).json()).toMatchObject({ ignored: true });
    expect(calls.some(call => call.operation && call.operation !== 'select')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
