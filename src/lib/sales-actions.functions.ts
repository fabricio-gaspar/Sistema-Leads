import { autonomyOf } from './autonomy'
import { autonomyOf } from './autonomy'
import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'


import type { Database } from '@/integrations/supabase/types'


type Ctx = { supabase: any; userId: string; claims?: any }

// ============================================================================
// Helpers
// ============================================================================

async function audit(ctx: Ctx, action: string, detail: string, actorType: 'ia' | 'human' | 'system' = 'ia') {
  await (ctx.supabase as any).from('audit_logs' as any) as any.insert({
    actor_id: ctx.userId,
    actor_name: ctx.claims?.email ?? (actorType === 'ia' ? 'Ana (IA)' : 'Sistema'),
    actor_type: actorType,
    action,
    detail,
  } as never)
}

async function loadCompanyContext(ctx: Ctx) {
  const [{ data: settings }, { data: services }, { data: objections }] = await Promise.all([
    (ctx.supabase as any).from('company_settings' as any) as any.select('*').limit(1).maybeSingle(),
    (ctx.supabase as any).from('services' as any) as any.select('id, name, description, price, unit, term, max_discount').eq('active', true),
    (ctx.supabase as any).from('objections' as any) as any.select('trigger, response').limit(10),
  ])
  return { settings: settings ?? null, services: services ?? [], objections: objections ?? [] }
}

async function loadKnowledgeSnippets(ctx: Ctx, maxChunks = 6): Promise<string> {
  const { data } = await ctx.supabase
    .from('knowledge_chunks' as any) as any
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

// ============================================================================
// Stage 2 (Pitch enriquecido): rascunho de primeiro contato personalizado
// ============================================================================

export const draftInitialContact = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    lead_id: z.string().uuid(),
    channel: z.enum(['whatsapp', 'email', 'phone']).default('whatsapp'),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    const { data: lead, error } = await (ctx.supabase as any).from('leads' as any) as any.select('*').eq('id', data.lead_id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!lead) throw new Error('Lead não encontrado')

    const { settings, services, objections } = await loadCompanyContext(ctx)
    const knowledge = await loadKnowledgeSnippets(ctx)

    const portfolio = services
      .slice(0, 6)
      .map((s: any) => (s.description ? `${s.name}: ${s.description}` : s.name))
      .join('; ')
    const topObjections = objections.slice(0, 3).map((o: any) => `Se surgir "${o.trigger}", responder: ${o.response}`).join('\n')

    const kind =
      data.channel === 'whatsapp'
        ? 'mensagem CURTA (2-3 frases) de PRIMEIRO CONTATO via WhatsApp, com uma pergunta ao final'
        : data.channel === 'email'
          ? 'e-mail curto (assunto na 1ª linha "Assunto: ...", corpo com 4-6 linhas, tom profissional e consultivo)'
          : 'roteiro de LIGAÇÃO em bullets: abertura, 2 perguntas de descoberta, valor, próximo passo'

    const system = `${settings?.ai_prompt || 'Você é Ana, vendedora virtual consultiva, cordial e comercial.'}
Empresa: ${settings?.name ?? 'nossa empresa'}${settings?.description ? `\nDescrição: ${settings.description}` : ''}${settings?.differentiators ? `\nDiferenciais: ${settings.differentiators}` : ''}${portfolio ? `\nPortfólio ativo: ${portfolio}` : ''}${settings?.tone_of_voice ? `\nTom: ${settings.tone_of_voice}` : ''}
${knowledge ? `\nContexto aprovado (base de conhecimento):\n${knowledge}` : ''}
${topObjections ? `\nObjeções conhecidas:\n${topObjections}` : ''}

Gere ${kind}. Personalize pelo segmento, cidade e porte do lead. Não invente serviços, preços, resultados ou condições. Não use "prezado/a". Não prometa prazos que não estejam no contexto.`

    const user = `Lead:
- Empresa: ${lead.company}
- Contato: ${lead.contact ?? 'sem nome ainda'}
- Segmento: ${lead.segment ?? 'não informado'}
- Cidade/UF: ${lead.city ?? '—'}/${lead.uf ?? '—'}
- Porte: ${lead.size ?? '—'}
- Score: ${lead.score ?? '—'}/100
- Motivo do score: ${lead.score_explanation ?? '—'}`

    const generated = await callClaude(system, user, settings?.ai_model)
    const draft = generated ?? `Olá! Sou da ${settings?.name ?? 'nossa empresa'} e vi que a ${lead.company} atua em ${lead.segment ?? 'seu segmento'}. Podemos conversar rapidamente?`

    await audit(ctx, 'initial_contact_drafted', `Rascunho de ${data.channel} para ${lead.company}`)
    return { draft, channel: data.channel, used_ai: Boolean(generated) }
  })

// ============================================================================
// Stage 3 (Orçamento automático): rascunho de proposta a partir da qualificação
// ============================================================================

type ProposedItem = { service_id?: string; name: string; qty: number; unit_price: number; total: number; note?: string }

