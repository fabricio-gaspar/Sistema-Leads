import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

type Ctx = { supabase: any; userId: string; claims?: any }

async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc('has_role', {
    _user_id: ctx.userId,
    _role: 'administrador',
  })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Acesso restrito a administradores')
}

async function audit(ctx: Ctx, action: string, detail: string) {
  await ctx.supabase.from('audit_logs').insert({
    actor_id: ctx.userId,
    actor_name: ctx.claims?.email ?? 'administrador',
    actor_type: 'human',
    action,
    detail,
  } as never)
}

const commercialPolicySchema = z.object({
  business_timezone: z.string().min(3).max(80),
  business_days: z.array(z.number().int().min(0).max(6)).min(1),
  business_start_time: z.string().regex(/^\d{2}:\d{2}/),
  business_end_time: z.string().regex(/^\d{2}:\d{2}/),
  outreach_daily_limit_per_contact: z.number().int().min(1).max(20),
  outreach_min_interval_minutes: z.number().int().min(5).max(43200),
  outreach_require_verified_contact: z.boolean(),
  outreach_require_manual_approval: z.boolean(),
  outreach_auto_start: z.boolean(),
  handoff_escalation_minutes: z.number().int().min(5).max(10080),
  privacy_contact_email: z.string().email().nullable().optional(),
  retention_days: z.number().int().min(30).max(3650),
})

export const getCommercialPolicy = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx)
    const { data, error } = await (context.supabase as any)
      .from('company_settings')
      .select('business_timezone, business_days, business_start_time, business_end_time, outreach_daily_limit_per_contact, outreach_min_interval_minutes, outreach_require_verified_contact, outreach_require_manual_approval, outreach_auto_start, handoff_escalation_minutes, privacy_contact_email, retention_days')
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  })

export const updateCommercialPolicy = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => commercialPolicySchema.parse(value))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    await assertAdmin(ctx)
    const { data: current, error: readError } = await ctx.supabase
      .from('company_settings').select('id').limit(1).maybeSingle()
    if (readError) throw new Error(readError.message)
    const query = current?.id
      ? ctx.supabase.from('company_settings').update(data as never).eq('id', current.id)
      : ctx.supabase.from('company_settings').insert(data as never)
    const { error } = await query
    if (error) throw new Error(error.message)
    await audit(ctx, 'commercial_policy_updated', 'Políticas de envio e retenção atualizadas')
    return { ok: true }
  })

const campaignSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(3).max(160),
  objective: z.string().trim().max(600).nullable().optional(),
  channel: z.enum(['whatsapp', 'email', 'phone', 'mixed', 'inbound']),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']).default('draft'),
  start_at: z.string().datetime().nullable().optional(),
  end_at: z.string().datetime().nullable().optional(),
  budget: z.number().min(0).nullable().optional(),
  expected_value: z.number().min(0).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
})

export const listCampaigns = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx)
    const { data, error } = await (context.supabase as any)
      .from('campaigns').select('*, campaign_members(count)').order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  })

export const upsertCampaign = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => campaignSchema.parse(value))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    await assertAdmin(ctx)
    const { id, ...payload } = data
    const query = id
      ? ctx.supabase.from('campaigns').update(payload as never).eq('id', id).select().single()
      : ctx.supabase.from('campaigns').insert({ ...payload, owner_id: ctx.userId } as never).select().single()
    const { data: row, error } = await query
    if (error) throw new Error(error.message)
    await audit(ctx, id ? 'campaign_updated' : 'campaign_created', payload.name)
    return row
  })

export const addLeadToCampaign = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ campaign_id: z.string().uuid(), lead_id: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    await assertAdmin(ctx)
    const { error } = await ctx.supabase.from('campaign_members').upsert({
      campaign_id: data.campaign_id, lead_id: data.lead_id, status: 'selected',
    } as never, { onConflict: 'campaign_id,lead_id' })
    if (error) throw new Error(error.message)
    await ctx.supabase.from('leads').update({ campaign_id: data.campaign_id } as never).eq('id', data.lead_id)
    return { ok: true }
  })

