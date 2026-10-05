import { useSyncExternalStore } from 'react';
import { sessionContext, type SessionContext } from '@/lib/sessionContext';

export interface ContextStoreSnapshot<T> {
  data: T;
  status: 'loading' | 'ready' | 'error';
  loaded: boolean;
  saving: boolean;
  error: unknown;
}

/** Shared read/write lifecycle for operational stores. Never persists browser caches. */
export function createContextStore<T>(options: {
  initial: () => T;
  load: (context: SessionContext) => Promise<T>;
  save?: (previous: T, next: T, context: SessionContext) => Promise<T>;
  normalize?: (value: T) => T;
  optimistic?: boolean;
}) {
  const initial = (): ContextStoreSnapshot<T> => ({ data: options.initial(), status: 'loading', loaded: false, saving: false, error: null });
  let snapshot = initial();
  let read: Promise<void> | null = null;
  let queue: Promise<void> = Promise.resolve();
  let revision = 0;
  let mutationEpoch = 0;
  let canonical = snapshot.data;
  let pendingWrites = 0;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const patch = (value: Partial<ContextStoreSnapshot<T>>) => { snapshot = { ...snapshot, ...value }; notify(); };

  async function refresh(): Promise<void> {
    const token = sessionContext.requireReady();
    const version = ++revision;
    patch({ status: 'loading' });
    try {
      const result = await options.load(token);
      sessionContext.assertCurrent(token);
      if (revision === version) {
        canonical = options.normalize ? options.normalize(result) : result;
        patch({ data: canonical, status: 'ready', loaded: true, error: null });
      }
    } catch (error) {
      if (sessionContext.isCurrent(token) && revision === version) patch({ status: 'error', error });
      throw error;
    }
  }

  function hydrate(): Promise<void> {
    if (!sessionContext.get().organizationId || snapshot.loaded) return Promise.resolve();
    if (read) return read;
    const operation = refresh().catch(() => undefined);
    read = operation;
    void operation.finally(() => { if (read === operation) read = null; });
    return operation;
  }

  const unsubscribeContext = sessionContext.subscribe(() => {
    snapshot = initial(); canonical = snapshot.data; read = null; queue = Promise.resolve(); revision++; mutationEpoch++; pendingWrites = 0;
    notify();
    // A canonical ready context may arrive without remounting the consumer.
    if (listeners.size) queueMicrotask(() => { void hydrate(); });
  });

  function update(updater: (previous: T) => T): Promise<void> {
    const token = sessionContext.requireReady();
    if (!snapshot.loaded) throw new Error('organization_data_not_loaded');
    if (!options.save) throw new Error('store_read_only');
    if (snapshot.error) throw new Error('store_refresh_required_after_write_failure');
    const epoch = mutationEpoch;
    revision++; pendingWrites++;
    patch({ saving: true });
    const operation = queue.then(async () => {
      sessionContext.assertCurrent(token);
      if (epoch !== mutationEpoch) throw new Error('queued_write_cancelled_after_failure');
      // Compute against the last acknowledged state, not an optimistic value
      // captured before earlier writes have run. Failed predecessors cancel the
      // queue rather than silently rebasing the user's intent.
      const previous = canonical;
      const next = options.normalize ? options.normalize(updater(previous)) : updater(previous);
      revision++;
      if (options.optimistic !== false) patch({ data: next });
      const result = await options.save!(previous, next, token);
      sessionContext.assertCurrent(token);
      if (epoch !== mutationEpoch) throw new Error('queued_write_cancelled_after_failure');
      revision++; // A read started during save may still contain the pre-write server value.
      canonical = options.normalize ? options.normalize(result) : result;
      pendingWrites--;
      patch({ data: canonical, status: 'ready', loaded: true, saving: pendingWrites > 0, error: null });
    });
    queue = operation.catch(async (error) => {
      if (!sessionContext.isCurrent(token) || epoch !== mutationEpoch) return;
      mutationEpoch++; pendingWrites = 0;
      const failedVersion = ++revision;
      patch({ data: canonical, saving: false, status: 'error', error });
      try {
        const recovered = await options.load(token);
        if (sessionContext.isCurrent(token) && failedVersion === revision) {
          canonical = options.normalize ? options.normalize(recovered) : recovered;
          patch({ data: canonical, loaded: true });
        }
      } catch {
        if (sessionContext.isCurrent(token) && failedVersion === revision) patch({ loaded: false });
      }
    });
    return operation;
  }

  const wait = async () => {
    const token = sessionContext.requireReady();
    await queue;
    sessionContext.assertCurrent(token);
    if (snapshot.error) throw snapshot.error;
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    void hydrate();
    return () => { listeners.delete(listener); };
  };
  const getSnapshot = () => snapshot;
  const useSnapshot = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const get = () => snapshot.data;
  const useData = () => useSnapshot().data;
  const useStatus = () => useSnapshot().status;
  const bindUpdate = () => {
    const token = sessionContext.get();
    return (updater: (previous: T) => T) => { sessionContext.assertCurrent(token); return update(updater); };
  };
  return { get, getSnapshot, subscribe, hydrate, refresh, update, bindUpdate, wait, useSnapshot, useData, useStatus, dispose: unsubscribeContext };
}
