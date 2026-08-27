import { createBackendStore } from '@/lib/backendStore';
import { socialAccounts as contasIniciais, socialPosts as postsIniciais } from '@/mocks/socialData';
import type { SocialAccount, SocialPost } from '@/mocks/socialData';

// Store das campanhas/redes sociais, agora persistida no Backend (tabela
// `campanhas`), em vez de ficar presa no localStorage do navegador. Isso
// garante que contas conectadas e publicações acompanhem o usuário em qualquer
// dispositivo, no mesmo padrão de todas as outras stores do sistema.

const STORAGE_KEY = 'leadai_campanhas_v1';

// Migração: reaproveita os dados salvos nas antigas chaves locais (se houver),
// para não perder nada já cadastrado antes desta mudança.
function carregarLegado<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const dados = JSON.parse(raw) as T;
      if (Array.isArray(dados) && dados.length > 0) return dados;
    }
  } catch {
    // ignora dados corrompidos
  }
  return fallback;
}

interface CampanhasState {
  contas: SocialAccount[];
  posts: SocialPost[];
}

const store = createBackendStore<CampanhasState>('campanhas', STORAGE_KEY, {
  contas: carregarLegado('leadai_social_contas_v1', contasIniciais),
  posts: carregarLegado('leadai_social_posts_v1', postsIniciais),
});

export interface SocialStore {
  contas: SocialAccount[];
  posts: SocialPost[];
  atualizarConta: (id: string, mudanca: Partial<SocialAccount>) => void;
  criarPost: (post: SocialPost) => void;
  atualizarPost: (id: string, mudanca: Partial<SocialPost>) => void;
  duplicarPost: (id: string) => void;
  excluirPost: (id: string) => void;
}

export function useSocialStore(): SocialStore {
  const { contas, posts } = store.useStore();

  const atualizarConta = (id: string, mudanca: Partial<SocialAccount>) => {
    store.set((prev) => ({
      ...prev,
      contas: prev.contas.map((c) => (c.id === id ? { ...c, ...mudanca } : c)),
    }));
  };

  const criarPost = (post: SocialPost) => {
    store.set((prev) => ({ ...prev, posts: [post, ...prev.posts] }));
  };

  const atualizarPost = (id: string, mudanca: Partial<SocialPost>) => {
    store.set((prev) => ({
      ...prev,
      posts: prev.posts.map((p) => (p.id === id ? { ...p, ...mudanca } : p)),
    }));
  };

  const duplicarPost = (id: string) => {
    const original = posts.find((p) => p.id === id);
    if (!original) return;
    const copia: SocialPost = {
      ...original,
      id: `sp-${Date.now()}`,
      nomeInterno: `${original.nomeInterno} (cópia)`,
      status: 'RASCUNHO',
      aprovadoEm: null,
      publicadoEm: null,
      erro: null,
      tentativas: 0,
      criadoEm: new Date().toISOString(),
    };
    store.set((prev) => ({ ...prev, posts: [copia, ...prev.posts] }));
  };

  const excluirPost = (id: string) => {
    store.set((prev) => ({ ...prev, posts: prev.posts.filter((p) => p.id !== id) }));
  };

  return { contas, posts, atualizarConta, criarPost, atualizarPost, duplicarPost, excluirPost };
}