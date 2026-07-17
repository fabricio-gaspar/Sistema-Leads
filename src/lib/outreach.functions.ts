import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

// ============================================================================
// Types
// ============================================================================

export type Channel = 'whatsapp' | 'email' | 'phone'
export type OutreachStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'replied'
  | 'failed'
  | 'skipped'

export type ChannelStatus = {
  available: boolean
  last_status?: OutreachStatus | null
  last_attempt_at?: string | null
}

export type ContactChannels = Partial<Record<Channel, ChannelStatus>>

// ============================================================================
// Helpers (server-only)
// ============================================================================

type Ctx = { supabase: any; userId: string; claims?: any }

function buildChannels(lead: {
  whatsapp?: string | null
  phone?: string | null
  email?: string | null
}): ContactChannels {
  const wa = (lead.whatsapp || '').replace(/\D/g, '')
  const ph = (lead.phone || '').replace(/\D/g, '')
  const em = (lead.email || '').trim()
  return {
    whatsapp: { available: wa.length >= 10, last_status: null, last_attempt_at: null },
    email: { available: /.+@.+\..+/.test(em), last_status: null, last_attempt_at: null },
    phone: { available: ph.length >= 10, last_status: null, last_attempt_at: null },
  }
}

function recommendChannel(
  channels: ContactChannels,
  cadenceCap: number,
): Channel | null {
  const order: Channel[] = ['whatsapp', 'email', 'phone']
  for (const c of order) {
    const s = channels[c]
    if (!s?.available) continue
    if (s.last_status === 'failed' || s.last_status === 'skipped') continue
    if (s.last_status === 'replied') return c
    // pending/sent/delivered/read/null are all valid to (re)use
    void cadenceCap
    return c
  }
  return null
}

async function loadCadence(ctx: Ctx): Promise<{ waitHours: number; maxAttempts: number }> {
  const { data } = await ctx.supabase
    .from('company_settings')
    .select('outreach_wait_hours, outreach_max_attempts')
    .limit(1)
    .maybeSingle()
  return {
    waitHours: Number(data?.outreach_wait_hours ?? 24),
    maxAttempts: Number(data?.outreach_max_attempts ?? 3),
  }
}

