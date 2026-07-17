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
    const payload = {
      ...data,
      items: data.items ?? '[]',
      discount: data.discount == null ? null : String(data.discount),
      owner_id: context.userId,
      creator: 'human' as const,
      creator_name: data.creator_name ?? (context.claims?.email as string | undefined) ?? null,
    }
    const { data: row, error } = await context.supabase
      .from('proposals')
      .insert(payload as never)
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
  size: z.enum(['pequena', 'media', 'grande']).optional().nullable(),
  annual_revenue: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
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
  prospecting_sources: z
    .object({
      cnpj_ws: z.boolean(),
      google_places: z.boolean(),
      ai_only: z.boolean(),
    })
    .optional()
    .nullable(),
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

    const leadUpdate: Record<string, unknown> = { last_contact: new Date().toISOString() }

    // Classificar interesse quando é mensagem do cliente e escalar para humano
    if (data.as_client) {
      try {
        const clsRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model,
            max_tokens: 150,
            temperature: 0,
            system: 'Classifique a última mensagem do cliente em um funil B2B. Responda APENAS JSON: {"intencao":"interesse|duvida|objecao|desinteresse|neutro","confianca":0-100}. "interesse" = cliente quer avançar (pedir proposta, agendar, quer saber preço para comprar, aceita reunião).',
            messages: [{ role: 'user', content: `Mensagem do cliente: "${data.user_text}"` }],
          }),
        })
        if (clsRes.ok) {
          const cls = (await clsRes.json()) as { content?: Array<{ type: string; text?: string }> }
          const raw = (cls.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('')
          const m = raw.match(/\{[\s\S]*\}/)
          if (m) {
            const parsed = JSON.parse(m[0]) as { intencao?: string; confianca?: number }
            if (parsed.intencao === 'interesse' && (parsed.confianca ?? 0) >= 60) {
              leadUpdate.stage = 'Qualificado'
              await context.supabase.from('lead_messages').insert({
                lead_id: data.lead_id,
                sender: 'ia',
                sender_name: 'Ana (IA)',
                type: 'ia-escalated',
                text: '🔔 Cliente demonstrou interesse — encaminhando para um vendedor humano.',
                sent_at: new Date().toISOString(),
              } as never)
              await context.supabase.from('notifications').insert({
                user_id: context.userId,
                kind: 'lead_escalated',
                title: 'Lead pronto para vendedor',
                body: `${lead?.company ?? 'Lead'} demonstrou interesse. Assuma o atendimento.`,
                lead_id: data.lead_id,
              } as never)
              await context.supabase.from('audit_logs').insert({
                actor_id: context.userId,
                actor_name: 'Ana (IA)',
                actor_type: 'ia',
                action: 'lead_escalated',
                detail: `Lead ${data.lead_id} escalado para humano (interesse detectado)`,
              } as never)
            }
          }
        }
      } catch (err) {
        console.error('intent classification failed', err)
      }
    }

    await context.supabase.from('leads').update(leadUpdate as never).eq('id', data.lead_id)
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
    type Profile = {
      id: string
      name: string | null
      email: string | null
      phone: string | null
      avatar: string | null
      active: boolean | null
      can_use_ia: boolean | null
      discount_limit: string | null
    }
    return ((profiles ?? []) as Profile[]).map((p) => ({ ...p, roles: byUser.get(p.id) ?? [] }))
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

// ============= DASHBOARD & REPORTS =============

export const getDashboardStats = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const [leadsRes, msgsRes, propsRes, ordersRes] = await Promise.all([
      context.supabase.from('leads').select('id, stage, value, temp, stale_hours, owner'),
      context.supabase
        .from('lead_messages')
        .select('id, sender', { count: 'exact', head: false })
        .gte('sent_at', startOfDay.toISOString()),
      context.supabase.from('proposals').select('id, status, value'),
      context.supabase.from('orders').select('id, value, created_at').gte('created_at', startOfMonth.toISOString()),
    ])

    const leads = leadsRes.data ?? []
    const active = leads.filter((l) => l.stage !== 'Fechado' && l.stage !== 'Perdido')
    const hot = leads.filter((l) => l.temp === 'hot').length
    const stale = leads.filter((l) => (l.stale_hours ?? 0) >= 48).length
    const pipelineValue = active.reduce((a, l) => a + Number(l.value || 0), 0)

    const msgs = msgsRes.data ?? []
    const msgsAna = msgs.filter((m) => m.sender === 'ia').length

    const proposals = propsRes.data ?? []
    const proposalsOpen = proposals.filter((p) => p.status !== 'Fechada' && p.status !== 'Perdida').length
    const proposalsValue = proposals
      .filter((p) => p.status !== 'Perdida')
      .reduce((a, p) => a + Number(p.value || 0), 0)

    const orders = ordersRes.data ?? []
    const ordersValue = orders.reduce((a, o) => a + Number(o.value || 0), 0)

    return {
      leadsActive: active.length,
      leadsTotal: leads.length,
      leadsHot: hot,
      leadsStale: stale,
      pipelineValue,
      messagesToday: msgs.length,
      messagesAnaToday: msgsAna,
      proposalsOpen,
      proposalsValue,
      ordersMonthCount: orders.length,
      ordersMonthValue: ordersValue,
    }
  })

