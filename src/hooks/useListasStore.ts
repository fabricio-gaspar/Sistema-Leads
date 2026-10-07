import { createContextStore } from '@/lib/contextStore';
import { loadOperationalLists, persistOperationalLists } from '@/lib/crm/operationalEntitiesRepository';

// Listas nomeadas criadas pela Busca de Leads.
// Representam o resultado de uma prospecção que aguarda aprovação do admin
// antes de a Ana disparar o primeiro contato (etapa de curadoria humana).

export type StatusLista = 'pendente' | 'ativada' | 'arquivada';

export interface ListaDeLeads {
  id: string;
  nome: string;
  criadaEm: string;
  segmento: string;
  cidade: string;
  estado: string;
  total: number;
  fonte: string;
  leadIds: string[];
  status: StatusLista;
}

const store = createContextStore<ListaDeLeads[]>({
  initial: () => [],
  load: async () => loadOperationalLists(),
  save: (previous, next) => persistOperationalLists(previous, next),
});
export const refreshListsStore = store.refresh;
export const waitForListsPersistence = store.wait;

export function useListasStore(): {
  listas: ListaDeLeads[];
  criar: (lista: Omit<ListaDeLeads, 'id' | 'criadaEm'>) => ListaDeLeads;
  atualizar: (id: string, patch: Partial<ListaDeLeads>) => void;
} {
  const listas = store.useData();
  const updateState = store.bindUpdate();

  const criar = (lista: Omit<ListaDeLeads, 'id' | 'criadaEm'>): ListaDeLeads => {
    const nova: ListaDeLeads = {
      ...lista,
      id: crypto.randomUUID(),
      criadaEm: new Date().toISOString(),
    };
    updateState((prev) => [nova, ...prev]);
    return nova;
  };

  const atualizar = (id: string, patch: Partial<ListaDeLeads>): void => {
    updateState((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  return { listas, criar, atualizar };
}

export function getListasSnapshot(): ListaDeLeads[] {
  return store.get();
}