async function nextProposalNumber(ctx: Ctx): Promise<string> {
  const year = new Date().getFullYear()
  const { count } = await (ctx.supabase as any).from('proposals' as any) as any.select('id', { count: 'exact', head: true })
  const n = String((count ?? 0) + 1).padStart(4, '0')
  return `P-${year}-${n}`
}

export const autoDraftProposal = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    lead_id: z.string().uuid(),
    force: z.boolean().optional().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    const [{ data: lead }, { data: qual }] = await Promise.all([
      (ctx.supabase as any).from('leads' as any) as any.select('*').eq('id', data.lead_id).maybeSingle(),
      (ctx.supabase as any).from('lead_qualifications' as any) as any.select('*').eq('lead_id', data.lead_id).maybeSingle(),
    ])
    if (!lead) throw new Error('Lead não encontrado')

    const { settings, services } = await loadCompanyContext(ctx)
    if (!services.length) throw new Error('Nenhum serviço ativo cadastrado')

    const autonomy = autonomyOf((settings as any)?.autonomy, 'proposal_send')
    const readiness = qual?.readiness_score ?? 0
    const minReadiness = settings?.handoff_readiness_score ?? 60
    if (!data.force && readiness < minReadiness) {
      throw new Error(`Prontidão insuficiente (${readiness}/${minReadiness}). Ajuste a qualificação ou envie manualmente.`)
    }

    const catalogo = services
      .map((s: any, i: number) => `${i + 1}. ${s.name} · R$ ${Number(s.price).toFixed(2)} / ${s.unit ?? 'un'}${s.term ? ` · ${s.term}` : ''}${s.description ? `\n   ${s.description}` : ''}`)
      .join('\n')

    const system = `Você é Ana, vendedora consultiva da ${settings?.name ?? 'empresa'}. Monte um ORÇAMENTO usando SOMENTE serviços do catálogo abaixo. Não invente serviços, preços ou condições.
Retorne APENAS JSON válido no formato:
{"items":[{"service_id":"...","name":"...","qty":1,"unit_price":0,"note":"..."}],"summary":"..."}
Escolha 1 a 3 serviços que melhor endereçam a dor/intenção do lead. Use qty=1 quando não houver base para estimar.

CATÁLOGO:
${catalogo}`

    const user = `Lead: ${lead.company} (${lead.segment ?? '—'}, ${lead.city ?? '—'}/${lead.uf ?? '—'})
Intenção: ${qual?.intent ?? '—'}
Dor: ${qual?.pain ?? '—'}
Urgência: ${qual?.urgency ?? '—'}
Orçamento sinalizado: ${qual?.budget_range ?? '—'}
Decisor: ${qual?.decision_maker ?? '—'}
Prontidão: ${readiness}/100
Resumo: ${qual?.summary ?? '—'}`

    const raw = await callClaude(system, user, settings?.ai_model, 1500)
    let picked: { items: ProposedItem[]; summary?: string } | null = null
    if (raw) {
      try {
        const jsonStart = raw.indexOf('{'); const jsonEnd = raw.lastIndexOf('}')
        if (jsonStart >= 0 && jsonEnd > jsonStart) picked = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
      } catch { /* fallback abaixo */ }
    }
    // Fallback determinístico: pega os 2 primeiros serviços do catálogo
    if (!picked?.items?.length) {
      picked = {
        items: services.slice(0, 2).map((s: any) => ({
          service_id: s.id, name: s.name, qty: 1, unit_price: Number(s.price), total: Number(s.price),
          note: s.description ?? undefined,
        })),
        summary: `Rascunho automático a partir do catálogo padrão para ${lead.company}.`,
      }
    }

    // Recalcula totais e valida contra o catálogo (impede preço/serviço inventado)
    const byId = new Map<string, any>(services.map((s: any) => [s.id, s]))
    const byName = new Map<string, any>(services.map((s: any) => [String(s.name).toLowerCase(), s]))
    const cleanItems: ProposedItem[] = []
    for (const raw of picked.items) {
      const svc = (raw.service_id && byId.get(raw.service_id)) || byName.get(String(raw.name ?? '').toLowerCase())
      if (!svc) continue
      const qty = Math.max(1, Math.min(999, Number(raw.qty) || 1))
      const unitPrice = Number(svc.price) // sempre do catálogo, nunca da IA
      cleanItems.push({
        service_id: svc.id,
        name: svc.name,
        qty,
        unit_price: unitPrice,
        total: qty * unitPrice,
        note: raw.note?.toString().slice(0, 400),
      })
    }
    if (!cleanItems.length) throw new Error('Não foi possível casar sugestões da IA com o catálogo ativo.')

    const totalValue = cleanItems.reduce((sum: any, item: any) => sum + item.total, 0)
    const number = await nextProposalNumber(ctx)
    const status = autonomy === 'auto' ? 'Enviado' : 'Rascunho'

    const proposalPayload = {
      number,
      lead_id: data.lead_id,
      client: lead.company,
      items: JSON.stringify(cleanItems),
      value: totalValue,
      discount: null,
      creator: 'ia' as const,
      creator_name: 'Ana (IA)',
      status,
      need_approval: true,
      owner_id: lead.assigned_to || lead.owner_id || ctx.userId,
    }
    const { data: proposal, error: insertError } = await ctx.supabase
      .from('proposals' as any) as any.insert(proposalPayload as never).select().single()
    if (insertError) throw new Error(insertError.message)

    // Avança o kanban do lead
    const order = ['Prospecção', 'Qualificado', 'Proposta', 'Negociação', 'Pedido', 'Fechado']
    const cur = order.indexOf(lead.stage ?? '')
    if (cur >= 0 && cur < order.indexOf('Proposta')) {
      await (ctx.supabase as any).from('leads' as any) as any.update({ stage: 'Proposta' } as never).eq('id', data.lead_id)
    }

    if (autonomy !== 'auto') {
      const assignee = lead.assigned_to || lead.owner_id
      if (assignee) {
        await (ctx.supabase as any).from('notifications' as any) as any.insert({
          user_id: assignee,
          kind: 'proposal_draft',
          title: 'Rascunho de orçamento pronto',
          description: `${lead.company}: R$ ${totalValue.toFixed(2)} — revise antes de enviar.`,
        } as never)
      }
    }

    await audit(
      ctx,
      autonomy === 'auto' ? 'proposal_auto_sent' : 'proposal_auto_drafted',
      `${number} para ${lead.company} · R$ ${totalValue.toFixed(2)} · ${cleanItems.length} item(ns)`,
    )
    return { proposal, items: cleanItems, total: totalValue, autonomy, summary: picked.summary ?? null }
  })