export const getReportsData = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Últimos 7 meses
    const now = new Date()
    const months: { key: string; label: string; year: number; month: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
      months.push({ key, label: label.charAt(0).toUpperCase() + label.slice(1), year: d.getFullYear(), month: d.getMonth() })
    }
    const start = new Date(months[0].year, months[0].month, 1)

    const [closedRes, allLeadsRes, teamRes] = await Promise.all([
      context.supabase
        .from('leads')
        .select('id, updated_at, owner, assigned_to, value, origin, stage')
        .eq('stage', 'Fechado')
        .gte('updated_at', start.toISOString()),
      context.supabase.from('leads').select('id, origin, value, stage'),
      context.supabase.from('profiles').select('id, name'),
    ])

    const closed = closedRes.data ?? []
    const allLeads = allLeadsRes.data ?? []
    const team = teamRes.data ?? []
    const nameById = new Map(team.map((p) => [p.id, p.name] as const))

    // Série mensal IA vs Humano (por owner do lead fechado)
    const series = months.map((m) => {
      const inMonth = closed.filter((l) => {
        const d = new Date(l.updated_at)
        return d.getFullYear() === m.year && d.getMonth() === m.month
      })
      return {
        label: m.label,
        ia: inMonth.filter((l) => l.owner === 'ia').length,
        humano: inMonth.filter((l) => l.owner !== 'ia').length,
      }
    })

    // Ranking por assigned_to (+ Ana agregada)
    type RankRow = { nome: string; isAI: boolean; leads: number; fechados: number; receita: number }
    const map = new Map<string, RankRow>()
    const add = (key: string, nome: string, isAI: boolean, fechado: boolean, valor: number) => {
      const cur = map.get(key) ?? { nome, isAI, leads: 0, fechados: 0, receita: 0 }
      cur.leads += 1
      if (fechado) {
        cur.fechados += 1
        cur.receita += valor
      }
      map.set(key, cur)
    }
    for (const l of allLeads) {
      const fechado = l.stage === 'Fechado'
      const valor = Number(l.value || 0)
      // heurística: se sem assigned_to e owner=Ana → linha "Ana (IA)"
      if (!('assigned_to' in l) || !(l as { assigned_to?: string | null }).assigned_to) {
        add('__ana__', 'Ana (IA)', true, fechado, valor)
      } else {
        const assigned = (l as { assigned_to?: string | null }).assigned_to as string
        const nome = nameById.get(assigned) ?? 'Vendedor'
        add(assigned, nome, false, fechado, valor)
      }
    }
    const ranking = Array.from(map.values())
      .map((r) => ({ ...r, taxa: r.leads > 0 ? ((r.fechados / r.leads) * 100).toFixed(1) + '%' : '0%' }))
      .sort((a, b) => b.receita - a.receita)

    // Canais / origem
    const origemMap = new Map<string, number>()
    for (const l of allLeads) {
      const o = l.origin || 'Outros'
      origemMap.set(o, (origemMap.get(o) ?? 0) + 1)
    }
    const totalOrigem = Array.from(origemMap.values()).reduce((a, b) => a + b, 0) || 1
    const canais = Array.from(origemMap.entries())
      .map(([canal, leads]) => ({ canal, leads, pct: Math.round((leads / totalOrigem) * 100) }))
      .sort((a, b) => b.leads - a.leads)

    // KPIs topo
    const receita7m = closed.reduce((a, l) => a + Number(l.value || 0), 0)
    const totalFechados = closed.length
    const ticket = totalFechados > 0 ? Math.round(receita7m / totalFechados) : 0

    return {
      months: series,
      ranking,
      canais,
      kpis: {
        receita7m,
        leadsGerados: allLeads.length,
        ticket,
        fechados7m: totalFechados,
      },
    }
  })

// ============= PROSPECÇÃO =============

