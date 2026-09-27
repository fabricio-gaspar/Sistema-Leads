export const ACTIVE_PIPELINE_STAGES = [
  'entered',
  'engaging',
  'qualified',
  'quote_preparation',
  'quote_sent',
  'won',
  'lost',
] as const;

export type PipelineStageCode = (typeof ACTIVE_PIPELINE_STAGES)[number];
export type OpportunityOutcome = 'open' | 'won' | 'lost';
export type StageSource = 'human' | 'rule' | 'ai_suggestion';

export const PIPELINE_STAGE_LABEL: Record<PipelineStageCode, string> = {
  entered: 'Novo',
  engaging: 'Apresentado',
  qualified: 'Qualificando',
  quote_preparation: 'Reunião',
  quote_sent: 'Orçamento',
  won: 'Ganho',
  lost: 'Perdido',
};

const legacyStageMap: Record<string, PipelineStageCode> = {
  'Novo': 'entered',
  'Apresentado': 'engaging',
  'Qualificando': 'qualified',
  'Reunião': 'quote_preparation',
  'Orçamento': 'quote_sent',
  Ganho: 'won',
  Perdido: 'lost',
  'Em Contato': 'engaging',
  'Aguardando Resposta': 'engaging',
  'Em Qualificação': 'qualified',
  'Reunião Agendada': 'qualified',
  'Proposta em Preparação': 'quote_preparation',
  'Orçamento Enviado': 'quote_sent',
  'Negociação': 'quote_sent',
  'Pausado': 'engaging',
  'Fechado — Ganho': 'won',
  'Fechado — Perdido': 'lost',
  'Prospecção': 'entered',
  'Qualificado': 'qualified',
  'Proposta': 'quote_sent',
  'Pedido': 'quote_sent',
  'Fechado': 'won',
  'Contatos Perdidos': 'lost',
};

export function stageFromLegacy(stage: string): PipelineStageCode {
  return legacyStageMap[stage] ?? 'entered';
}

export function legacyStageForPipeline(stage: PipelineStageCode): string {
  return {
    entered: 'Novo',
    engaging: 'Apresentado',
    qualified: 'Qualificando',
    quote_preparation: 'Reunião',
    quote_sent: 'Orçamento',
    won: 'Ganho',
    lost: 'Perdido',
  }[stage];
}

export function outcomeFromLegacy(stage: string): OpportunityOutcome {
  if (stage === 'Ganho' || stage === 'Fechado — Ganho') return 'won';
  if (stage === 'Perdido' || stage === 'Fechado — Perdido') return 'lost';
  return 'open';
}

export interface TransitionEvidence {
  hasPersistedMessage?: boolean;
  isQualified?: boolean;
  hasSentQuote?: boolean;
  hasDecisionSignal?: boolean;
  explicitOptOut?: boolean;
  confirmedByHuman?: boolean;
}

export function canTransitionOpportunity(input: {
  from: PipelineStageCode;
  to: PipelineStageCode;
  outcome?: OpportunityOutcome;
  source: StageSource;
  evidence: TransitionEvidence;
}): { ok: boolean; reason?: string } {
  const { from, to, outcome = 'open', source, evidence } = input;

  if ((to === 'won' || outcome === 'won') && source !== 'human') {
    return { ok: false, reason: 'A Ana não pode concluir uma oportunidade como ganha.' };
  }
  if ((to === 'won' || outcome === 'won') && !evidence.confirmedByHuman) {
    return { ok: false, reason: 'O fechamento como ganho exige confirmação humana.' };
  }
  if ((to === 'lost' || outcome === 'lost') && !evidence.explicitOptOut && !evidence.confirmedByHuman) {
    return { ok: false, reason: 'Perdas exigem confirmação humana, exceto opt-out inequívoco.' };
  }
  if (from === to) return { ok: true };

  if (from === 'won' || from === 'lost') {
    return { ok: false, reason: 'Ganho e Perdido são estados terminais e não podem ser reabertos por transição comum.' };
  }

  const order = ACTIVE_PIPELINE_STAGES.indexOf(from);
  const target = ACTIVE_PIPELINE_STAGES.indexOf(to);
  if (target < order) return { ok: false, reason: 'O Kanban não permite regressão automática de etapa.' };
  if (source !== 'human' && target > order + 1 && to !== 'lost') {
    return { ok: false, reason: 'Automações avançam somente uma etapa por vez.' };
  }

  if (to === 'engaging' && !evidence.hasPersistedMessage) {
    return { ok: false, reason: 'É necessário ao menos um evento de mensagem persistido.' };
  }
  if (to === 'qualified' && !evidence.isQualified) {
    return { ok: false, reason: 'A qualificação ainda não foi concluída.' };
  }
  if (to === 'quote_preparation' && !evidence.isQualified) {
    return { ok: false, reason: 'A qualificação precisa estar concluída antes de preparar o orçamento.' };
  }
  if (to === 'quote_sent' && !evidence.hasSentQuote) {
    return { ok: false, reason: 'O orçamento precisa estar registrado como enviado.' };
  }
  return { ok: true };
}