export const approveCampaignMember = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ campaign_id: z.string().uuid(), lead_id: z.string().uuid(), approved: z.boolean() }).parse(value))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    await assertAdmin(ctx)
    const status = data.approved ? 'approved' : 'removed'
    const { error } = await ctx.supabase.from('campaign_members').update({
      status,
      approved_by: data.approved ? ctx.userId : null,
      approved_at: data.approved ? new Date().toISOString() : null,
    } as never).eq('campaign_id', data.campaign_id).eq('lead_id', data.lead_id)
    if (error) throw new Error(error.message)
    await ctx.supabase.from('leads').update({
      contact_status: data.approved ? 'approved' : 'unverified',
      contact_approved_at: data.approved ? new Date().toISOString() : null,
    } as never).eq('id', data.lead_id)
    await audit(ctx, data.approved ? 'campaign_member_approved' : 'campaign_member_removed', data.lead_id)
    return { ok: true }
  })

/** Aprovação explícita para iniciar uma cadência fora de uma campanha. */
export const approveLeadForOutreach = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ lead_id: z.string().uuid(), approved: z.boolean() }).parse(value))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    await assertAdmin(ctx)
    const approvedAt = data.approved ? new Date().toISOString() : null
    const { error } = await ctx.supabase.from('leads').update({
      contact_status: data.approved ? 'approved' : 'unverified',
      contact_approved_at: approvedAt,
    } as never).eq('id', data.lead_id)
    if (error) throw new Error(error.message)
    await audit(ctx, data.approved ? 'outreach_approved' : 'outreach_approval_revoked', data.lead_id)
    return { ok: true, approved_at: approvedAt }
  })

const accountSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(240),
  legal_name: z.string().trim().max(240).nullable().optional(),
  cnpj: z.string().trim().max(24).nullable().optional(),
  domain: z.string().trim().max(180).nullable().optional(),
  segment: z.string().trim().max(180).nullable().optional(),
  size: z.string().trim().max(60).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  uf: z.string().trim().max(2).nullable().optional(),
  website: z.string().trim().max(500).nullable().optional(),
})

export const upsertAccount = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => accountSchema.parse(value))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    const { id, ...payload } = data
    const query = id
      ? ctx.supabase.from('accounts').update(payload as never).eq('id', id).select().single()
      : ctx.supabase.from('accounts').insert({ ...payload, owner_id: ctx.userId, source: 'manual' } as never).select().single()
    const { data: row, error } = await query
    if (error) throw new Error(error.message)
    return row
  })

const contactSchema = z.object({
  id: z.string().uuid().optional(),
  account_id: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  title: z.string().trim().max(160).nullable().optional(),
  department: z.string().trim().max(160).nullable().optional(),
  email: z.string().trim().email().nullable().optional().or(z.literal('')),
  phone: z.string().trim().max(40).nullable().optional(),
  whatsapp: z.string().trim().max(40).nullable().optional(),
  linkedin_url: z.string().trim().url().nullable().optional().or(z.literal('')),
  decision_role: z.enum(['decision_maker', 'influencer', 'user', 'gatekeeper', 'unknown']).default('unknown'),
  is_primary: z.boolean().default(false),
})

export const upsertCommercialContact = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => contactSchema.parse(value))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    const { id, ...rest } = data
    const payload = { ...rest, email: rest.email || null, linkedin_url: rest.linkedin_url || null }
    if (payload.is_primary) {
      await ctx.supabase.from('contacts').update({ is_primary: false } as never).eq('account_id', payload.account_id)
    }
    const query = id
      ? ctx.supabase.from('contacts').update(payload as never).eq('id', id).select().single()
      : ctx.supabase.from('contacts').insert({ ...payload, owner_id: ctx.userId, source: 'manual' } as never).select().single()
    const { data: row, error } = await query
    if (error) throw new Error(error.message)
    return row
  })

export const listAccountContacts = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ account_id: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from('contacts').select('*').eq('account_id', data.account_id).order('is_primary', { ascending: false }).order('name')
    if (error) throw new Error(error.message)
    return rows ?? []
  })

export const findDuplicateLeads = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({
    cnpj: z.string().nullable().optional(), domain: z.string().nullable().optional(),
    email: z.string().nullable().optional(), phone: z.string().nullable().optional(),
  }).parse(value))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any).rpc('find_duplicate_leads', {
      _cnpj: data.cnpj || null, _domain: data.domain || null,
      _email: data.email || null, _phone: data.phone || null,
    })
    if (error) throw new Error(error.message)
    return rows ?? []
  })

