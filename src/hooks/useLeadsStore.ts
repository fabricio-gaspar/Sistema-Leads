import { useEffect, useSyncExternalStore } from 'react';
import { normalizarLead } from '@/mocks/leadsData';
import type { Lead } from '@/mocks/leadsData';
import { loadOperationalLeads, persistOperationalLeads } from '@/lib/crm/leadsRepository';
import { persistentLeadId } from '@/lib/crm/leadMapper';

let state: Lead[] = [];
let hydrated = false;
let loadStatus: 'loading' | 'ready' | 'error' = 'loading';
let hydratePromise: Promise<void> | null = null;
let writeQueue: Promise<void> = Promise.resolve();
let latestPersistenceError: unknown = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());
const getSnapshot = () => state;
const getLoadStatus = () => loadStatus;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;
  loadStatus = 'loading';
  notify();
  hydratePromise = loadOperationalLeads()
    .then((leads) => {
      state = leads.map(normalizarLead);
      hydrated = true;
      loadStatus = 'ready';
      notify();
    })
    .catch((error) => {
      console.error('[crm-leads] falha ao carregar fonte operacional', error);
      loadStatus = 'error';
      notify();
    })
    .finally(() => {
      hydratePromise = null;
    });
  return hydratePromise;
}

/** Recarrega a fonte operacional depois de uma mutação transacional do backend. */
export async function refreshLeadsStore(): Promise<void> {
  try {
    const leads = await loadOperationalLeads();
    state = leads.map(normalizarLead);
    hydrated = true;
    loadStatus = 'ready';
    latestPersistenceError = null;
    notify();
  } catch (error) {
    loadStatus = 'error';
    notify();
    throw error;
  }
}

function updateState(updater: React.SetStateAction<Lead[]>): void {
  const previous = state;
  const candidate = typeof updater === 'function' ? updater(previous) : updater;
  const next = candidate.map((lead) => normalizarLead({ ...lead, id: persistentLeadId(lead.id) }));
  state = next;
  notify();

  writeQueue = writeQueue
    .then(async () => {
      const persisted = await persistOperationalLeads(previous, next);
      state = persisted.map(normalizarLead);
      latestPersistenceError = null;
      notify();
    })
    .catch((error) => {
      console.error('[crm-leads] falha ao salvar fonte operacional', error);
      latestPersistenceError = error;
      // `hydrate()` is a no-op while the store is marked hydrated. Clear the
      // flag so the optimistic state is reconciled with the server on failure.
      hydrated = false;
      void hydrate();
    });
}

export function useLeadsStore(): [Lead[], React.Dispatch<React.SetStateAction<Lead[]>>] {
  const leads = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => { void hydrate(); }, []);

  const setLeads: React.Dispatch<React.SetStateAction<Lead[]>> = updateState;

  return [leads, setLeads];
}

export function useLeadsLoadStatus(): 'loading' | 'ready' | 'error' {
  const status = useSyncExternalStore(subscribe, getLoadStatus, getLoadStatus);
  useEffect(() => { void hydrate(); }, []);
  return status;
}

// Acesso imperativo (para orquestradores/handlers sem hook).
export function getLeadsSnapshot(): Lead[] {
  return state;
}

// Used when a new relational entity (for example, a lead list) needs to
// reference leads created in the same user action. It preserves the
// synchronous UI contract while allowing the caller to respect foreign keys.
export async function waitForLeadsPersistence(): Promise<void> {
  await writeQueue;
  if (latestPersistenceError) {
    const error = latestPersistenceError;
    latestPersistenceError = null;
    throw error;
  }
}
