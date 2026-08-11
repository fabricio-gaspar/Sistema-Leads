import { autonomyOf } from './autonomy'
import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'

type Ctx = { supabase: any; userId: string; claims?: any }

async function audit(ctx: Ctx, action: string, detail: string, actorType: 'ia' | 'human' | 'system' = 'ia') {
  await (ctx.supabase as any).from('audit_logs').insert({
    actor_id: ctx.userId,
    actor_name: ctx.claims?.email ?? (actorType === 'ia' ? 'Ana (IA)' : 'Sistema'),
    actor_type: actorType,
    action,
    detail,
  } as never)
}

async function loadCompanyContext(ctx: Ctx) {
  const [{ data: settings }, { data: services }, { data: objections }] = await Promise.all([
    (ctx.supabase as any).from('company_settings').select('*').limit(1).maybeSingle(),
    (ctx.supabase as any).from('services').select('id, name, description, price, unit, term, max_discount').eq('active', true),
    (ctx.supabase as any).from('objections').select('trigger, response').limit(10),
  ])
  return { settings: settings ?? null, services: services ?? [], objections: objections ?? [] }
}

async function loadKnowledgeSnippets(ctx: Ctx, maxChunks = 6): Promise<string> {
  const { data } = await (ctx.supabase as any).from('knowledge_chunks')
    .select('content, documents(name, status)')
    .eq('status', 'ready')
    .limit(maxChunks)
  if (!data?.length) return ''
  return (data as any[])
    .filter((r: any) => r.documents?.status === 'active' || r.documents?.status === 'ready')
    .map((r) => `— ${r.content.slice(0, 400)}`)
    .join('\n')
}

async function callClaude(system: string, user: string, model?: string, maxTokens = 900) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-5-20250929',
      max_tokens: maxTokens,
      temperature: 0.4,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) return null
  const payload = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
  return (payload.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text || '').join('').trim() || null
}

export const draftInitialContact = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    lead_id: z.string().uuid(),
    channel: z.enum(['whatsapp', 'email', 'phone']).default('whatsapp'),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    const { data: lead } = await (ctx.supabase as any).from("leads" as any).select('*').eq('id', data.lead_id).maybeSingle()
    if (!lead) throw new Error('Lead não encontrado')
    const { settings, services, objections } = await loadCompanyContext(ctx)
    const knowledge = await loadKnowledgeSnippets(ctx)
    const portfolio = services.slice(0, 6).map((s: any) => (s.description ? `${s.name}: ${s.description}` : s.name)).join('; ')
    const topObjections = objections.slice(0, 3).map((o: any) => `Se surgir "${o.trigger}", responder: ${o.response}`).join('\n')
    const kind = data.channel === 'whatsapp' ? 'mensagem CURTA (2-3 frases) de PRIMEIRO CONTATO via WhatsApp' : data.channel === 'email' ? 'e-mail curto Tom profissional' : 'roteiro de LIGAÇÃO'
    const system = `${settings?.ai_prompt || 'Você é Ana.'} Contexto: ${knowledge}`
    const user = `Lead: ${lead.company}`
    const generated = await callClaude(system, user, settings?.ai_model)
    await audit(ctx, 'initial_contact_drafted', `Rascunho para ${lead.company}`)
    return { draft: generated ?? 'Olá!', channel: data.channel, used_ai: Boolean(generated) }
  })

type ProposedItem = { service_id?: string; name: string; qty: number; unit_price: number; total: number; note?: string }
async function nextProposalNumber(ctx: Ctx): Promise<string> {
  const year = new Date().getFullYear()
  const { count } = await (ctx.supabase as any).from('proposals').select('id', { count: 'exact', head: true })
  return `P-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`
}