export const listProspects = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        segment: z.string().optional().nullable(),
        uf: z.string().optional().nullable(),
        min_score: z.number().int().optional().nullable(),
        size: z.string().optional().nullable(),
        city: z.string().optional().nullable(),
        min_revenue: z.number().optional().nullable(),
        max_revenue: z.number().optional().nullable(),
      })
      .partial()
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase.from('leads').select('*').eq('stage', 'Prospecção')
    if (data.segment) q = q.eq('segment', data.segment)
    if (data.uf) q = q.eq('uf', data.uf)
    if (data.min_score) q = q.gte('score', data.min_score)
    if (data.size) q = q.eq('size', data.size)
    if (data.city) q = q.ilike('city', `%${data.city}%`)
    if (data.min_revenue != null) q = q.gte('annual_revenue', data.min_revenue)
    if (data.max_revenue != null) q = q.lte('annual_revenue', data.max_revenue)
    const { data: rows, error } = await q.order('score', { ascending: false }).limit(200)
    if (error) throw new Error(error.message)
    return rows ?? []
  })

export const bulkAssignProspects = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1),
        target: z.enum(['ana', 'human']),
        assigned_to: z.string().uuid().optional().nullable(),
        next_stage: leadStage.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {
      owner: data.target === 'ana' ? 'ia' : 'human',
      stage: data.next_stage ?? 'Qualificado',
    }
    if (data.target === 'human' && data.assigned_to) patch.assigned_to = data.assigned_to
    if (data.target === 'ana') patch.assigned_to = null
    const { error } = await context.supabase.from('leads').update(patch as never).in('id', data.ids)
    if (error) throw new Error(error.message)
    await context.supabase.from('audit_logs').insert({
      actor_id: context.userId,
      actor_name: context.claims?.email ?? 'user',
      actor_type: 'human',
      action: 'bulk_assign',
      detail: `${data.ids.length} prospect(s) → ${data.target === 'ana' ? 'Ana (IA)' : 'Vendedor humano'}`,
    } as never)
    return { ok: true, count: data.ids.length }
  })

// ============= SERVICES (Catálogo) =============

const serviceInput = z.object({
  name: z.string().min(1),
  category: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  price: z.number().optional().nullable(),
  unit: z.string().optional().nullable(),
  term: z.string().optional().nullable(),
  max_discount: z.number().optional().nullable(),
  active: z.boolean().optional(),
})

export const listServices = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from('services').select('*').order('name')
    if (error) throw new Error(error.message)
    return data ?? []
  })

export const upsertService = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional().nullable(), patch: serviceInput.partial() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from('services')
        .update(data.patch as never)
        .eq('id', data.id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return row
    }
    const { data: row, error } = await context.supabase
      .from('services')
      .insert({ ...(data.patch as Record<string, unknown>), active: data.patch.active ?? true } as never)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  })

export const deleteService = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const { error } = await context.supabase.from('services').delete().eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

// ============= OBJEÇÕES =============

export const listObjections = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from('objections').select('*').order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  })

export const upsertObjection = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional().nullable(),
        trigger: z.string().min(1),
        response: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from('objections')
        .update({ trigger: data.trigger, response: data.response } as never)
        .eq('id', data.id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return row
    }
    const { data: row, error } = await context.supabase
      .from('objections')
      .insert({ trigger: data.trigger, response: data.response } as never)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  })

export const deleteObjection = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const { error } = await context.supabase.from('objections').delete().eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

// ============= SCORE WEIGHTS =============

export const getScoreWeights = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from('score_weights').select('*').limit(1).maybeSingle()
    if (error) throw new Error(error.message)
    return data
  })

export const updateScoreWeights = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        segment: z.number().int().min(0).max(100),
        whatsapp: z.number().int().min(0).max(100),
        site: z.number().int().min(0).max(100),
        porte: z.number().int().min(0).max(100),
        google: z.number().int().min(0).max(100),
        regiao: z.number().int().min(0).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const { data: existing } = await context.supabase.from('score_weights').select('id').limit(1).maybeSingle()
    if (existing?.id) {
      const { data: row, error } = await context.supabase
        .from('score_weights')
        .update(data as never)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return row
    }
    const { data: row, error } = await context.supabase.from('score_weights').insert(data as never).select().single()
    if (error) throw new Error(error.message)
    return row
  })

// ============= UNANSWERED QUESTIONS (Governança IA) =============

export const listUnansweredQuestions = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from('unanswered_questions')
      .select('*')
      .order('count', { ascending: false })
      .limit(200)
    if (error) throw new Error(error.message)
    return data ?? []
  })

