import { supabase } from '@/lib/supabase';

export interface AnaLeadActivationInput {
  leadId: string;
  whatsapp: string;
  approvalReason: string;
  requestId?: string;
  /**
   * Used when "Ana conduz tudo" is selected. The server clears a previous
   * transfer rule as part of the activation command, avoiding a separate
   * browser RPC before the canonical ana-run invocation.
   */
  clearHandoffPolicy?: boolean;
}

interface AnaLeadActivationResponse {
  ok: boolean;
  error?: string;
  ana?: { ok?: boolean; skipped?: boolean; reason?: string };
}

/**
 * Keeps only digits because the provider and the inbound matcher use the
 * normalized phone identity. The country code is deliberately not inferred:
 * the number stored by the user remains the source of truth.
 */
export function normalizeWhatsAppForActivation(value: string): string {
  return value.replace(/\D/g, '');
}

export async function activateLeadWithAna(input: AnaLeadActivationInput): Promise<AnaLeadActivationResponse> {
  const whatsapp = normalizeWhatsAppForActivation(input.whatsapp);
  if (whatsapp.length < 10 || whatsapp.length > 15) {
    throw new Error('invalid_whatsapp');
  }
  const approvalReason = input.approvalReason.trim();
  if (!approvalReason) {
    throw new Error('contact_approval_reason_required');
  }

  const { data, error } = await supabase.functions.invoke('lead-workflow', {
    body: {
      action: 'start_ai',
      lead_id: input.leadId,
      whatsapp,
      approve_whatsapp_contact: true,
      approval_reason: approvalReason,
      request_id: input.requestId ?? crypto.randomUUID(),
      clear_handoff_policy: input.clearHandoffPolicy === true,
    },
  });
  if (error) {
    throw new Error('lead_activation_unavailable');
  }
  const result = data as AnaLeadActivationResponse | null;
  if (!result?.ok) {
    throw new Error(result?.error || 'lead_activation_failed');
  }
  return result;
}