const dsrSchema = z.object({
  id: z.string().uuid().optional(),
  request_type: z.enum(['access', 'correction', 'deletion', 'anonymization', 'portability', 'objection']),
  requester_name: z.string().trim().max(200).nullable().optional(),
  requester_email: z.string().trim().email().nullable().optional().or(z.literal('')),
  requester_phone: z.string().trim().max(40).nullable().optional(),
  lead_id: z.string().uuid().nullable().optional(),
  status: z.enum(['open', 'verifying', 'in_progress', 'completed', 'rejected']).default('open'),
  resolution: z.string().trim().max(4000).nullable().optional(),
})

export const listDataSubjectRequests = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx)
    const { data, error } = await (context.supabase as any).from('data_subject_requests').select('*').order('due_at')
    if (error) throw new Error(error.message)
    return data ?? []
  })

export const upsertDataSubjectRequest = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => dsrSchema.parse(value))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    await assertAdmin(ctx)
    const { id, ...rest } = data
    const payload = { ...rest, requester_email: rest.requester_email || null, handled_by: rest.status === 'completed' ? ctx.userId : null, completed_at: rest.status === 'completed' ? new Date().toISOString() : null }
    const query = id
      ? ctx.supabase.from('data_subject_requests').update(payload as never).eq('id', id).select().single()
      : ctx.supabase.from('data_subject_requests').insert(payload as never).select().single()
    const { data: row, error } = await query
    if (error) throw new Error(error.message)
    await audit(ctx, id ? 'dsr_updated' : 'dsr_created', `${payload.request_type}: ${payload.requester_email ?? payload.requester_phone ?? 'sem contato'}`)
    return row
  })

export const listOperationalAlerts = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx)
    const { data, error } = await (context.supabase as any).from('operational_alerts').select('*').order('created_at', { ascending: false }).limit(100)
    if (error) throw new Error(error.message)
    return data ?? []
  })

export const updateOperationalAlert = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ id: z.string().uuid(), status: z.enum(['acknowledged', 'resolved']) }).parse(value))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    await assertAdmin(ctx)
    const now = new Date().toISOString()
    const { error } = await ctx.supabase.from('operational_alerts').update({
      status: data.status, assigned_to: ctx.userId,
      ...(data.status === 'acknowledged' ? { acknowledged_at: now } : { resolved_at: now }),
    } as never).eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

