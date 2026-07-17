import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'

// ============= Types =============
export type SourceId = 'cnpj_ws' | 'google_places' | 'ai_only'

export type ExternalCompany = {
  cnpj: string
  razao_social: string
  nome_fantasia: string | null
  cnae_principal: string | null
  cnae_descricao: string | null
  porte: string | null
  capital_social: number | null
  situacao: string | null
  data_abertura: string | null
  telefone: string | null
  whatsapp: string | null
  email: string | null
  logradouro: string | null
  numero: string | null
  bairro: string | null
  municipio: string | null
  uf: string | null
  cep: string | null
  website?: string | null
  score?: number
  score_reason?: string
  source: SourceId
}

// Detecta se um telefone brasileiro é celular (11 dígitos, começa com 9 após DDD)
function detectWhatsapp(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  // Formatos: 11 dígitos (DDD + 9XXXXXXXX) ou 13 (55 + DDD + 9XXXXXXXX)
  const local = digits.length === 13 && digits.startsWith('55') ? digits.slice(2) : digits
  if (local.length === 11 && local[2] === '9') {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  }
  return null
}


// ============= Filters schema =============
const filtersSchema = z.object({
  source: z.enum(['cnpj_ws', 'google_places', 'ai_only']).default('cnpj_ws'),
  cnae: z.string().optional().nullable(),
  uf: z.string().length(2).optional().nullable(),
  municipio: z.string().optional().nullable(),
  porte: z.string().optional().nullable(),
  min_capital: z.number().optional().nullable(),
  keyword: z.string().optional().nullable(),
  limit: z.number().int().min(1).max(30).default(15),
})

type Filters = z.infer<typeof filtersSchema>

function hashFilters(f: Filters): string {
  return JSON.stringify({
    source: f.source,
    cnae: f.cnae || null,
    uf: f.uf || null,
    municipio: (f.municipio || '').toLowerCase().trim() || null,
    porte: f.porte || null,
    min_capital: f.min_capital || null,
    keyword: (f.keyword || '').toLowerCase().trim() || null,
    limit: f.limit,
  })
}

// ============= CNPJ.ws Publica adapter =============
type CnpjWsEstab = {
  cnpj_raiz?: string
  cnpj?: string
  razao_social?: string
  porte?: { descricao?: string } | string | null
  capital_social?: string | number | null
  estabelecimento?: {
    cnpj?: string
    nome_fantasia?: string | null
    situacao_cadastral?: string | null
    data_inicio_atividade?: string | null
    ddd1?: string | null
    telefone1?: string | null
    email?: string | null
    tipo_logradouro?: string | null
    logradouro?: string | null
    numero?: string | null
    bairro?: string | null
    cidade?: { nome?: string } | null
    estado?: { sigla?: string } | null
    cep?: string | null
    atividade_principal?: { subclasse?: string; descricao?: string } | null
  }
}

function normalizeCnpjWs(item: CnpjWsEstab): ExternalCompany {
  const e = item.estabelecimento || {}
  const porte = typeof item.porte === 'string' ? item.porte : (item.porte?.descricao ?? null)
  const capital = item.capital_social != null ? Number(item.capital_social) : null
  const cnpj = e.cnpj || item.cnpj || ''
  const phone = e.ddd1 && e.telefone1 ? `(${e.ddd1}) ${e.telefone1}` : (e.telefone1 ?? null)
  const logradouro = [e.tipo_logradouro, e.logradouro].filter(Boolean).join(' ') || null
  return {
    cnpj,
    razao_social: item.razao_social || '',
    nome_fantasia: e.nome_fantasia ?? null,
    cnae_principal: e.atividade_principal?.subclasse ?? null,
    cnae_descricao: e.atividade_principal?.descricao ?? null,
    porte,
    capital_social: Number.isFinite(capital as number) ? (capital as number) : null,
    situacao: e.situacao_cadastral ?? null,
    data_abertura: e.data_inicio_atividade ?? null,
    telefone: phone,
    email: e.email ?? null,
    logradouro,
    numero: e.numero ?? null,
    bairro: e.bairro ?? null,
    municipio: e.cidade?.nome ?? null,
    uf: e.estado?.sigla ?? null,
    cep: e.cep ?? null,
    source: 'cnpj_ws',
  }
}

