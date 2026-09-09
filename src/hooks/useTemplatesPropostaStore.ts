import { useEffect, useSyncExternalStore } from 'react';
import { loadProposalTemplates, saveProposalTemplates } from '@/lib/crm/proposalTemplatesRepository';

export interface BlocoProposta {
  id: string;
  titulo: string;
  texto: string;
}

export interface TemplateProposta {
  id: string;
  nome: string;
  descricao: string;
  validadePadraoDias: number;
  formaPagamento: string;
  garantia: string;
  termos: string;
  blocos: BlocoProposta[];
  ativo: boolean;
  padrao: boolean;
}

// Estruturas de exemplo sem preço, prazo, pagamento, garantia ou certificação
// afirmados. Esses dados só podem ser preenchidos após validação humana.
export const WAYFLEX_TEMPLATE_EXAMPLES: TemplateProposta[] = [
  {
    id: 'wayflex-borracha-tecnica',
    nome: 'Borracha técnica sob medida',
    descricao: 'Levantamento técnico para peças de borracha conforme aplicação, desenho ou amostra.',
    validadePadraoDias: 0,
    formaPagamento: '',
    garantia: '',
    termos: '',
    blocos: [
      { id: 'borracha-aplicacao', titulo: 'Aplicação', texto: 'Descrever o equipamento, a função da peça e as condições de operação informadas pelo cliente.' },
      { id: 'borracha-especificacao', titulo: 'Especificação técnica', texto: 'Registrar material solicitado, dimensões, dureza, temperatura, contato químico e tolerâncias quando confirmados.' },
      { id: 'borracha-referencia', titulo: 'Referência para análise', texto: 'Relacionar desenho técnico, medidas, fotos ou amostra recebidos para validação da equipe.' },
      { id: 'borracha-comercial', titulo: 'Condições comerciais', texto: 'Preencher preço, prazo, frete, impostos, pagamento, validade e garantia somente após aprovação humana.' },
    ],
    ativo: true,
    padrao: true,
  },
  {
    id: 'wayflex-silicone',
    nome: 'Peça técnica em silicone',
    descricao: 'Modelo para coleta e organização dos requisitos de uma peça em silicone.',
    validadePadraoDias: 0,
    formaPagamento: '',
    garantia: '',
    termos: '',
    blocos: [
      { id: 'silicone-uso', titulo: 'Uso e ambiente', texto: 'Descrever aplicação, faixa de temperatura, pressão, contato com fluidos e ambiente de trabalho informados.' },
      { id: 'silicone-dados', titulo: 'Dados da peça', texto: 'Registrar medidas, dureza, cor, acabamento, quantidade e referência técnica disponível.' },
      { id: 'silicone-validacao', titulo: 'Validação técnica', texto: 'Registrar requisitos normativos ou certificações solicitados, sem confirmar atendimento antes da análise da equipe.' },
      { id: 'silicone-comercial', titulo: 'Condições comerciais', texto: 'Preencher preço, prazo, frete, impostos, pagamento, validade e garantia somente após aprovação humana.' },
    ],
    ativo: true,
    padrao: false,
  },
  {
    id: 'wayflex-poliuretano',
    nome: 'Peça técnica em poliuretano',
    descricao: 'Modelo para componentes sujeitos a carga, impacto ou abrasão.',
    validadePadraoDias: 0,
    formaPagamento: '',
    garantia: '',
    termos: '',
    blocos: [
      { id: 'pu-aplicacao', titulo: 'Aplicação e esforço', texto: 'Descrever carga, impacto, abrasão, rotação, velocidade e frequência de uso informados pelo cliente.' },
      { id: 'pu-especificacao', titulo: 'Especificação da peça', texto: 'Registrar dimensões, dureza, quantidade, acabamento e desenho ou amostra de referência.' },
      { id: 'pu-engenharia', titulo: 'Análise de engenharia', texto: 'Indicar os pontos que dependem de validação técnica antes da fabricação.' },
      { id: 'pu-comercial', titulo: 'Condições comerciais', texto: 'Preencher preço, prazo, frete, impostos, pagamento, validade e garantia somente após aprovação humana.' },
    ],
    ativo: true,
    padrao: false,
  },
  {
    id: 'wayflex-desenvolvimento',
    nome: 'Desenvolvimento de peça especial',
    descricao: 'Modelo para demandas que exigem desenho, amostra, ferramental ou definição conjunta.',
    validadePadraoDias: 0,
    formaPagamento: '',
    garantia: '',
    termos: '',
    blocos: [
      { id: 'especial-necessidade', titulo: 'Necessidade do cliente', texto: 'Registrar o problema, resultado esperado, equipamento e cenário de uso.' },
      { id: 'especial-referencias', titulo: 'Referências recebidas', texto: 'Listar desenhos, medidas, fotos, vídeos, amostras ou códigos fornecidos.' },
      { id: 'especial-pendencias', titulo: 'Pendências para definição', texto: 'Listar informações técnicas e aprovações ainda necessárias para concluir o orçamento.' },
      { id: 'especial-comercial', titulo: 'Condições comerciais', texto: 'Preencher preço, prazo, ferramental, frete, impostos, pagamento, validade e garantia somente após aprovação humana.' },
    ],
    ativo: true,
    padrao: false,
  },
];