/** Indicadores para decidir onde investir esforço comercial, não só receita final. */
export const getCommercialReport = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ days: z.number().int().min(7).max(730).optional() }).parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    await assertAdmin(ctx)
    const since = new Date(Date.now() - (data.days ?? 90) * 86_400_000).toISOString()
    const [leadsRes, sourceRes, campaignsRes, pointsRes, historyRes] = await Promise.all([
      ctx.supabase.from('leads').select('id, stage, value, campaign_id, origin, contact_status, lost_reason, created_at, updated_at').gte('created_at', since),
      ctx.supabase.from('lead_source_events').select('lead_id, source, campaign_id, utm_campaign, received_at').gte('received_at', since),
      ctx.supabase.from('campaigns').select('id, name, status, channel, expected_value, budget, campaign_members(lead_id, status)').order('created_at', { ascending: false }),
      ctx.supabase.from('contact_points').select('status, verified, created_at').gte('created_at', since),
      ctx.supabase.from('lead_stage_history').select('lead_id, to_stage, created_at').gte('created_at', since),
    ])
    for (const result of [leadsRes, sourceRes, campaignsRes, pointsRes, historyRes]) if (result.error) throw new Error(result.error.message)
    const leads = leadsRes.data ?? []
    const sources = sourceRes.data ?? []
    const stages = historyRes.data ?? []
    const closedStages = new Map<string, string>()
    for (const event of stages) if (event.to_stage === 'Fechado') closedStages.set(event.lead_id, event.created_at)
    const sourceMap = new Map<string, { source: string; leads: number; closed: number; revenue: number }>()
    for (const lead of leads) {
      const source = sources.find((event: any) => event.lead_id === lead.id)?.utm_campaign
        || sources.find((event: any) => event.lead_id === lead.id)?.source
        || lead.origin || 'Sem origem'
      const row = sourceMap.get(source) ?? { source, leads: 0, closed: 0, revenue: 0 }
      row.leads += 1
      if (lead.stage === 'Fechado') { row.closed += 1; row.revenue += Number(lead.value || 0) }
      sourceMap.set(source, row)
    }
    const campaignRows = (campaignsRes.data ?? []).map((campaign: any) => {
      const campaignLeads = leads.filter((lead: any) => lead.campaign_id === campaign.id)
      const closed = campaignLeads.filter((lead: any) => lead.stage === 'Fechado')
      const revenue = closed.reduce((sum: number, lead: any) => sum + Number(lead.value || 0), 0)
      return {
        id: campaign.id, name: campaign.name, status: campaign.status, channel: campaign.channel,
        selected: campaign.campaign_members?.length ?? 0, generated: campaignLeads.length,
        closed: closed.length, revenue, expected_value: Number(campaign.expected_value || 0), budget: Number(campaign.budget || 0),
      }
    })
    const lost = new Map<string, number>()
    for (const lead of leads.filter((row: any) => row.stage === 'Perdido')) {
      const key = lead.lost_reason || 'Não informado'
      lost.set(key, (lost.get(key) ?? 0) + 1)
    }
    const conversion = (from: string, to: string) => {
      const fromLeads = new Set(stages.filter((event: any) => event.to_stage === from).map((event: any) => event.lead_id))
      const toLeads = new Set(stages.filter((event: any) => event.to_stage === to).map((event: any) => event.lead_id))
      const progressed = [...fromLeads].filter((leadId) => toLeads.has(leadId)).length
      return { from, to, leads: fromLeads.size, progressed, rate: fromLeads.size ? Number(((progressed / fromLeads.size) * 100).toFixed(1)) : 0 }
    }
    const points = pointsRes.data ?? []
    return {
      sourcePerformance: [...sourceMap.values()].map((row) => ({ ...row, conversion: row.leads ? Number(((row.closed / row.leads) * 100).toFixed(1)) : 0 })).sort((a, b) => b.revenue - a.revenue),
      campaigns: campaignRows,
      lossReasons: [...lost.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
      stageConversions: [conversion('Prospecção', 'Qualificado'), conversion('Qualificado', 'Proposta'), conversion('Proposta', 'Fechado')],
      contactQuality: {
        total: points.length,
        verified: points.filter((point: any) => point.verified).length,
        invalid: points.filter((point: any) => ['invalid', 'bounced'].includes(point.status)).length,
        optOut: points.filter((point: any) => point.status === 'opt_out').length,
      },
      closedAtTracked: closedStages.size,
    }
  })

export const logCallActivity = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({
    lead_id: z.string().uuid(), contact_point_id: z.string().uuid().nullable().optional(),
    outcome: z.enum(['planned', 'connected', 'voicemail', 'no_answer', 'wrong_number', 'follow_up', 'qualified', 'lost']),
    duration_seconds: z.number().int().min(0).max(86_400).nullable().optional(),
    notes: z.string().trim().max(4000).nullable().optional(), recording_url: z.string().url().nullable().optional(),
  }).parse(value))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx
    const { data: row, error } = await ctx.supabase.from('call_activities').insert({ ...data, owner_id: ctx.userId } as never).select().single()
    if (error) throw new Error(error.message)
    await audit(ctx, 'call_activity_logged', `${data.outcome}: ${data.lead_id}`)
    return row
  })

export const listCallActivities = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ lead_id: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from('call_activities').select('*').eq('lead_id', data.lead_id).order('created_at', { ascending: false }).limit(30)
    if (error) throw new Error(error.message)
    return rows ?? []
  })

export type InboundLeadInput = {
  company: string
  name?: string | null
  title?: string | null
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  cnpj?: string | null
  website?: string | null
  segment?: string | null
  city?: string | null
  uf?: string | null
  message?: string | null
  source?: string | null
  external_id?: string | null
  campaign_id?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_content?: string | null
  utm_term?: string | null
  landing_page?: string | null
}

function compact(value: string | null | undefined, max = 500) {
  return value?.trim().slice(0, max) || null
}

