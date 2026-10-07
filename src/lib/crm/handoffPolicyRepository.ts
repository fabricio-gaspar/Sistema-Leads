import { supabase } from '@/lib/supabase';
import { canonicalStageKeys, isTerminalStage, type CanonicalStageKey } from '@/lib/crm/leadStageRepository';

export type HandoffStage = Exclude<CanonicalStageKey, 'ganho' | 'perdido'>;

// Ganho e Perdido permanecem fora da transferência automática: são resultados
// finais confirmados individualmente pelo orçamento no servidor.
export const handoffStages = canonicalStageKeys.filter(
  (stage): stage is HandoffStage => !isTerminalStage(stage),
);

export async function configureLeadHandoffPolicy(input: {
  leadIds: string[];
  assigneeUserId: string | null;
  stage: HandoffStage | null;
  notifyWhatsapp: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc('configure_lead_handoff_policy', {
    p_lead_ids: input.leadIds,
    p_assignee_user_id: input.assigneeUserId,
    p_handoff_stage: input.stage,
    p_notify_whatsapp: input.notifyWhatsapp,
  });
  if (error) throw error;
}
