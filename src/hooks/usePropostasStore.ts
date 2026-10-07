import { createContextStore } from '@/lib/contextStore';
import { loadOperationalProposals, persistOperationalProposals, persistentProposalId } from '@/lib/crm/proposalsRepository';
import type { Proposta } from '@/mocks/propostasData';

const store = createContextStore<Proposta[]>({
  initial: () => [],
  load: async () => loadOperationalProposals(),
  save: (previous, next) => persistOperationalProposals(previous, next),
  normalize: (items) => items.map((item) => ({ ...item, id: persistentProposalId(item.id) })),
});
export const refreshPropostasStore = store.refresh;

export interface PropostasStore {
  propostas: Proposta[];
  atualizar: (id: string, mudanca: Partial<Proposta>) => void;
  confirmarAceiteLocal: (id: string) => void;
  criar: (proposta: Proposta) => void;
  excluir: (id: string) => void;
}

export function usePropostasStore(): PropostasStore {
  const propostas = store.useData();
  const updateState = store.bindUpdate();

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
  return store.useStatus();
}

// Acesso imperativo (para orquestradores/handlers sem hook).
export function getPropostasSnapshot(): Proposta[] {
  return store.get();
}

export const waitForPropostasPersistence = store.wait;