// ============================================================================
// Stage 4 (Nurture): reengajar leads frios sem resposta
// ============================================================================

export async function runNurtureSweepInternal(ctx: Ctx, limit = 20): Promise<{
  candidates: number; reactivated: number; skipped: number; details: Array<{ lead_id: string; result: string }>
}> {
  const admin = ctx.supabase
  const { data: settings } = await admin.from('company_settings' as any) as any.select('nurture_days, nurture_max_cycles, autonomy').limit(1).maybeSingle()
  const autonomy = autonomyOf(settings?.autonomy, 'nurture')
  if (autonomy === 'manual') return { candidates: 0, reactivated: 0, skipped: 0, details: [] }

  const days = Number(settings?.nurture_days ?? 14)
  const maxCycles = Number(settings?.nurture_max_cycles ?? 2)
  const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data: candidates, error } = await admin
    .from('leads' as any) as any
    .select('id, company, stage, opt_out, ai_paused, assigned_to, owner_id, updated_at')
    .in('stage', ['Prospecção', 'Qualificado'])
    .eq('opt_out', false)
    .eq('ai_paused', false)
    .lt('updated_at', threshold)
    .limit(limit)
  if (error) throw new Error(error.message)
  if (!candidates?.length) return { candidates: 0, reactivated: 0, skipped: 0, details: [] }

  const details: Array<{ lead_id: string; result: string }> = []
  let reactivated = 0
  let skipped = 0
  const { triggerOutreachInternal } = await import('@/lib/outreach.functions')

  for (const lead of candidates as any[]) {
    const { data: enrollment } = await admin
      .from('lead_sequence_enrollments' as any) as any.select('id, status, nurture_cycles')
      .eq('lead_id', lead.id).maybeSingle()
    if (enrollment?.status === 'active') { skipped += 1; details.push({ lead_id: lead.id, result: 'active_already' }); continue }
    if ((enrollment?.nurture_cycles ?? 0) >= maxCycles) { skipped += 1; details.push({ lead_id: lead.id, result: 'max_cycles' }); continue }

    if (autonomy === 'assist') {
      const assignee = lead.assigned_to ?? lead.owner_id ?? null
      if (assignee) {
        await admin.from('notifications' as any) as any.insert({
          user_id: assignee, kind: 'nurture_ready',
          title: 'Lead pronto para nurture',
          description: `${lead.company} está sem resposta há ${days}+ dias. Reativar cadência?`,
        } as never)
      }
      details.push({ lead_id: lead.id, result: 'assist_notified' })
      continue
    }

    try {
      // Reativa a matrícula do zero para o próximo passo elegível
      if (enrollment?.id) {
        await admin.from('lead_sequence_enrollments' as any) as any.update({
          status: 'active',
          current_step_index: -1,
          next_run_at: new Date().toISOString(),
          last_error: null,
          nurture_cycles: (enrollment?.nurture_cycles ?? 0) + 1,
        } as never).eq('id', enrollment.id)
      }
      await triggerOutreachInternal(ctx, lead.id)
      reactivated += 1
      details.push({ lead_id: lead.id, result: 'restarted' })
      await admin.from('audit_logs' as any) as any.insert({
        actor_id: ctx.userId, actor_name: 'Nurture', actor_type: 'ia',
        action: 'nurture_restart', detail: `${lead.company}: reativado após ${days}+ dias`,
      } as never)
    } catch (err) {
      skipped += 1; details.push({ lead_id: lead.id, result: `error_${(err as Error).message.slice(0, 40)}` })
    }
  }
  return { candidates: candidates.length, reactivated, skipped, details }
}

export const runNurtureNow = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => runNurtureSweepInternal(context as Ctx, 20))

