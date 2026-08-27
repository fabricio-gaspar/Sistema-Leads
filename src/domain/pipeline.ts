export const ACTIVE_PIPELINE_STAGES = [
  'entered',
  'engaging',
  'qualified',
  'quote_sent',
  'decision',
] as const;

export type PipelineStageCode = (typeof ACTIVE_PIPELINE_STAGES)[number];
export type OpportunityOutcome = 'open' | 'won' | 'lost';
export type StageSource = 'human' | 'rule' | 'ai_suggestion';

export const PIPELINE_STAGE_LABEL: Record<PipelineStageCode, string> = {
  entered: 'Entrou',
  engaging: 'Em conversa',
  qualified: 'Qualificado',
  quote_sent: 'Orçamento enviado',
  decision: 'Em decisão',
};

const legacyStageMap: Record<string, PipelineStageCode> = {
  'Novo': 'entered',
  'Em Contato': 'engaging',
  'Aguardando Resposta': 'engaging',
  'Em Qualificação': 'qualified',
  'Reunião Agendada': 'qualified',
  'Proposta em Preparação': 'qualified',
  'Orçamento Enviado': 'quote_sent',
  'Negociação': 'decision',
  'Pausado': 'engaging',
  'Fechado — Ganho': 'decision',
  'Fechado — Perdido': 'decision',
};

export function stageFromLegacy(stage: string): PipelineStageCode {
  return legacyStageMap[stage] ?? 'entered';
}

export function outcomeFromLegacy(stage: string): OpportunityOutcome {
  if (stage === 'Fechado — Ganho') return 'won';
  if (stage === 'Fechado — Perdido') return 'lost';
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

  if (outcome === 'won' && source !== 'human') {
    return { ok: false, reason: 'A Ana não pode concluir uma oportunidade como ganha.' };
  }
  if (outcome === 'lost' && !evidence.explicitOptOut && !evidence.confirmedByHuman) {
    return { ok: false, reason: 'Perdas exigem confirmação humana, exceto opt-out inequívoco.' };
  }
  if (from === to) return { ok: true };

  const order = ACTIVE_PIPELINE_STAGES.indexOf(from);
  const target = ACTIVE_PIPELINE_STAGES.indexOf(to);
  if (target < order) return { ok: false, reason: 'O Kanban não permite regressão automática de etapa.' };

  if (to === 'engaging' && !evidence.hasPersistedMessage) {
    return { ok: false, reason: 'É necessário ao menos um evento de mensagem persistido.' };
  }
  if (to === 'qualified' && !evidence.isQualified) {
    return { ok: false, reason: 'A qualificação ainda não foi concluída.' };
  }
  if (to === 'quote_sent' && !evidence.hasSentQuote) {
    return { ok: false, reason: 'O orçamento precisa estar registrado como enviado.' };
  }
  if (to === 'decision' && !evidence.hasDecisionSignal) {
    return { ok: false, reason: 'Falta uma resposta, visualização ou objeção verificável.' };
  }
  return { ok: true };
}
