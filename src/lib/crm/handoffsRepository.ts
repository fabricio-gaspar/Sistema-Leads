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
}): Promise<string> {
  await resolveOrganizationSession();
  const { data, error } = await supabase.rpc('assign_human_handoff', {
    p_lead_id: input.leadId,
    p_reason: input.reason,
    p_category: input.category,
    p_target_user_id: input.targetUserId ?? null,
  });
  if (error) throw new Error(handoffErrorMessage(error));
  if (typeof data !== 'string' || !data) throw new Error('A transferência não retornou confirmação do servidor.');
  return data;
}

export function handoffErrorMessage(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error
    ? String((error as { message?: unknown }).message ?? '')
    : String(error ?? '');
  const known: Record<string, string> = {
    handoff_target_whatsapp_account_required: 'Este atendente ainda não possui um canal de WhatsApp próprio. Configure-o em Configurações > Canais.',
    handoff_target_whatsapp_account_not_ready: 'O canal de WhatsApp deste atendente não está conectado.',
    handoff_target_whatsapp_integration_not_ready: 'A integração do WhatsApp deste atendente está pausada ou indisponível.',
    handoff_target_whatsapp_provider_not_ready: 'O provedor do WhatsApp deste atendente ainda não está liberado para envio.',
    handoff_assignee_inactive: 'O atendente selecionado não está ativo.',
    handoff_assignee_cannot_reply: 'O atendente selecionado não possui permissão para responder conversas.',
    lead_not_found_or_access_denied: 'A conversa não está mais disponível para transferência ou seu acesso mudou.',
    organization_context_required: 'Sua sessão de organização expirou. Atualize a página e tente novamente.',
  };
  const code = Object.keys(known).find((candidate) => message.includes(candidate));
  return code ? known[code] : 'Não foi possível concluir a transferência. Os dados atuais foram preservados.';
}

export async function returnConversationToAna(leadId: string): Promise<void> {
  await resolveOrganizationSession();
  const { error } = await supabase.rpc('return_handoff_to_ana', { p_lead_id: leadId });
  if (error) throw error;
}
