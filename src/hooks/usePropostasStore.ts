import { useEffect, useSyncExternalStore } from 'react';
import { loadOperationalProposals, persistOperationalProposals, persistentProposalId } from '@/lib/crm/proposalsRepository';
import type { Proposta } from '@/mocks/propostasData';

let state: Proposta[] = [];
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let writeQueue = Promise.resolve();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());
const getSnapshot = () => state;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;
  hydratePromise = loadOperationalProposals()
    .then((proposals) => { state = proposals; hydrated = true; notify(); })
    .catch((error) => console.error('[crm-proposals] falha ao carregar fonte operacional', error))
    .finally(() => { hydratePromise = null; });
  return hydratePromise;
}

function updateState(updater: (previous: Proposta[]) => Proposta[]): void {
  const previous = state;
  const next = updater(previous).map((proposal) => ({ ...proposal, id: persistentProposalId(proposal.id) }));
  state = next;
  notify();
  writeQueue = writeQueue
    .then(async () => { state = await persistOperationalProposals(previous, next); notify(); })
    .catch((error) => { console.error('[crm-proposals] falha ao salvar fonte operacional', error); void hydrate(); });
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

  // The financial RPC already persists the acceptance together with the sale
  // and receivable. Reflect it here without issuing a second proposal write.
  const confirmarAceiteLocal = (id: string) => {
    state = state.map((proposal) => (proposal.id === id ? { ...proposal, status: 'aceita' } : proposal));
    notify();
  };

  const criar = (proposta: Proposta) => {
    updateState((prev) => [{ ...proposta, id: persistentProposalId(proposta.id) }, ...prev]);
  };

  const excluir = (id: string) => {
    updateState((prev) => prev.filter((p) => p.id !== id));
  };

  return { propostas, atualizar, confirmarAceiteLocal, criar, excluir };
}

// Acesso imperativo (para orquestradores/handlers sem hook).
export function getPropostasSnapshot(): Proposta[] {
  return state;
}
