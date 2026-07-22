import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

// ============================================================================
// Types
// ============================================================================

export type SequenceChannel = 'whatsapp' | 'email' | 'phone'

export type SequenceStep = {
  id: string
  sequence_id: string
  order_index: number
  channel: SequenceChannel
  delay_minutes: number
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
  completed_at: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// Internal helpers (called by outreach.functions.ts + webhooks)
// ============================================================================

export async function loadDefaultSequenceInternal(
  supabase: any,
): Promise<{ sequence: Sequence; steps: SequenceStep[] } | null> {
  const { data: seq } = await supabase
    .from('outreach_sequences')
    .select('*')
    .eq('is_default', true)
    .eq('active', true)
    .maybeSingle()
  if (!seq) return null
  const { data: steps } = await supabase
    .from('outreach_sequence_steps')
    .select('*')
    .eq('sequence_id', seq.id)
    .eq('active', true)
    .order('order_index', { ascending: true })
  return { sequence: seq as Sequence, steps: (steps ?? []) as SequenceStep[] }
}

export async function ensureEnrollmentInternal(
  supabase: any,
  leadId: string,
): Promise<Enrollment | null> {
  const { data: existing } = await supabase
    .from('lead_sequence_enrollments')
    .select('*')
    .eq('lead_id', leadId)
    .maybeSingle()
  if (existing) return existing as Enrollment
  const bundle = await loadDefaultSequenceInternal(supabase)
  if (!bundle) return null
  const { data: created, error } = await supabase
    .from('lead_sequence_enrollments')
    .insert({ lead_id: leadId, sequence_id: bundle.sequence.id, status: 'active' } as never)
    .select('*')
    .maybeSingle()
  if (error) {
    // Race — another writer inserted; fetch it
    const { data: retry } = await supabase
      .from('lead_sequence_enrollments')
      .select('*')
      .eq('lead_id', leadId)
      .maybeSingle()
    return (retry ?? null) as Enrollment | null
  }
  return created as Enrollment
}

export async function getEnrollmentInternal(
  supabase: any,
  leadId: string,
): Promise<Enrollment | null> {
  const { data } = await supabase
    .from('lead_sequence_enrollments')
    .select('*')
    .eq('lead_id', leadId)
    .maybeSingle()
  return (data ?? null) as Enrollment | null
}

export async function patchEnrollmentInternal(
  supabase: any,
  leadId: string,
  patch: Partial<Enrollment>,
) {
  await supabase.from('lead_sequence_enrollments').update(patch as never).eq('lead_id', leadId)
}

export async function pauseEnrollmentInternal(supabase: any, leadId: string, reason: string) {
  const { data: enr } = await supabase
    .from('lead_sequence_enrollments')
    .select('id, status')
    .eq('lead_id', leadId)
    .maybeSingle()
  if (!enr) return
  if ((enr as any).status === 'completed' || (enr as any).status === 'cancelled') return
  await supabase
    .from('lead_sequence_enrollments')
    .update({ status: 'paused', pause_reason: reason } as never)
    .eq('lead_id', leadId)
}

export async function resumeEnrollmentInternal(supabase: any, leadId: string) {
  const { data: enr } = await supabase
    .from('lead_sequence_enrollments')
    .select('id, status')
    .eq('lead_id', leadId)
    .maybeSingle()
  if (!enr || (enr as any).status !== 'paused') return
  await supabase
    .from('lead_sequence_enrollments')
    .update({ status: 'active', pause_reason: null } as never)
    .eq('lead_id', leadId)
}

export async function cancelEnrollmentInternal(supabase: any, leadId: string, reason: string) {
  await supabase
    .from('lead_sequence_enrollments')
    .update({
      status: 'cancelled',
      pause_reason: reason,
      completed_at: new Date().toISOString(),
    } as never)
    .eq('lead_id', leadId)
}

export async function completeEnrollmentInternal(supabase: any, leadId: string, reason: string) {
  await supabase
    .from('lead_sequence_enrollments')
    .update({
      status: 'completed',
      pause_reason: reason,
      completed_at: new Date().toISOString(),
    } as never)
    .eq('lead_id', leadId)
}

// ============================================================================
// Admin server functions (client-callable)
// ============================================================================

async function assertAdmin(context: any) {
  const { data: ok, error } = await context.supabase.rpc('has_role', {
    _user_id: context.userId,
    _role: 'administrador',
  })
  if (error) throw new Error(error.message)
  if (!ok) throw new Error('Apenas administradores podem gerenciar cadências.')
}

export const listSequences = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: seqs, error } = await context.supabase
      .from('outreach_sequences')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (seqs ?? []) as Sequence[]
  })

