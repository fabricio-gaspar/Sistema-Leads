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
    await context.supabase.from('audit_logs').insert({
      actor_id: context.userId,
      actor_name: context.claims?.email ?? 'user',
      actor_type: 'human',
      action: 'lead_create',
      detail: `Lead criado: ${data.company}`,
    } as never)
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
    await context.supabase.from('audit_logs').insert({
      actor_id: context.userId,
      actor_name: context.claims?.email ?? 'user',
      actor_type: 'human',
      action: 'lead_delete',
      detail: `Lead ${data.id} removido`,
    } as never)
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
      .insert({ ...data, sent_at: new Date().toISOString() } as never)
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

// ============= COMPANY SETTINGS =============

const companySettingsInput = z.object({
  name: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  segment: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  tone_of_voice: z.string().optional().nullable(),
  differentiators: z.string().optional().nullable(),
  logo_url: z.string().optional().nullable(),
  ai_prompt: z.string().optional().nullable(),
  ai_model: z.string().optional().nullable(),
  ai_temperature: z.number().optional().nullable(),
  ai_max_tokens: z.number().int().optional().nullable(),
})

export const getCompanySettings = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  })

export const updateCompanySettings = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySettingsInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from('company_settings')
      .select('id')
      .limit(1)
      .maybeSingle()
    if (existing?.id) {
      const { data: row, error } = await context.supabase
        .from('company_settings')
        .update(data as never)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return row
    }
    const { data: row, error } = await context.supabase
      .from('company_settings')
      .insert(data as never)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  })

// ============= ANA (Anthropic) =============

const ANA_DEFAULT_SYSTEM = `Você é Ana, vendedora virtual da WF Digital.
Seja consultiva, cordial, objetiva e comercial. Reposicione objeções (preço, "vou pensar", concorrente) com valor.
Responda em português do Brasil, mensagens curtas de WhatsApp (2 a 4 frases).`

export const chatWithAna = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        lead_id: z.string().uuid(),
        user_text: z.string().min(1).max(4000),
        as_client: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada')

    const [{ data: settings }, { data: history }, { data: lead }] = await Promise.all([
      context.supabase.from('company_settings').select('ai_prompt, ai_model, ai_temperature, ai_max_tokens, name, description, differentiators, tone_of_voice').limit(1).maybeSingle(),
      context.supabase.from('lead_messages').select('sender, text').eq('lead_id', data.lead_id).order('sent_at', { ascending: true }).limit(20),
      context.supabase.from('leads').select('company, contact, segment, stage').eq('id', data.lead_id).maybeSingle(),
    ])

    const senderLabel = data.as_client ? 'client' : 'human'
    await context.supabase.from('lead_messages').insert({
      lead_id: data.lead_id,
      sender: senderLabel,
      sender_name: data.as_client ? (lead?.contact ?? 'Cliente') : (context.claims?.email ?? 'Vendedor'),
      type: data.as_client ? 'client' : 'human',
      text: data.user_text,
      sent_at: new Date().toISOString(),
    } as never)

    const systemBase = (settings?.ai_prompt && settings.ai_prompt.trim()) || ANA_DEFAULT_SYSTEM
    const leadCtx = lead
      ? `\n\nContexto do lead:\n- Empresa: ${lead.company}\n- Contato: ${lead.contact ?? '—'}\n- Segmento: ${lead.segment ?? '—'}\n- Estágio: ${lead.stage}`
      : ''
    const companyCtx = settings
      ? `\n\nSua empresa: ${settings.name ?? 'WF Digital'}${settings.description ? `\nDescrição: ${settings.description}` : ''}${settings.differentiators ? `\nDiferenciais: ${settings.differentiators}` : ''}${settings.tone_of_voice ? `\nTom de voz: ${settings.tone_of_voice}` : ''}`
      : ''
    const system = `${systemBase}${companyCtx}${leadCtx}`

    const messages = [
      ...(history ?? []).map((m) => ({
        role: m.sender === 'client' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      })),
      { role: data.as_client ? ('user' as const) : ('assistant' as const), content: data.user_text },
    ]
    // If vendor typed as themselves asking Ana to reply, treat prior as-is and add a user "prompt-me" turn:
    if (!data.as_client) {
      messages.push({ role: 'user' as const, content: 'Como Ana, responda à conversa acima de forma comercial, curta e cordial.' })
    }

    const model = settings?.ai_model || 'claude-sonnet-4-5-20250929'
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: Number(settings?.ai_max_tokens ?? 512),
        temperature: Number(settings?.ai_temperature ?? 0.7),
        system,
        messages,
      }),
    })

    const payload = (await upstream.json()) as {
      content?: Array<{ type: string; text?: string }>
      error?: { message?: string }
    }
    if (!upstream.ok) throw new Error(payload?.error?.message || `Anthropic ${upstream.status}`)
    const text =
      (payload.content || [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text || '')
        .join('\n')
        .trim() || '…'

    const { data: anaRow, error: anaErr } = await context.supabase
      .from('lead_messages')
      .insert({
        lead_id: data.lead_id,
        sender: 'ia',
        sender_name: 'Ana (IA)',
        type: 'ia',
        text,
        sent_at: new Date().toISOString(),
      } as never)
      .select()
      .single()
    if (anaErr) throw new Error(anaErr.message)

    await context.supabase.from('leads').update({ last_contact: new Date().toISOString() }).eq('id', data.lead_id)
    return { reply: text, message: anaRow }
  })

