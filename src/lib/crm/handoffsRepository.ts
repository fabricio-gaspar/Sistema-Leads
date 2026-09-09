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

export async function returnConversationToAna(leadId: string): Promise<void> {
  await resolveOrganizationSession();
  const { error } = await supabase.rpc('return_handoff_to_ana', { p_lead_id: leadId });
  if (error) throw error;
}
