// Lógica pura do Fluxo de Leads (sem I/O) — usada pelo servidor, pela UI e pelos testes.

export type ApproachType = 'ia' | 'humano'

export const NO_REPLY_STAGE = 'Contatos Perdidos'

export type LeadFlowSettings = {
  /** Ana inicia a cadência automaticamente quando a abordagem escolhida é IA. */
  ai_auto_start: boolean
  /** Horas sem resposta antes de mover para a etapa de timeout. */
  no_reply_timeout_hours: number
  /** Etapa de destino quando o prazo sem resposta vence. */
  no_reply_stage: string
  /** Abrir conversa na Central apenas quando o contato responder. */
  open_conversation_on_reply_only: boolean
  /** Criar tarefa de primeiro contato na abordagem humana. */
  human_create_task: boolean
  /** Notificar o responsável humano. */
  human_notify: boolean
  /** SLA (horas) da tarefa de primeiro contato humano. */
  human_sla_hours: number
  /** Pausar automação da Ana quando o contato responder. */
  pause_automation_on_reply: boolean
}

export const DEFAULT_LEAD_FLOW: LeadFlowSettings = {
  ai_auto_start: true,
  no_reply_timeout_hours: 48,
  no_reply_stage: NO_REPLY_STAGE,
  open_conversation_on_reply_only: true,
  human_create_task: true,
  human_notify: true,
  human_sla_hours: 4,
  pause_automation_on_reply: true,
}

const MIN_TIMEOUT_HOURS = 1
const MAX_TIMEOUT_HOURS = 720 // 30 dias
const MIN_SLA_HOURS = 1
const MAX_SLA_HOURS = 168

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** Normaliza o JSON salvo em company_settings.lead_flow aplicando limites seguros. */
export function normalizeLeadFlow(raw: unknown): LeadFlowSettings {
  const v = (raw ?? {}) as Record<string, unknown>
  return {
    ai_auto_start: bool(v.ai_auto_start, DEFAULT_LEAD_FLOW.ai_auto_start),
    no_reply_timeout_hours: clamp(
      v.no_reply_timeout_hours,
      DEFAULT_LEAD_FLOW.no_reply_timeout_hours,
      MIN_TIMEOUT_HOURS,
      MAX_TIMEOUT_HOURS,
    ),
    no_reply_stage:
      typeof v.no_reply_stage === 'string' && v.no_reply_stage.trim()
        ? v.no_reply_stage.trim()
        : DEFAULT_LEAD_FLOW.no_reply_stage,
    open_conversation_on_reply_only: bool(
      v.open_conversation_on_reply_only,
      DEFAULT_LEAD_FLOW.open_conversation_on_reply_only,
    ),
    human_create_task: bool(v.human_create_task, DEFAULT_LEAD_FLOW.human_create_task),
    human_notify: bool(v.human_notify, DEFAULT_LEAD_FLOW.human_notify),
    human_sla_hours: clamp(v.human_sla_hours, DEFAULT_LEAD_FLOW.human_sla_hours, MIN_SLA_HOURS, MAX_SLA_HOURS),
    pause_automation_on_reply: bool(
      v.pause_automation_on_reply,
      DEFAULT_LEAD_FLOW.pause_automation_on_reply,
    ),
  }
}

/**
 * O relógio de timeout só começa após o primeiro envio de saída bem-sucedido.
 * Retorna null quando ainda não houve primeiro contato.
 */
export function computeNoReplyDeadline(
  firstOutreachAt: string | Date | null | undefined,
  settings: Pick<LeadFlowSettings, 'no_reply_timeout_hours'>,
): string | null {
  if (!firstOutreachAt) return null
  const base = new Date(firstOutreachAt)
  if (Number.isNaN(base.getTime())) return null
  return new Date(base.getTime() + settings.no_reply_timeout_hours * 3600_000).toISOString()
}

export type LeadFlowState = {
  opt_out?: boolean | null
  first_outreach_at?: string | null
  first_inbound_at?: string | null
  no_reply_deadline_at?: string | null
  no_reply_processed_at?: string | null
  conversation_opened_at?: string | null
  stage?: string | null
}

/** Um lead só vira "Contatos Perdidos" se houve saída, não houve resposta e o prazo venceu. */
export function isNoReplyExpired(lead: LeadFlowState, now: Date = new Date()): boolean {
  if (!lead.first_outreach_at) return false
  if (lead.first_inbound_at) return false
  if (lead.no_reply_processed_at) return false
  if (!lead.no_reply_deadline_at) return false
  if (lead.stage === NO_REPLY_STAGE) return false
  return new Date(lead.no_reply_deadline_at).getTime() <= now.getTime()
}

/** A conversa aparece na Central apenas com resposta recebida ou abertura autorizada. */
export function shouldShowConversation(
  lead: LeadFlowState & { escalated?: boolean | null },
  settings: Pick<LeadFlowSettings, 'open_conversation_on_reply_only'>,
): boolean {
  if (!settings.open_conversation_on_reply_only) return true
  return Boolean(lead.first_inbound_at || lead.conversation_opened_at || lead.escalated)
}

/** Bloqueios obrigatórios antes de abordar um lead. */
export function approachBlockReason(lead: {
  opt_out?: boolean | null
  approach_type?: string | null
  contact_approval_status?: string | null
  whatsapp?: string | null
  phone?: string | null
  email?: string | null
}): string | null {
  if (lead.opt_out) return 'opt_out'
  if (lead.contact_approval_status === 'rejected') return 'contato_reprovado'
  if (lead.approach_type) return 'ja_abordado'
  if (!lead.whatsapp && !lead.phone && !lead.email) return 'sem_canal'
  return null
}
