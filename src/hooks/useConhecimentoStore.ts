import { createBackendStore } from '@/lib/backendStore';
import { conhecimentoInicial } from '@/mocks/conhecimentoData';
import type { EntradaConhecimento } from '@/mocks/conhecimentoData';

const STORAGE_KEY = 'leadai_conhecimento_v1';

// Singleton persistente no Backend (com cache local síncrono), mantendo o
// mesmo padrão das demais stores para que a Base de Conhecimento sobreviva
// ao refresh e alimente a Ana de forma consistente.
const store = createBackendStore<EntradaConhecimento[]>('conhecimento', STORAGE_KEY, conhecimentoInicial);

export interface ConhecimentoStore {
  entradas: EntradaConhecimento[];
  adicionar: (entrada: EntradaConhecimento) => void;
  atualizar: (id: string, mudanca: Partial<EntradaConhecimento>) => void;
  excluir: (id: string) => void;
  alternarStatus: (id: string) => void;
}

export function useConhecimentoStore(): ConhecimentoStore {
  const entradas = store.useStore();

  const adicionar = (entrada: EntradaConhecimento) => {
    store.set((prev) => [entrada, ...prev]);
  };

  const atualizar = (id: string, mudanca: Partial<EntradaConhecimento>) => {
    store.set((prev) => prev.map((e) => (e.id === id ? { ...e, ...mudanca } : e)));
  };

  const excluir = (id: string) => {
    store.set((prev) => prev.filter((e) => e.id !== id));
  };

  const alternarStatus = (id: string) => {
    store.set((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: e.status === 'ativo' ? 'rascunho' : 'ativo' } : e))
    );
  };

  return { entradas, adicionar, atualizar, excluir, alternarStatus };
}

// Acesso imperativo (para a Ana/IA ler a base fora de um hook).
export function getConhecimentoSnapshot(): EntradaConhecimento[] {
  return store.get();
}