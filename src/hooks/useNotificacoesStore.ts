import { createBackendStore } from '@/lib/backendStore';
import type { Notificacao } from '@/lib/tipos';

const STORAGE_KEY = 'leadai_notificacoes_v1';

const store = createBackendStore<Notificacao[]>('notificacoes',STORAGE_KEY, []);

export function useNotificacoesStore(): {
  notificacoes: Notificacao[];
  criar: (dados: Omit<Notificacao, 'id' | 'lida' | 'data'>) => Notificacao;
  marcarLida: (id: string) => void;
  marcarTodasLidas: () => void;
  naoLidas: number;
} {
  const notificacoes = store.useStore();

  const criar = (dados: Omit<Notificacao, 'id' | 'lida' | 'data'>): Notificacao => {
    const nova: Notificacao = {
      ...dados,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      lida: false,
      data: new Date().toISOString(),
    };
    store.set((prev) => [nova, ...prev]);
    return nova;
  };

  const marcarLida = (id: string) => {
    store.set((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
  };

  const marcarTodasLidas = () => {
    store.set((prev) => prev.map((n) => ({ ...n, lida: true })));
  };

  return {
    notificacoes,
    criar,
    marcarLida,
    marcarTodasLidas,
    naoLidas: notificacoes.filter((n) => !n.lida).length,
  };
}

export function getNotificacoesSnapshot(): Notificacao[] {
  return store.get();
}