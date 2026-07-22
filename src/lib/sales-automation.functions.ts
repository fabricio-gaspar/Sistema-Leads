import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { pauseEnrollmentInternal } from '@/lib/outreach-sequences.functions'

type Ctx = { supabase: any; userId: string; claims?: any }

const qualificationSchema = z.object({
  lead_id: z.string().uuid(),
  intent: z.string().trim().max(200).nullable().optional(),
  service_interest: z.string().trim().max(500).nullable().optional(),
  pain: z.string().trim().max(1000).nullable().optional(),
  urgency: z.string().trim().max(200).nullable().optional(),
  budget_range: z.string().trim().max(200).nullable().optional(),
  decision_maker: z.string().trim().max(300).nullable().optional(),
  objections: z.array(z.string().trim().max(500)).max(20).default([]),
  sentiment: z.string().trim().max(100).nullable().optional(),
  next_action: z.string().trim().max(500).nullable().optional(),
  summary: z.string().trim().max(3000).nullable().optional(),
  evidence: z.array(z.string().trim().max(1000)).max(30).default([]),
  readiness_score: z.number().int().min(0).max(100).nullable().optional(),
})

async function audit(ctx: Ctx, action: string, detail: string, actorType: 'ia' | 'human' | 'system' = 'human') {
  const { error } = await ctx.supabase.from('audit_logs').insert({
    actor_id: ctx.userId,
    actor_name: ctx.claims?.email ?? (actorType === 'ia' ? 'Ana (IA)' : 'Usuário'),
    actor_type: actorType,
    action,
    detail,
  } as never)
  if (error) console.error('[audit]', error.message)
}

async function selectSeller(ctx: Ctx, currentSeller?: string | null) {
  if (currentSeller) return currentSeller
  const { data: settings } = await ctx.supabase
    .from('company_settings')
    .select('assignment_strategy')
    .limit(1)
    .maybeSingle()
  if ((settings?.assignment_strategy ?? 'manual') === 'manual') return null

  const { data: roleRows, error: rolesError } = await ctx.supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'vendedor')
  if (rolesError) throw new Error(rolesError.message)
  const ids = (roleRows ?? []).map((row: any) => row.user_id)
  if (!ids.length) return null
  const { data: profiles, error: profileError } = await ctx.supabase
    .from('profiles')
    .select('id, name')
    .in('id', ids)
    .eq('active', true)
    .order('name')
  if (profileError) throw new Error(profileError.message)
  const sellers = (profiles ?? []).map((row: any) => row.id)
  if (!sellers.length) return null

  if (settings?.assignment_strategy === 'round_robin') {
    const { data: last } = await ctx.supabase
      .from('lead_handoffs')
      .select('assigned_to')
      .not('assigned_to', 'is', null)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const index = sellers.indexOf(last?.assigned_to)
    return sellers[(index + 1) % sellers.length]
  }

  const { data: openLeads, error: leadsError } = await ctx.supabase
    .from('leads')
    .select('assigned_to')
    .in('assigned_to', sellers)
    .not('stage', 'in', '(Fechado,Perdido)')
  if (leadsError) throw new Error(leadsError.message)
  const load = new Map<string, number>(sellers.map((id: string) => [id, 0] as const))
  for (const row of openLeads ?? []) {
    const sellerId = row.assigned_to as string
    load.set(sellerId, (load.get(sellerId) ?? 0) + 1)
  }
  return [...load.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null
}

