// ============================================================
// TEMPLATES DA ANA — RASCUNHO / INATIVO
// Nenhum template é enviado automaticamente nesta versão.
// Aguarda revisão e aprovação humana (e aprovação do WhatsApp).
// ============================================================

export type StatusRascunho = 'rascunho' | 'ativo' | 'inativo';

export interface TemplatePrimeiroContato {
  id: string;
  nomeInterno: string;
  canal: 'WhatsApp' | 'E-mail';
  categoria: string;
  objetivo: string;
  publico: string;
  texto: string;
  variaveis: string[];
  limiteCaracteres: number;
  condicoesUso: string[];
  proximaAcao: string;
  status: StatusRascunho;
  versao: number;
  dataRevisao: string;
  requerAprovacaoWhatsApp?: boolean;
}

export const templatesPrimeiroContato: TemplatePrimeiroContato[] = [
  {
    id: 'tpc-1',
    nomeInterno: 'whatsapp_primeiro_contato_consultivo',
    canal: 'WhatsApp',
    categoria: 'Primeiro contato',
    objetivo: 'Abordagem consultiva que abre espaço para o lead explicar a necessidade.',
    publico: 'Leads novos em geral, sem sinal claro de urgência.',
    texto:
      'Olá, {nome}! Aqui é a Ana, da {nome_empresa}. Vi que a {empresa} atua em {segmento} e queria entender se vocês estão buscando melhorar algum processo relacionado a tecnologia, automação ou presença digital. Posso fazer uma pergunta rápida para entender melhor?',
    variaveis: ['nome', 'nome_empresa', 'empresa', 'segmento'],
    limiteCaracteres: 500,
    condicoesUso: ['Somente modo IA', 'Dentro do horário comercial', 'Lead sem opt-out', 'Uma mensagem por contato'],
    proximaAcao: 'Aguardar resposta.',
    status: 'rascunho',
    versao: 1,
    dataRevisao: '2026-08-19',
    requerAprovacaoWhatsApp: true,
  },
  {
    id: 'tpc-2',
    nomeInterno: 'whatsapp_primeiro_contato_direto',
    canal: 'WhatsApp',
    categoria: 'Primeiro contato',
    objetivo: 'Abordagem direta focada em identificar um desafio específico.',
    publico: 'Leads com origem de busca ou interesse já demonstrado.',
    texto:
      'Olá, {nome}! Sou a Ana, da {nome_empresa}. Ajudamos empresas a melhorar seus processos digitais e comerciais. Hoje vocês têm algum desafio específico nessa área que gostariam de resolver?',
    variaveis: ['nome', 'nome_empresa'],
    limiteCaracteres: 500,
    condicoesUso: ['Somente modo IA', 'Dentro do horário comercial', 'Lead sem opt-out'],
    proximaAcao: 'Qualificar necessidade.',
    status: 'rascunho',
    versao: 1,
    dataRevisao: '2026-08-19',
    requerAprovacaoWhatsApp: true,
  },
  {
    id: 'tpc-3',
    nomeInterno: 'whatsapp_confirmacao_decisor',
    canal: 'WhatsApp',
    categoria: 'Confirmação de decisor',
    objetivo: 'Confirmar que fala com a pessoa que decide sobre tecnologia, marketing ou processos digitais.',
    publico: 'Quando o contato recebido pode não ser o decisor.',
    texto:
      'Olá, {nome}! Falo com a pessoa responsável por decisões relacionadas a tecnologia, marketing ou processos digitais na {empresa}? Sou a Ana, da {nome_empresa}.',
    variaveis: ['nome', 'empresa', 'nome_empresa'],
    limiteCaracteres: 500,
    condicoesUso: ['Somente modo IA', 'Dentro do horário comercial', 'Lead sem opt-out'],
    proximaAcao: 'Confirmar decisor ou pedir indicação.',
    status: 'rascunho',
    versao: 1,
    dataRevisao: '2026-08-19',
    requerAprovacaoWhatsApp: true,
  },
  {
    id: 'tpc-4',
    nomeInterno: 'whatsapp_primeiro_contato_agendado',
    canal: 'WhatsApp',
    categoria: 'Contato fora do horário',
    objetivo: 'Informar o lead fora do horário comercial e prometer retorno no horário de atendimento.',
    publico: 'Lead captado fora do horário comercial.',
    texto:
      'Olá, {nome}! Aqui é a Ana, da {nome_empresa}. Recebi seu contato e gostaria de entender melhor como podemos ajudar a {empresa}. Retornarei durante nosso horário de atendimento: {horario_atendimento}.',
    variaveis: ['nome', 'nome_empresa', 'empresa', 'horario_atendimento'],
    limiteCaracteres: 500,
    condicoesUso: ['Somente modo IA', 'Enviado quando fora da janela comercial', 'Lead sem opt-out'],
    proximaAcao: 'Aguardar resposta.',
    status: 'rascunho',
    versao: 1,
    dataRevisao: '2026-08-19',
    requerAprovacaoWhatsApp: true,
  },
  {
    id: 'tpc-5',
    nomeInterno: 'email_apresentacao_comercial',
    canal: 'E-mail',
    categoria: 'Primeiro contato',
    objetivo: 'Apresentação comercial por e-mail, com espaço para o lead responder.',
    publico: 'Leads com e-mail válido e que aceitam contato por e-mail.',
    texto:
      'Olá, {nome}.\n\nSou a Ana, assistente comercial da {nome_empresa}. Entrei em contato porque a {empresa} atua em {segmento}, e ajudamos empresas a organizar processos digitais, automações e oportunidades comerciais.\n\nGostaria de entender: qual é hoje o principal desafio da {empresa} nessa área?\n\nSe preferir, posso encaminhar algumas informações ou agendar uma conversa com nosso especialista.\n\nAtenciosamente,\nAna\n{nome_empresa}',
    variaveis: ['nome', 'nome_empresa', 'empresa', 'segmento'],
    limiteCaracteres: 500,
    condicoesUso: ['Somente modo IA', 'Lead sem opt-out', 'E-mail válido'],
    proximaAcao: 'Aguardar resposta e qualificar.',
    status: 'rascunho',
    versao: 1,
    dataRevisao: '2026-08-19',
  },
];

