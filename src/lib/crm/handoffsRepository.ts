import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';

export async function requestHumanHandoff(leadId: string, reason: string, category = 'operator_request'): Promise<void> {
  await resolveOrganizationSession();
  const { error } = await supabase.rpc('request_human_handoff', {
    p_lead_id: leadId,
    p_reason: reason,
    p_category: category,
  });
  if (error) throw error;
}

/**
 * Ação explícita da Central. Diferente do handoff automático, o destino é
 * sempre o operador atual (assumir) ou um membro escolhido (transferir).
 */
export async function assignHumanHandoff(input: {
  leadId: string;
  reason: string;
  category: 'operator_takeover' | 'operator_transfer';
  targetUserId?: string | null;
}): Promise<void> {
  await resolveOrganizationSession();
  const { error } = await supabase.rpc('assign_human_handoff', {
    p_lead_id: input.leadId,
    p_reason: input.reason,
    p_category: input.category,
    p_target_user_id: input.targetUserId ?? null,
  });
  if (error) throw error;
}

export async function returnConversationToAna(leadId: string): Promise<void> {
  await resolveOrganizationSession();
  const { error } = await supabase.rpc('return_handoff_to_ana', { p_lead_id: leadId });
  if (error) throw error;
}
