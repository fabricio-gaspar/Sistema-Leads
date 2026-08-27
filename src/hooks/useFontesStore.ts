import { createBackendStore } from '@/lib/backendStore';
import { fontesLeads } from '@/mocks/fontesData';

export type FonteLead = typeof fontesLeads[number];

const STORAGE_KEY = 'leadai_fontes_v1';
const store = createBackendStore<FonteLead[]>('fontes', STORAGE_KEY, fontesLeads);

export interface FontesStore {
  fontes: FonteLead[];
  atualizar: (id: string, mudanca: Partial<FonteLead>) => void;
  adicionar: (fonte: FonteLead) => void;
  excluir: (id: string) => void;
}

export function useFontesStore(): FontesStore {
  const fontes = store.useStore();

  const atualizar = (id: string, mudanca: Partial<FonteLead>) => {
    store.set((prev) => prev.map((f) => (f.id === id ? { ...f, ...mudanca } : f)));
  };

  const adicionar = (fonte: FonteLead) => {
    store.set((prev) => [...prev, fonte]);
  };

  const excluir = (id: string) => {
    store.set((prev) => prev.filter((f) => f.id !== id));
  };

  return { fontes, atualizar, adicionar, excluir };
}