async function loadLead(ctx: Ctx, leadId: string) {
  const { data, error } = await ctx.supabase.from('leads').select('*').eq('id', leadId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Lead não encontrado')
  return data
}

async function updateChannelStatus(
  ctx: Ctx,
  leadId: string,
  channel: Channel,
  status: OutreachStatus,
  extra: Record<string, unknown> = {},
) {
  const lead = await loadLead(ctx, leadId)
  const channels = (lead.contact_channels ?? {}) as ContactChannels
  channels[channel] = {
    available: channels[channel]?.available ?? true,
    last_status: status,
    last_attempt_at: new Date().toISOString(),
  }
  const patch: Record<string, unknown> = { contact_channels: channels, ...extra }
  await ctx.supabase.from('leads').update(patch as never).eq('id', leadId)
}

async function audit(
  ctx: Ctx,
  action: string,
  detail: string,
  actorType: 'ia' | 'human' | 'system' = 'ia',
) {
  await ctx.supabase.from('audit_logs').insert({
    actor_id: ctx.userId,
    actor_name: ctx.claims?.email ?? (actorType === 'ia' ? 'Ana (IA)' : 'user'),
    actor_type: actorType,
    action,
    detail,
  } as never)
}

// ============================================================================
// Ana copywriting (Claude)
// ============================================================================

async function generateOutreachMessage(
  ctx: Ctx,
  lead: any,
  channel: Channel,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const { data: settings } = await ctx.supabase
    .from('company_settings')
    .select('name, description, differentiators, tone_of_voice, ai_prompt, ai_model')
    .limit(1)
    .maybeSingle()

  const kind =
    channel === 'whatsapp'
      ? 'mensagem CURTA (2-3 frases) de PRIMEIRO CONTATO via WhatsApp'
      : channel === 'email'
        ? 'e-mail de primeiro contato (assunto na 1ª linha "Assunto: ...", corpo abaixo, tom profissional e curto, máximo 6 linhas)'
        : 'roteiro de LIGAÇÃO comercial (bullet points: abertura, 2 perguntas descoberta, valor, próximo passo)'

  const system = `${settings?.ai_prompt || 'Você é Ana, vendedora virtual consultiva, cordial e comercial.'}
Empresa: ${settings?.name ?? 'nossa empresa'}${settings?.description ? `\nDescrição: ${settings.description}` : ''}${settings?.differentiators ? `\nDiferenciais: ${settings.differentiators}` : ''}${settings?.tone_of_voice ? `\nTom: ${settings.tone_of_voice}` : ''}

Gere ${kind}. Não use "prezado/a". Personalize pelo segmento/empresa do lead.`

  const userPrompt = `Lead:
- Empresa: ${lead.company}
- Contato: ${lead.contact ?? 'sem nome ainda'}
- Segmento: ${lead.segment ?? 'não informado'}
- Cidade/UF: ${lead.city ?? '—'}/${lead.uf ?? '—'}`

  if (!apiKey) {
    // Fallback textual determinístico se Claude indisponível
    if (channel === 'whatsapp')
      return `Olá! Sou da ${settings?.name ?? 'nossa empresa'}. Vi que a ${lead.company} atua em ${lead.segment ?? 'seu segmento'} e acredito que podemos ajudar. Posso te explicar em 2 minutos?`
    if (channel === 'email')
      return `Assunto: Uma ideia rápida para a ${lead.company}\n\nOi! Sou da ${settings?.name ?? 'nossa empresa'}. Ajudamos empresas de ${lead.segment ?? 'seu segmento'} com resultados concretos. Faz sentido conversarmos 15 min essa semana?`
    return `- Abertura: cumprimentar e apresentar-se pela ${settings?.name ?? 'nossa empresa'}\n- Descoberta: como estão hoje em ${lead.segment ?? 'a operação'}? qual maior desafio?\n- Valor: como resolvemos casos parecidos\n- Próximo passo: agendar reunião de 20 min`
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: settings?.ai_model || 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      temperature: 0.7,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })
  if (!res.ok) return `Olá! Sou da ${settings?.name ?? 'nossa empresa'} e gostaria de conversar rapidamente com você.`
  const payload = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
  return (
    (payload.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('').trim() ||
    'Olá! Podemos conversar rapidamente?'
  )
}

// ============================================================================
// WhatsApp senders (server only) — prefer Evolution Go, fallback Z-API
// ============================================================================

async function loadEvolutionConfig(ctx: Ctx): Promise<{
  url: string | null
  apiKey: string | null
  instance: string | null
  active: boolean
} | null> {
  const { data } = await ctx.supabase
    .from('company_settings')
    .select('evolution_url, evolution_api_key, evolution_instance, evolution_active')
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return {
    url: (data.evolution_url ?? '').trim() || null,
    apiKey: (data.evolution_api_key ?? '').trim() || null,
    instance: (data.evolution_instance ?? '').trim() || null,
    active: !!data.evolution_active,
  }
}

async function sendEvolutionText(
  cfg: { url: string; apiKey: string; instance?: string | null },
  to: string,
  message: string,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const phone = to.replace(/\D/g, '')
  if (phone.length < 10) return { ok: false, error: 'invalid_phone' }
  const base = cfg.url.replace(/\/+$/, '')
  // Evolution Go endpoint: POST /send/text — instance derives from apikey.
  // If an instance name is provided we still forward it as a header for
  // servers that support instance-scoped keys.
  const url = `${base}/send/text`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: cfg.apiKey,
        ...(cfg.instance ? { instance: cfg.instance } : {}),
      },
      body: JSON.stringify({ number: phone, text: message }),
    })
    const body = (await res.json().catch(() => ({}))) as any
    if (!res.ok || body?.success === false) {
      return { ok: false, error: body?.error?.message || body?.error || `http_${res.status}` }
    }
    const messageId =
      body?.data?.Info?.ID ||
      body?.messageId ||
      body?.key?.id ||
      body?.id ||
      undefined
    return { ok: true, messageId }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

async function sendZapiText(to: string, message: string): Promise<{
  ok: boolean
  messageId?: string
  error?: string
}> {
  const instance = process.env.ZAPI_INSTANCE_ID
  const token = process.env.ZAPI_TOKEN
  const clientToken = process.env.ZAPI_CLIENT_TOKEN
  if (!instance || !token) {
    return { ok: false, error: 'zapi_not_configured' }
  }
  const phone = to.replace(/\D/g, '')
  if (phone.length < 10) return { ok: false, error: 'invalid_phone' }
  const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(clientToken ? { 'Client-Token': clientToken } : {}),
      },
      body: JSON.stringify({ phone, message }),
    })
    const body = (await res.json().catch(() => ({}))) as any
    if (!res.ok || body?.error) {
      return { ok: false, error: body?.error || `http_${res.status}` }
    }
    return { ok: true, messageId: body?.messageId || body?.id || body?.zaapId }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

async function sendWhatsappText(
  ctx: Ctx,
  to: string,
  message: string,
): Promise<{ ok: boolean; messageId?: string; error?: string; provider: 'evolution' | 'zapi' | 'none' }> {
  const evo = await loadEvolutionConfig(ctx)
  if (evo?.active && evo.url && evo.apiKey) {
    const r = await sendEvolutionText({ url: evo.url, apiKey: evo.apiKey, instance: evo.instance }, to, message)
    return { ...r, provider: 'evolution' }
  }
  const r = await sendZapiText(to, message)
  return { ...r, provider: r.ok || r.error !== 'zapi_not_configured' ? 'zapi' : 'none' }
}

