import { useEffect, useSyncExternalStore } from 'react';
import { loadOperationalCatalog, persistOperationalCatalog } from '@/lib/crm/operationalEntitiesRepository';
import { isUuid } from '@/lib/crm/leadMapper';
import { produtosCatalogo } from '@/mocks/produtosData';

export type ProdutoCatalogo = typeof produtosCatalogo[number];

let state: ProdutoCatalogo[] = [];
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
  hydratePromise = loadOperationalCatalog()
    .then((catalog) => { state = catalog; hydrated = true; notify(); })
    .catch((error) => console.error('[crm-catalog] falha ao carregar fonte operacional', error))
    .finally(() => { hydratePromise = null; });
  return hydratePromise;
}

function updateState(updater: (previous: ProdutoCatalogo[]) => ProdutoCatalogo[]): void {
  const previous = state;
  const next = updater(previous).map((item) => ({ ...item, id: isUuid(item.id) ? item.id : crypto.randomUUID() }));
  state = next;
  notify();
  writeQueue = writeQueue
    .then(async () => { state = await persistOperationalCatalog(previous, next); notify(); })
    .catch((error) => { console.error('[crm-catalog] falha ao salvar fonte operacional', error); void hydrate(); });
}

export interface CatalogoStore {
  produtos: ProdutoCatalogo[];
  atualizar: (id: string, mudanca: Partial<ProdutoCatalogo>) => void;
  adicionar: (produto: ProdutoCatalogo) => void;
  excluir: (id: string) => void;
}

export function useCatalogoStore(): CatalogoStore {
  const produtos = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => { void hydrate(); }, []);

  const atualizar = (id: string, mudanca: Partial<ProdutoCatalogo>) => {
    updateState((prev) => prev.map((p) => (p.id === id ? { ...p, ...mudanca } : p)));
  };

  const adicionar = (produto: ProdutoCatalogo) => {
    updateState((prev) => [...prev, produto]);
  };

  const excluir = (id: string) => {
    updateState((prev) => prev.filter((p) => p.id !== id));
  };

  return { produtos, atualizar, adicionar, excluir };
}
