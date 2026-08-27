import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';

export async function requestHumanHandoff(leadId: string, reason: string, category = 'operator_request'): Promise<void> {
  const session = await resolveOrganizationSession();
  const now = new Date().toISOString();
  const { error: leadError } = await supabase
    .from('leads')
    .update({ ai_paused: true, automation_status: 'human', automation_updated_at: now })
    .eq('id', leadId)
    .eq('organization_id', session.organizationId);
  if (leadError) throw leadError;

  const { error: handoffError } = await supabase.from('lead_handoffs').insert({
    organization_id: session.organizationId,
    lead_id: leadId,
    from_user_id: session.userId,
    status: 'requested',
    requested_at: now,
    reason,
    category,
  });
  if (handoffError) throw handoffError;
}

export async function returnConversationToAna(leadId: string): Promise<void> {
  const session = await resolveOrganizationSession();
  const now = new Date().toISOString();
  const { error: leadError } = await supabase
    .from('leads')
    .update({ ai_paused: false, automation_status: 'running', automation_updated_at: now })
    .eq('id', leadId)
    .eq('organization_id', session.organizationId);
  if (leadError) throw leadError;

  const { error: handoffError } = await supabase
    .from('lead_handoffs')
    .update({ status: 'closed', closed_at: now, updated_at: now })
    .eq('organization_id', session.organizationId)
    .eq('lead_id', leadId)
    .in('status', ['requested', 'accepted']);
  if (handoffError) throw handoffError;
}
