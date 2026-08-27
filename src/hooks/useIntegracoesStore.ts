import { createBackendStore } from '@/lib/backendStore';
import { integracoes as integracoesMock } from '@/mocks/businessData';
import type { Integracao } from '@/mocks/businessData';
import { useMemo } from 'react';

const STORAGE_KEY = 'leadai_integracoes_v1';
const store = createBackendStore<Integracao[]>('integracoes', STORAGE_KEY, integracoesMock);

export interface IntegracoesStore {
  integracoes: Integracao[];
  atualizar: (id: string, mudanca: Partial<Integracao>) => void;
  conectar: (id: string) => void;
  desconectar: (id: string) => void;
  salvarCredenciais: (id: string, credenciais: Record<string, string>) => void;
}

function mergeWithMock(raw: Integracao[]): Integracao[] {
  const byId = new Map(raw.map((i) => [i.id, i]));
  return integracoesMock.map((mock) => {
    const saved = byId.get(mock.id);
    if (!saved) return mock;
    // Nunca reidrata segredos que possam ter sido salvos pela versão mock.
    // A conexão real é criada pelo backend e expõe ao navegador apenas status
    // e metadados não sensíveis.
    const { credenciais: _ignoredCredentials, ...safeSaved } = saved;
    return {
      ...mock,
      ...safeSaved,
      campos: mock.campos,       // sempre usar campos atualizados do código
      nome: mock.nome,           // sempre usar nome atualizado do código
      descricao: mock.descricao, // sempre usar descrição atualizada do código
      icone: mock.icone,         // sempre usar ícone atualizado do código
      categoria: mock.categoria, // sempre usar categoria atualizada do código
    };
  });
}

export function useIntegracoesStore(): IntegracoesStore {
  const raw = store.useStore();

  const integracoes = useMemo(() => {
    if (!Array.isArray(raw)) return integracoesMock;
    return mergeWithMock(raw);
  }, [raw]);

  const atualizar = (id: string, mudanca: Partial<Integracao>) => {
    store.set((prev) => prev.map((i) => (i.id === id ? { ...i, ...mudanca } : i)));
  };

  const conectar = (id: string) => {
    store.set((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'conectado', ultimoTeste: 'agora' } : i))
    );
  };

  const desconectar = (id: string) => {
    store.set((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'pendente' } : i))
    );
  };

  const salvarCredenciais = (id: string, credenciais: Record<string, string>) => {
    // Não persistir tokens/chaves no browser, localStorage ou JSON compartilhado.
    // A próxima fase grava segredos somente no cofre de secrets do backend, por
    // OAuth ou um endpoint administrativo autenticado.
    void credenciais;
    store.set((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, credenciais: undefined, status: 'pendente', ultimoTeste: 'Aguardando conexão segura' }
          : i
      )
    );
  };

  return { integracoes, atualizar, conectar, desconectar, salvarCredenciais };
}
