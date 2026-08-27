import { useEffect, useSyncExternalStore } from 'react';
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

let state: ListaDeLeads[] = [];
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
  hydratePromise = loadOperationalLists()
    .then((lists) => { state = lists; hydrated = true; notify(); })
    .catch((error) => console.error('[crm-lists] falha ao carregar fonte operacional', error))
    .finally(() => { hydratePromise = null; });
  return hydratePromise;
}

function updateState(updater: (previous: ListaDeLeads[]) => ListaDeLeads[]): void {
  const previous = state;
  const next = updater(previous);
  state = next;
  notify();
  writeQueue = writeQueue
    .then(async () => { state = await persistOperationalLists(previous, next); notify(); })
    .catch((error) => { console.error('[crm-lists] falha ao salvar fonte operacional', error); void hydrate(); });
}

export function useListasStore(): {
  listas: ListaDeLeads[];
  criar: (lista: Omit<ListaDeLeads, 'id' | 'criadaEm'>) => ListaDeLeads;
  atualizar: (id: string, patch: Partial<ListaDeLeads>) => void;
} {
  const listas = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => { void hydrate(); }, []);

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
  return state;
}
