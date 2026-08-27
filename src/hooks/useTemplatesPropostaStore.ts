import { createBackendStore } from '@/lib/backendStore';

// Bloco reutilizável de uma proposta (cláusula, seção, rodapé). Pode ser
// ligado/desligado ao montar um orçamento.
export interface BlocoProposta {
  id: string;
  titulo: string;
  texto: string;
}

// Template de proposta/orçamento: estrutura pronta com validade, forma de
// pagamento, garantia e termos, além de blocos reutilizáveis.
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

const inicial: TemplateProposta[] = [
  {
    id: 'tp-1',
    nome: 'Projeto sob medida',
    descricao: 'Orçamento padrão para projetos únicos (site, branding, automação).',
    validadePadraoDias: 15,
    formaPagamento: '50% na assinatura e 50% na entrega',
    garantia: 'Garantia de 90 dias sobre as entregas, com suporte incluído no período.',
    termos: 'Valores válidos até {validade}. Após a aprovação, o projeto inicia mediante pagamento da primeira parcela. Escopo e prazos descritos nesta proposta.',
    blocos: [
      { id: 'bl-1', titulo: 'Condições de pagamento', texto: '50% no aceite e 50% na entrega final, via PIX ou boleto.' },
      { id: 'bl-2', titulo: 'Prazo de entrega', texto: 'Entrega em até 30 dias úteis após o aceite e pagamento da entrada.' },
      { id: 'bl-3', titulo: 'Garantia', texto: 'Garantia de 90 dias sobre as entregas, com suporte incluído no período.' },
      { id: 'bl-4', titulo: 'Escopo', texto: 'O escopo contempla exclusivamente os itens listados nesta proposta. Alterações serão orçadas à parte.' },
    ],
    ativo: true,
    padrao: true,
  },
  {
    id: 'tp-2',
    nome: 'Mensalidade recorrente',
    descricao: 'Para serviços contínuos (tráfego pago, SEO, gestão de CRM).',
    validadePadraoDias: 30,
    formaPagamento: 'Mensal, via cartão ou boleto recorrente',
    garantia: 'Contrato sem fidelidade — cancele a qualquer momento com aviso de 30 dias.',
    termos: 'Plano mensal com renovação automática. Valores reajustáveis anualmente mediante aviso prévio de 30 dias.',
    blocos: [
      { id: 'bl-1', titulo: 'Condições de pagamento', texto: 'Mensalidade paga antecipadamente, no início de cada ciclo.' },
      { id: 'bl-2', titulo: 'Sem fidelidade', texto: 'Cancelamento a qualquer momento, com aviso prévio de 30 dias.' },
      { id: 'bl-3', titulo: 'Relatórios', texto: 'Relatório mensal de performance com métricas e recomendações.' },
    ],
    ativo: true,
    padrao: false,
  },
  {
    id: 'tp-3',
    nome: 'Proposta simplificada',
    descricao: 'Orçamento enxuto para fechamentos rápidos.',
    validadePadraoDias: 7,
    formaPagamento: '100% no aceite',
    garantia: 'Garantia de 30 dias sobre as entregas.',
    termos: 'Valores válidos até {validade}. Condições sujeitas a aprovação de crédito.',
    blocos: [
      { id: 'bl-1', titulo: 'Condições de pagamento', texto: 'Pagamento integral no aceite, via PIX.' },
      { id: 'bl-2', titulo: 'Prazo de entrega', texto: 'Entrega em até 15 dias úteis.' },
    ],
    ativo: true,
    padrao: false,
  },
];

const STORAGE_KEY = 'leadai_templates_proposta_v1';
const store = createBackendStore<TemplateProposta[]>('templates_proposta', STORAGE_KEY, inicial);

export function useTemplatesPropostaStore() {
  const templates = store.useStore();

  const atualizar = (id: string, mudanca: Partial<TemplateProposta>) => {
    store.set((prev) => prev.map((t) => (t.id === id ? { ...t, ...mudanca } : t)));
  };

  const adicionar = (t: TemplateProposta) => {
    store.set((prev) => [...prev, t]);
  };

  const excluir = (id: string) => {
    store.set((prev) => prev.filter((t) => t.id !== id));
  };

  const definirPadrao = (id: string) => {
    store.set((prev) => prev.map((t) => ({ ...t, padrao: t.id === id })));
  };

  return { templates, atualizar, adicionar, excluir, definirPadrao };
}