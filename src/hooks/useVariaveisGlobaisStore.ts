import { createBackendStore } from '@/lib/backendStore';

// Variável personalizada da empresa: preenchida uma vez e usada em qualquer
// template/resposta/proposta/e-mail através de {chave}.
export interface VariavelGlobal {
  id: string;
  chave: string;
  valor: string;
  descricao: string;
}

const inicial: VariavelGlobal[] = [
  { id: 'vg-1', chave: 'link_agendamento', valor: 'https://www.wayflex.ind.br/contato', descricao: 'Link da agenda/reunião' },
  { id: 'vg-2', chave: 'link_portfolio', valor: 'https://www.wayflex.ind.br', descricao: 'Link do site institucional' },
  { id: 'vg-3', chave: 'horario_comercial', valor: 'Segunda a sexta, das 9h às 18h', descricao: 'Horário de atendimento' },
];

const STORAGE_KEY = 'leadai_variaveis_globais_v1';
const store = createBackendStore<VariavelGlobal[]>('variaveis_globais', STORAGE_KEY, inicial);

export function useVariaveisGlobaisStore() {
  const variaveis = store.useStore();
  const setStore = store.bindSet();

  const atualizar = (id: string, mudanca: Partial<VariavelGlobal>) => {
    setStore((prev) => prev.map((v) => (v.id === id ? { ...v, ...mudanca } : v)));
  };

  const adicionar = (v: VariavelGlobal) => {
    setStore((prev) => [...prev, v]);
  };

  const excluir = (id: string) => {
    setStore((prev) => prev.filter((v) => v.id !== id));
  };

  return { variaveis, atualizar, adicionar, excluir };
}

// Acesso imperativo ao snapshot das variáveis globais (para o motor de automação).
export function getVariaveisGlobaisSnapshot(): VariavelGlobal[] {
  return store.get();
}
