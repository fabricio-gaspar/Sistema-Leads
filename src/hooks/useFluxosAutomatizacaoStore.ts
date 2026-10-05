import { createContextStore } from '@/lib/contextStore';
import { loadOperationalFlows, persistOperationalFlows } from '@/lib/crm/operationalEntitiesRepository';
import { isUuid } from '@/lib/crm/leadMapper';

// Um passo de um fluxo: uma mensagem enviada X dias após o gatilho, por um canal.
export interface PassoFluxo {
  id: string;
  diasApos: number;
  canal: string;
  mensagem: string;
}

// Gatilhos disponíveis para disparar um fluxo pronto.
export const GATILHOS_FLUXO: { valor: string; rotulo: string }[] = [
  { valor: 'novo_lead', rotulo: 'Novo lead (boas-vindas)' },
  { valor: 'orcamento_enviado', rotulo: 'Orçamento enviado' },
  { valor: 'lead_inativo', rotulo: 'Lead inativo' },
  { valor: 'aniversario', rotulo: 'Aniversário' },
];

export function rotuloGatilho(valor: string): string {
  return GATILHOS_FLUXO.find((g) => g.valor === valor)?.rotulo || valor;
}

// Fluxo de automação pronto: sequência de mensagens com timing e canal.
export interface FluxoAutomatizacao {
  id: string;
  nome: string;
  gatilho: string;
  descricao: string;
  passos: PassoFluxo[];
  ativo: boolean;
}

export const fluxosIniciais: FluxoAutomatizacao[] = [
  {
    id: 'fl-1',
    nome: 'Boas-vindas e apresentação',
    gatilho: 'novo_lead',
    descricao: 'Sequência de primeiro contato para leads recém-ativados no Kanban.',
    passos: [
      { id: 'p-1', diasApos: 0, canal: 'WhatsApp', mensagem: 'Olá, {nome}! Aqui é a Ana, da {empresa_nome}. Posso entender qual peça, material ou aplicação industrial você precisa avaliar?' },
      { id: 'p-2', diasApos: 1, canal: 'E-mail', mensagem: 'Oi {nome}, conforme conversamos, segue nossa apresentação institucional com cases e diferenciais. Fico à disposição para tirar qualquer dúvida!\n\n{assinatura}' },
      { id: 'p-3', diasApos: 3, canal: 'WhatsApp', mensagem: 'Oi {nome}, tudo bem? Vi que você ainda não teve tempo de ver a apresentação. Quer que eu resuma os principais pontos por aqui?' },
    ],
    ativo: true,
  },
  {
    id: 'fl-2',
    nome: 'Follow-up pós-orçamento',
    gatilho: 'orcamento_enviado',
    descricao: 'Cadência de 1/3/7 dias após o envio do orçamento, para não deixar a proposta esfriar.',
    passos: [
      { id: 'p-1', diasApos: 1, canal: 'WhatsApp', mensagem: 'Oi {nome}, te enviei o orçamento ontem. Conseguiu dar uma olhada? Posso esclarecer qualquer ponto.' },
      { id: 'p-2', diasApos: 3, canal: 'E-mail', mensagem: 'Olá {nome}, reforçando o envio do orçamento. A validade é de {validade}. Se precisar de alguma condição especial, me avise!\n\n{assinatura}' },
      { id: 'p-3', diasApos: 7, canal: 'WhatsApp', mensagem: '{nome}, o orçamento expira em breve. Quer que eu reserve um horário pra gente fechar os detalhes?' },
    ],
    ativo: true,
  },
  {
    id: 'fl-3',
    nome: 'Reativação de lead inativo',
    gatilho: 'lead_inativo',
    descricao: 'Tentativa de reengajar leads que pararam de responder ou ficaram parados no funil.',
    passos: [
      { id: 'p-1', diasApos: 0, canal: 'E-mail', mensagem: 'Oi {nome}, faz um tempo que não conversamos. Queria saber se o seu interesse em {oferta} continua de pé. Posso ajudar em algo?\n\n{assinatura}' },
      { id: 'p-2', diasApos: 2, canal: 'WhatsApp', mensagem: 'Oi {nome}, passei por aqui e lembrei de você! Ainda faz sentido a gente conversar sobre {oferta}? Se preferir, sigo sem te incomodar. 😊' },
    ],
    ativo: false,
  },
  {
    id: 'fl-4',
    nome: 'Aniversário de parceria',
    gatilho: 'aniversario',
    descricao: 'Mensagem de relacionamento no aniversário do lead ou da parceria.',
    passos: [
      { id: 'p-1', diasApos: 0, canal: 'WhatsApp', mensagem: '{nome}, parabéns pelo seu dia! 🎉 Foi um prazer trabalhar com a {empresa}. Que venham mais conquistas juntos!' },
    ],
    ativo: false,
  },
];

const store = createContextStore<FluxoAutomatizacao[]>({
  initial: () => [],
  load: async () => loadOperationalFlows(),
  save: (previous, next) => persistOperationalFlows(previous, next),
  normalize: (items) => items.map((item) => ({ ...item, id: isUuid(item.id) ? item.id : crypto.randomUUID() })),
});

export function useFluxosAutomatizacaoStore() {
  const fluxos = store.useData();
  const updateState = store.bindUpdate();

  const atualizar = (id: string, mudanca: Partial<FluxoAutomatizacao>) => {
    updateState((prev) => prev.map((f) => (f.id === id ? { ...f, ...mudanca } : f)));
  };

  const adicionar = (f: FluxoAutomatizacao) => {
    updateState((prev) => [...prev, f]);
  };

  const excluir = (id: string) => {
    updateState((prev) => prev.filter((f) => f.id !== id));
  };

  return { fluxos, atualizar, adicionar, excluir };
}

// Acesso imperativo ao snapshot dos fluxos (para o motor de automação).
export function getFluxosSnapshot(): FluxoAutomatizacao[] {
  return store.get();
}