async function fetchFromCnpjWs(filters: Filters): Promise<ExternalCompany[]> {
  const params = new URLSearchParams()
  if (filters.cnae) params.set('estabelecimento.atividade_principal', filters.cnae.replace(/\D/g, ''))
  if (filters.uf) params.set('estabelecimento.estado', filters.uf.toUpperCase())
  if (filters.municipio) params.set('estabelecimento.cidade', filters.municipio)
  params.set('estabelecimento.situacao_cadastral', 'Ativa')
  params.set('estabelecimento.tipo', 'matriz')

  const url = `https://publica.cnpj.ws/cnpj?${params.toString()}`
  const key = process.env.CNPJWS_API_KEY
  const headers: Record<string, string> = { accept: 'application/json' }
  if (key) headers['Authorization'] = `Bearer ${key}`

  const res = await fetch(url, { headers })
  if (res.status === 429) {
    throw new Error('Limite da API pública CNPJ.ws atingido (3 req/min). Aguarde 1 minuto ou configure uma chave gratuita em cnpj.ws.')
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`CNPJ.ws ${res.status}: ${text.slice(0, 200)}`)
  }
  const payload = (await res.json()) as { data?: CnpjWsEstab[] } | CnpjWsEstab[]
  const items = Array.isArray(payload) ? payload : (payload.data ?? [])
  const mapped = items.map(normalizeCnpjWs)

  const porteFilter = filters.porte?.toLowerCase()
  const minCap = filters.min_capital ?? 0
  return mapped
    .filter((c) => (porteFilter ? (c.porte ?? '').toLowerCase().includes(porteFilter) : true))
    .filter((c) => (minCap > 0 ? (c.capital_social ?? 0) >= minCap : true))
    .slice(0, filters.limit)
}

// ============= Google Places (New) adapter =============
type GPlace = {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  internationalPhoneNumber?: string
  nationalPhoneNumber?: string
  websiteUri?: string
  primaryTypeDisplayName?: { text?: string }
  primaryType?: string
  addressComponents?: Array<{ types?: string[]; longText?: string; shortText?: string }>
}

function pickAddr(place: GPlace, type: string): string | null {
  const c = (place.addressComponents || []).find((x) => (x.types || []).includes(type))
  return c?.longText ?? c?.shortText ?? null
}

function normalizeGoogle(p: GPlace): ExternalCompany {
  const uf = pickAddr(p, 'administrative_area_level_1')
  const municipio = pickAddr(p, 'administrative_area_level_2') || pickAddr(p, 'locality')
  const bairro = pickAddr(p, 'sublocality') || pickAddr(p, 'sublocality_level_1')
  const cep = pickAddr(p, 'postal_code')
  return {
    cnpj: p.id || '',
    razao_social: p.displayName?.text || '',
    nome_fantasia: p.displayName?.text || null,
    cnae_principal: null,
    cnae_descricao: p.primaryTypeDisplayName?.text || p.primaryType || null,
    porte: null,
    capital_social: null,
    situacao: null,
    data_abertura: null,
    telefone: p.internationalPhoneNumber || p.nationalPhoneNumber || null,
    email: null,
    logradouro: p.formattedAddress || null,
    numero: null,
    bairro,
    municipio,
    uf: uf ? uf.slice(0, 2).toUpperCase() : null,
    cep,
    website: p.websiteUri || null,
    source: 'google_places',
  }
}

async function fetchFromGooglePlaces(filters: Filters): Promise<ExternalCompany[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) {
    throw new Error('Chave da API do Google Places não configurada. Adicione a secret GOOGLE_PLACES_API_KEY nas configurações.')
  }
  const query = [filters.keyword, filters.municipio, filters.uf].filter(Boolean).join(' ').trim()
  if (!query) throw new Error('Informe uma palavra-chave (ex.: "restaurantes", "clínicas") para o Google Places.')

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri,places.primaryType,places.primaryTypeDisplayName,places.addressComponents',
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'pt-BR', regionCode: 'BR', pageSize: Math.min(20, filters.limit) }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Google Places ${res.status}: ${text.slice(0, 200)}`)
  }
  const payload = (await res.json()) as { places?: GPlace[] }
  return (payload.places || []).slice(0, filters.limit).map(normalizeGoogle)
}

// ============= AI-only (Claude gera sugestões) =============
async function fetchFromAI(
  filters: Filters,
  ctx: { name?: string | null; description?: string | null; differentiators?: string | null },
): Promise<ExternalCompany[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada.')

  const prompt = `Você é analista de inteligência comercial B2B no Brasil. Gere ${filters.limit} sugestões REALISTAS de empresas brasileiras que provavelmente existem e se encaixariam como potenciais clientes.

Contexto da minha empresa:
- Nome: ${ctx.name ?? 'N/D'}
- Descrição: ${ctx.description ?? 'N/D'}
- Diferenciais: ${ctx.differentiators ?? 'N/D'}

