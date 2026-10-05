// ============================================================
// QUALIFICAÇÃO, CLASSIFICAÇÃO, OBJEÇÕES E BASE DE CONHECIMENTO
// DA ANA — RASCUNHO / INATIVO
// ============================================================

export type StatusRascunho = 'rascunho' | 'ativo' | 'inativo';

// ------------------------- FASE 6 -------------------------
export interface PerguntaQualificacao {
  id: string;
  etapa: 'inicial' | 'qualificacao';
  ordem: number;
  texto: string;
  status: StatusRascunho;
}

export const perguntasQualificacao: PerguntaQualificacao[] = [
  { id: 'pq-1', etapa: 'inicial', ordem: 1, texto: 'Qual é o principal desafio que vocês gostariam de resolver hoje?', status: 'rascunho' },
  { id: 'pq-2', etapa: 'inicial', ordem: 2, texto: 'Como esse processo é feito atualmente?', status: 'rascunho' },
  { id: 'pq-3', etapa: 'inicial', ordem: 3, texto: 'O que mais está dificultando ou consumindo tempo da equipe?', status: 'rascunho' },
  { id: 'pq-4', etapa: 'inicial', ordem: 4, texto: 'Vocês já utilizam alguma ferramenta para resolver isso?', status: 'rascunho' },
  { id: 'pq-5', etapa: 'inicial', ordem: 5, texto: 'Existe algum prazo ou evento que torna essa necessidade mais urgente?', status: 'rascunho' },
  { id: 'pq-6', etapa: 'qualificacao', ordem: 6, texto: 'Quem participa da decisão sobre essa solução?', status: 'rascunho' },
  { id: 'pq-7', etapa: 'qualificacao', ordem: 7, texto: 'O objetivo principal é reduzir trabalho manual, aumentar vendas, organizar processos ou outro?', status: 'rascunho' },
  { id: 'pq-8', etapa: 'qualificacao', ordem: 8, texto: 'Vocês já têm uma faixa de investimento definida para esse projeto?', status: 'rascunho' },
  { id: 'pq-9', etapa: 'qualificacao', ordem: 9, texto: 'Gostariam de receber uma proposta ou preferem conversar primeiro com um especialista?', status: 'rascunho' },
  { id: 'pq-10', etapa: 'qualificacao', ordem: 10, texto: 'Qual seria o melhor próximo passo para vocês?', status: 'rascunho' },
];

// ------------------------- FASE 7 -------------------------
export const intencoesAna = [
  'interesse',
  'dúvida',
  'objeção',
  'preço',
  'orçamento',
  'agendamento',
  'suporte',
  'negativo',
  'opt-out',
  'neutro',
];

export const faixasScore = [
  { faixa: '0–29', classificacao: 'frio' },
  { faixa: '30–59', classificacao: 'em avaliação' },
  { faixa: '60–79', classificacao: 'qualificado' },
  { faixa: '80–100', classificacao: 'quente' },
];

export const sinaisPositivos = [
  'Pediu orçamento',
  'Pediu preço',
  'Informou problema específico',
  'Mencionou prazo',
  'Pediu reunião',
  'Perguntou sobre implantação',
  'Pediu apresentação ou catálogo',
];

export const sinaisRisco = [
  'Pediu desconto',
  'Contestou preço',
  'Fez reclamação',
  'Demonstrou irritação',
  'Pediu contrato ou condição especial',
  'Informou que não quer contato',
  'Perguntou algo fora da base',
];

export const proximasAcoes = [
  'responder',
  'qualificar',
  'enviar_orcamento',
  'agendar',
  'transferir_humano',
  'follow_up',
  'encerrar',
];

// ------------------------- FASE 8 -------------------------
export interface ObjecaoResposta {
  id: string;
  objecao: string;
  respostaWhatsapp: string;
  respostaEmail: string;
  proximaPergunta: string;
  acaoKanban: string;
  transferirHumano: boolean;
  motivo: string;
  status: StatusRascunho;
}

