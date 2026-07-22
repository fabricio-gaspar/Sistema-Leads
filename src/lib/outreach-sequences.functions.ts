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
  const { error } = await supabase.from('lead_sequence_enrollments').update(patch as never).eq('lead_id', leadId)
  if (error) throw new Error(error.message)
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

function validateSequenceSteps(steps: SequenceStep[]) {
  const active = [...steps].filter((step) => step.active).sort((a, b) => a.order_index - b.order_index)
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
  max_attempts: z.number().int().min(1).max(10).optional(),
  template: z.string().trim().max(2000).nullish(),
  continue_on: z
    .array(z.enum(['sent', 'delivered', 'read', 'replied', 'failed', 'skipped']))
    .optional(),
  active: z.boolean().optional(),
})

export const upsertSequenceStep = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => stepUpsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const { data: currentRows, error: currentError } = await context.supabase
      .from('outreach_sequence_steps')
      .select('*')
      .eq('sequence_id', data.sequence_id)
      .order('order_index', { ascending: true })
    if (currentError) throw new Error(currentError.message)
    const current = (currentRows ?? []) as SequenceStep[]
    if (data.id) {
      const existing = current.find((step) => step.id === data.id)
      if (!existing) throw new Error('Passo da cadência não encontrado.')
      const next = {
        ...existing,
        order_index: data.order_index,
        channel: data.channel,
        delay_minutes: data.delay_minutes,
        max_attempts: data.max_attempts ?? existing.max_attempts ?? 1,
        template: data.template === undefined ? existing.template : (data.template ?? null),
        continue_on: data.continue_on ?? existing.continue_on,
        active: data.active ?? existing.active,
      }
      validateSequenceSteps(current.map((step) => step.id === data.id ? next : step))
      const { error } = await context.supabase
        .from('outreach_sequence_steps')
        .update({
          order_index: next.order_index,
          channel: next.channel,
          delay_minutes: next.delay_minutes,
          max_attempts: next.max_attempts,
          template: next.template,
          continue_on: next.continue_on,
          active: next.active,
        } as never)
        .eq('id', data.id)
      if (error) throw new Error(error.message)
      return { ok: true, id: data.id }
    }
    const shiftedCurrent = current.map((step) =>
      step.order_index >= data.order_index ? { ...step, order_index: step.order_index + 1 } : step,
    )
    const candidate = {
      id: 'new',
      sequence_id: data.sequence_id,
      order_index: data.order_index,
      channel: data.channel,
      delay_minutes: data.delay_minutes,
      max_attempts: data.max_attempts ?? 1,
      template: data.template ?? null,
      continue_on: data.continue_on ?? ['failed', 'skipped'],
      active: data.active ?? true,
      created_at: '',
      updated_at: '',
    } satisfies SequenceStep
    validateSequenceSteps([...shiftedCurrent, candidate])
    const shiftedRows = [...current]
      .filter((step) => step.order_index >= data.order_index)
      .sort((a, b) => b.order_index - a.order_index)
    for (const step of shiftedRows) {
      const { error: shiftError } = await context.supabase
        .from('outreach_sequence_steps')
        .update({ order_index: step.order_index + 1 } as never)
        .eq('id', step.id)
      if (shiftError) throw new Error(`Não foi possível abrir espaço para o novo passo: ${shiftError.message}`)
    }
    const { data: inserted, error } = await context.supabase
      .from('outreach_sequence_steps')
      .insert({
        sequence_id: data.sequence_id,
        order_index: data.order_index,
        channel: data.channel,
        delay_minutes: data.delay_minutes,
        max_attempts: data.max_attempts ?? 1,
        template: data.template ?? null,
        continue_on: data.continue_on ?? ['failed', 'skipped'],
        active: data.active ?? true,
      } as never)
      .select('id')
      .maybeSingle()
    if (error) {
      for (const step of [...shiftedRows].reverse()) {
        await context.supabase
          .from('outreach_sequence_steps')
          .update({ order_index: step.order_index } as never)
          .eq('id', step.id)
      }
      throw new Error(error.message)
    }
    return { ok: true, id: (inserted as { id?: string } | null)?.id }
  })

export const deleteSequenceStep = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const { data: row, error: rowError } = await context.supabase
      .from('outreach_sequence_steps')
      .select('*')
      .eq('id', data.id)
      .maybeSingle()
    if (rowError) throw new Error(rowError.message)
    if (!row) throw new Error('Passo da cadência não encontrado.')
    const { data: siblings, error: siblingsError } = await context.supabase
      .from('outreach_sequence_steps')
      .select('*')
      .eq('sequence_id', row.sequence_id)
    if (siblingsError) throw new Error(siblingsError.message)
    validateSequenceSteps(((siblings ?? []) as SequenceStep[]).filter((step) => step.id !== data.id))
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