Filtros do usuário:
- Palavra-chave / setor: ${filters.keyword || 'qualquer'}
- CNAE: ${filters.cnae || 'qualquer'}
- UF: ${filters.uf || 'qualquer'}
- Município: ${filters.municipio || 'qualquer'}
- Porte: ${filters.porte || 'qualquer'}

Retorne APENAS JSON válido no formato:
{"empresas":[{"razao_social":"","nome_fantasia":"","cnae_descricao":"","porte":"","municipio":"","uf":"","website":"","motivo":"por que é um bom fit em 1 frase","score":0-100}]}

Não invente CNPJ. Não invente telefone/email. Priorize empresas plausíveis do mercado real.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 3000,
      temperature: 0.6,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Claude ${res.status}: ${text.slice(0, 200)}`)
  }
  const payload = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
  const text = (payload.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('')
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return []
  const parsed = JSON.parse(match[0]) as {
    empresas?: Array<{
      razao_social: string
      nome_fantasia?: string
      cnae_descricao?: string
      porte?: string
      municipio?: string
      uf?: string
      website?: string
      motivo?: string
      score?: number
    }>
  }
  return (parsed.empresas || []).slice(0, filters.limit).map((e, i) => ({
    cnpj: `ai-${Date.now()}-${i}`,
    razao_social: e.razao_social || '',
    nome_fantasia: e.nome_fantasia || null,
    cnae_principal: null,
    cnae_descricao: e.cnae_descricao || null,
    porte: e.porte || null,
    capital_social: null,
    situacao: null,
    data_abertura: null,
    telefone: null,
    email: null,
    logradouro: null,
    numero: null,
    bairro: null,
    municipio: e.municipio || null,
    uf: e.uf || null,
    cep: null,
    website: e.website || null,
    score: typeof e.score === 'number' ? Math.max(0, Math.min(100, Math.round(e.score))) : undefined,
    score_reason: e.motivo || undefined,
    source: 'ai_only' as SourceId,
  }))
}

// ============= Claude scoring for real sources =============
async function scoreWithClaude(
  companies: ExternalCompany[],
  ctx: { name?: string | null; description?: string | null; differentiators?: string | null; icp?: string | null },
): Promise<ExternalCompany[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || companies.length === 0) return companies

  const icp = `Empresa: ${ctx.name ?? 'WF Digital'}
Descrição: ${ctx.description ?? '—'}
Diferenciais: ${ctx.differentiators ?? '—'}
Perfil de cliente ideal: ${ctx.icp ?? 'Indústrias e comércios de médio/grande porte'}`

  const list = companies.map((c, i) => ({
    idx: i,
    razao: c.razao_social,
    fantasia: c.nome_fantasia,
    cnae: `${c.cnae_principal ?? ''} - ${c.cnae_descricao ?? ''}`,
    porte: c.porte,
    capital: c.capital_social,
    municipio: c.municipio,
    uf: c.uf,
    abertura: c.data_abertura,
  }))

  const prompt = `Você é analista de pré-vendas B2B. Avalie o fit entre as empresas abaixo e o ICP a seguir.
${icp}

Empresas (JSON):
${JSON.stringify(list, null, 2)}

Retorne APENAS um JSON no formato:
{"scores":[{"idx":0,"score":0-100,"reason":"1 frase curta"}]}

Score alto = alto potencial de fechamento.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return companies
    const payload = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
    const text = (payload.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('')
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return companies
    const parsed = JSON.parse(match[0]) as { scores?: Array<{ idx: number; score: number; reason: string }> }
    const scored = [...companies]
    for (const s of parsed.scores ?? []) {
      if (scored[s.idx]) {
        scored[s.idx].score = Math.max(0, Math.min(100, Math.round(s.score)))
        scored[s.idx].score_reason = s.reason
      }
    }
    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    return scored
  } catch {
    return companies
  }
}

// ============= Server functions =============

export const getEnabledSources = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from('company_settings')
      .select('prospecting_sources')
      .limit(1)
      .maybeSingle()
    const src = (data?.prospecting_sources as Record<string, boolean> | null) ?? null
    return {
      cnpj_ws: src?.cnpj_ws ?? true,
      google_places: src?.google_places ?? false,
      ai_only: src?.ai_only ?? false,
      has_google_key: !!process.env.GOOGLE_PLACES_API_KEY,
      has_anthropic_key: !!process.env.ANTHROPIC_API_KEY,
    }
  })

