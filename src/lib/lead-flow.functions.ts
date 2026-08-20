import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import {
  DEFAULT_LEAD_FLOW,
  NO_REPLY_STAGE,
  approachBlockReason,
  normalizeLeadFlow,
} from './lead-flow'
import { loadLeadFlowSettings, markFirstOutreach, openConversation } from './lead-flow-db'

// ============================ Configurações ============================

export const getLeadFlowSettings = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const settings = await loadLeadFlowSettings((context as any).supabase)
    const { data: stages } = await (context as any).supabase
      .from('pipeline_stages')
      .select('id, name, legacy_stage, position')
      .eq('active', true)
      .order('position')
    return {
      settings,
      stages: (stages ?? []).map((s: any) => ({ value: String(s.legacy_stage), label: s.name })),
    }
  })

const leadFlowSchema = z.object({
  ai_auto_start: z.boolean(),
  no_reply_timeout_hours: z.number().int().min(1).max(720),
  no_reply_stage: z.string().min(1),
  open_conversation_on_reply_only: z.boolean(),
  human_create_task: z.boolean(),
  human_notify: z.boolean(),
  human_sla_hours: z.number().int().min(1).max(168),
  pause_automation_on_reply: z.boolean(),
})

export const updateLeadFlowSettings = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => leadFlowSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: (context as any).userId,
      _role: 'administrador',
    })
    if (!isAdmin) throw new Error('Apenas administradores podem alterar o Fluxo de Leads')

    const value = normalizeLeadFlow(data)
    const { data: row } = await supabase.from('company_settings').select('id').limit(1).maybeSingle()
    if (!row) throw new Error('Configurações da empresa não encontradas')
    const { error } = await supabase.from('company_settings').update({ lead_flow: value }).eq('id', row.id)
    if (error) throw new Error(error.message)

    await supabase.from('audit_logs').insert({
      actor_id: (context as any).userId,
      actor_name: (context as any).claims?.email ?? 'user',
      actor_type: 'human',
      action: 'lead_flow_settings_updated',
      detail: `Fluxo de Leads atualizado (timeout ${value.no_reply_timeout_hours}h → ${value.no_reply_stage})`,
    })
    return { ok: true, settings: value }
  })

// ============================ Prévia da 1ª mensagem ============================

export const previewApproachMessage = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lead_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase
    const { data: lead } = await supabase.from('leads').select('*').eq('id', data.lead_id).maybeSingle()
    if (!lead) throw new Error('Lead não encontrado')

    const { data: seq } = await supabase
      .from('outreach_sequences')
      .select('id, name')
      .eq('active', true)
      .order('created_at')
      .limit(1)
      .maybeSingle()
    let template: string | null = null
    let channel = lead.whatsapp || lead.phone ? 'whatsapp' : lead.email ? 'email' : 'phone'
    if (seq) {
      const { data: step } = await supabase
        .from('outreach_sequence_steps')
        .select('channel, template')
        .eq('sequence_id', seq.id)
        .order('order_index')
        .limit(1)
        .maybeSingle()
      if (step) {
        template = step.template ?? null
        channel = step.channel ?? channel
      }
    }

    const { renderTemplate, generateOutreachMessage } = await import('./outreach.functions')
    const message = template
      ? renderTemplate(template, lead)
      : await generateOutreachMessage(context as never, lead, channel as never)
    return { channel, sequence: seq?.name ?? null, message }
  })

// ============================ Abordagem ============================

const approachSchema = z.object({
  lead_ids: z.array(z.string().uuid()).min(1).max(200),
  approach: z.enum(['ia', 'humano']),
  assignee_id: z.string().uuid().optional().nullable(),
  sla_hours: z.number().int().min(1).max(168).optional(),
  start_now: z.boolean().optional().default(true),
})

export const approachLeads = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => approachSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase
    const userId = (context as any).userId
    const cfg = await loadLeadFlowSettings(supabase)
    const now = new Date().toISOString()

    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .in('id', data.lead_ids)
    if (error) throw new Error(error.message)

    const started: string[] = []
    const blocked: Array<{ id: string; company: string; reason: string }> = []

    for (const lead of leads ?? []) {
      const reason = approachBlockReason(lead)
      if (reason) {
        blocked.push({ id: lead.id, company: lead.company, reason })
        continue
      }

      if (data.approach === 'ia') {
        await supabase
          .from('leads')
          .update({
            approach_type: 'ia',
            approach_set_at: now,
            owner: 'ia',
            ai_paused: false,
          })
          .eq('id', lead.id)
          .is('approach_type', null)

        if (cfg.ai_auto_start && data.start_now !== false) {
          try {
            const { triggerOutreachInternal } = await import('./outreach.functions')
            await triggerOutreachInternal(context as never, lead.id)
            await markFirstOutreach(supabase, lead.id, cfg)
          } catch (err) {
            blocked.push({
              id: lead.id,
              company: lead.company,
              reason: `falha_envio: ${(err as Error).message}`,
            })
            continue
          }
        }
        started.push(lead.id)
      } else {
        const assignee = data.assignee_id ?? lead.assigned_to ?? userId
        const slaHours = data.sla_hours ?? cfg.human_sla_hours
        const dueAt = new Date(Date.now() + slaHours * 3600_000).toISOString()
        await supabase
          .from('leads')
          .update({
            approach_type: 'humano',
            approach_set_at: now,
            owner: 'human',
            ai_paused: true,
            assigned_to: assignee,
          })
          .eq('id', lead.id)
          .is('approach_type', null)

        if (cfg.human_create_task) {
          const { data: existing } = await supabase
            .from('lead_tasks')
            .select('id')
            .eq('lead_id', lead.id)
            .eq('text', 'Primeiro contato com o lead')
            .maybeSingle()
          if (!existing) {
            await supabase.from('lead_tasks').insert({
              lead_id: lead.id,
              text: 'Primeiro contato com o lead',
              due_at: dueAt,
              owner_id: assignee,
              owner_label: 'Vendedor',
              completed: false,
            })
          }
        }
        if (cfg.human_notify) {
          await supabase.from('notifications').insert({
            user_id: assignee,
            kind: 'lead',
            title: `Novo lead para abordagem: ${lead.company}`,
            description: `SLA de ${slaHours}h para o primeiro contato.`,
            link: `/leads/${lead.id}`,
            read: false,
          })
        }
        started.push(lead.id)
      }

      await supabase.from('audit_logs').insert({
        actor_id: userId,
        actor_name: (context as any).claims?.email ?? 'user',
        actor_type: 'human',
        action: data.approach === 'ia' ? 'lead_approach_ia' : 'lead_approach_humano',
        detail: `Abordagem ${data.approach} definida para ${lead.company}`,
      })
    }

    return { ok: true, started: started.length, blocked, started_ids: started }
  })

