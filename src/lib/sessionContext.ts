/** Browser data fence. This is NOT authorization: repositories/RLS still verify access. */
export interface SessionContext {
  readonly generation: number;
  readonly userId: string | null;
  readonly organizationId: string | null;
}

export class StaleSessionContextError extends Error {
  constructor() { super('session_context_changed'); }
}

export function createSessionContext() {
  let current: SessionContext = Object.freeze({ generation: 0, userId: null, organizationId: null });
  const listeners = new Set<() => void>();
  const get = () => current;
  const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
  const replace = (userId: string | null, organizationId: string | null = null) => {
    current = Object.freeze({ generation: current.generation + 1, userId, organizationId });
    listeners.forEach((listener) => listener());
    return current;
  };
  const isCurrent = (token: SessionContext) => current === token;
  const assertCurrent = (token: SessionContext) => { if (!isCurrent(token)) throw new StaleSessionContextError(); };
  const requireReady = () => {
    if (!current.userId || !current.organizationId) throw new Error('organization_context_required');
    return current;
  };
  const confirm = (token: SessionContext, userId: string, organizationId: string) => {
    assertCurrent(token);
    if (token.userId !== userId) throw new StaleSessionContextError();
    if (token.organizationId === organizationId) return token;
    return replace(userId, organizationId);
  };
  return { get, subscribe, replace, isCurrent, assertCurrent, requireReady, confirm };
}

export const sessionContext = createSessionContext();
const SIGNAL_KEY = 'wayflex_context_invalidation_v1';
type Signal = 'signout' | 'refresh';

// Contains no identity, JWT, customer data or authority. Peers must re-read Auth/DB.
export function broadcastContextInvalidation(reason: Signal, host: Window | undefined = typeof window === 'undefined' ? undefined : window): void {
  if (!host) return;
  try { host.localStorage.setItem(SIGNAL_KEY, JSON.stringify({ reason, nonce: crypto.randomUUID() })); } catch { /* Storage may be disabled. Supabase Auth still has its own broadcast. */ }
}

export function listenForContextInvalidation(onSignal: (reason: Signal) => void, context = sessionContext, host: Window | undefined = typeof window === 'undefined' ? undefined : window): () => void {
  if (!host) return () => undefined;
  const listener = (event: StorageEvent) => {
    if (event.key !== SIGNAL_KEY || !event.newValue) return;
    try {
      const message = JSON.parse(event.newValue) as { reason?: unknown };
      if (message.reason === 'signout' || message.reason === 'refresh') {
        context.replace(null);
        onSignal(message.reason);
      }
    } catch { /* Malformed signals carry no authority. */ }
  };
  host.addEventListener('storage', listener);
  return () => host.removeEventListener('storage', listener);
}