export async function captureInboundLeadInternal(supabase: any, input: InboundLeadInput) {
  const company = compact(input.company, 240)
  if (!company) throw new Error('Empresa é obrigatória')
  const email = compact(input.email, 240)?.toLowerCase() ?? null
  const phone = compact(input.phone, 40)
  const whatsapp = compact(input.whatsapp, 40)
  const domain = compact(input.website, 500)?.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase() ?? null
  const duplicate = await supabase.rpc('find_duplicate_leads', {
    _cnpj: compact(input.cnpj, 24), _domain: domain, _email: email, _phone: whatsapp || phone,
  })
  const existing = duplicate.data?.[0]
  if (existing) {
    await supabase.from('lead_source_events').insert({
      lead_id: existing.id, source: input.source || 'inbound', external_id: compact(input.external_id, 200),
      campaign_id: input.campaign_id || null, utm_source: input.utm_source || null,
      utm_medium: input.utm_medium || null, utm_campaign: input.utm_campaign || null,
      utm_content: input.utm_content || null, utm_term: input.utm_term || null,
      landing_page: input.landing_page || null, metadata: { deduplicated: true, reason: existing.reason },
    } as never)
    return { lead_id: existing.id as string, duplicate: true, reason: existing.reason as string }
  }

  let accountId: string | null = null
  const cnpj = compact(input.cnpj, 24)
  const accountQuery = cnpj || domain
    ? (cnpj
      ? supabase.from('accounts').select('id').eq('cnpj', cnpj).maybeSingle()
      : supabase.from('accounts').select('id').eq('domain', domain).maybeSingle())
    : Promise.resolve({ data: null, error: null })
  const { data: existingAccount, error: accountReadError } = await accountQuery
  if (accountReadError) throw new Error(accountReadError.message)
  if (existingAccount?.id) {
    accountId = existingAccount.id
  } else {
    const { data: account, error: accountError } = await supabase.from('accounts').insert({
      name: company, legal_name: company, cnpj, domain,
      website: compact(input.website, 500), segment: compact(input.segment, 180),
      city: compact(input.city, 120), uf: compact(input.uf, 2)?.toUpperCase(), source: input.source || 'inbound',
    } as never).select('id').single()
    if (accountError) throw new Error(accountError.message)
    accountId = account.id
  }

  let contactId: string | null = null
  if (input.name || email || phone || whatsapp) {
    const { data: existingContact } = email
      ? await supabase.from('contacts').select('id').eq('account_id', accountId).eq('email', email).maybeSingle()
      : { data: null }
    if (existingContact?.id) {
      contactId = existingContact.id
    } else {
      const { data: contact, error: contactError } = await supabase.from('contacts').insert({
        account_id: accountId, name: compact(input.name, 200) || 'Contato inbound', title: compact(input.title, 160),
        email, phone, whatsapp, is_primary: true, source: input.source || 'inbound',
      } as never).select('id').single()
      if (contactError) throw new Error(contactError.message)
      contactId = contact.id
    }
  }
  const { data: lead, error } = await supabase.from('leads').insert({
    company, contact: compact(input.name, 200), title: compact(input.title, 160), email, phone, whatsapp,
    segment: compact(input.segment, 180), city: compact(input.city, 120), uf: compact(input.uf, 2)?.toUpperCase(),
    stage: 'Prospecção', owner: 'ia', origin: input.source || 'inbound', account_id: accountId,
    primary_contact_id: contactId, campaign_id: input.campaign_id || null,
    utm_source: input.utm_source || null, utm_medium: input.utm_medium || null,
    utm_campaign: input.utm_campaign || null, utm_content: input.utm_content || null, utm_term: input.utm_term || null,
    contact_status: 'unverified',
  } as never).select('id').single()
  if (error) throw new Error(error.message)
  const contactRows = [
    whatsapp ? { kind: 'whatsapp', value: whatsapp } : null,
    phone ? { kind: 'phone', value: phone } : null,
    email ? { kind: 'email', value: email } : null,
  ].filter(Boolean).map((row: any) => ({ ...row, lead_id: lead.id, preferred: true, verified: false, source: input.source || 'inbound', source_detail: input.landing_page || null }))
  if (contactRows.length) await supabase.from('contact_points').insert(contactRows as never)
  if (input.message) await supabase.from('lead_notes').insert({ lead_id: lead.id, body: compact(input.message, 4000), visibility: 'internal' } as never)
  await supabase.from('lead_source_events').insert({
    lead_id: lead.id, source: input.source || 'inbound', external_id: compact(input.external_id, 200),
    campaign_id: input.campaign_id || null, utm_source: input.utm_source || null,
    utm_medium: input.utm_medium || null, utm_campaign: input.utm_campaign || null,
    utm_content: input.utm_content || null, utm_term: input.utm_term || null,
    landing_page: input.landing_page || null, metadata: { inbound: true },
  } as never)
  return { lead_id: lead.id as string, duplicate: false }
}
