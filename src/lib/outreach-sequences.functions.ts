import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'

// Types
export type SequenceChannel = 'whatsapp' | 'email' | 'phone'
export type SequenceStep = {
  id: string
  sequence_id: string
  order_index: number
  channel: SequenceChannel
  delay_minutes: number
  max_attempts: number
  template: string | null
  continue_on: string[]
  active: boolean
  created_at: string
  updated_at: string
}
export type Sequence = {
  id: string
  name: string
  description: string | null
  active: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}
export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'cancelled'
export type Enrollment = {
  id: string
  lead_id: string
  sequence_id: string
  current_step_index: number
  status: EnrollmentStatus
  pause_reason: string | null
  started_at: string
  last_step_at: string | null
  next_run_at: string | null
  last_error: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

// Internal helpers
export async function loadDefaultSequenceInternal(supabase: any): Promise<{ sequence: Sequence; steps: SequenceStep[] } | null> {
  const { data: seq } = await (supabase as any).from('outreach_sequences').select('*').eq('is_default', true).eq('active', true).maybeSingle()
  if (!seq) return null
  const { data: steps } = await (supabase as any).from('outreach_sequence_steps').select('*').eq('sequence_id', seq.id).eq('active', true).order('order_index', { ascending: true })
  return { sequence: seq as Sequence, steps: (steps ?? []) as SequenceStep[] }
}

export async function ensureEnrollmentInternal(supabase: any, leadId: string): Promise<Enrollment | null> {
  const { data: existing } = await (supabase as any).from('lead_sequence_enrollments').select('*').eq('lead_id', leadId).maybeSingle()
  if (existing) return existing as Enrollment
  const bundle = await loadDefaultSequenceInternal(supabase)
  if (!bundle) return null
  const { data: created, error } = await (supabase as any).from('lead_sequence_enrollments').insert({ lead_id: leadId, sequence_id: bundle.sequence.id, status: 'active' } as never).select('*').maybeSingle()
  if (error) {
    const { data: retry } = await (supabase as any).from('lead_sequence_enrollments').select('*').eq('lead_id', leadId).maybeSingle()
    return (retry ?? null) as Enrollment | null
  }
  return created as Enrollment
}

export async function getEnrollmentInternal(supabase: any, leadId: string): Promise<Enrollment | null> {
  const { data } = await (supabase as any).from('lead_sequence_enrollments').select('*').eq('lead_id', leadId).maybeSingle()
  return (data ?? null) as Enrollment | null
}

export async function patchEnrollmentInternal(supabase: any, leadId: string, patch: Partial<Enrollment>) {
  const { error } = await (supabase as any).from('lead_sequence_enrollments').update(patch as never).eq('lead_id', leadId)
  if (error) throw new Error(error.message)
}

export async function pauseEnrollmentInternal(supabase: any, leadId: string, reason: string) {
  const { data: enr } = await (supabase as any).from('lead_sequence_enrollments').select('id, status').eq('lead_id', leadId).maybeSingle()
  if (!enr) return
  if ((enr as any).status === 'completed' || (enr as any).status === 'cancelled') return
  await (supabase as any).from('lead_sequence_enrollments').update({ status: 'paused', pause_reason: reason } as never).eq('lead_id', leadId)
}

export async function resumeEnrollmentInternal(supabase: any, leadId: string) {
  const { data: enr } = await (supabase as any).from('lead_sequence_enrollments').select('id, status').eq('lead_id', leadId).maybeSingle()
  if (!enr || (enr as any).status !== 'paused') return
  await (supabase as any).from('lead_sequence_enrollments').update({ status: 'active', pause_reason: null } as never).eq('lead_id', leadId)
}

export async function cancelEnrollmentInternal(supabase: any, leadId: string, reason: string) {
  await (supabase as any).from('lead_sequence_enrollments').update({ status: 'cancelled', pause_reason: reason, completed_at: new Date().toISOString() } as never).eq('lead_id', leadId)
}

export async function completeEnrollmentInternal(supabase: any, leadId: string, reason: string) {
  await (supabase as any).from('lead_sequence_enrollments').update({ status: 'completed', pause_reason: reason, completed_at: new Date().toISOString() } as never).eq('lead_id', leadId)
}

async function assertAdmin(context: any) {
  const { data: ok, error } = await (context.supabase).rpc('has_role', { _user_id: context.userId, _role: 'administrador' })
  if (error) throw new Error(error.message)
  if (!ok) throw new Error('Apenas administradores podem gerenciar cadências.')
}

export const listSequences = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: seqs, error } = await (context.supabase as any).from('outreach_sequences').select('*').order('is_default', { ascending: false }).order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (seqs ?? []) as Sequence[]
  })