// ============================ Importar + abordar ============================

export const importProspectsAndApproach = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cache_id: z.string().uuid(),
        cnpjs: z.array(z.string().min(3)).min(1).max(100),
        approach: z.enum(['ia', 'humano']),
        assignee_id: z.string().uuid().optional().nullable(),
        sla_hours: z.number().int().min(1).max(168).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { importExternalAsLeadInternal } = await import('./prospecting.functions')
    const imported: string[] = []
    const skipped: Array<{ cnpj: string; reason: string }> = []
    for (const cnpj of data.cnpjs) {
      try {
        const row = await importExternalAsLeadInternal(context as never, { cache_id: data.cache_id, cnpj })
        if ((row as any)._already_imported) skipped.push({ cnpj, reason: 'duplicado' })
        imported.push((row as any).id)
      } catch (err) {
        skipped.push({ cnpj, reason: (err as Error).message })
      }
    }
    if (!imported.length) return { imported: 0, skipped, started: 0, blocked: [] as any[] }

    const supabase = (context as any).supabase
    const cfg = await loadLeadFlowSettings(supabase)
    const result = await (approachLeads as any)({
      data: {
        lead_ids: imported,
        approach: data.approach,
        assignee_id: data.assignee_id ?? null,
        sla_hours: data.sla_hours ?? cfg.human_sla_hours,
        start_now: true,
      },
    })
    return { imported: imported.length, skipped, started: result.started, blocked: result.blocked }
  })

// ============================ Conversa ============================

export const openLeadConversation = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lead_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await openConversation((context as any).supabase, data.lead_id)
    await (context as any).supabase.from('audit_logs').insert({
      actor_id: (context as any).userId,
      actor_name: (context as any).claims?.email ?? 'user',
      actor_type: 'human',
      action: 'conversation_opened_manual',
      detail: `Conversa aberta manualmente para o lead ${data.lead_id}`,
    })
    return { ok: true }
  })

// ============================ Timeout sem resposta ============================

/** Processa deadlines vencidos. Idempotente; pode ser chamado pelo cron ou manualmente. */
export async function processNoReplyTimeouts(supabase: any): Promise<{ processed: number; ids: string[] }> {
  const nowIso = new Date().toISOString()
  const { data: leads } = await supabase
    .from('leads')
    .select('id, organization_id, company, stage, first_outreach_at, first_inbound_at, no_reply_deadline_at, no_reply_processed_at')
    .not('no_reply_deadline_at', 'is', null)
    .is('no_reply_processed_at', null)
    .is('first_inbound_at', null)
    .lte('no_reply_deadline_at', nowIso)
    .limit(200)

  const ids: string[] = []
  const cache = new Map<string, Awaited<ReturnType<typeof loadLeadFlowSettings>>>()
  for (const lead of leads ?? []) {
    if (!lead.first_outreach_at) continue
    let cfg = cache.get(lead.organization_id)
    if (!cfg) {
      cfg = await loadLeadFlowSettings(supabase, lead.organization_id)
      cache.set(lead.organization_id, cfg)
    }
    const targetStage = cfg.no_reply_stage || NO_REPLY_STAGE
    if (lead.stage === targetStage) {
      await supabase.from('leads').update({ no_reply_processed_at: nowIso }).eq('id', lead.id)
      continue
    }
    const { error } = await supabase
      .from('leads')
      .update({
        stage: targetStage,
        ai_paused: true,
        next_action_at: null,
        no_reply_processed_at: nowIso,
        lost_reason: 'Sem resposta dentro do prazo configurado',
      })
      .eq('id', lead.id)
      .is('no_reply_processed_at', null)
    if (error) continue

    await supabase
      .from('lead_sequence_enrollments')
      .update({ status: 'paused', pause_reason: 'no_reply_timeout', next_run_at: null })
      .eq('lead_id', lead.id)
      .eq('status', 'active')

    await supabase.from('audit_logs').insert({
      organization_id: lead.organization_id,
      actor_id: null,
      actor_name: 'Sistema',
      actor_type: 'system',
      action: 'lead_no_reply_timeout',
      detail: `${lead.company} movido para ${targetStage} por falta de resposta`,
    })
    ids.push(lead.id)
  }
  return { processed: ids.length, ids }
}

export const runNoReplySweep = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = (context as any).supabase
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: (context as any).userId,
      _role: 'administrador',
    })
    if (!isAdmin) throw new Error('Apenas administradores podem executar a varredura')
    return processNoReplyTimeouts(supabase)
  })

export { DEFAULT_LEAD_FLOW, NO_REPLY_STAGE }