export const objecoesRespostas: ObjecaoResposta[] = [
  {
    id: 'ob-1',
    objecao: 'Está caro.',
    respostaWhatsapp: 'Entendo que o investimento precise ser avaliado com cuidado. Posso explicar o que está incluído e o retorno esperado?',
    respostaEmail: 'Prezado(a) {nome}, entendo que o investimento precise ser avaliado. Posso detalhar o escopo, o que está incluso e o retorno mensurável esperado para que você decida com segurança.',
    proximaPergunta: 'Qual parte do investimento você considera que não compensa?',
    acaoKanban: 'Manter em Negociação / Em Qualificação.',
    transferirHumano: true,
    motivo: 'Preço e desconto exigem autorização humana.',
    status: 'rascunho',
  },
  {
    id: 'ob-2',
    objecao: 'Preciso pensar.',
    respostaWhatsapp: 'Sem problema, é uma decisão importante. Posso enviar um resumo para você avaliar com calma?',
    respostaEmail: 'Sem problema. Vou encaminhar um resumo da proposta para que você avalie com calma. Fico à disposição para esclarecer qualquer dúvida quando estiver pronto.',
    proximaPergunta: 'Posso enviar um resumo da proposta por e-mail?',
    acaoKanban: 'Manter em Orçamento Enviado.',
    transferirHumano: false,
    motivo: 'Lead ainda em avaliação; aguardar retorno.',
    status: 'rascunho',
  },
  {
    id: 'ob-3',
    objecao: 'Já tenho fornecedor.',
    respostaWhatsapp: 'Compreendo. Se estiver aberto a conhecer, posso compartilhar resultados que já alcançamos em segmentos parecidos. Seria só uma conversa sem compromisso.',
    respostaEmail: 'Compreendo que já trabalhe com um fornecedor. Posso compartilhar resultados relevantes do seu segmento para que você avalie se faz sentido um segundo parecer.',
    proximaPergunta: 'Posso te mostrar resultados do seu segmento?',
    acaoKanban: 'Manter em Em Contato.',
    transferirHumano: false,
    motivo: 'Momento de nutrição, não de pressão.',
    status: 'rascunho',
  },
  {
    id: 'ob-4',
    objecao: 'Não tenho orçamento agora.',
    respostaWhatsapp: 'Tudo bem. Posso deixar um contato registrado e retomar em um momento melhor?',
    respostaEmail: 'Sem problemas. Registro seu interesse e retomo em um momento mais adequado. Se surgir alguma dúvida, estamos à disposição.',
    proximaPergunta: 'Posso retomar o contato daqui a alguns meses?',
    acaoKanban: 'Mover para Pausado.',
    transferirHumano: false,
    motivo: 'Sem verba no momento; agendar recontato.',
    status: 'rascunho',
  },
  {
    id: 'ob-5',
    objecao: 'Mande uma apresentação.',
    respostaWhatsapp: 'Claro! Vou te enviar um material resumido. Tem algum segmento ou solução específica que prefere que eu destaque?',
    respostaEmail: 'Claro! Vou encaminhar uma apresentação da Wayflex. Para personalizar, poderia me contar qual aplicação e material vocês necessitam?',
    proximaPergunta: 'Qual solução você gostaria que eu destacasse?',
    acaoKanban: 'Manter em Em Qualificação.',
    transferirHumano: false,
    motivo: 'Pedido de material — respondível pela Ana.',
    status: 'rascunho',
  },
  {
    id: 'ob-6',
    objecao: 'Não sou a pessoa responsável.',
    respostaWhatsapp: 'Sem problema! Poderia me indicar quem seria a melhor pessoa para conversar sobre isso?',
    respostaEmail: 'Sem problema. Poderia me indicar a pessoa responsável por decisões de tecnologia, marketing ou processos digitais? Ficarei feliz em entrar em contato.',
    proximaPergunta: 'Pode me indicar a pessoa responsável?',
    acaoKanban: 'Manter em Em Contato.',
    transferirHumano: false,
    motivo: 'Pedir indicação do decisor.',
    status: 'rascunho',
  },
  {
    id: 'ob-7',
    objecao: 'Não tenho interesse.',
    respostaWhatsapp: 'Entendido, agradeço seu tempo. Posso encerrar o contato e não te procurar mais. Se um dia precisar, estou à disposição.',
    respostaEmail: 'Entendido e agradecemos seu tempo. Encerrarei o contato e não enviaremos novas mensagens. Caso mude de ideia, estamos à disposição.',
    proximaPergunta: 'Prefere que eu encerre de vez o contato?',
    acaoKanban: 'Mover para Fechado — Perdido (Sem interesse).',
    transferirHumano: false,
    motivo: 'Respeitar recusa; encerrar ou oferecer opt-out.',
    status: 'rascunho',
  },
  {
    id: 'ob-8',
    objecao: 'Pode me ligar?',
    respostaWhatsapp: 'Claro! Vou registrar seu pedido e encaminhar para a pessoa responsável entrar em contato pelo telefone. Qual o melhor horário para ligar?',
    respostaEmail: 'Claro! Vou encaminhar seu pedido para nossa equipe entrar em contato por telefone. Poderia informar o melhor horário e número para contato?',
    proximaPergunta: 'Qual o melhor horário para ligarmos?',
    acaoKanban: 'Manter em Em Contato.',
    transferirHumano: true,
    motivo: 'Ligação é feita por humano.',
    status: 'rascunho',
  },
  {
    id: 'ob-9',
    objecao: 'Quero falar com uma pessoa.',
    respostaWhatsapp: 'Claro! Vou transferir seu atendimento para um especialista da nossa equipe agora.',
    respostaEmail: 'Claro! Vou encaminhar seu atendimento a um especialista da nossa equipe, que entrará em contato com todo o contexto da conversa.',
    proximaPergunta: 'Nenhuma — transferir imediatamente.',
    acaoKanban: 'Mover para Em Contato com responsável.',
    transferirHumano: true,
    motivo: 'Pedido explícito de atendimento humano.',
    status: 'rascunho',
  },
  {
    id: 'ob-10',
    objecao: 'Vocês dão desconto?',
    respostaWhatsapp: 'Entendo que a condição seja importante. Vou encaminhar isso para nosso especialista, que poderá avaliar uma condição adequada ao seu caso.',
    respostaEmail: 'Entendo que a condição seja relevante. Vou encaminhar sua solicitação ao nosso especialista, que avaliará uma condição adequada e retornará com uma proposta.',
    proximaPergunta: 'Nenhuma — transferir para humano.',
    acaoKanban: 'Mover para Negociação.',
    transferirHumano: true,
    motivo: 'Desconto sempre exige autorização humana.',
    status: 'rascunho',
  },
];

