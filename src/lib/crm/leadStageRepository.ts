import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';

export const canonicalStageKeys = ['novo', 'apresentado', 'qualificando', 'reuniao', 'orcamento', 'ganho', 'perdido'] as const;
export type CanonicalStageKey = (typeof canonicalStageKeys)[number];

export const terminalStageKeys = ['ganho', 'perdido'] as const;
export type TerminalStageKey = (typeof terminalStageKeys)[number];

export const canonicalStageLabels = {
  novo: 'Novo',
  apresentado: 'Apresentado',
  qualificando: 'Qualificando',
  reuniao: 'Reunião',
  orcamento: 'Orçamento',
  ganho: 'Ganho',
  perdido: 'Perdido',
} as const satisfies Record<CanonicalStageKey, string>;

export const canonicalStageOptions = canonicalStageKeys.map((key) => ({
  key,
  label: canonicalStageLabels[key],
}));

export function isTerminalStage(stage: CanonicalStageKey): stage is TerminalStageKey {
  return terminalStageKeys.includes(stage as TerminalStageKey);
}

const stageKeyByLabel: Record<string, CanonicalStageKey> = Object.fromEntries(
  Object.entries(canonicalStageLabels).map(([key, label]) => [label, key]),
) as Record<string, CanonicalStageKey>;

export function canonicalStageKeyFromLabel(label: string): CanonicalStageKey | null {
  return stageKeyByLabel[label] ?? null;
}

function rpcMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const known: Record<string, string> = {
    authentication_required: 'Sua sessão expirou. Entre novamente para alterar a etapa.',
    lead_not_found_or_forbidden: 'Este lead não está disponível na sua carteira.',
    lead_stage_transition_forbidden: 'Você não tem permissão para alterar a etapa deste lead.',
    invalid_pipeline_transition: 'Siga a sequência comercial do funil; não é possível pular ou voltar uma etapa.',
    terminal_stage_cannot_be_reopened: 'Ganho e Perdido são estados finais. A reativação exige um processo de governança.',
    persisted_message_required: 'Registre uma mensagem no histórico antes de marcar o lead como apresentado.',
    qualification_required: 'Conclua a qualificação estruturada antes de avançar.',
    sent_proposal_required: 'Registre um orçamento enviado antes de avançar para Orçamento.',
    accepted_proposal_required: 'Ganho exige um orçamento aceito.',
    outcome_reason_required: 'Informe o motivo comercial para concluir o resultado.',
    proposal_not_found_or_unlinked: 'O orçamento não está vinculado a um lead operacional.',
    proposal_outcome_forbidden: 'Você não tem permissão para concluir este orçamento.',
    proposal_not_open: 'Este orçamento não está mais aberto para conclusão.',
  };
  return Object.entries(known).find(([code]) => message.includes(code))?.[1] ?? 'Não foi possível concluir a operação no servidor. Nenhuma alteração local foi confirmada.';
}

export class CommercialTransitionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function normalizeError(error: unknown): CommercialTransitionError {
  const code = error instanceof Error ? error.message : String(error ?? 'transition_failed');
  return new CommercialTransitionError(code, rpcMessage(error));
}

export async function transitionOperationalLeadStage(input: {
  leadId: string;
  stage: CanonicalStageKey;
  reason?: string;
}): Promise<void> {
  await resolveOrganizationSession();
  const { error } = await supabase.rpc('transition_lead_stage', {
    p_lead_id: input.leadId,
    p_to_stage: input.stage,
    p_reason: input.reason?.trim() || null,
  });
  if (error) throw normalizeError(error);
}

/**
 * The database accepts an undo only for the last human transition made by the
 * same user inside its short audit window.  It is deliberately not a generic
 * backwards transition and cannot reopen a closed outcome.
 */
export async function undoRecentOperationalLeadStageTransition(input: {
  leadId: string;
  expectedStage: CanonicalStageKey;
}): Promise<void> {
  await resolveOrganizationSession();
  const { error } = await supabase.rpc('undo_recent_lead_stage_transition', {
    p_lead_id: input.leadId,
    p_expected_stage: input.expectedStage,
  });
  if (error) throw normalizeError(error);
}

export async function resolveOperationalProposalOutcome(input: {
  proposalId: string;
  outcome: 'accepted' | 'rejected';
  reason?: string;
}): Promise<void> {
  await resolveOrganizationSession();
  const { error } = await supabase.rpc('resolve_proposal_outcome', {
    p_proposal_id: input.proposalId,
    p_outcome: input.outcome,
    p_reason: input.reason?.trim() || null,
  });
  if (error) throw normalizeError(error);
}

export const commercialTransitionMessages = { rpcMessage };