interface TemplateState {
  templates: TemplateProposta[];
  loading: boolean;
  saving: boolean;
  loaded: boolean;
  error: string | null;
}

let state: TemplateState = { templates: [], loading: false, saving: false, loaded: false, error: null };
const listeners = new Set<() => void>();
let loadPromise: Promise<void> | null = null;

const notify = () => listeners.forEach((listener) => listener());
const updateState = (next: Partial<TemplateState>) => {
  state = { ...state, ...next };
  notify();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

async function ensureLoaded(force = false): Promise<void> {
  if (state.loaded && !force) return;
  if (loadPromise) return loadPromise;
  updateState({ loading: true, error: null });
  loadPromise = (async () => {
    try {
      const remote = await loadProposalTemplates();
      const templates = remote ?? WAYFLEX_TEMPLATE_EXAMPLES;
      if (remote === null) await saveProposalTemplates(templates);
      updateState({ templates, loaded: true });
    } catch (error) {
      console.error('[proposal-templates] falha ao carregar', error);
      updateState({ error: 'Não foi possível carregar os templates do banco.' });
    } finally {
      updateState({ loading: false });
      loadPromise = null;
    }
  })();
  return loadPromise;
}

async function persist(next: TemplateProposta[]): Promise<void> {
  updateState({ saving: true, error: null });
  try {
    await saveProposalTemplates(next);
    updateState({ templates: next, loaded: true });
  } catch (error) {
    console.error('[proposal-templates] falha ao salvar', error);
    updateState({ error: 'A alteração não foi salva. O conteúdo anterior foi mantido.' });
    throw error;
  } finally {
    updateState({ saving: false });
  }
}

export function useTemplatesPropostaStore() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state);

  useEffect(() => {
    void ensureLoaded();
  }, []);

  const atualizar = async (id: string, mudanca: Partial<TemplateProposta>) => {
    let next = state.templates.map((template) => template.id === id ? { ...template, ...mudanca } : template);
    if (mudanca.padrao) next = next.map((template) => ({ ...template, padrao: template.id === id }));
    await persist(next);
  };

  const adicionar = async (template: TemplateProposta) => {
    const next = template.padrao
      ? [...state.templates.map((item) => ({ ...item, padrao: false })), template]
      : [...state.templates, template];
    await persist(next);
  };

  const duplicar = async (id: string) => {
    const source = state.templates.find((template) => template.id === id);
    if (!source) throw new Error('proposal_template_not_found');
    const copy: TemplateProposta = {
      ...source,
      id: crypto.randomUUID(),
      nome: `${source.nome} — cópia`,
      padrao: false,
      blocos: source.blocos.map((block) => ({ ...block, id: crypto.randomUUID() })),
    };
    await persist([...state.templates, copy]);
  };

  const excluir = async (id: string) => {
    const current = state.templates.find((template) => template.id === id);
    const remaining = state.templates.filter((template) => template.id !== id);
    const next = current?.padrao && remaining.length > 0
      ? remaining.map((template, index) => ({ ...template, padrao: index === 0 }))
      : remaining;
    await persist(next);
  };

  const definirPadrao = async (id: string) => {
    await persist(state.templates.map((template) => ({ ...template, padrao: template.id === id })));
  };

  return {
    ...snapshot,
    atualizar,
    adicionar,
    duplicar,
    excluir,
    definirPadrao,
    recarregar: () => ensureLoaded(true),
  };
}
