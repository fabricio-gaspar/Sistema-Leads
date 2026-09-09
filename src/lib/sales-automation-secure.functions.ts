import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import {
  createHandoffInternal as createLegacyHandoffInternal,
  getLeadAutomation,
  saveLeadQualification,
} from './sales-automation.functions'

export { getLeadAutomation, saveLeadQualification }

type Ctx = { supabase: any; userId: string; claims?: any }

async function audit(ctx: Ctx, action: string, detail: string, entityTable?: string, entityId?: string) {
  await ctx.supabase.from('audit_logs').insert({
    actor_id: ctx.userId,
    actor_name: ctx.claims?.email ?? 'Usuário',
    actor_type: 'human',
    action,
    detail,
    entity_table: entityTable,
    entity_id: entityId,
  } as never)
}

export async function createHandoffInternal(
  ctx: Ctx,
  input: { leadId: string; reason: string; category?: string; summary?: string; context?: Record<string, unknown> },
) {
  const handoff = await createLegacyHandoffInternal(ctx, input)
  if (!handoff) throw new Error('Handoff não foi criado.')
  const assignedTo = (handoff as { assigned_to?: string | null }).assigned_to ?? null
  const { error } = await ctx.supabase.from('leads').update({
    modo_atendimento: 'humano',
    ai_paused: true,
    automation_status: 'human',
    owner: 'human',
    assigned_to: assignedTo,
    next_action_at: null,
    automation_error: null,
    automation_updated_at: new Date().toISOString(),
  } as never).eq('id', input.leadId)
  if (error) throw new Error(error.message)
  return handoff
}

export const acceptHandoff = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ handoff_id: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    const now = new Date().toISOString()
    const { data: handoff, error } = await ctx.supabase.from('lead_handoffs').update({
      status: 'accepted',
      assigned_to: ctx.userId,
      to_user_id: ctx.userId,
      accepted_at: now,
      updated_at: now,
    } as never).eq('id', data.handoff_id).eq('status', 'pending').select().maybeSingle()
    if (error) throw new Error(error.message)
    if (!handoff) throw new Error('Este atendimento já foi assumido ou encerrado.')

    const { error: leadError } = await ctx.supabase.from('leads').update({
      assigned_to: ctx.userId,
      owner_id: ctx.userId,
      owner: 'human',
      modo_atendimento: 'humano',
      ai_paused: true,
      automation_status: 'human',
      automation_error: null,
      automation_updated_at: now,
      next_action_at: null,
    } as never).eq('id', handoff.lead_id)
    if (leadError) throw new Error(leadError.message)

    await ctx.supabase.from('tickets').update({
      status: 'open',
      assigned_to: ctx.userId,
    } as never).eq('lead_id', handoff.lead_id).in('status', ['waiting_agent', 'open'])

    await audit(ctx, 'handoff_accepted', `Handoff ${handoff.id} assumido com sincronização do modo humano.`, 'lead_handoffs', handoff.id)
    return handoff
  })

export const scheduleAppointment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({
    lead_id: z.string().uuid(),
    title: z.string().trim().min(3).max(200),
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime().nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  }).parse(value))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    const starts = new Date(data.starts_at)
    const ends = data.ends_at ? new Date(data.ends_at) : new Date(starts.getTime() + 30 * 60_000)
    if (!Number.isFinite(starts.getTime()) || !Number.isFinite(ends.getTime()) || ends <= starts) {
      throw new Error('O término deve ser posterior ao início.')
    }

    const { data: lead, error: leadError } = await ctx.supabase
      .from('leads')
      .select('id,organization_id,company')
      .eq('id', data.lead_id)
      .maybeSingle()
    if (leadError || !lead) throw new Error(leadError?.message || 'Lead não encontrado.')

    const { data: conflict, error: conflictError } = await ctx.supabase
      .from('appointments')
      .select('id,title,starts_at,ends_at')
      .eq('organization_id', lead.organization_id)
      .eq('user_id', ctx.userId)
      .in('status', ['scheduled', 'confirmed'])
      .lt('starts_at', ends.toISOString())
      .gt('ends_at', starts.toISOString())
      .limit(1)
      .maybeSingle()
    if (conflictError) throw new Error(conflictError.message)
    if (conflict) throw new Error(`Já existe uma reunião neste horário: ${conflict.title}.`)

    const { data: appointment, error } = await ctx.supabase.from('appointments').insert({
      organization_id: lead.organization_id,
      lead_id: data.lead_id,
      user_id: ctx.userId,
      title: data.title,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      notes: data.notes ?? null,
      status: 'scheduled',
      provider: 'internal',
      metadata: { origin: 'manual', timezone: 'America/Sao_Paulo' },
      updated_at: new Date().toISOString(),
    } as never).select().single()
    if (error) throw new Error(error.message)

    const { error: taskError } = await ctx.supabase.from('lead_tasks').insert({
      organization_id: lead.organization_id,
      lead_id: data.lead_id,
      text: `Reunião: ${data.title}`,
      owner_id: ctx.userId,
      owner_label: ctx.claims?.email ?? 'Responsável',
      due_at: starts.toISOString(),
      completed: false,
      metadata: { appointment_id: appointment.id },
    } as never)
    if (taskError) {
      await ctx.supabase.from('appointments').delete().eq('id', appointment.id)
      throw new Error(taskError.message)
    }

    await audit(ctx, 'appointment_scheduled', `Reunião com ${lead.company} agendada para ${starts.toISOString()}.`, 'appointments', appointment.id)
    return appointment
  })
