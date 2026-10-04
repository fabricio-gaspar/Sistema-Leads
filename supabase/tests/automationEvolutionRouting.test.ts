import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
type Result = { data: unknown; error: null };

const organizationId = 'a1111111-1111-4111-8111-111111111111';
const leadId = 'b1111111-1111-4111-8111-111111111111';
const integrationId = 'c1111111-1111-4111-8111-111111111111';
const accountId = 'd1111111-1111-4111-8111-111111111111';
const alternateIntegrationId = 'e1111111-1111-4111-8111-111111111111';
const alternateAccountId = 'f1111111-1111-4111-8111-111111111111';

const state = vi.hoisted(() => ({ admin: {} as object }));
vi.mock('../functions/_shared/auth.ts', () => ({
  createAdminClient: () => state.admin,
  requireOrganizationRole: async () => undefined,
  requireUser: async () => ({ user: { id: 'synthetic-user' } }),
}));

let canonicalAccount: Row;
let controls: Row;
let handler: (request: Request) => Promise<Response>;

const ok = (data: unknown): Result => ({ data, error: null });

function queryFor(table: string) {
  const filters: Row = {};
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = (key: string, value: unknown) => { filters[key] = value; return chain; };
  chain.is = () => chain;
  chain.in = () => chain;
  chain.limit = () => chain;
  chain.order = () => chain;
  chain.maybeSingle = () => chain;
  chain.then = (resolve: (result: Result) => unknown, reject: (error: unknown) => unknown) => {
    let data: unknown = null;
    if (table === 'leads') data = {
      id: leadId, owner_id: 'owner', modo_atendimento: 'ia', ai_paused: false,
      opt_out: false, contact_approval_status: 'approved', last_contact: null, no_reply_deadline_at: null,
    };
    if (table === 'company_settings') data = { active: true, sandbox_mode: false, can_use_ia: true, ai_actions_enabled: true };
    if (table === 'organization_module_data') data = { data: { killSwitchGlobal: false } };
    if (table === 'integrations') data = filters.key === 'ai'
      ? { enabled: true, connected: true, paused: false }
      : { id: integrationId, enabled: true, connected: true, paused: false };
    if (table === 'lead_handoffs') data = null;
    if (table === 'whatsapp_accounts') data = {
      id: accountId, integration_id: integrationId, provider: 'evolution_go', enabled: true, connection_status: 'connected',
    };
    if (table === 'messaging_provider_controls') data = controls;
    return Promise.resolve(ok(data)).then(resolve, reject);
  };
  return chain;
}

beforeEach(() => {
  vi.resetModules();
  canonicalAccount = { account_id: accountId, integration_id: integrationId };
  controls = { inbound_enabled: true, send_enabled: true, automation_enabled: true, kill_switch: false };
  state.admin = {
    from: queryFor,
    rpc: async (name: string) => name === 'resolve_lead_whatsapp_account' ? ok([canonicalAccount]) : ok({}),
  };
  vi.stubGlobal('Deno', { env: { get: () => undefined }, serve: (callback: typeof handler) => { handler = callback; } });
});

afterEach(() => vi.unstubAllGlobals());

async function dispatchBlock() {
  const { automaticDispatchBlock } = await import('../functions/automation-worker/index');
  return automaticDispatchBlock(state.admin as never, {
    organizationId,
    leadId,
    channel: 'whatsapp',
    expectedLastContact: null,
    expectedIntegrationId: integrationId,
    expectedWhatsappAccountId: accountId,
  });
}

describe('Evolution GO automatic dispatch routing', () => {
  it('uses the account-specific Evolution integration instead of a legacy generic WhatsApp integration', async () => {
    await expect(dispatchBlock()).resolves.toBeNull();
  });

  it('blocks automatic sending if the lead now resolves to another seller account', async () => {
    canonicalAccount = { account_id: alternateAccountId, integration_id: alternateIntegrationId };

    await expect(dispatchBlock()).resolves.toBe('whatsapp_account_changed');
  });

  it('keeps Ana from sending when the Evolution automation controls are closed', async () => {
    controls = { inbound_enabled: true, send_enabled: true, automation_enabled: false, kill_switch: false };

    await expect(dispatchBlock()).resolves.toBe('evolution_go_automation_not_ready');
  });
});