export async function createHandoffInternal(
  ctx: Ctx,
  input: { leadId: string; reason: string; category?: string; summary?: string; context?: Record<string, unknown> },
) {
  const { data: lead, error: leadError } = await ctx.supabase
    .from('leads')
    .select('id, company, assigned_to, owner_id')
    .eq('id', input.leadId)
    .maybeSingle()
  if (leadError) throw new Error(leadError.message)
  if (!lead) throw new Error('Lead não encontrado')

  const { data: open, error: openError } = await ctx.supabase
    .from('lead_handoffs')
    .select('*')
    .eq('lead_id', input.leadId)
    .in('status', ['pending', 'accepted'])
    .maybeSingle()
  if (openError) throw new Error(openError.message)
  if (open) return open

  const { data: settings } = await ctx.supabase
    .from('company_settings')
    .select('handoff_sla_minutes')
    .limit(1)
    .maybeSingle()
  const assignedTo = await selectSeller(ctx, lead.assigned_to)
  const dueAt = new Date(Date.now() + Number(settings?.handoff_sla_minutes ?? 30) * 60_000).toISOString()
  const { data: handoff, error } = await ctx.supabase
    .from('lead_handoffs')
    .insert({
      lead_id: input.leadId,
      reason: input.reason,
      category: input.category ?? 'geral',
      summary: input.summary ?? input.reason,
      context: input.context ?? {},
      assigned_to: assignedTo,
      due_at: dueAt,
    } as never)
    .select()
    .single()
  if (error?.code === '23505') {
    const { data: raced } = await ctx.supabase
      .from('lead_handoffs')
      .select('*')
      .eq('lead_id', input.leadId)
      .in('status', ['pending', 'accepted'])
      .maybeSingle()
    return raced
  }
  if (error) throw new Error(error.message)

  const { error: pauseError } = await ctx.supabase.from('leads').update({
    ai_paused: true,
    owner: 'human',
    assigned_to: assignedTo ?? lead.assigned_to,
    next_action_at: null,
  } as never).eq('id', input.leadId)
  if (pauseError) throw new Error(pauseError.message)
  await pauseEnrollmentInternal(ctx.supabase, input.leadId, `handoff:${input.category ?? 'geral'}`)
  await ctx.supabase
    .from('lead_sequence_enrollments')
    .update({ next_run_at: null, last_error: 'handoff' } as never)
    .eq('lead_id', input.leadId)

  if (assignedTo) {
    await ctx.supabase.from('notifications').insert({
      user_id: assignedTo,
      kind: 'lead_handoff',
      title: 'Novo atendimento para assumir',
      description: `${lead.company}: ${input.reason}`,
    } as never)
  }
  await audit(ctx, 'handoff_created', `[${input.category ?? 'geral'}] ${lead.company}: ${input.reason}`, 'ia')
  return handoff
}

export const getLeadAutomation = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ lead_id: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    const [enrollment, qualification, handoff, appointments] = await Promise.all([
      ctx.supabase
        .from('lead_sequence_enrollments')
        .select('*, outreach_sequences(name, outreach_sequence_steps(*))')
        .eq('lead_id', data.lead_id)
        .maybeSingle(),
      ctx.supabase.from('lead_qualifications').select('*').eq('lead_id', data.lead_id).maybeSingle(),
      ctx.supabase.from('lead_handoffs').select('*').eq('lead_id', data.lead_id)
        .order('requested_at', { ascending: false }).limit(1).maybeSingle(),
      ctx.supabase.from('appointments').select('*').eq('lead_id', data.lead_id)
        .order('starts_at', { ascending: false }).limit(20),
    ])
    for (const result of [enrollment, qualification, handoff, appointments]) {
      if (result.error) throw new Error(result.error.message)
    }
    return {
      enrollment: enrollment.data ?? null,
      qualification: qualification.data ?? null,
      handoff: handoff.data ?? null,
      appointments: appointments.data ?? [],
    }
  })

export const saveLeadQualification = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => qualificationSchema.parse(value))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    const { lead_id, ...values } = data
    const { data: row, error } = await ctx.supabase.from('lead_qualifications').upsert({
      lead_id,
      ...values,
      updated_by: 'human',
    } as never, { onConflict: 'lead_id' }).select().single()
    if (error) throw new Error(error.message)
    await audit(ctx, 'lead_qualification_updated', `Qualificação atualizada para ${lead_id}`)
    return row
  })

export const acceptHandoff = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ handoff_id: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    const now = new Date().toISOString()
    const { data: handoff, error } = await ctx.supabase.from('lead_handoffs').update({
      status: 'accepted',
      assigned_to: ctx.userId,
      accepted_at: now,
    } as never).eq('id', data.handoff_id).eq('status', 'pending').select().maybeSingle()
    if (error) throw new Error(error.message)
    if (!handoff) throw new Error('Este atendimento já foi assumido ou encerrado')
    const { error: leadError } = await ctx.supabase.from('leads').update({
      assigned_to: ctx.userId,
      owner: 'human',
      ai_paused: true,
      next_action_at: null,
    } as never).eq('id', handoff.lead_id)
    if (leadError) throw new Error(leadError.message)
    await audit(ctx, 'handoff_accepted', `Handoff ${handoff.id} assumido`, 'human')
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
    if (data.ends_at && new Date(data.ends_at) <= new Date(data.starts_at)) {
      throw new Error('O término deve ser posterior ao início')
    }
    const { data: appointment, error } = await ctx.supabase.from('appointments').insert({
      ...data,
      owner_id: ctx.userId,
      origin: 'manual',
    } as never).select().single()
    if (error) throw new Error(error.message)
    await ctx.supabase.from('lead_tasks').insert({
      lead_id: data.lead_id,
      text: `Reunião: ${data.title}`,
      owner_id: ctx.userId,
      owner_label: ctx.claims?.email ?? 'Vendedor',
      due_at: data.starts_at,
    } as never)
    await audit(ctx, 'appointment_scheduled', `Reunião agendada para ${data.starts_at}`)
    return appointment
  })