export const getSequenceWithSteps = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: seq, error } = await (context.supabase as any).from('outreach_sequences').select('*').eq('id', data.id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!seq) throw new Error('Cadência não encontrada.')
    const { data: steps } = await (context.supabase as any).from('outreach_sequence_steps').select('*').eq('sequence_id', data.id).order('order_index', { ascending: true })
    return { sequence: seq as Sequence, steps: (steps ?? []) as SequenceStep[] }
  })

export const getDefaultSequenceWithSteps = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return await loadDefaultSequenceInternal(context.supabase)
  })

function validateSequenceSteps(steps: SequenceStep[]) {
  const active = [...steps].filter((step: any) => step.active).sort((a, b) => a.order_index - b.order_index)
  if (!active.length) throw new Error('Ative pelo menos um passo da cadência.')
  if (active[0]?.channel !== 'whatsapp') throw new Error('O primeiro passo ativo deve ser WhatsApp.')
  if (active.at(-1)?.channel !== 'phone') throw new Error('O último passo ativo deve ser a tarefa humana de telefone.')
  const channelOrder: Record<SequenceChannel, number> = { whatsapp: 0, email: 1, phone: 2 }
  if (active.some((step, index) => index > 0 && channelOrder[step.channel] < channelOrder[active[index - 1].channel])) {
    throw new Error('A ordem dos canais deve ser WhatsApp → e-mail → telefone.')
  }
}

export const updateSequence = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), name: z.string().optional(), description: z.string().nullish(), active: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const { error } = await (context.supabase as any).from('outreach_sequences').update({ name: data.name, description: data.description, active: data.active } as never).eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const upsertSequenceStep = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid().optional(), sequence_id: z.string().uuid(), order_index: z.number(), channel: z.enum(['whatsapp', 'email', 'phone']), delay_minutes: z.number(), max_attempts: z.number().optional(), template: z.string().nullish(), continue_on: z.array(z.string()).optional(), active: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const { data: rows } = await (context.supabase as any).from('outreach_sequence_steps').select('*').eq('sequence_id', data.sequence_id).order('order_index', { ascending: true })
    const current = (rows ?? []) as SequenceStep[]
    if (data.id) {
      const existing = current.find(s => s.id === data.id)
      if (!existing) throw new Error('Not found')
      const next = { ...existing, ...data } as SequenceStep
      validateSequenceSteps(current.map(s => s.id === data.id ? next : s))
      await (context.supabase as any).from('outreach_sequence_steps').update(data as never).eq('id', data.id)
      return { ok: true, id: data.id }
    }
    const { data: inserted } = await (context.supabase as any).from('outreach_sequence_steps').insert(data as never).select('id').maybeSingle()
    return { ok: true, id: inserted?.id }
  })

export const deleteSequenceStep = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    await (context.supabase as any).from('outreach_sequence_steps').delete().eq('id', data.id)
    return { ok: true }
  })

export const getLeadEnrollment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lead_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: enr } = await (context.supabase as any).from('lead_sequence_enrollments').select('*').eq('lead_id', data.lead_id).maybeSingle()
    if (!enr) return null
    const { data: seq } = await (context.supabase as any).from('outreach_sequences').select('*').eq('id', enr.sequence_id).maybeSingle()
    const { data: steps } = await (context.supabase as any).from('outreach_sequence_steps').select('*').eq('sequence_id', enr.sequence_id).order('order_index', { ascending: true })
    return { enrollment: enr as Enrollment, sequence: seq, steps: (steps ?? []) as SequenceStep[] }
  })
