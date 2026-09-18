import { supabase } from '@/lib/supabase';

export const handoffStages = ['novo', 'apresentado', 'qualificando', 'reuniao', 'orcamento'] as const;
export type HandoffStage = typeof handoffStages[number];

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
