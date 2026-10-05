import { createContextStore } from '@/lib/contextStore';
import { loadOperationalCatalog, persistOperationalCatalog } from '@/lib/crm/operationalEntitiesRepository';
import { isUuid } from '@/lib/crm/leadMapper';
import { produtosCatalogo } from '@/mocks/produtosData';

export type ProdutoCatalogo = typeof produtosCatalogo[number];

const store = createContextStore<ProdutoCatalogo[]>({
  initial: () => [],
  load: async () => loadOperationalCatalog(),
  save: (previous, next) => persistOperationalCatalog(previous, next),
  normalize: (items) => items.map((item) => ({ ...item, id: isUuid(item.id) ? item.id : crypto.randomUUID() })),
});

export interface CatalogoStore {
  produtos: ProdutoCatalogo[];
  atualizar: (id: string, mudanca: Partial<ProdutoCatalogo>) => void;
  adicionar: (produto: ProdutoCatalogo) => void;
  excluir: (id: string) => void;
}

export function useCatalogoStore(): CatalogoStore {
  const produtos = store.useData();
  const updateState = store.bindUpdate();

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
