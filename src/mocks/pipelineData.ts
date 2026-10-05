export const pipelineStages = [
  { id: 'NOVO', nome: 'Novo', ordem: 1, cor: '#69717d', tipo: 'aberta', permiteAutomacao: true, exigeMotivo: false, exigeResponsavel: false, slaHoras: 24, ativa: true },
  { id: 'EM_CONTATO', nome: 'Em Contato', ordem: 2, cor: '#259b5e', tipo: 'aberta', permiteAutomacao: true, exigeMotivo: false, exigeResponsavel: false, slaHoras: 48, ativa: true },
  { id: 'AGUARDANDO_RESPOSTA', nome: 'Aguardando Resposta', ordem: 3, cor: '#bc8b42', tipo: 'aberta', permiteAutomacao: true, exigeMotivo: false, exigeResponsavel: false, slaHoras: 72, ativa: true },
  { id: 'EM_QUALIFICACAO', nome: 'Em Qualificação', ordem: 4, cor: '#168654', tipo: 'aberta', permiteAutomacao: true, exigeMotivo: false, exigeResponsavel: true, slaHoras: 48, ativa: true },
  { id: 'REUNIAO_AGENDADA', nome: 'Reunião Agendada', ordem: 5, cor: '#474c55', tipo: 'aberta', permiteAutomacao: false, exigeMotivo: false, exigeResponsavel: true, slaHoras: 48, ativa: true },
  { id: 'PROPOSTA_PREPARACAO', nome: 'Proposta em Preparação', ordem: 6, cor: '#d9f66d', tipo: 'aberta', permiteAutomacao: false, exigeMotivo: false, exigeResponsavel: true, slaHoras: 48, ativa: true },
  { id: 'ORCAMENTO_ENVIADO', nome: 'Orçamento Enviado', ordem: 7, cor: '#116b43', tipo: 'aberta', permiteAutomacao: false, exigeMotivo: false, exigeResponsavel: true, slaHoras: 120, ativa: true },
  { id: 'NEGOCIACAO', nome: 'Negociação', ordem: 8, cor: '#20252b', tipo: 'aberta', permiteAutomacao: false, exigeMotivo: false, exigeResponsavel: true, slaHoras: 72, ativa: true },
  { id: 'FECHADO_GANHO', nome: 'Fechado — Ganho', ordem: 9, cor: '#168654', tipo: 'ganha', permiteAutomacao: false, exigeMotivo: false, exigeResponsavel: false, slaHoras: 0, ativa: true },
  { id: 'FECHADO_PERDIDO', nome: 'Fechado — Perdido', ordem: 10, cor: '#bd3d32', tipo: 'perdida', permiteAutomacao: false, exigeMotivo: true, exigeResponsavel: false, slaHoras: 0, ativa: true },
  { id: 'PAUSADO', nome: 'Pausado', ordem: 11, cor: '#69717d', tipo: 'pausada', permiteAutomacao: false, exigeMotivo: false, exigeResponsavel: false, slaHoras: 0, ativa: true },
];