export const autoDraftProposal = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lead_id: z.string().uuid(), force: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    const { data: lead } = await (ctx.supabase as any).from("leads" as any).select('*').eq('id', data.lead_id).maybeSingle()
    if (!lead) throw new Error('Lead não encontrado')
    const { settings, services } = await loadCompanyContext(ctx)
    const totalValue = Number(services[0]?.price ?? 0)
    const number = await nextProposalNumber(ctx)
    const { data: proposal } = await (ctx.supabase as any).from('proposals').insert({ number, lead_id: data.lead_id, client: lead.company, value: totalValue, status: 'Rascunho' } as never).select().single()
    await audit(ctx, 'proposal_auto_drafted', `${number} para ${lead.company}`)
    return { proposal }
  })

export async function runNurtureSweepInternal(ctx: Ctx, limit = 20) {
  const { data: settings } = await (ctx.supabase as any).from('company_settings').select('nurture_days, nurture_max_cycles').limit(1).maybeSingle()
  const threshold = new Date(Date.now() - (Number(settings?.nurture_days ?? 14) * 24 * 60 * 60 * 1000)).toISOString()
  const { data: candidates } = await (ctx.supabase as any).from('leads').select('id, company').in('stage', ['Prospecção', 'Qualificado']).eq('opt_out', false).lt('updated_at', threshold).limit(limit)
  if (!candidates?.length) return { candidates: 0 }
  const { triggerOutreachInternal } = await import('@/lib/outreach.functions')
  for (const lead of candidates) {
    await triggerOutreachInternal(ctx, lead.id)
  }
  return { candidates: candidates.length }
}

export const runNurtureNow = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => runNurtureSweepInternal(context as Ctx, 20))

export async function createHandoffInternal(ctx: Ctx, input: any) {
  const admin = ctx.supabase as any
  const { data: lead } = await admin.from('leads').select('*').eq('id', input.leadId).maybeSingle()
  const { data: handoff } = await admin.from('lead_handoffs').insert({ lead_id: input.leadId, reason: input.reason, assigned_to: lead.assigned_to } as never).select().single()
  return handoff
}

export const getLeadAutomation = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: any) => z.object({ lead_id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    const [enr, qual, hand, appt] = await Promise.all([
      (ctx.supabase as any).from('lead_sequence_enrollments').select('*').eq('lead_id', data.lead_id).maybeSingle(),
      (ctx.supabase as any).from('lead_qualifications').select('*').eq('lead_id', data.lead_id).maybeSingle(),
      (ctx.supabase as any).from('lead_handoffs').select('*').eq('lead_id', data.lead_id).order('requested_at', { ascending: false }).limit(1).maybeSingle(),
      (ctx.supabase as any).from('appointments').select('*').eq('lead_id', data.lead_id).order('starts_at', { ascending: false }).limit(20),
    ])
    return { enrollment: enr.data, qualification: qual.data, handoff: hand.data, appointments: appt.data ?? [] }
  })

export const scheduleAppointment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: any) => z.object({ lead_id: z.string().uuid(), title: z.string(), starts_at: z.string() }).parse(v))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    const { data: appointment } = await (ctx.supabase as any).from('appointments').insert({ ...data, owner_id: ctx.userId } as never).select().single()
    return appointment
  })

export const acceptHandoff = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: any) => z.object({ handoff_id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    const { data: handoff } = await (ctx.supabase as any).from('lead_handoffs').update({ 
      status: 'Aprovado',
      assigned_to: ctx.userId 
    } as never).eq('id', data.handoff_id).select().single()
    return handoff
  })

export const saveLeadQualification = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: any) => z.object({ 
    lead_id: z.string().uuid(),
    readiness_score: z.number().min(0).max(100),
    summary: z.string().optional(),
    pain_points: z.array(z.string()).optional(),
    decision_maker: z.boolean().optional(),
    budget_confirmed: z.boolean().optional()
  }).parse(v))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    const { data: qual } = await (ctx.supabase as any).from('lead_qualifications').upsert({
      lead_id: data.lead_id,
      readiness_score: data.readiness_score,
      summary: data.summary,
      pain_points: data.pain_points,
      decision_maker: data.decision_maker,
      budget_confirmed: data.budget_confirmed,
      updated_at: new Date().toISOString()
    } as never).select().single()
    return qual
  })
