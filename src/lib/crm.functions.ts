import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'

// ============= LEADS =============

const leadStage = z.enum(['Prospecção', 'Qualificado', 'Proposta', 'Negociação', 'Pedido', 'Fechado', 'Perdido'])
const leadTemp = z.enum(['hot', 'warm', 'cold'])

const leadInputSchema = z.object({
  company: z.string().min(1),
  contact: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  segment: z.string().optional().nullable(),
  uf: z.string().optional().nullable(),
  distance: z.number().int().optional().nullable(),
  score: z.number().int().min(0).max(100).optional().nullable(),
  temp: leadTemp.optional(),
  stage: leadStage.optional(),
  value: z.number().optional().nullable(),
  origin: z.string().optional().nullable(),
  owner: z.string().optional().nullable(),
  assigned_to: z.string().optional().nullable(),
})

export const listLeads = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from('leads')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  })

export const getLead = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: lead, error } = await context.supabase.from('leads').select('*').eq('id', data.id).maybeSingle()
    if (error) throw new Error(error.message)
    return lead
  })

export const createLead = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => leadInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const payload = { ...data, email: data.email || null, owner_id: context.userId }
    const { data: row, error } = await context.supabase.from('leads').insert(payload as never).select().single()
    if (error) throw new Error(error.message)
    return row
  })

export const updateLead = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), patch: leadInputSchema.partial() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from('leads')
      .update(data.patch as never)
      .eq('id', data.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  })

export const moveLeadStage = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), stage: leadStage }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from('leads')
      .update({ stage: data.stage })
      .eq('id', data.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    await context.supabase.from('audit_logs').insert({
      actor_id: context.userId,
      actor_name: context.claims?.email ?? 'user',
      actor_type: 'human',
      action: 'stage_change',
      detail: `Lead ${data.id} → ${data.stage}`,
    })
    return row
  })

export const deleteLead = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from('leads').delete().eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

// ============= LEAD MESSAGES =============

const messageSender = z.enum(['ia', 'human', 'client'])
const messageType = z.enum(['ia', 'ia-escalated', 'human', 'client'])

export const listLeadMessages = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lead_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from('lead_messages')
      .select('*')
      .eq('lead_id', data.lead_id)
      .order('sent_at', { ascending: true })
    if (error) throw new Error(error.message)
    return rows ?? []
  })

export const createLeadMessage = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        lead_id: z.string().uuid(),
        sender: messageSender,
        sender_name: z.string().min(1),
        type: messageType,
        text: z.string().min(1).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from('lead_messages')
      .insert({ ...data, sent_at: new Date().toISOString() })
      .select()
      .single()
    if (error) throw new Error(error.message)
    await context.supabase.from('leads').update({ last_contact: new Date().toISOString() }).eq('id', data.lead_id)
    return row
  })

// ============= LEAD TASKS =============

export const listLeadTasks = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lead_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from('lead_tasks')
      .select('*')
      .eq('lead_id', data.lead_id)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return rows ?? []
  })

export const upsertLeadTask = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        lead_id: z.string().uuid(),
        text: z.string().min(1).max(500),
        due_at: z.string().datetime().optional().nullable(),
        owner_label: z.string().optional().nullable(),
        completed: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from('lead_tasks')
        .update({ text: data.text, due_at: data.due_at, owner_label: data.owner_label, completed: data.completed ?? false })
        .eq('id', data.id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return row
    }
    const { data: row, error } = await context.supabase
      .from('lead_tasks')
      .insert({
        lead_id: data.lead_id,
        text: data.text,
        due_at: data.due_at,
        owner_id: context.userId,
        owner_label: data.owner_label ?? null,
        completed: data.completed ?? false,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  })

export const deleteLeadTask = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from('lead_tasks').delete().eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

// ============= PROPOSALS =============

const proposalStatus = z.string().min(1)

const proposalInput = z.object({
  number: z.string().min(1),
  lead_id: z.string().uuid().optional().nullable(),
  client: z.string().min(1),
  items: z.any().optional().nullable(),
  value: z.number().nonnegative(),
  discount: z.number().optional().nullable(),
  creator_name: z.string().optional().nullable(),
  status: proposalStatus.optional(),
  need_approval: z.boolean().optional(),
})

export const listProposals = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from('proposals').select('*').order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  })

export const createProposal = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => proposalInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from('proposals')
      .insert({ ...data, owner_id: context.userId, creator: context.userId } as never)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  })

export const updateProposal = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), patch: proposalInput.partial() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from('proposals')
      .update(data.patch as never)
      .eq('id', data.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  })

export const deleteProposal = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from('proposals').delete().eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

// ============= ORDERS =============

const orderInput = z.object({
  number: z.string().min(1),
  lead_id: z.string().uuid().optional().nullable(),
  proposal_id: z.string().uuid().optional().nullable(),
  company: z.string().min(1),
  seller_name: z.string().optional().nullable(),
  seller_type: z.string().optional().nullable(),
  order_date: z.string().optional().nullable(),
  items: z.any().optional().nullable(),
  value: z.number().nonnegative(),
  payment: z.string().optional().nullable(),
  contract_status: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
})

export const listOrders = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from('orders').select('*').order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  })

export const createOrder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orderInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from('orders')
      .insert({ ...data, owner_id: context.userId } as never)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  })

export const updateOrder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), patch: orderInput.partial() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from('orders')
      .update(data.patch as never)
      .eq('id', data.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  })

export const deleteOrder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from('orders').delete().eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })
