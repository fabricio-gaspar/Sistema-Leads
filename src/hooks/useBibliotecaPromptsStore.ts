import { createBackendStore } from '@/lib/backendStore';

// Prompt editável do Agente de Prompt (biblioteca). Substitui os modelos
// hardcoded que existiam em promptBusca.ts por dados gerenciáveis.
export interface BibliotecaPrompt {
  id: string;
  titulo: string;
  objetivo: string;
  criterios: string;
  campos: string[];
  preset: string;
  ativo: boolean;
}

export const PRESETS_PROMPT = [
  'Prospecção',
  'Qualificação',
  'Atendimento',
  'Follow-up',
] as const;

const inicial: BibliotecaPrompt[] = [
  {
    id: 'local-b2b',
    titulo: 'Prospecção local B2B',
    objetivo: 'Empresas de um segmento numa cidade/estado, com contato direto.',
    criterios:
      'Empresas do segmento de Tecnologia localizadas em São Paulo - SP, porte pequeno e médio, que possuam site próprio e contato comercial ativo.',
    campos: ['nome', 'cargo', 'empresa', 'email', 'telefone', 'segmento', 'cidade', 'site'],
    preset: 'Prospecção',
    ativo: true,
  },
  {
    id: 'decisor',
    titulo: 'Busca por decisor',
    objetivo: 'Encontre o cargo de decisão (CEO, Diretor) de empresas de um setor.',
    criterios:
      'Contatos com cargo de decisão (CEO, Diretor, Gerente) em empresas de Marketing e Publicidade na região Sul do Brasil.',
    campos: ['nome', 'cargo', 'empresa', 'email', 'telefone', 'linkedin', 'porte'],
    preset: 'Prospecção',
    ativo: true,
  },
  {
    id: 'validacao',
    titulo: 'Lista nichada com validação',
    objetivo: 'Lista enxuta de leads com qualidade e sem duplicados.',
    criterios:
      'Gerar uma lista de leads de clínicas e consultórios de Saúde em Belo Horizonte - MG, priorizando empresas ativas e com CNPJ válido.',
    campos: ['nome', 'empresa', 'cnpj', 'email', 'telefone', 'segmento', 'porte'],
    preset: 'Prospecção',
    ativo: true,
  },
  {
    id: 'qualificar',
    titulo: 'Qualificar lead',
    objetivo: 'Roteiro de perguntas para descobrir necessidade, orçamento e decisor.',
    criterios:
      'Perguntas de qualificação B2B: qual o principal desafio, quem decide, qual o orçamento previsto e o prazo ideal para implementação.',
    campos: ['nome', 'cargo', 'empresa', 'email', 'telefone', 'segmento'],
    preset: 'Qualificação',
    ativo: true,
  },
  {
    id: 'resumir',
    titulo: 'Resumir conversa',
    objetivo: 'Condensar uma conversa em pontos-chave e próximos passos.',
    criterios:
      'Resumir a conversa em: contexto, dores citadas, interesse, objeções e próximos passos recomendados, em tópicos curtos.',
    campos: ['nome', 'empresa'],
    preset: 'Atendimento',
    ativo: true,
  },
  {
    id: 'followup',
    titulo: 'Redigir follow-up',
    objetivo: 'Mensagem de retorno após proposta ou reunião.',
    criterios:
      'Redigir um follow-up cordial para retomar contato após envio de proposta, reforçando valor e oferecendo horários para conversa.',
    campos: ['nome', 'empresa', 'email', 'whatsapp'],
    preset: 'Follow-up',
    ativo: true,
  },
];

const STORAGE_KEY = 'leadai_biblioteca_prompts_v1';
const store = createBackendStore<BibliotecaPrompt[]>('biblioteca_prompts', STORAGE_KEY, inicial);

export function useBibliotecaPromptsStore() {
  const prompts = store.useStore();

  const atualizar = (id: string, mudanca: Partial<BibliotecaPrompt>) => {
    store.set((prev) => prev.map((p) => (p.id === id ? { ...p, ...mudanca } : p)));
  };

  const adicionar = (p: BibliotecaPrompt) => {
    store.set((prev) => [p, ...prev]);
  };

  const excluir = (id: string) => {
    store.set((prev) => prev.filter((p) => p.id !== id));
  };

  return { prompts, atualizar, adicionar, excluir };
}
