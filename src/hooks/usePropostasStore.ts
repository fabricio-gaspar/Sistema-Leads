import { useEffect, useSyncExternalStore } from 'react';
import { loadOperationalProposals, persistOperationalProposals, persistentProposalId } from '@/lib/crm/proposalsRepository';
import type { Proposta } from '@/mocks/propostasData';

let state: Proposta[] = [];
let hydrated = false;
let loadStatus: 'loading' | 'ready' | 'error' = 'loading';
let hydratePromise: Promise<void> | null = null;
let writeQueue = Promise.resolve();
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
  hydratePromise = loadOperationalProposals()
    .then((proposals) => { state = proposals; hydrated = true; loadStatus = 'ready'; notify(); })
    .catch((error) => { console.error('[crm-proposals] falha ao carregar fonte operacional', error); loadStatus = 'error'; notify(); })
    .finally(() => { hydratePromise = null; });
  return hydratePromise;
}

function updateState(updater: (previous: Proposta[]) => Proposta[]): void {
  const previous = state;
  const next = updater(previous).map((proposal) => ({ ...proposal, id: persistentProposalId(proposal.id) }));
  state = next;
  notify();
  writeQueue = writeQueue
    .then(async () => {
      state = await persistOperationalProposals(previous, next);
      latestPersistenceError = null;
      notify();
    })
    .catch((error) => {
      console.error('[crm-proposals] falha ao salvar fonte operacional', error);
      latestPersistenceError = error;
      hydrated = false;
      void hydrate();
    });
}

/** Recarrega a fonte operacional após uma mutação transacional do backend. */
export async function refreshPropostasStore(): Promise<void> {
  try {
    state = await loadOperationalProposals();
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

export interface PropostasStore {
  propostas: Proposta[];
  atualizar: (id: string, mudanca: Partial<Proposta>) => void;
  confirmarAceiteLocal: (id: string) => void;
  criar: (proposta: Proposta) => void;
  excluir: (id: string) => void;
}

export function usePropostasStore(): PropostasStore {
  const propostas = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => { void hydrate(); }, []);

  const atualizar = (id: string, mudanca: Partial<Proposta>) => {
    updateState((prev) => prev.map((p) => (p.id === id ? { ...p, ...mudanca } : p)));
  };

  // Aceite encerra o orçamento e o funil; não cria venda, cobrança ou pedido.
  const confirmarAceiteLocal = (id: string) => {
    updateState((previous) => previous.map((proposal) => (proposal.id === id ? { ...proposal, status: 'aceita' } : proposal)));
  };

  const criar = (proposta: Proposta) => {
    updateState((prev) => [{ ...proposta, id: persistentProposalId(proposta.id) }, ...prev]);
  };

  const excluir = (id: string) => {
    updateState((prev) => prev.filter((p) => p.id !== id));
  };

  return { propostas, atualizar, confirmarAceiteLocal, criar, excluir };
}

export function usePropostasLoadStatus(): 'loading' | 'ready' | 'error' {
  const status = useSyncExternalStore(subscribe, getLoadStatus, getLoadStatus);
  useEffect(() => { void hydrate(); }, []);
  return status;
}

// Acesso imperativo (para orquestradores/handlers sem hook).
export function getPropostasSnapshot(): Proposta[] {
  return state;
}

export async function waitForPropostasPersistence(): Promise<void> {
  await writeQueue;
  if (latestPersistenceError) {
    const error = latestPersistenceError;
    latestPersistenceError = null;
    throw error;
  }
}