// ------------------------- FASE 11 -------------------------
export const categoriasBaseConhecimento = [
  'Sobre a Wayflex',
  'Produtos e serviços',
  'Benefícios e diferenciais',
  'Perguntas frequentes',
  'Processo comercial',
  'Objeções',
  'Preços e condições',
  'Prazos e implantação',
  'Política de atendimento',
  'LGPD e privacidade',
  'Situações que exigem humano',
];

export interface ItemBaseConhecimento {
  id: string;
  categoria: string;
  titulo: string;
  conteudo: string;
  tags: string[];
  produtoRelacionado?: string;
  status: StatusRascunho;
  versao: number;
  responsavel: string;
  dataRevisao: string;
}

export const baseConhecimentoAna: ItemBaseConhecimento[] = [
  {
    id: 'bc-1',
    categoria: 'Produtos e serviços',
    titulo: 'Desenvolvimento de peça técnica',
    conteudo: 'Levantamento de aplicação, medidas, material e condições de operação para análise técnica humana.',
    tags: ['consultoria', 'marketing', 'estratégia'],
    produtoRelacionado: 'Peça técnica sob medida',
    status: 'rascunho',
    versao: 1,
    responsavel: 'A definir',
    dataRevisao: '2026-08-19',
  },
  {
    id: 'bc-2',
    categoria: 'Produtos e serviços',
    titulo: 'Desenvolvimento de Site',
    conteudo: 'Sites responsivos otimizados para SEO e conversão, com integração a CRM.',
    tags: ['site', 'landing page', 'desenvolvimento'],
    produtoRelacionado: 'Desenvolvimento de Site',
    status: 'rascunho',
    versao: 1,
    responsavel: 'A definir',
    dataRevisao: '2026-08-19',
  },
  {
    id: 'bc-3',
    categoria: 'Produtos e serviços',
    titulo: 'Automação de Vendas',
    conteudo: 'Fluxos automatizados de prospecção, qualificação e acompanhamento de leads via WhatsApp e e-mail.',
    tags: ['automação', 'prospecção', 'fluxos'],
    produtoRelacionado: 'Automação de Vendas',
    status: 'rascunho',
    versao: 1,
    responsavel: 'A definir',
    dataRevisao: '2026-08-19',
  },
  {
    id: 'bc-4',
    categoria: 'Produtos e serviços',
    titulo: 'Consultoria de IA',
    conteudo: 'Criação e treinamento de agentes de IA para atendimento, qualificação de leads e suporte técnico.',
    tags: ['ia', 'agente', 'atendimento'],
    produtoRelacionado: 'Consultoria de IA',
    status: 'rascunho',
    versao: 1,
    responsavel: 'A definir',
    dataRevisao: '2026-08-19',
  },
  {
    id: 'bc-5',
    categoria: 'Produtos e serviços',
    titulo: 'Gestão de Redes Sociais',
    conteudo: 'Planejamento, criação de conteúdo e gestão de comunidades para Instagram, LinkedIn e TikTok.',
    tags: ['redes sociais', 'conteúdo', 'comunidades'],
    produtoRelacionado: 'Gestão de Redes Sociais',
    status: 'rascunho',
    versao: 1,
    responsavel: 'A definir',
    dataRevisao: '2026-08-19',
  },
];

export const informacoesPendentes = [
  'Público-alvo oficial da Wayflex',
  'Tabela de preços vigente (por produto/serviço)',
  'Condições de pagamento e descontos aprovados',
  'Prazos de implantação por tipo de projeto',
  'Cases e depoimentos reais autorizados para divulgação',
  'Link oficial de agendamento de reuniões',
  'Diferenciais competitivos validados',
  'Política de recontato e frequência máxima',
];

// ------------------------- FASE 10 -------------------------
export const fluxoHandoff = [
  'Pausar automação do lead',
  'Criar tarefa para o responsável',
  'Notificar responsável e gestor conforme prioridade',
  'Gerar resumo de 2–3 frases',
  'Informar intenção, score, sentimento e confiança',
  'Mostrar transcript completo ao humano',
  'Informar ao lead que uma pessoa assumirá o atendimento',
  'Não fazer o cliente repetir o histórico',
];
