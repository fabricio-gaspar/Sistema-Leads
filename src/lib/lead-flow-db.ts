// Helpers de banco do Fluxo de Leads. Recebe um client Supabase já autenticado
// (usuário via requireSupabaseAuth ou admin em webhooks/cron). Sem import de
// outreach.functions para evitar ciclo.
import {
  DEFAULT_LEAD_FLOW,
  computeNoReplyDeadline,
  normalizeLeadFlow,
  type LeadFlowSettings,
} from './lead-flow'

type Client = any

export async function loadLeadFlowSettings(
  supabase: Client,
  organizationId?: string | null,
): Promise<LeadFlowSettings> {
  let query = supabase.from('company_settings').select('lead_flow, organization_id').limit(1)
  if (organizationId) query = query.eq('organization_id', organizationId)
  const { data } = await query.maybeSingle()
  if (!data) return { ...DEFAULT_LEAD_FLOW }
  return normalizeLeadFlow(data.lead_flow)
}

/**
 * Marca o primeiro contato de saída bem-sucedido e abre o relógio de timeout.
 * Idempotente: só grava quando first_outreach_at ainda está vazio.
 */
export async function markFirstOutreach(
  supabase: Client,
  leadId: string,
  settings?: LeadFlowSettings,
): Promise<void> {
  const { data: lead } = await supabase
    .from('leads')
    .select('id, organization_id, first_outreach_at, first_inbound_at')
    .eq('id', leadId)
    .maybeSingle()
  if (!lead || lead.first_outreach_at) return
  const cfg = settings ?? (await loadLeadFlowSettings(supabase, lead.organization_id))
  const now = new Date().toISOString()
  await supabase
    .from('leads')
    .update({
      first_outreach_at: now,
      no_reply_deadline_at: lead.first_inbound_at ? null : computeNoReplyDeadline(now, cfg),
      no_reply_processed_at: null,
    })
    .eq('id', leadId)
    .is('first_outreach_at', null)
}

/**
 * Registra a primeira resposta recebida do lead: abre a conversa na Central,
 * cancela o prazo de "sem resposta" e pausa a automação quando configurado.
 * Idempotente.
 */
export async function markInboundReceived(
  supabase: Client,
  leadId: string,
  settings?: LeadFlowSettings,
): Promise<{ opened: boolean }> {
  const { data: lead } = await supabase
    .from('leads')
    .select('id, organization_id, first_inbound_at, conversation_opened_at')
    .eq('id', leadId)
    .maybeSingle()
  if (!lead) return { opened: false }
  const cfg = settings ?? (await loadLeadFlowSettings(supabase, lead.organization_id))
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    first_inbound_at: lead.first_inbound_at ?? now,
    conversation_opened_at: lead.conversation_opened_at ?? now,
    no_reply_deadline_at: null,
  }
  if (cfg.pause_automation_on_reply) patch.ai_paused = true
  await supabase.from('leads').update(patch).eq('id', leadId)
  return { opened: !lead.conversation_opened_at }
}

/** Abertura manual autorizada da conversa (vendedor/admin assume o atendimento). */
export async function openConversation(supabase: Client, leadId: string): Promise<void> {
  await supabase
    .from('leads')
    .update({ conversation_opened_at: new Date().toISOString() })
    .eq('id', leadId)
    .is('conversation_opened_at', null)
}