export const assuntoEmailApresentacao = 'Uma ideia para a {empresa}, {nome}';

export interface FollowUpAna {
  id: string;
  nome: string;
  disparo: string;
  texto: string;
  variaveis: string[];
  proximaAcao: string;
  status: StatusRascunho;
  versao: number;
}

export const followUpsAna: FollowUpAna[] = [
  {
    id: 'fu-1',
    nome: 'Follow-up 1',
    disparo: '24 horas sem resposta',
    texto:
      'Olá, {nome}! Passando apenas para confirmar se minha mensagem chegou. Gostaria de entender se existe algum desafio em que a {nome_empresa} possa ajudar a {empresa}. Se não for o momento, tudo bem; posso encerrar o contato.',
    variaveis: ['nome', 'nome_empresa', 'empresa'],
    proximaAcao: 'Aguardar resposta.',
    status: 'rascunho',
    versao: 1,
  },
  {
    id: 'fu-2',
    nome: 'Follow-up 2',
    disparo: '48 horas sem resposta',
    texto:
      'Olá, {nome}! Como não tive retorno, vou encerrar este contato por enquanto. Se surgir alguma necessidade relacionada a tecnologia, automação ou processos digitais, ficaremos à disposição. Obrigada!',
    variaveis: ['nome'],
    proximaAcao: 'Após envio, mover para Fechado — Perdido (Sem resposta).',
    status: 'rascunho',
    versao: 1,
  },
];

export const regrasCadencia = [
  'Nunca enviar follow-up se houver resposta.',
  'Nunca enviar após opt-out ou bloqueio.',
  'Nunca exceder o limite diário configurado.',
  'Após a cadência final, mover o lead para Fechado — Perdido (Sem resposta).',
  'Permitir reativação manual com nova campanha.',
];