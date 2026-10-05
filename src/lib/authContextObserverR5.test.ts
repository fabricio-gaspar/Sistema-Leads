import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { beginAuthIntent, observeAuthContext } from '@/lib/authContextObserver';
import { sessionContext } from '@/lib/sessionContext';

const auth = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), resolveOrganization: vi.fn(), unsubscribe: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }));
vi.mock('@/lib/organizationSession', () => ({ resolveOrganizationSession: auth.resolveOrganization }));
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const user = (id: string) => ({ id } as User);
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
let emit: (event: string, session: { user: User } | null) => void;
const dispose: Array<() => void> = [];
const callbacks = () => ({ identity: vi.fn(), loading: vi.fn(), organizationError: vi.fn() });
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); beginAuthIntent('login');
  auth.onAuthStateChange.mockImplementation((listener) => { emit = listener; return { data: { subscription: { unsubscribe: auth.unsubscribe } } }; });
  auth.getSession.mockReturnValue(new Promise(() => undefined));
  auth.resolveOrganization.mockResolvedValue(undefined);
});
afterEach(() => { dispose.splice(0).forEach((stop) => stop()); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('R5 — actual Auth observer with synthetic Supabase transport', () => {
  it('T-R5-036: peer refresh during intentional logout never restores the still-live SDK session', async () => {
    const host = new EventTarget(); vi.stubGlobal('window', host);
    auth.getSession.mockResolvedValue({ data: { session: { user: user('A') } }, error: null });
    const view = callbacks(); dispose.push(observeAuthContext(view)); await flush();
    expect(sessionContext.get().userId).toBe('A'); beginAuthIntent('logout');
    host.dispatchEvent(Object.assign(new Event('storage'), { key: 'wayflex_context_invalidation_v1', newValue: JSON.stringify({ reason: 'refresh' }) }));
    await flush(); await vi.runAllTimersAsync();
    expect(sessionContext.get().userId).toBeNull(); expect(view.identity).toHaveBeenLastCalledWith(null);
    expect(auth.getSession).toHaveBeenCalledTimes(1); expect(view.loading).toHaveBeenLastCalledWith(false);
    beginAuthIntent('login'); emit('SIGNED_IN', { user: user('B') }); expect(sessionContext.get().userId).toBe('B');
  });
  it('T-R5-025: initial getSession A arriving after SIGNED_IN B cannot restore A', async () => {
    const initial = deferred<{ data: { session: { user: User } }; error: null }>(); auth.getSession.mockReturnValue(initial.promise);
    const view = callbacks(); dispose.push(observeAuthContext(view)); emit('SIGNED_IN', { user: user('B') });
    initial.resolve({ data: { session: { user: user('A') } }, error: null }); await flush();
    expect(view.identity).toHaveBeenCalledTimes(1); expect(view.identity).toHaveBeenLastCalledWith(user('B')); expect(sessionContext.get().userId).toBe('B');
  });
  it('T-R5-026: Auth callback never performs an awaited/nested Supabase operation', async () => {
    dispose.push(observeAuthContext(callbacks())); emit('SIGNED_IN', { user: user('A') });
    expect(auth.resolveOrganization).not.toHaveBeenCalled(); await vi.runAllTimersAsync(); expect(auth.resolveOrganization).toHaveBeenCalledOnce();
  });
  it('T-R5-027: old organization failure after logout cannot change the new view', async () => {
    const resolving = deferred<unknown>(); auth.resolveOrganization.mockReturnValue(resolving.promise);
    const view = callbacks(); dispose.push(observeAuthContext(view)); emit('SIGNED_IN', { user: user('A') }); await vi.runAllTimersAsync();
    beginAuthIntent('logout'); emit('SIGNED_OUT', null); resolving.reject(new Error('old_failure')); await flush();
    expect(view.organizationError).toHaveBeenLastCalledWith(null); expect(sessionContext.get().userId).toBeNull();
  });
  it('T-R5-028: late authenticated events do not undo intentional logout; explicit login may start again', () => {
    const view = callbacks(); dispose.push(observeAuthContext(view)); beginAuthIntent('logout'); emit('SIGNED_IN', { user: user('A') });
    expect(view.identity).not.toHaveBeenCalled(); expect(sessionContext.get().userId).toBeNull();
    beginAuthIntent('login'); emit('SIGNED_IN', { user: user('B') }); expect(sessionContext.get().userId).toBe('B');
  });
  it('T-R5-029: unmounted observer ignores an initial session response and unsubscribes', async () => {
    const initial = deferred<{ data: { session: { user: User } }; error: null }>(); auth.getSession.mockReturnValue(initial.promise);
    const view = callbacks(); const stop = observeAuthContext(view); stop(); initial.resolve({ data: { session: { user: user('A') } }, error: null }); await flush();
    expect(view.identity).not.toHaveBeenCalled(); expect(auth.unsubscribe).toHaveBeenCalledOnce();
  });
  it('T-R5-030: a failed session read closes authentication instead of hanging in loading', async () => {
    auth.getSession.mockRejectedValue(new Error('network_unavailable')); const view = callbacks(); dispose.push(observeAuthContext(view)); await flush();
    expect(view.identity).toHaveBeenLastCalledWith(null); expect(view.loading).toHaveBeenLastCalledWith(false);
  });
});