// ============================================================================
// Core cadence
// ============================================================================

async function tryChannel(ctx: Ctx, lead: any, channel: Channel): Promise<void> {
  const cadence = await loadCadence(ctx)
  const { count } = await ctx.supabase
    .from('lead_outreach')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', lead.id)
    .eq('channel', channel)
  const attempt = (count ?? 0) + 1

  if (attempt > cadence.maxAttempts) {
    await ctx.supabase.from('lead_outreach').insert({
      lead_id: lead.id,
      owner_id: ctx.userId,
      channel,
      status: 'skipped',
      attempt,
      content: null,
      error: 'max_attempts_reached',
      actor_type: 'system',
    } as never)
    await updateChannelStatus(ctx, lead.id, channel, 'skipped')
    await advanceOrFinish(ctx, lead.id, channel)
    return
  }

  const content = await generateOutreachMessage(ctx, lead, channel)

  // Insert a pending row first (we'll patch it after send)
  const { data: row } = await ctx.supabase
    .from('lead_outreach')
    .insert({
      lead_id: lead.id,
      owner_id: ctx.userId,
      channel,
      status: 'pending',
      attempt,
      content,
      provider: channel === 'whatsapp' ? 'zapi' : channel === 'email' ? 'smtp' : 'manual',
      actor_type: 'ia',
    } as never)
    .select()
    .single()

  if (channel === 'whatsapp') {
    const to = lead.whatsapp || lead.phone || ''
    const result = await sendZapiText(to, content)
    if (result.ok) {
      await ctx.supabase
        .from('lead_outreach')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          provider_message_id: result.messageId ?? null,
        } as never)
        .eq('id', row.id)
      // Log a mirror message in the chat
      await ctx.supabase.from('lead_messages').insert({
        lead_id: lead.id,
        sender: 'ia',
        sender_name: 'Ana (IA)',
        type: 'ia',
        text: content,
        sent_at: new Date().toISOString(),
      } as never)
      await updateChannelStatus(ctx, lead.id, 'whatsapp', 'sent', {
        active_channel: 'whatsapp',
        // aguardar delivered/read/reply antes de trocar de canal
        next_action_at: new Date(Date.now() + cadence.waitHours * 3600 * 1000).toISOString(),
        last_contact: new Date().toISOString(),
      })
      await audit(ctx, 'outreach_whatsapp_sent', `Ana enviou WhatsApp para ${lead.company} (tent. ${attempt})`)
      return
    }
    // failed
    await ctx.supabase
      .from('lead_outreach')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        error: result.error,
      } as never)
      .eq('id', row.id)
    await updateChannelStatus(ctx, lead.id, 'whatsapp', 'failed')
    await audit(ctx, 'outreach_whatsapp_failed', `Falha WhatsApp ${lead.company}: ${result.error}`)
    await advanceOrFinish(ctx, lead.id, 'whatsapp')
    return
  }

  if (channel === 'email') {
    // Sem provedor de e-mail integrado ainda: registrar falha controlada
    await ctx.supabase
      .from('lead_outreach')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        error: 'no_email_provider',
      } as never)
      .eq('id', row.id)
    await updateChannelStatus(ctx, lead.id, 'email', 'failed')
    await audit(ctx, 'outreach_email_skipped', `E-mail para ${lead.company}: nenhum provedor configurado`)
    await advanceOrFinish(ctx, lead.id, 'email')
    return
  }

  // phone → cria tarefa de ligação e marca "pending"
  await ctx.supabase
    .from('lead_outreach')
    .update({ status: 'pending', metadata: { script: content } } as never)
    .eq('id', row.id)
  await ctx.supabase.from('lead_tasks').insert({
    lead_id: lead.id,
    text: `Ligação pendente para ${lead.company} — roteiro sugerido pela Ana disponível no histórico do lead.`,
    owner_id: ctx.userId,
    owner_label: 'Vendedor',
  } as never)
  await updateChannelStatus(ctx, lead.id, 'phone', 'pending', {
    active_channel: 'phone',
    next_action_at: null,
  })
  await audit(ctx, 'outreach_phone_task_created', `Tarefa de ligação criada para ${lead.company}`)
}

