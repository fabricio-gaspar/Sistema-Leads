import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContextStore } from '@/lib/contextStore';
import { broadcastContextInvalidation, createSessionContext, listenForContextInvalidation, sessionContext, type SessionContext } from '@/lib/sessionContext';
import { createBackendStore } from '@/lib/backendStore';
import { clearCurrentAccess, loadCurrentAccess } from '@/lib/crm/currentAccessRepository';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { loadOperationalStatus } from '@/lib/crm/operationalDiagnosticsRepository';
import { loadWhatsappAccounts } from '@/lib/crm/whatsappAccountsRepository';
import { scopedPreferenceKey } from '@/hooks/useLocalStorageState';

const remote = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), getUser: vi.fn(), invoke: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: remote.rpc, from: remote.from, auth: { getUser: remote.getUser }, functions: { invoke: remote.invoke } } }));
vi.mock('@/lib/transportador', () => ({ detalheDoErroDeFuncao: vi.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function ready(user = 'user-A', org = 'org-A') {
  return sessionContext.confirm(sessionContext.replace(user), user, org);
}
const cleanups: Array<() => void> = [];
function store(load: (context: SessionContext) => Promise<string[]>, save = vi.fn(async (_before: string[], next: string[]) => next)) {
  const result = createContextStore({ initial: () => [] as string[], load, save });
  cleanups.push(result.dispose);
  return result;
}
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

beforeEach(() => { vi.resetAllMocks(); sessionContext.replace(null); });
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.unstubAllGlobals(); });

describe('R5 — generation fence and operational stores (runtime, synthetic)', () => {
  it('T-R5-037: read started during save cannot overwrite the later acknowledged write', async () => {
    ready(); const saving = deferred<string[]>(); const staleRead = deferred<string[]>();
    const load = vi.fn().mockResolvedValueOnce([]).mockReturnValueOnce(staleRead.promise);
    const state = store(load, vi.fn(() => saving.promise)); await state.refresh();
    const write = state.update(() => ['acknowledged']); await flush(); const read = state.refresh();
    saving.resolve(['acknowledged']); await write; staleRead.resolve(['old']); await read;
    expect(state.get()).toEqual(['acknowledged']); expect(state.getSnapshot().status).toBe('ready');
  });
  it.each([false, true])('T-R5-034: serial updates use the acknowledged predecessor (optimistic=%s)', async (optimistic) => {
    ready(); const first = deferred<{ a: number; b: number }>();
    const save = vi.fn().mockImplementationOnce(() => first.promise).mockImplementation(async (_previous, next) => next);
    const state = createContextStore({ initial: () => ({ a: 0, b: 0 }), load: async () => ({ a: 0, b: 0 }), save, optimistic });
    cleanups.push(state.dispose); await state.refresh();
    const a = state.update((previous) => ({ ...previous, a: 1 }));
    const b = state.update((previous) => ({ ...previous, b: 1 }));
    await flush(); expect(save).toHaveBeenCalledTimes(1);
    first.resolve({ a: 1, b: 0 }); await a; await b; await state.wait();
    expect(save.mock.calls[1].slice(0, 2)).toEqual([{ a: 1, b: 0 }, { a: 1, b: 1 }]);
    expect(state.get()).toEqual({ a: 1, b: 1 }); expect(state.getSnapshot().saving).toBe(false);
  });
  it.each([false, true])('T-R5-035: a failed predecessor cancels dependent writes and retains the error (optimistic=%s)', async (optimistic) => {
    ready(); const first = deferred<{ a: number; b: number }>();
    const save = vi.fn(() => first.promise); const secondUpdater = vi.fn((previous: { a: number; b: number }) => ({ ...previous, b: 1 }));
    const state = createContextStore({ initial: () => ({ a: 0, b: 0 }), load: async () => ({ a: 0, b: 0 }), save, optimistic });
    cleanups.push(state.dispose); await state.refresh();
    const a = state.update((previous) => ({ ...previous, a: 1 })); const b = state.update(secondUpdater);
    const aFailed = expect(a).rejects.toThrow('first_write_failed'); const bFailed = expect(b).rejects.toThrow('queued_write_cancelled_after_failure');
    await flush(); first.reject(new Error('first_write_failed')); await aFailed; await bFailed;
    await expect(state.wait()).rejects.toThrow('first_write_failed');
    expect(save).toHaveBeenCalledTimes(1); expect(secondUpdater).not.toHaveBeenCalled();
    expect(state.get()).toEqual({ a: 0, b: 0 }); expect(state.getSnapshot().status).toBe('error');
    expect(() => state.update(secondUpdater)).toThrow('store_refresh_required_after_write_failure');
    await state.refresh(); expect(state.getSnapshot().error).toBeNull();
  });
  it('T-R5-001: no read/write or operational seed without a canonical context', async () => {
    const load = vi.fn(async () => ['A']); const save = vi.fn(); const state = store(load, save);
    await state.hydrate();
    expect(state.get()).toEqual([]); expect(load).not.toHaveBeenCalled();
    expect(() => state.update(() => ['unsafe'])).toThrow('organization_context_required');
    expect(save).not.toHaveBeenCalled();
  });
  it.each([['user-B', 'org-B'], ['user-A', 'org-B'], ['user-B', 'org-A']])('T-R5-002: %s/%s clears the previous state synchronously', async (user, org) => {
    ready(); const state = store(async (context) => [context.userId + ':' + context.organizationId]);
    await state.refresh(); expect(state.get()).toEqual(['user-A:org-A']);
    ready(user, org); expect(state.get()).toEqual([]);
    await state.refresh(); expect(state.get()).toEqual([user + ':' + org]);
  });
  it('T-R5-003: a late A read cannot overwrite an already loaded B', async () => {
    ready(); const a = deferred<string[]>(); const state = store((context) => context.userId === 'user-A' ? a.promise : Promise.resolve(['B']));
    const oldRead = state.refresh(); const rejected = expect(oldRead).rejects.toThrow('session_context_changed');
    ready('user-B', 'org-B'); await state.refresh(); a.resolve(['A']); await rejected;
    expect(state.get()).toEqual(['B']); expect(state.getSnapshot().status).toBe('ready');
  });
  it('T-R5-004: logout invalidates pending load/error/finally and data immediately', async () => {
    ready(); const a = deferred<string[]>(); const state = store(() => a.promise);
    const pending = state.refresh(); const failure = expect(pending).rejects.toThrow('old_failure');
    sessionContext.replace(null); a.reject(new Error('old_failure')); await failure;
    expect(state.get()).toEqual([]); expect(state.getSnapshot().error).toBeNull();
  });
  it('T-R5-005: pending writes cannot acknowledge or repopulate a new identity', async () => {
    ready(); const a = deferred<string[]>(); const save = vi.fn(() => a.promise); const state = store(async () => [], save);
    await state.refresh(); const pending = state.update(() => ['A']); const failure = expect(pending).rejects.toThrow('session_context_changed');
    await flush(); expect(save).toHaveBeenCalledOnce(); sessionContext.replace(null);
    ready('user-B', 'org-B'); await state.refresh(); a.resolve(['A']); await failure;
    expect(state.get()).toEqual([]); expect(state.getSnapshot().error).toBeNull();
  });
  it('T-R5-006: queued A writes never start using B credentials/context', async () => {
    ready(); const a = deferred<string[]>(); const save = vi.fn(() => a.promise); const state = store(async () => [], save);
    await state.refresh(); const first = state.update(() => ['first']); const second = state.update(() => ['second']);
    const firstFailure = expect(first).rejects.toThrow('session_context_changed');
    const secondFailure = expect(second).rejects.toThrow('session_context_changed');
    await flush(); ready('user-B', 'org-B'); a.resolve(['first']); await firstFailure; await secondFailure;
    expect(save).toHaveBeenCalledOnce(); expect(state.get()).toEqual([]);
  });
  it('T-R5-007: callbacks retained from a previous render cannot edit a new generation', async () => {
    ready(); const save = vi.fn(async (_p: string[], next: string[]) => next); const state = store(async () => [], save);
    await state.refresh(); const callbackA = state.bindUpdate(); ready('user-B', 'org-B'); await state.refresh();
    expect(() => callbackA(() => ['A payload'])).toThrow('session_context_changed'); expect(save).not.toHaveBeenCalled();
  });
  it('T-R5-008: logout/login with the SAME identity invalidates previous promises', async () => {
    const context = ready(); sessionContext.replace(null); ready();
    expect(sessionContext.isCurrent(context)).toBe(false);
    expect(() => sessionContext.assertCurrent(context)).toThrow('session_context_changed');
  });
  it('T-R5-009: mounted stores rehydrate after ready context without a component remount', async () => {
    ready(); const state = store(async (context) => [context.organizationId!]); const notify = vi.fn();
    const unsubscribe = state.subscribe(notify); cleanups.push(unsubscribe); await flush();
    expect(state.get()).toEqual(['org-A']); ready('user-A', 'org-B'); await flush();
    expect(state.get()).toEqual(['org-B']); expect(notify).toHaveBeenCalled();
  });
  it('T-R5-010: read started before an optimistic mutation cannot erase it', async () => {
    ready(); const a = deferred<string[]>(); const load = vi.fn().mockResolvedValueOnce([]).mockReturnValueOnce(a.promise);
    const state = store(load); await state.refresh(); const refresh = state.refresh(); await state.update(() => ['new']);
    a.resolve(['old']); await refresh; expect(state.get()).toEqual(['new']);
  });
  it('T-R5-011: write failures stay failures after canonical reconciliation', async () => {
    ready(); const load = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(['partial']);
    const state = store(load, vi.fn().mockRejectedValue(new Error('write_failed'))); await state.refresh();
    await expect(state.update(() => ['optimistic'])).rejects.toThrow('write_failed');
    await expect(state.wait()).rejects.toThrow('write_failed'); expect(state.get()).toEqual(['partial']);
  });
});

describe('R5 — untrusted legacy cache and per-context access', () => {
  it('T-R5-031: WhatsApp account read coalescing cannot return a previous tenant account', async () => {
    ready(); const old = deferred<{ data: unknown; error: null }>();
    remote.invoke.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ data: { ok: true, accounts: [{ id: 'B' }] }, error: null });
    const a = loadWhatsappAccounts(); const failure = expect(a).rejects.toThrow('session_context_changed');
    ready('user-B', 'org-B'); expect((await loadWhatsappAccounts()).accounts[0].id).toBe('B');
    old.resolve({ data: { ok: true, accounts: [{ id: 'A' }] }, error: null }); await failure;
    expect(remote.invoke).toHaveBeenCalledTimes(2);
  });
  it('T-R5-032: preferences are partitioned by user and org, never read anonymously', () => {
    expect(scopedPreferenceKey('saved-views', sessionContext.get())).toBeNull();
    const a = scopedPreferenceKey('saved-views', ready());
    const otherOrg = scopedPreferenceKey('saved-views', ready('user-A', 'org-B'));
    const otherUser = scopedPreferenceKey('saved-views', ready('user-B', 'org-A'));
    expect(new Set([a, otherOrg, otherUser]).size).toBe(3);
    expect(scopedPreferenceKey('saved-views', ready())).toBe(a);
  });
  it('T-R5-012 (regression T-UI-008): old localStorage content is never seeded into B', async () => {
    const getItem = vi.fn(() => JSON.stringify(['secret-A'])); const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem, setItem, removeItem: vi.fn() });
    const upsert = vi.fn(); const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), upsert };
    remote.from.mockReturnValue(query); ready('user-B', 'org-B');
    const backend = createBackendStore('notifications', 'legacy', ['example']); await backend.refresh();
    expect(backend.get()).toEqual([]); expect(getItem).not.toHaveBeenCalled(); expect(setItem).not.toHaveBeenCalled(); expect(upsert).not.toHaveBeenCalled();
  });
  it('T-R5-013: cache access is separated by user, organization and generation', async () => {
    remote.rpc.mockImplementation(async () => ({ data: { organization_id: sessionContext.get().organizationId, role: 'admin', permissions: { 'team.manage': true } }, error: null }));
    ready(); await loadCurrentAccess('user-A'); await loadCurrentAccess('user-A'); expect(remote.rpc).toHaveBeenCalledTimes(1);
    ready('user-A', 'org-B'); expect((await loadCurrentAccess('user-A')).organizationId).toBe('org-B');
    ready('user-B', 'org-B'); await loadCurrentAccess('user-B'); expect(remote.rpc).toHaveBeenCalledTimes(3);
    clearCurrentAccess('user-B'); await loadCurrentAccess('user-B'); expect(remote.rpc).toHaveBeenCalledTimes(4);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 31_000);
    await loadCurrentAccess('user-B'); expect(remote.rpc).toHaveBeenCalledTimes(5);
    clock.mockRestore();
  });
  it('T-R5-014: a late current-access result cannot authorize after logout', async () => {
    ready(); const access = deferred<{ data: unknown; error: null }>(); remote.rpc.mockReturnValue(access.promise);
    const promise = loadCurrentAccess('user-A'); const rejection = expect(promise).rejects.toThrow('session_context_changed');
    sessionContext.replace(null); access.resolve({ data: { organization_id: 'org-A', role: 'admin', permissions: {} }, error: null }); await rejection;
  });
  it('T-R5-033: explicit access invalidation rejects an already in-flight old permission response', async () => {
    ready(); const old = deferred<{ data: unknown; error: null }>(); remote.rpc.mockReturnValue(old.promise);
    const request = loadCurrentAccess('user-A'); const failure = expect(request).rejects.toThrow('organization_access_invalidated');
    clearCurrentAccess('user-A'); old.resolve({ data: { organization_id: 'org-A', role: 'admin', permissions: { 'team.manage': true } }, error: null });
    await failure;
  });
  it('T-R5-015: wrong org in current_user_access is not cached as authorization', async () => {
    ready(); remote.rpc.mockResolvedValue({ data: { organization_id: 'org-B', role: 'admin', permissions: {} }, error: null });
    await expect(loadCurrentAccess('user-A')).rejects.toThrow('organization_context_changed');
  });
  it('T-R5-016: diagnostics deduplication never lends an A request to B', async () => {
    ready(); const old = deferred<{ data: unknown; error: null }>(); remote.invoke.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ data: { ok: true, status: { modeLabel: 'B' } }, error: null });
    const a = loadOperationalStatus(); const failure = expect(a).rejects.toThrow('session_context_changed');
    ready('user-B', 'org-B'); expect((await loadOperationalStatus()).modeLabel).toBe('B');
    old.resolve({ data: { ok: true, status: { modeLabel: 'A' } }, error: null }); await failure;
    expect(remote.invoke).toHaveBeenCalledTimes(2);
  });
});