export const registerUnansweredQuestion = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ text: z.string().min(2) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from('unanswered_questions')
      .select('id, count')
      .eq('text', data.text)
      .maybeSingle()
    if (existing?.id) {
      const { error } = await context.supabase
        .from('unanswered_questions')
        .update({ count: (existing.count ?? 1) + 1, resolved: false } as never)
        .eq('id', existing.id)
      if (error) throw new Error(error.message)
      return { ok: true }
    }
    const { error } = await context.supabase
      .from('unanswered_questions')
      .insert({ text: data.text, count: 1, resolved: false } as never)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const resolveUnansweredQuestion = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), resolved: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const { error } = await context.supabase
      .from('unanswered_questions')
      .update({ resolved: data.resolved } as never)
      .eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const deleteUnansweredQuestion = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const { error } = await context.supabase.from('unanswered_questions').delete().eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })


// ============= NOTIFICATIONS =============

export const listNotifications = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from('notifications')
      .select('*')
      .eq('user_id', context.userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw new Error(error.message)
    return data ?? []
  })

export const markAllNotificationsRead = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from('notifications')
      .update({ read: true } as never)
      .eq('user_id', context.userId)
      .eq('read', false)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const pushNotification = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      kind: z.enum(['ana', 'lead', 'orcamento', 'pedido', 'sistema']).default('sistema'),
      title: z.string().min(1),
      description: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from('notifications')
      .insert({
        user_id: context.userId,
        kind: data.kind,
        title: data.title,
        description: data.description ?? null,
      } as never)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  })

// ============= GLOBAL SEARCH =============

export const globalSearch = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const q = data.q.trim()
    const pattern = `%${q}%`
    const [leads, proposals, orders] = await Promise.all([
      context.supabase
        .from('leads')
        .select('id, company, contact, email')
        .or(`company.ilike.${pattern},contact.ilike.${pattern},email.ilike.${pattern}`)
        .limit(8),
      context.supabase
        .from('proposals')
        .select('id, number, client')
        .or(`number.ilike.${pattern},client.ilike.${pattern}`)
        .limit(8),
      context.supabase
        .from('orders')
        .select('id, number, company')
        .or(`number.ilike.${pattern},company.ilike.${pattern}`)
        .limit(8),
    ])
    return {
      leads: leads.data ?? [],
      proposals: proposals.data ?? [],
      orders: orders.data ?? [],
    }
  })

// ============= AI RETRAIN =============

export const retrainAna = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Records a retrain event; the actual model context is rebuilt from company_settings + objections at chat time.
    const [{ count: objectionsCount }, { count: questionsCount }] = await Promise.all([
      context.supabase.from('objections').select('id', { count: 'exact', head: true }),
      context.supabase.from('unanswered_questions').select('id', { count: 'exact', head: true }).eq('resolved', true),
    ])
    await context.supabase.from('audit_logs').insert({
      actor_id: context.userId,
      actor_name: (context.claims?.email as string | undefined) ?? 'user',
      actor_type: 'human',
      action: 'ana_retrain',
      detail: `Ana retreinada com ${objectionsCount ?? 0} objeções e ${questionsCount ?? 0} respostas aprendidas.`,
    } as never)
    await context.supabase.from('notifications').insert({
      user_id: context.userId,
      kind: 'ana',
      title: 'Ana foi retreinada',
      description: `Base atualizada: ${objectionsCount ?? 0} objeções · ${questionsCount ?? 0} respostas aprendidas.`,
    } as never)
    return { ok: true, objections: objectionsCount ?? 0, learned: questionsCount ?? 0 }
  })

// ============= COUNTS (for sidebar badges) =============

export const getSidebarCounts = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [leads, proposalsPending, unreadNotif] = await Promise.all([
      context.supabase.from('leads').select('id', { count: 'exact', head: true }).in('stage', ['Prospecção', 'Qualificado']),
      context.supabase.from('proposals').select('id', { count: 'exact', head: true }).in('status', ['Rascunho', 'Enviado', 'Visualizado']),
      context.supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', context.userId).eq('read', false),
    ])
    return {
      leads: leads.count ?? 0,
      proposals: proposalsPending.count ?? 0,
      notifications: unreadNotif.count ?? 0,
    }
  })

// ============= INTEGRATIONS =============

export const listIntegrations = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from('integrations')
      .select('id, key, label, connected, updated_at')
      .order('label', { ascending: true })
    if (error) throw new Error(error.message)
    return data ?? []
  })