export const searchExternalCompanies = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => filtersSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Validate source is enabled
    const { data: settingsRow } = await context.supabase
      .from('company_settings')
      .select('name, description, differentiators, prospecting_sources')
      .limit(1)
      .maybeSingle()

    const enabled = (settingsRow?.prospecting_sources as Record<string, boolean> | null) ?? {
      cnpj_ws: true, google_places: false, ai_only: false,
    }
    if (!enabled[data.source]) {
      throw new Error(`A fonte "${data.source}" está desativada. Ative-a em Configurações → Prospecção.`)
    }

    const hash = hashFilters(data)

    const { data: cached } = await context.supabase
      .from('prospecting_cache')
      .select('*')
      .eq('user_id', context.userId)
      .eq('filters_hash', hash)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cached) {
      return {
        cache_id: cached.id as string,
        cached: true,
        source: data.source,
        results: cached.results as unknown as ExternalCompany[],
      }
    }

    let raw: ExternalCompany[] = []
    if (data.source === 'cnpj_ws') {
      raw = await fetchFromCnpjWs(data)
      raw = await scoreWithClaude(raw, {
        name: settingsRow?.name,
        description: settingsRow?.description,
        differentiators: settingsRow?.differentiators,
        icp: null,
      })
    } else if (data.source === 'google_places') {
      raw = await fetchFromGooglePlaces(data)
      raw = await scoreWithClaude(raw, {
        name: settingsRow?.name,
        description: settingsRow?.description,
        differentiators: settingsRow?.differentiators,
        icp: null,
      })
    } else {
      raw = await fetchFromAI(data, {
        name: settingsRow?.name,
        description: settingsRow?.description,
        differentiators: settingsRow?.differentiators,
      })
    }

    const autoName = buildAutoName(data, raw.length)
    const farFuture = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10).toISOString()
    const { data: row, error: insErr } = await context.supabase
      .from('prospecting_cache')
      .insert({
        user_id: context.userId,
        filters: data as never,
        filters_hash: hash,
        results: raw as never,
        total_found: raw.length,
        scored: raw.some((s) => s.score != null),
        name: autoName,
        saved: true,
        expires_at: farFuture,
      } as never)
      .select('id')
      .single()
    if (insErr) throw new Error(insErr.message)

    return { cache_id: row.id as string, cached: false, source: data.source, results: raw }
  })

function buildAutoName(f: Filters, count: number): string {
  const src = f.source === 'cnpj_ws' ? 'Receita' : f.source === 'google_places' ? 'Google' : 'IA'
  const bits = [f.keyword, f.municipio, f.uf, f.porte].filter(Boolean).join(' · ')
  const when = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  return `${src} — ${bits || 'sem filtros'} (${count}) · ${when}`
}

export const importExternalAsLead = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cache_id: z.string().uuid(), cnpj: z.string().min(3) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: cache } = await context.supabase
      .from('prospecting_cache')
      .select('results')
      .eq('id', data.cache_id)
      .eq('user_id', context.userId)
      .maybeSingle()
    if (!cache) throw new Error('Cache de prospecção não encontrado ou expirado')

    const company = ((cache.results as unknown as ExternalCompany[]) || []).find((c) => c.cnpj === data.cnpj)
    if (!company) throw new Error('Empresa não encontrada no resultado')

    const originTag = `${company.source}:${company.cnpj}`
    const { data: dup } = await context.supabase
      .from('leads')
      .select('id')
      .eq('owner_id', context.userId)
      .eq('origin', originTag)
      .maybeSingle()
    if (dup) throw new Error('Esta empresa já foi importada como lead')

    const sizeMap: Record<string, 'pequena' | 'media' | 'grande'> = {
      'micro empresa': 'pequena',
      'me': 'pequena',
      'empresa de pequeno porte': 'pequena',
      'epp': 'pequena',
      'demais': 'media',
    }
    const porteLower = (company.porte ?? '').toLowerCase()
    const size = Object.entries(sizeMap).find(([k]) => porteLower.includes(k))?.[1] ?? 'media'

    const payload = {
      owner_id: context.userId,
      company: company.nome_fantasia || company.razao_social,
      contact: null,
      title: null,
      phone: company.telefone,
      email: company.email,
      segment: company.cnae_descricao,
      uf: company.uf,
      city: company.municipio,
      size,
      annual_revenue: null,
      score: company.score ?? null,
      temp: (company.score ?? 0) >= 75 ? 'hot' : (company.score ?? 0) >= 50 ? 'warm' : 'cold',
      stage: 'Prospecção',
      origin: originTag,
    }

    const { data: row, error } = await context.supabase.from('leads').insert(payload as never).select().single()
    if (error) throw new Error(error.message)

    await context.supabase.from('audit_logs').insert({
      actor_id: context.userId,
      actor_name: context.claims?.email ?? 'user',
      actor_type: 'human',
      action: 'lead_import_external',
      detail: `Importado de ${company.source}: ${company.razao_social}`,
    } as never)

    // Ana faz o primeiro contato automaticamente
    try {
      await anaFirstContact(context, row as { id: string; company: string; contact: string | null; segment: string | null }, {
        name: null, description: null, differentiators: null, tone_of_voice: null,
      })
    } catch (err) {
      console.error('Ana first-contact failed:', err)
    }

    return row
  })

