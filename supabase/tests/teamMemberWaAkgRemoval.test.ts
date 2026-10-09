import { beforeEach, describe, expect, it, vi } from 'vitest';

const organizationId = 'a1ea4d91-3d09-4052-9759-3009b442e6cb';
const actorId = '11111111-1111-4111-8111-111111111111';
const memberId = '86457c84-639c-4fb4-9749-6e1af363aa89';
const state = vi.hoisted(() => ({ admin: {} as Record<string, unknown> }));
vi.mock('../functions/_shared/auth.ts', () => ({
  createAdminClient: () => state.admin,
  requireUser: async () => ({ user: { id: actorId } }),
  requireOrganizationPermission: async () => undefined,
}));

let handler: (request: Request) => Promise<Response>;
let rpcCalls: string[];

function queryFor(table: string) {
  const filters: Record<string, unknown> = {};
  let operation = 'select';
  const query: Record<string, unknown> = {};
  query.eq = (key: string, value: unknown) => { filters[key] = value; return query; };
  query.select = () => query;
  query.insert = () => { operation = 'insert'; return query; };
  query.maybeSingle = async () => {
    if (operation === 'insert') return { data: {}, error: null };
    if (table === 'profiles') return { data: { active_organization_id: organizationId }, error: null };
    if (table === 'organization_members') return { data: { role: 'administrador', status: 'active' }, error: null };
    if (table === 'team_member_wa_akg_removal_claims') return { data: null, error: null };
    return { data: null, error: null };
  };
  return query;
}

beforeEach(() => {
  vi.resetModules();
  rpcCalls = [];
  state.admin = {
    from: queryFor,
    storage: { from: () => ({ remove: async () => ({ error: null }) }) },
    rpc: async (name: string) => {
      rpcCalls.push(name);
      if (name === 'team_member_identity_erasure_preflight' || name === 'team_member_shared_data_preflight') return { data: { ready: true }, error: null };
      if (name === 'team_member_wa_akg_remove_finalize') return { data: { membership_removed: true, history_preserved: true }, error: null };
      if (name === 'list_user_owned_storage') return { data: [], error: null };
      if (name === 'revoke_user_auth_sessions') return { data: 1, error: null };
      if (name === 'team_member_wa_akg_identity_erasure_finalize') return { data: { identity_deleted: true }, error: null };
      return { data: null, error: { message: 'unexpected_rpc' } };
    },
  };
  vi.stubGlobal('Deno', { serve: (callback: typeof handler) => { handler = callback; } });
});

describe('team member WA-AKG removal boundary', () => {
  it('finalizes only the WA-AKG binding before deleting an isolated identity', async () => {
    await import('../functions/team-member-wa-akg-removal/index.ts');
    const response = await handler(new Request('https://example.invalid/team-member-wa-akg-removal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', user_id: memberId }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, membership_removed: true, history_preserved: true, identity_deleted: true });
    expect(rpcCalls).toContain('team_member_wa_akg_remove_finalize');
    expect(rpcCalls).toContain('team_member_wa_akg_identity_erasure_finalize');
  });
});