// ============= DOCUMENTS =============

export const listDocuments = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  })

export const createDocumentRecord = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1),
        type: z.string().optional().nullable(),
        size: z.string().optional().nullable(),
        storage_path: z.string().min(1),
        status: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from('documents')
      .insert({ ...data, uploaded_by: context.userId, status: data.status ?? 'active' } as never)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  })

export const deleteDocument = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase.from('documents').select('storage_path').eq('id', data.id).maybeSingle()
    if (doc?.storage_path) {
      await context.supabase.storage.from('docs').remove([doc.storage_path])
    }
    const { error } = await context.supabase.from('documents').delete().eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const getDocumentSignedUrl = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ storage_path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage.from('docs').createSignedUrl(data.storage_path, 3600)
    if (error) throw new Error(error.message)
    return signed
  })

// ============= ROLES / PERMISSIONS =============

const appRole = z.enum(['administrador', 'vendedor', 'sdr', 'cx'])

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc('has_role', { _user_id: ctx.userId, _role: 'administrador' })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Acesso restrito a administradores')
}

export const getMyRoles = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from('user_roles').select('role').eq('user_id', context.userId)
    if (error) throw new Error(error.message)
    return (data ?? []).map((r: { role: string }) => r.role)
  })

export const listTeam = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context)
    const [{ data: profiles, error: e1 }, { data: roles, error: e2 }] = await Promise.all([
      context.supabase.from('profiles').select('*').order('created_at', { ascending: true }),
      context.supabase.from('user_roles').select('user_id, role'),
    ])
    if (e1) throw new Error(e1.message)
    if (e2) throw new Error(e2.message)
    const byUser = new Map<string, string[]>()
    for (const r of roles ?? []) {
      const arr = byUser.get(r.user_id) ?? []
      arr.push(r.role)
      byUser.set(r.user_id, arr)
    }
    return (profiles ?? []).map((p: { id: string }) => ({ ...p, roles: byUser.get(p.id) ?? [] }))
  })

export const setUserRole = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid(), role: appRole }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    // Substitui roles do usuário pela role escolhida (perfil único de exibição)
    const { error: delErr } = await context.supabase.from('user_roles').delete().eq('user_id', data.user_id)
    if (delErr) throw new Error(delErr.message)
    const { error } = await context.supabase.from('user_roles').insert({ user_id: data.user_id, role: data.role } as never)
    if (error) throw new Error(error.message)
    await context.supabase.from('audit_logs').insert({
      actor_id: context.userId,
      actor_name: context.claims?.email ?? 'admin',
      actor_type: 'human',
      action: 'role_change',
      detail: `Usuário ${data.user_id} → ${data.role}`,
    } as never)
    return { ok: true }
  })

export const removeUserRole = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid(), role: appRole }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const { error } = await context.supabase
      .from('user_roles')
      .delete()
      .eq('user_id', data.user_id)
      .eq('role', data.role)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const updateTeamMember = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z
          .object({
            name: z.string().optional().nullable(),
            phone: z.string().optional().nullable(),
            active: z.boolean().optional(),
            can_use_ia: z.boolean().optional(),
            discount_limit: z.string().optional().nullable(),
          })
          .partial(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const { data: row, error } = await context.supabase
      .from('profiles')
      .update(data.patch as never)
      .eq('id', data.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  })

// ============= AUDIT LOGS =============

export const listAuditLogs = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context)
    const { data, error } = await context.supabase
      .from('audit_logs')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(200)
    if (error) throw new Error(error.message)
    return data ?? []
  })