describe('R5 — canonical session resolution', () => {
  it('T-R5-017: getUser response from A is rejected after identity switches', async () => {
    sessionContext.replace('user-A'); const auth = deferred<{ data: { user: { id: string } }; error: null }>(); remote.getUser.mockReturnValue(auth.promise);
    const resolving = resolveOrganizationSession(); const failure = expect(resolving).rejects.toThrow('session_context_changed');
    sessionContext.replace('user-B'); auth.resolve({ data: { user: { id: 'user-A' } }, error: null }); await failure;
    expect(remote.from).not.toHaveBeenCalled();
  });
  it('T-R5-018: discovery of another canonical org aborts the old caller instead of retargeting its payload', async () => {
    ready(); remote.getUser.mockResolvedValue({ data: { user: { id: 'user-A' } }, error: null });
    remote.from.mockImplementation((table: string) => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: table === 'profiles' ? { active_organization_id: 'org-B' } : { organization_id: 'org-B', role: 'admin' }, error: null }) }));
    await expect(resolveOrganizationSession()).rejects.toThrow('organization_context_changed');
    expect(sessionContext.get().organizationId).toBe('org-B'); expect(remote.rpc).not.toHaveBeenCalled();
  });
});

describe('R5 — two independent tabs with a synthetic StorageEvent transport', () => {
  function hosts() {
    const targets = [new EventTarget(), new EventTarget()];
    return targets.map((target, index) => ({
      addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target),
      localStorage: { setItem: (key: string, newValue: string) => {
        const event = Object.assign(new Event('storage'), { key, newValue }); targets[1 - index].dispatchEvent(event);
      } },
    } as unknown as Window));
  }
  it.each(['signout', 'refresh'] as const)('T-R5-019: %s invalidates the peer immediately; signals never confer identity/org', (reason) => {
    const a = createSessionContext(); const b = createSessionContext();
    a.confirm(a.replace('A'), 'A', 'org-A'); b.confirm(b.replace('A'), 'A', 'org-A');
    const [hostA, hostB] = hosts(); const callback = vi.fn();
    cleanups.push(listenForContextInvalidation(callback, b, hostB));
    const old = b.get(); broadcastContextInvalidation(reason, hostA);
    expect(b.get().userId).toBeNull(); expect(b.get().organizationId).toBeNull(); expect(b.isCurrent(old)).toBe(false);
    expect(callback).toHaveBeenCalledWith(reason); expect(a.get().organizationId).toBe('org-A');
  });
  it('T-R5-020: unknown/malformed storage messages do not change context', () => {
    const b = createSessionContext(); const token = b.confirm(b.replace('A'), 'A', 'org-A');
    const [hostA, hostB] = hosts(); const callback = vi.fn(); cleanups.push(listenForContextInvalidation(callback, b, hostB));
    hostA.localStorage.setItem('wayflex_context_invalidation_v1', '{bad');
    hostA.localStorage.setItem('wayflex_context_invalidation_v1', JSON.stringify({ reason: 'grant_admin', userId: 'B' }));
    expect(b.isCurrent(token)).toBe(true); expect(callback).not.toHaveBeenCalled();
  });
});