async function anaFirstContact(
  context: { supabase: any; userId: string },
  lead: { id: string; company: string; contact: string | null; segment: string | null },
  _fallback: { name: string | null; description: string | null; differentiators: string | null; tone_of_voice: string | null },
) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return

  const { data: settings } = await context.supabase
    .from('company_settings')
    .select('name, description, differentiators, tone_of_voice, ai_prompt, ai_model')
    .limit(1)
    .maybeSingle()

  const system = `${settings?.ai_prompt || 'Você é Ana, vendedora virtual consultiva, cordial e comercial.'}\n\nSua empresa: ${settings?.name ?? 'WF Digital'}${settings?.description ? `\nDescrição: ${settings.description}` : ''}${settings?.differentiators ? `\nDiferenciais: ${settings.differentiators}` : ''}${settings?.tone_of_voice ? `\nTom: ${settings.tone_of_voice}` : ''}\n\nEscreva uma mensagem CURTA (2-3 frases) de PRIMEIRO CONTATO via WhatsApp para o lead abaixo. Apresente-se, mencione o nome da empresa dele e pergunte se pode explicar rapidamente como podem se ajudar. Não use "prezado/a".`

  const userPrompt = `Lead:\n- Empresa: ${lead.company}\n- Contato: ${lead.contact ?? 'sem nome ainda'}\n- Segmento: ${lead.segment ?? 'não informado'}\n\nGere a mensagem de abertura.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: settings?.ai_model || 'claude-sonnet-4-5-20250929',
      max_tokens: 300,
      temperature: 0.7,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })
  if (!res.ok) return
  const payload = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
  const text = (payload.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('').trim()
  if (!text) return

  await context.supabase.from('lead_messages').insert({
    lead_id: lead.id,
    sender: 'ia',
    sender_name: 'Ana (IA)',
    type: 'ia',
    text,
    sent_at: new Date().toISOString(),
  } as never)
  await context.supabase.from('leads').update({ last_contact: new Date().toISOString() }).eq('id', lead.id)
}

// ============= Saved searches =============

export type SavedSearch = {
  id: string
  name: string
  source: SourceId
  filters: Filters
  total_found: number
  created_at: string
}

export const saveProspectingSearch = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cache_id: z.string().uuid(), name: z.string().trim().max(120).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const farFuture = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10).toISOString()
    const patch: Record<string, unknown> = { saved: true, expires_at: farFuture }
    if (data.name && data.name.length > 0) patch.name = data.name
    const { error } = await context.supabase
      .from('prospecting_cache')
      .update(patch as never)
      .eq('id', data.cache_id)
      .eq('user_id', context.userId)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const listSavedSearches = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from('prospecting_cache')
      .select('id, name, filters, total_found, created_at')
      .eq('user_id', context.userId)
      .eq('saved', true)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map((r) => {
      const f = r.filters as unknown as Filters
      return {
        id: r.id as string,
        name: (r.name as string) ?? 'Sem nome',
        source: f.source,
        filters: f,
        total_found: r.total_found as number,
        created_at: r.created_at as string,
      } satisfies SavedSearch
    })
  })

export const getSavedSearch = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from('prospecting_cache')
      .select('id, name, filters, results, created_at')
      .eq('id', data.id)
      .eq('user_id', context.userId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!row) throw new Error('Busca salva não encontrada')
    const f = row.filters as unknown as Filters
    return {
      cache_id: row.id as string,
      name: (row.name as string) ?? 'Sem nome',
      source: f.source,
      filters: f,
      created_at: row.created_at as string,
      results: (row.results as unknown as ExternalCompany[]) ?? [],
    }
  })

export const deleteSavedSearch = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from('prospecting_cache')
      .delete()
      .eq('id', data.id)
      .eq('user_id', context.userId)
      .eq('saved', true)
    if (error) throw new Error(error.message)
    return { ok: true }
  })
