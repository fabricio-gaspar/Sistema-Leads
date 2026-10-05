import { createBackendStore } from '@/lib/backendStore';
import { equipe } from '@/mocks/businessData';
import type { Membro } from '@/mocks/businessData';

const STORAGE_KEY = 'leadai_equipe_v1';
const store = createBackendStore<Membro[]>('equipe', STORAGE_KEY, equipe);

export interface EquipeStore {
  membros: Membro[];
  adicionar: (membro: Membro) => void;
  atualizar: (id: string, mudanca: Partial<Membro>) => void;
  excluir: (id: string) => void;
}

export function useEquipeStore(): EquipeStore {
  const membros = store.useStore();
  const setStore = store.bindSet();

  const adicionar = (membro: Membro) => setStore((prev) => [...prev, membro]);
  const atualizar = (id: string, mudanca: Partial<Membro>) =>
    setStore((prev) => prev.map((m) => (m.id === id ? { ...m, ...mudanca } : m)));
  const excluir = (id: string) => setStore((prev) => prev.filter((m) => m.id !== id));

  return { membros, adicionar, atualizar, excluir };
}
