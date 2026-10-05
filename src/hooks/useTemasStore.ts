import { createBackendStore } from '@/lib/backendStore';

// Paleta de cores de um tema (usada na geração de propostas e documentos em PDF).
// Valores são hex escolhidos pelo usuário — são dados configuráveis, não
// decoração de interface.
export interface TemaCores {
  primaria: string;
  secundaria: string;
  texto: string;
}

// Tema visual: identidade aplicada a propostas, orçamentos e documentos com 1 clique.
export interface Tema {
  id: string;
  nome: string;
  descricao: string;
  cores: TemaCores;
  logoUrl: string;
  assinatura: string;
  padrao: boolean;
}

const inicial: Tema[] = [
  {
    id: 'tm-1',
    nome: 'Clássico corporativo',
    descricao: 'Verde Wayflex e grafite da identidade oficial, ideal para negócios B2B.',
    cores: { primaria: '#168654', secundaria: '#14151A', texto: '#14151A' },
    logoUrl: '',
    assinatura: 'Equipe Wayflex',
    padrao: true,
  },
  {
    id: 'tm-2',
    nome: 'Vibrante',
    descricao: 'Laranja forte para dar energia às propostas e se destacar.',
    cores: { primaria: '#C2410C', secundaria: '#FB923C', texto: '#1F2937' },
    logoUrl: '',
    assinatura: 'Equipe Wayflex',
    padrao: false,
  },
  {
    id: 'tm-3',
    nome: 'Minimalista',
    descricao: 'Carvão e cinza, visual limpo, discreto e elegante.',
    cores: { primaria: '#334155', secundaria: '#94A3B8', texto: '#0F172A' },
    logoUrl: '',
    assinatura: 'Equipe Wayflex',
    padrao: false,
  },
];

const STORAGE_KEY = 'leadai_temas_v1';
const store = createBackendStore<Tema[]>('temas', STORAGE_KEY, inicial);

export function useTemasStore() {
  const temas = store.useStore();

  const atualizar = (id: string, mudanca: Partial<Tema>) => {
    store.set((prev) => prev.map((t) => (t.id === id ? { ...t, ...mudanca } : t)));
  };

  const adicionar = (t: Tema) => {
    store.set((prev) => [...prev, t]);
  };

  const excluir = (id: string) => {
    store.set((prev) => prev.filter((t) => t.id !== id));
  };

  const definirPadrao = (id: string) => {
    store.set((prev) => prev.map((t) => ({ ...t, padrao: t.id === id })));
  };

  // Retorna o tema marcado como padrão, com fallback para o primeiro da lista.
  const temaPadrao = (): Tema =>
    temas.find((t) => t.padrao) || temas[0] || inicial[0];

  return { temas, atualizar, adicionar, excluir, definirPadrao, temaPadrao };
}