export const getSequenceWithSteps = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: seq, error } = await context.supabase
      .from('outreach_sequences')
      .select('*')
      .eq('id', data.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!seq) throw new Error('Cadência não encontrada.')
    const { data: steps } = await context.supabase
      .from('outreach_sequence_steps')
      .select('*')
      .eq('sequence_id', data.id)
      .order('order_index', { ascending: true })
    return { sequence: seq as Sequence, steps: (steps ?? []) as SequenceStep[] }
  })

export const getDefaultSequenceWithSteps = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return await loadDefaultSequenceInternal(context.supabase)
  })

const seqUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullish(),
  active: z.boolean().optional(),
})

export const updateSequence = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => seqUpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const patch: Record<string, unknown> = {}
    if (data.name !== undefined) patch.name = data.name
    if (data.description !== undefined) patch.description = data.description
    if (data.active !== undefined) patch.active = data.active
    if (!Object.keys(patch).length) return { ok: true }
    const { error } = await context.supabase
      .from('outreach_sequences')
      .update(patch as never)
      .eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

const stepUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  sequence_id: z.string().uuid(),
  order_index: z.number().int().min(0).max(50),
  channel: z.enum(['whatsapp', 'email', 'phone']),
  delay_minutes: z.number().int().min(0).max(60 * 24 * 30),
  template: z.string().trim().max(2000).nullish(),
  continue_on: z
    .array(z.enum(['sent', 'delivered', 'read', 'replied', 'failed', 'skipped']))
    .default([]),
  active: z.boolean().default(true),
})

export const upsertSequenceStep = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => stepUpsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    if (data.id) {
      const { error } = await context.supabase
        .from('outreach_sequence_steps')
        .update({
          order_index: data.order_index,
          channel: data.channel,
          delay_minutes: data.delay_minutes,
          template: data.template ?? null,
          continue_on: data.continue_on,
          active: data.active,
        } as never)
        .eq('id', data.id)
      if (error) throw new Error(error.message)
      return { ok: true, id: data.id }
    }
    const { data: inserted, error } = await context.supabase
      .from('outreach_sequence_steps')
      .insert({
        sequence_id: data.sequence_id,
        order_index: data.order_index,
        channel: data.channel,
        delay_minutes: data.delay_minutes,
        template: data.template ?? null,
        continue_on: data.continue_on,
        active: data.active,
      } as never)
      .select('id')
      .maybeSingle()
    if (error) throw new Error(error.message)
    return { ok: true, id: (inserted as { id?: string } | null)?.id }
  })

export const deleteSequenceStep = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const { error } = await context.supabase
      .from('outreach_sequence_steps')
      .delete()
      .eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const getLeadEnrollment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lead_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: enr } = await context.supabase
      .from('lead_sequence_enrollments')
      .select('*')
      .eq('lead_id', data.lead_id)
      .maybeSingle()
    if (!enr) return null
    const seqId = (enr as { sequence_id: string }).sequence_id
    const [{ data: seq }, { data: steps }] = await Promise.all([
      context.supabase
        .from('outreach_sequences')
        .select('id, name, description, is_default, active')
        .eq('id', seqId)
        .maybeSingle(),
      context.supabase
        .from('outreach_sequence_steps')
        .select('*')
        .eq('sequence_id', seqId)
        .order('order_index', { ascending: true }),
    ])
    return {
      enrollment: enr as Enrollment,
      sequence: seq,
      steps: (steps ?? []) as SequenceStep[],
    }
  })
