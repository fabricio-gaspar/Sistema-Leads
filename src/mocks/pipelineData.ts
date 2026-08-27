export const pipelineStages = [
  { id: 'NOVO', nome: 'Novo', ordem: 1, cor: '#3b82f6', tipo: 'aberta', permiteAutomacao: true, exigeMotivo: false, exigeResponsavel: false, slaHoras: 24, ativa: true },
  { id: 'EM_CONTATO', nome: 'Em Contato', ordem: 2, cor: '#06b6d4', tipo: 'aberta', permiteAutomacao: true, exigeMotivo: false, exigeResponsavel: false, slaHoras: 48, ativa: true },
  { id: 'AGUARDANDO_RESPOSTA', nome: 'Aguardando Resposta', ordem: 3, cor: '#f59e0b', tipo: 'aberta', permiteAutomacao: true, exigeMotivo: false, exigeResponsavel: false, slaHoras: 72, ativa: true },
  { id: 'EM_QUALIFICACAO', nome: 'Em Qualificação', ordem: 4, cor: '#8b5cf6', tipo: 'aberta', permiteAutomacao: true, exigeMotivo: false, exigeResponsavel: true, slaHoras: 48, ativa: true },
  { id: 'REUNIAO_AGENDADA', nome: 'Reunião Agendada', ordem: 5, cor: '#0ea5e9', tipo: 'aberta', permiteAutomacao: false, exigeMotivo: false, exigeResponsavel: true, slaHoras: 48, ativa: true },
  { id: 'PROPOSTA_PREPARACAO', nome: 'Proposta em Preparação', ordem: 6, cor: '#ec4899', tipo: 'aberta', permiteAutomacao: false, exigeMotivo: false, exigeResponsavel: true, slaHoras: 48, ativa: true },
  { id: 'ORCAMENTO_ENVIADO', nome: 'Orçamento Enviado', ordem: 7, cor: '#14b8a6', tipo: 'aberta', permiteAutomacao: false, exigeMotivo: false, exigeResponsavel: true, slaHoras: 120, ativa: true },
  { id: 'NEGOCIACAO', nome: 'Negociação', ordem: 8, cor: '#f97316', tipo: 'aberta', permiteAutomacao: false, exigeMotivo: false, exigeResponsavel: true, slaHoras: 72, ativa: true },
  { id: 'FECHADO_GANHO', nome: 'Fechado — Ganho', ordem: 9, cor: '#22c55e', tipo: 'ganha', permiteAutomacao: false, exigeMotivo: false, exigeResponsavel: false, slaHoras: 0, ativa: true },
  { id: 'FECHADO_PERDIDO', nome: 'Fechado — Perdido', ordem: 10, cor: '#ef4444', tipo: 'perdida', permiteAutomacao: false, exigeMotivo: true, exigeResponsavel: false, slaHoras: 0, ativa: true },
  { id: 'PAUSADO', nome: 'Pausado', ordem: 11, cor: '#6b7280', tipo: 'pausada', permiteAutomacao: false, exigeMotivo: false, exigeResponsavel: false, slaHoras: 0, ativa: true },
];