async function advanceOrFinish(ctx: Ctx, leadId: string, failedChannel: Channel) {
  const lead = await loadLead(ctx, leadId)
  const channels = (lead.contact_channels ?? {}) as ContactChannels
  const order: Channel[] = ['whatsapp', 'email', 'phone']
  const startIdx = order.indexOf(failedChannel) + 1
  for (let i = startIdx; i < order.length; i++) {
    const next = order[i]
    const s = channels[next]
    if (s?.available && s.last_status !== 'failed' && s.last_status !== 'skipped') {
      await tryChannel(ctx, lead, next)
      return
    }
  }
  // Nada mais a fazer
  await ctx.supabase
    .from('leads')
    .update({ next_action_at: null, active_channel: null } as never)
    .eq('id', leadId)
  await audit(ctx, 'outreach_exhausted', `Todos os canais esgotados para ${lead.company}`, 'system')
}

// ============================================================================
// Server functions (client-callable)
// ============================================================================

export const startOutreach = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lead_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const lead = await loadLead(context as Ctx, data.lead_id)
    if (lead.opt_out) return { ok: false, reason: 'opt_out' }
    if (lead.ai_paused) return { ok: false, reason: 'paused' }

    // Garante contact_channels populado
    let channels = (lead.contact_channels ?? {}) as ContactChannels
    if (!channels.whatsapp && !channels.email && !channels.phone) {
      channels = buildChannels(lead)
      await context.supabase
        .from('leads')
        .update({ contact_channels: channels } as never)
        .eq('id', lead.id)
      lead.contact_channels = channels
    }

    const cadence = await loadCadence(context as Ctx)
    const target = recommendChannel(channels, cadence.maxAttempts)
    if (!target) {
      await audit(context as Ctx, 'outreach_no_channel', `Sem canais para ${lead.company}`, 'system')
      return { ok: false, reason: 'no_channel_available' }
    }
    await tryChannel(context as Ctx, lead, target)
    return { ok: true, channel: target }
  })

export const pauseAi = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ lead_id: z.string().uuid(), paused: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await context.supabase
      .from('leads')
      .update({ ai_paused: data.paused } as never)
      .eq('id', data.lead_id)
    await audit(
      context as Ctx,
      data.paused ? 'ai_paused' : 'ai_resumed',
      `IA ${data.paused ? 'pausada' : 'retomada'} para lead ${data.lead_id}`,
      'human',
    )
    return { ok: true }
  })

export const assumeManually = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lead_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from('leads')
      .update({
        ai_paused: true,
        assigned_to: context.userId,
        owner: 'humano',
        next_action_at: null,
      } as never)
      .eq('id', data.lead_id)
    await audit(context as Ctx, 'handoff_manual', `Atendimento assumido manualmente`, 'human')
    return { ok: true }
  })

export const setOptOut = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ lead_id: z.string().uuid(), opt_out: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await context.supabase
      .from('leads')
      .update({
        opt_out: data.opt_out,
        next_action_at: data.opt_out ? null : undefined,
      } as never)
      .eq('id', data.lead_id)
    await audit(
      context as Ctx,
      data.opt_out ? 'opt_out_set' : 'opt_out_cleared',
      `LGPD: opt_out=${data.opt_out}`,
      'human',
    )
    return { ok: true }
  })

export const listOutreach = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lead_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from('lead_outreach')
      .select('*')
      .eq('lead_id', data.lead_id)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return rows ?? []
  })

export const testZapi = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const instance = process.env.ZAPI_INSTANCE_ID
    const token = process.env.ZAPI_TOKEN
    const clientToken = process.env.ZAPI_CLIENT_TOKEN
    if (!instance || !token) return { ok: false, error: 'Credenciais Z-API ausentes' }
    try {
      const res = await fetch(
        `https://api.z-api.io/instances/${instance}/token/${token}/status`,
        { headers: clientToken ? { 'Client-Token': clientToken } : {} },
      )
      const body = (await res.json().catch(() => ({}))) as any
      if (!res.ok) return { ok: false, error: body?.error || `http_${res.status}` }
      return { ok: true, connected: !!body?.connected, session: body?.session ?? null }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

// ============================================================================
// Exposed helpers for other server modules (prospecting) & webhooks
// ============================================================================

export async function initialContactChannels(lead: {
  whatsapp?: string | null
  phone?: string | null
  email?: string | null
}): Promise<ContactChannels> {
  return buildChannels(lead)
}

export async function triggerOutreachInternal(ctx: Ctx, leadId: string) {
  const lead = await loadLead(ctx, leadId)
  if (lead.opt_out || lead.ai_paused) return
  let channels = (lead.contact_channels ?? {}) as ContactChannels
  if (!channels.whatsapp && !channels.email && !channels.phone) {
    channels = buildChannels(lead)
    await ctx.supabase
      .from('leads')
      .update({ contact_channels: channels } as never)
      .eq('id', leadId)
    lead.contact_channels = channels
  }
  const cadence = await loadCadence(ctx)
  const target = recommendChannel(channels, cadence.maxAttempts)
  if (!target) return
  await tryChannel(ctx, lead, target)
}
