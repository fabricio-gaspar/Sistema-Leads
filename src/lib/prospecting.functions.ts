import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'
import {
  generateAiText,
  normalizeAiJson,
  providerAvailable,
  type AiProvider,
} from '@/lib/ai-provider.server'
import { DEFAULT_WEIGHTS, explainScore, type Weights } from '@/lib/score-explain'

// ============= Types =============
export type SourceId = 'cnpj_ws' | 'google_places' | 'ai_only' | 'apify'

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
  latitude?: number | null
  longitude?: number | null
  distance_km?: number | null
  ai_score?: number
  deterministic_score?: number
  score_provider_results?: Array<{ provider: AiProvider; score: number; reason: string }>
  score?: number
  score_reason?: string
  source: SourceId
}

type ApprovalMode = 'automatic' | 'score' | 'manual'
type AiScoringStrategy = 'consensus' | 'fallback'

type ProspectingAiConfig = {
  providers: AiProvider[]
  strategy: AiScoringStrategy
  primaryProvider: AiProvider
  primaryModel?: string | null
}

type ApprovalDecision = {
  approved: boolean
  mode: ApprovalMode
  minScore: number
  reason: string
}

const AI_PROVIDER_LABEL: Record<AiProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Claude',
  gemini: 'Gemini',
}

function cleanProviders(value: unknown, fallback: unknown): AiProvider[] {
  const source = Array.isArray(value) ? value : [fallback]
  const providers = source.filter(
    (item, index, all): item is AiProvider =>
      (item === 'openai' || item === 'anthropic' || item === 'gemini') && all.indexOf(item) === index,
  )
  return providers.length ? providers : ['anthropic']
}

function buildAiConfig(settings: Record<string, unknown> | null | undefined): ProspectingAiConfig {
  const providers = cleanProviders(settings?.prospecting_ai_providers, settings?.ai_provider)
  return {
    providers,
    strategy: settings?.prospecting_ai_strategy === 'fallback' ? 'fallback' : 'consensus',
    primaryProvider: providers[0],
    primaryModel: typeof settings?.ai_model === 'string' ? settings.ai_model : null,
  }
}

function buildWeights(row: Record<string, unknown> | null | undefined): Weights {
  const numberOr = (value: unknown, fallback: number) =>
    Number.isFinite(Number(value)) ? Number(value) : fallback
  return {
    segment: numberOr(row?.segment, DEFAULT_WEIGHTS.segment),
    whatsapp: numberOr(row?.whatsapp, DEFAULT_WEIGHTS.whatsapp),
    site: numberOr(row?.site, DEFAULT_WEIGHTS.site),
    porte: numberOr(row?.porte, DEFAULT_WEIGHTS.porte),
    google: numberOr(row?.google, DEFAULT_WEIGHTS.google),
    regiao: numberOr(row?.regiao, DEFAULT_WEIGHTS.regiao),
  }
}

function normalizeIdentityPart(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180)
}

export function prospectIdentity(company: ExternalCompany): string {
  const digits = company.cnpj.replace(/\D/g, '')
  if (digits.length === 14) return `cnpj:${digits}`
  const websiteHost = (() => {
    try {
      return company.website ? new URL(company.website).hostname.replace(/^www\./, '').toLowerCase() : ''
    } catch {
      return ''
    }
  })()
  if (websiteHost) return `domain:${websiteHost}`
  const email = (company.email || '').trim().toLocaleLowerCase('pt-BR')
  if (/.+@.+\..+/.test(email)) return `email:${email.slice(0, 220)}`
  const contactDigits = (company.whatsapp || company.telefone || '').replace(/\D/g, '')
  if (contactDigits.length >= 10) return `phone:${contactDigits.slice(-13)}`
  const name = normalizeIdentityPart(company.razao_social || company.nome_fantasia)
  if (name) {
    return `company:${name}:${normalizeIdentityPart(company.municipio)}:${normalizeIdentityPart(company.uf)}`
  }
  return `${company.source}:${normalizeIdentityPart(company.cnpj)}`
}

function approvalDecision(
  settings: Record<string, unknown> | null | undefined,
  score: number | null | undefined,
): ApprovalDecision {
  const mode: ApprovalMode = settings?.contact_approval_mode === 'manual'
    ? 'manual'
    : settings?.contact_approval_mode === 'score'
      ? 'score'
      : 'automatic'
  const minScore = Math.max(0, Math.min(100, Number(settings?.contact_approval_min_score ?? 70)))
  if (mode === 'manual') {
    return { approved: false, mode, minScore, reason: 'Aguardando aprovacao manual do administrador.' }
  }
  if (mode === 'score') {
    const approved = Number(score ?? 0) >= minScore
    return {
      approved,
      mode,
      minScore,
      reason: approved
        ? `Aprovado automaticamente: score ${Math.round(Number(score ?? 0))} >= ${minScore}.`
        : `Aguardando aprovacao: score ${Math.round(Number(score ?? 0))} abaixo de ${minScore}.`,
    }
  }
  return { approved: true, mode, minScore, reason: 'Aprovado automaticamente pela regra configurada.' }
}

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc('has_role', {
    _user_id: ctx.userId,
    _role: 'administrador',
  })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Apenas administradores podem aprovar e enviar prospectos para Leads.')
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
  source: z.enum(['cnpj_ws', 'google_places', 'ai_only', 'apify']).default('cnpj_ws'),
  cnae: z.string().optional().nullable(),
  uf: z.string().length(2).optional().nullable(),
  municipio: z.string().optional().nullable(),
  porte: z.string().optional().nullable(),
  min_capital: z.number().optional().nullable(),
  keyword: z.string().optional().nullable(),
  radius_km: z.number().min(1).max(50).optional().nullable(),
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
    radius_km: f.radius_km || null,
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
    whatsapp: detectWhatsapp(phone),
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
  location?: { latitude?: number; longitude?: number }
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
    whatsapp: detectWhatsapp(p.nationalPhoneNumber || p.internationalPhoneNumber || null),
    email: null,

    logradouro: p.formattedAddress || null,
    numero: null,
    bairro,
    municipio,
    uf: uf ? uf.slice(0, 2).toUpperCase() : null,
    cep,
    website: p.websiteUri || null,
    latitude: p.location?.latitude ?? null,
    longitude: p.location?.longitude ?? null,
    source: 'google_places',
  }
}

async function geocodeSearchCenter(filters: Filters): Promise<{ latitude: number; longitude: number } | null> {
  if (!filters.radius_km) return null
  if (!filters.municipio) throw new Error('Informe o município para usar a busca por raio.')
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY não configurada.')
  const address = [filters.municipio, filters.uf, 'Brasil'].filter(Boolean).join(', ')
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${encodeURIComponent(key)}&language=pt-BR&region=br`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Google Geocoding ${res.status}`)
  const payload = (await res.json()) as {
    status?: string
    results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>
    error_message?: string
  }
  const location = payload.results?.[0]?.geometry?.location
  if (payload.status !== 'OK' || location?.lat == null || location.lng == null) {
    throw new Error(payload.error_message || `Não foi possível localizar ${address}. Ative também a Geocoding API no Google Cloud.`)
  }
  return { latitude: location.lat, longitude: location.lng }
}

function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const earthRadiusKm = 6371
  const lat = toRad(b.latitude - a.latitude)
  const lng = toRad(b.longitude - a.longitude)
  const h = Math.sin(lat / 2) ** 2
    + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(lng / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

async function fetchFromGooglePlaces(filters: Filters): Promise<ExternalCompany[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) {
    throw new Error('Chave da API do Google Places não configurada. Adicione a secret GOOGLE_PLACES_API_KEY nas configurações.')
  }
  const query = [filters.keyword, filters.municipio, filters.uf].filter(Boolean).join(' ').trim()
  if (!query) throw new Error('Informe uma palavra-chave (ex.: "restaurantes", "clínicas") para o Google Places.')
  const center = await geocodeSearchCenter(filters)
  const radiusMeters = Math.min(50_000, Math.round((filters.radius_km ?? 0) * 1000))

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri,places.primaryType,places.primaryTypeDisplayName,places.addressComponents,places.location',
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: 'pt-BR',
      regionCode: 'BR',
      pageSize: Math.min(20, filters.limit),
      ...(center ? { locationBias: { circle: { center, radius: radiusMeters } } } : {}),
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Google Places ${res.status}: ${text.slice(0, 200)}`)
  }
  const payload = (await res.json()) as { places?: GPlace[] }
  return (payload.places || [])
    .map(normalizeGoogle)
    .map((company) => {
      if (!center || company.latitude == null || company.longitude == null) return company
      return {
        ...company,
        distance_km: Number(distanceKm(center, {
          latitude: company.latitude,
          longitude: company.longitude,
        }).toFixed(1)),
      }
    })
    .filter((company) => !center || (company.distance_km != null && company.distance_km <= (filters.radius_km ?? 50)))
    .slice(0, filters.limit)
}

// ============= AI-only (provedor configurado gera sugestões) =============
async function fetchFromAI(
  filters: Filters,
  ctx: { name?: string | null; description?: string | null; differentiators?: string | null },
  ai: ProspectingAiConfig,
): Promise<ExternalCompany[]> {
  const candidates = ai.providers.filter(providerAvailable)
  if (!candidates.length) {
    throw new Error(`Nenhuma credencial configurada para: ${ai.providers.map((p) => AI_PROVIDER_LABEL[p]).join(', ')}.`)
  }

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
{"empresas":[{"razao_social":"","nome_fantasia":"","cnae_descricao":"","porte":"","municipio":"","uf":"","website":"","email":"","telefone":"","whatsapp":"","motivo":"por que é um bom fit em 1 frase","score":0-100}]}

Para telefone/whatsapp/email: SOMENTE inclua se forem informações públicas plausíveis (ex.: SAC divulgado no site). Se não tiver certeza, use "" (string vazia). Nunca invente CNPJ nem dados pessoais. Priorize empresas plausíveis do mercado real.`
  const generated = await generateAiText({
    provider: candidates[0],
    fallbackProvider: candidates[1] ?? null,
    model: candidates[0] === ai.primaryProvider ? ai.primaryModel : null,
    maxTokens: 3000,
    temperature: 0.6,
    json: true,
    system: 'Você gera inteligência comercial B2B sem inventar dados de contato. Responda somente JSON válido.',
    messages: [{ role: 'user', content: prompt }],
  })
  const parsed = JSON.parse(normalizeAiJson(generated.text)) as {
    empresas?: Array<{
      razao_social: string
      nome_fantasia?: string
      cnae_descricao?: string
      porte?: string
      municipio?: string
      uf?: string
      website?: string
      email?: string
      telefone?: string
      whatsapp?: string
      motivo?: string
      score?: number
    }>
  }
  return (parsed.empresas || []).slice(0, filters.limit).map<ExternalCompany>((e, i) => {
    const tel = (e.telefone || '').trim() || null
    const wa = (e.whatsapp || '').trim() || detectWhatsapp(tel)
    return {
      cnpj: `ai-${Date.now()}-${i}`,
      razao_social: e.razao_social || '',
      nome_fantasia: e.nome_fantasia || null,
      cnae_principal: null,
      cnae_descricao: e.cnae_descricao || null,
      porte: e.porte || null,
      capital_social: null,
      situacao: null,
      data_abertura: null,
      telefone: tel,
      whatsapp: wa,
      email: (e.email || '').trim() || null,
      logradouro: null,
      numero: null,
      bairro: null,
      municipio: e.municipio || null,
      uf: e.uf || null,
      cep: null,
      website: e.website || null,
      ai_score: typeof e.score === 'number' ? Math.max(0, Math.min(100, Math.round(e.score))) : undefined,
      score: typeof e.score === 'number' ? Math.max(0, Math.min(100, Math.round(e.score))) : undefined,
      score_reason: `${e.motivo || 'Sugestão gerada por IA.'} (${AI_PROVIDER_LABEL[generated.provider]})`,
      score_provider_results: typeof e.score === 'number'
        ? [{
            provider: generated.provider,
            score: Math.max(0, Math.min(100, Math.round(e.score))),
            reason: e.motivo || '',
          }]
        : undefined,
      source: 'ai_only' as SourceId,
    }
  })
}

// ============= Apify adapter (Google Maps Scraper) =============
type ApifyPlace = {
  title?: string
  categoryName?: string
  address?: string
  street?: string
  city?: string
  state?: string
  postalCode?: string
  phone?: string
  phoneUnformatted?: string
  website?: string
  url?: string
  placeId?: string
  emails?: string[]
  locatedIn?: string
}

function normalizeApify(p: ApifyPlace): ExternalCompany {
  const phone = p.phone || p.phoneUnformatted || null
  const email = (p.emails && p.emails.length > 0 ? p.emails[0] : null) || null
  return {
    cnpj: p.placeId || `apify-${Math.random().toString(36).slice(2, 10)}`,
    razao_social: p.title || '',
    nome_fantasia: p.title || null,
    cnae_principal: null,
    cnae_descricao: p.categoryName || null,
    porte: null,
    capital_social: null,
    situacao: null,
    data_abertura: null,
    telefone: phone,
    whatsapp: detectWhatsapp(phone),
    email,
    logradouro: p.street || p.address || null,
    numero: null,
    bairro: null,
    municipio: p.city || null,
    uf: p.state ? p.state.slice(0, 2).toUpperCase() : null,
    cep: p.postalCode || null,
    website: p.website || p.url || null,
    source: 'apify',
  }
}

async function fetchFromApify(filters: Filters): Promise<ExternalCompany[]> {
  const token = process.env.APIFY_TOKEN
  if (!token) {
    throw new Error('APIFY_TOKEN não configurado. Adicione a secret nas configurações do projeto.')
  }
  const query = [filters.keyword, filters.municipio, filters.uf].filter(Boolean).join(' ').trim()
  if (!query) throw new Error('Informe uma palavra-chave (ex.: "restaurantes", "clínicas") para o Apify.')

  const actorId = process.env.APIFY_ACTOR_ID || 'compass~crawler-google-places'
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      searchStringsArray: [query],
      maxCrawledPlacesPerSearch: Math.min(30, filters.limit),
      language: 'pt-BR',
      countryCode: 'br',
      scrapeContacts: true,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Apify ${res.status}: ${text.slice(0, 300)}`)
  }
  const items = (await res.json()) as ApifyPlace[]
  return (Array.isArray(items) ? items : []).slice(0, filters.limit).map(normalizeApify)
}


// ============= Classificacao combinada: sinais reais + uma ou mais IAs =============
async function scoreWithAiProviders(
  companies: ExternalCompany[],
  ctx: { name?: string | null; description?: string | null; differentiators?: string | null; icp?: string | null },
  ai: ProspectingAiConfig,
  weights: Weights,
  scoreContext: { porteFilter?: string | null; ufFilter?: string | null; radiusKm?: number | null },
): Promise<ExternalCompany[]> {
  if (companies.length === 0) return companies

  const deterministic = companies.map((company) => {
    const breakdown = explainScore(
      { ...company, score: undefined, ai_score: undefined },
      weights,
      scoreContext,
    )
    return {
      ...company,
      deterministic_score: breakdown.deterministic,
      score: breakdown.deterministic,
      score_reason: 'Classificação determinística baseada nos sinais verificados do prospecto.',
    }
  })

  const available = ai.providers.filter(providerAvailable)
  if (!available.length) return deterministic.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

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

  const runProvider = async (provider: AiProvider) => {
    const generated = await generateAiText({
      provider,
      fallbackProvider: null,
      model: provider === ai.primaryProvider ? ai.primaryModel : null,
      maxTokens: 2200,
      temperature: 0.1,
      json: true,
      system: 'Você é um classificador B2B rigoroso. Use apenas os dados informados e retorne somente JSON válido.',
      messages: [{ role: 'user', content: prompt }],
    })
    const parsed = JSON.parse(normalizeAiJson(generated.text)) as {
      scores?: Array<{ idx: number; score: number; reason: string }>
    }
    const byIndex = new Map<number, { score: number; reason: string }>()
    for (const item of parsed.scores ?? []) {
      if (!Number.isInteger(item.idx) || !Number.isFinite(Number(item.score))) continue
      byIndex.set(item.idx, {
        score: Math.max(0, Math.min(100, Math.round(Number(item.score)))),
        reason: String(item.reason || '').slice(0, 500),
      })
    }
    return { provider: generated.provider, byIndex }
  }

  const successful: Array<Awaited<ReturnType<typeof runProvider>>> = []
  if (ai.strategy === 'fallback') {
    for (const provider of available) {
      try {
        successful.push(await runProvider(provider))
        break
      } catch (error) {
        console.error(`[prospecting_score:${provider}]`, (error as Error).message)
      }
    }
  } else {
    const settled = await Promise.allSettled(available.map(runProvider))
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') successful.push(result.value)
      else console.error(`[prospecting_score:${available[index]}]`, result.reason)
    })
  }

  const scored = deterministic.map((company, index) => {
    const providerResults = successful
      .map((result) => {
        const value = result.byIndex.get(index)
        return value ? { provider: result.provider, ...value } : null
      })
      .filter((value): value is { provider: AiProvider; score: number; reason: string } => Boolean(value))
    if (!providerResults.length) return company
    const aiScore = Math.round(
      providerResults.reduce((sum, result) => sum + result.score, 0) / providerResults.length,
    )
    const finalScore = Math.round(Number(company.deterministic_score ?? 0) * 0.6 + aiScore * 0.4)
    const providerSummary = providerResults
      .map((result) => `${AI_PROVIDER_LABEL[result.provider]} ${result.score}: ${result.reason}`)
      .join(' | ')
    return {
      ...company,
      ai_score: aiScore,
      score: finalScore,
      score_provider_results: providerResults,
      score_reason: `Sinais reais ${company.deterministic_score}/100 + parecer de IA ${aiScore}/100. ${providerSummary}`,
    }
  })
  return scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
}

// ============= Server functions =============

export const getEnabledSources = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from('company_settings')
      .select('prospecting_sources, prospecting_ai_providers, prospecting_ai_strategy, contact_approval_mode, contact_approval_min_score')
      .limit(1)
      .maybeSingle()
    const src = (data?.prospecting_sources as Record<string, boolean> | null) ?? null
    const ai = buildAiConfig((data ?? null) as Record<string, unknown> | null)
    return {
      cnpj_ws: src?.cnpj_ws ?? true,
      google_places: src?.google_places ?? false,
      ai_only: src?.ai_only ?? false,
      apify: src?.apify ?? false,
      has_google_key: !!process.env.GOOGLE_PLACES_API_KEY,
      has_openai_key: providerAvailable('openai'),
      has_anthropic_key: !!process.env.ANTHROPIC_API_KEY,
      has_gemini_key: providerAvailable('gemini'),
      has_apify_token: !!process.env.APIFY_TOKEN,
      ai_providers: ai.providers,
      ai_strategy: ai.strategy,
      approval_mode: (data?.contact_approval_mode as ApprovalMode | null) ?? 'automatic',
      approval_min_score: Number(data?.contact_approval_min_score ?? 70),
    }
  })

export const testApifyToken = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const token = process.env.APIFY_TOKEN
    if (!token) {
      return {
        ok: false as const,
        status: 0,
        message: 'APIFY_TOKEN não configurado no cofre de secrets do projeto.',
      }
    }
    try {
      const res = await fetch(`https://api.apify.com/v2/users/me?token=${encodeURIComponent(token)}`)
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return {
          ok: false as const,
          status: res.status,
          message:
            res.status === 401
              ? 'Token inválido ou revogado (401). Gere um novo em apify.com → Settings → Integrations.'
              : `Falha na verificação (HTTP ${res.status}). ${text.slice(0, 200)}`,
        }
      }
      const json = (await res.json()) as {
        data?: { username?: string; email?: string; plan?: string; proxy?: unknown }
      }
      const u = json.data ?? {}
      return {
        ok: true as const,
        status: 200,
        message: 'Token válido — conectado à Apify.',
        username: u.username ?? null,
        email: u.email ?? null,
        plan: u.plan ?? null,
      }
    } catch (e) {
      return {
        ok: false as const,
        status: 0,
        message: `Erro de rede ao contatar api.apify.com: ${e instanceof Error ? e.message : String(e)}`,
      }
    }
  })

export const searchExternalCompanies = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => filtersSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Validate source is enabled
    const [{ data: settingsRow }, { data: weightsRow }] = await Promise.all([
      context.supabase
        .from('company_settings')
        .select('name, description, differentiators, prospecting_sources, ai_provider, ai_model, prospecting_ai_providers, prospecting_ai_strategy')
        .limit(1)
        .maybeSingle(),
      context.supabase.from('score_weights').select('*').limit(1).maybeSingle(),
    ])

    const enabled = (settingsRow?.prospecting_sources as Record<string, boolean> | null) ?? {
      cnpj_ws: true, google_places: false, ai_only: false, apify: false,
    }
    if (!enabled[data.source]) {
      throw new Error(`A fonte "${data.source}" está desativada. Ative-a em Configurações → Prospecção.`)
    }

    const aiConfig = buildAiConfig((settingsRow ?? null) as Record<string, unknown> | null)
    const weights = buildWeights((weightsRow ?? null) as Record<string, unknown> | null)
    const hash = `${hashFilters(data)}|${JSON.stringify({
      providers: aiConfig.providers,
      strategy: aiConfig.strategy,
      weights,
      scoring_version: 2,
    })}`

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
      raw = await scoreWithAiProviders(raw, {
        name: settingsRow?.name,
        description: settingsRow?.description,
        differentiators: settingsRow?.differentiators,
        icp: null,
      }, aiConfig, weights, { porteFilter: data.porte, ufFilter: data.uf, radiusKm: data.radius_km })
    } else if (data.source === 'google_places') {
      raw = await fetchFromGooglePlaces(data)
      raw = await scoreWithAiProviders(raw, {
        name: settingsRow?.name,
        description: settingsRow?.description,
        differentiators: settingsRow?.differentiators,
        icp: null,
      }, aiConfig, weights, { porteFilter: data.porte, ufFilter: data.uf, radiusKm: data.radius_km })
    } else if (data.source === 'apify') {
      raw = await fetchFromApify(data)
      raw = await scoreWithAiProviders(raw, {
        name: settingsRow?.name,
        description: settingsRow?.description,
        differentiators: settingsRow?.differentiators,
        icp: null,
      }, aiConfig, weights, { porteFilter: data.porte, ufFilter: data.uf, radiusKm: data.radius_km })
    } else {
      raw = await fetchFromAI(data, {
        name: settingsRow?.name,
        description: settingsRow?.description,
        differentiators: settingsRow?.differentiators,
      }, aiConfig)
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
  const src = f.source === 'cnpj_ws' ? 'Receita' : f.source === 'google_places' ? 'Google' : f.source === 'apify' ? 'Apify' : 'IA'
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
    await assertAdmin(context)
    const { data: cache } = await context.supabase
      .from('prospecting_cache')
      .select('results')
      .eq('id', data.cache_id)
      .eq('user_id', context.userId)
      .maybeSingle()
    if (!cache) throw new Error('Cache de prospecção não encontrado ou expirado')

    const company = ((cache.results as unknown as ExternalCompany[]) || []).find((c) => c.cnpj === data.cnpj)
    if (!company) throw new Error('Empresa não encontrada no resultado')
    if (company.source === 'ai_only') {
      throw new Error('Sugestões geradas somente por IA precisam ser validadas em uma fonte real antes do contato.')
    }
    if (!company.whatsapp && !company.telefone && !company.email) {
      throw new Error('Este prospecto não possui canal de contato validado.')
    }
    const { isAnyContactSuppressed } = await import('./outreach.functions')
    if (await isAnyContactSuppressed(context as never, null, {
      whatsapp: company.whatsapp,
      phone: company.telefone,
      email: company.email,
    })) {
      throw new Error('Este contato está na lista de supressão (opt-out/LGPD) e não pode ser reativado.')
    }

    const [{ data: settingsRow }, identityResult] = await Promise.all([
      context.supabase
        .from('company_settings')
        .select('organization_id, contact_approval_mode, contact_approval_min_score')
        .limit(1)
        .maybeSingle(),
      Promise.resolve(prospectIdentity(company)),
    ])
    const identity = identityResult
    const originTag = `${company.source}:${company.cnpj}`
    const { data: identityDup } = await context.supabase
      .from('leads')
      .select('*')
      .eq('prospect_identity', identity)
      .maybeSingle()
    if (identityDup) return { ...identityDup, _already_imported: true }
    const { data: legacyDup } = await context.supabase
      .from('leads')
      .select('*')
      .eq('origin', originTag)
      .maybeSingle()
    if (legacyDup) return { ...legacyDup, _already_imported: true }

    const sizeMap: Record<string, 'pequena' | 'media' | 'grande'> = {
      'micro empresa': 'pequena',
      'me': 'pequena',
      'empresa de pequeno porte': 'pequena',
      'epp': 'pequena',
      'demais': 'media',
    }
    const porteLower = (company.porte ?? '').toLowerCase()
    const size = Object.entries(sizeMap).find(([k]) => porteLower.includes(k))?.[1] ?? 'media'

    const initialChannels = {
      whatsapp: {
        available: ((company.whatsapp ?? detectWhatsapp(company.telefone)) || '').replace(/\D/g, '').length >= 10,
        last_status: null,
        last_attempt_at: null,
      },
      email: {
        available: /.+@.+\..+/.test((company.email ?? '').trim()),
        last_status: null,
        last_attempt_at: null,
      },
      phone: {
        available: (company.telefone ?? '').replace(/\D/g, '').length >= 10,
        last_status: null,
        last_attempt_at: null,
      },
    }

    const approval = approvalDecision(
      (settingsRow ?? null) as Record<string, unknown> | null,
      company.score,
    )
    const approvedAt = approval.approved ? new Date().toISOString() : null
    const payload = {
      organization_id: settingsRow?.organization_id ?? undefined,
      owner_id: context.userId,
      company: company.nome_fantasia || company.razao_social,
      contact: null,
      title: null,
      phone: company.telefone,
      whatsapp: company.whatsapp ?? detectWhatsapp(company.telefone),
      email: company.email,

      segment: company.cnae_descricao,
      uf: company.uf,
      city: company.municipio,
      distance: company.distance_km == null ? null : Math.round(company.distance_km),
      size,
      annual_revenue: null,
      score: company.score ?? null,
      score_snapshot: {
        total: company.score ?? 0,
        deterministic: company.deterministic_score ?? null,
        ai: company.ai_score ?? null,
        providers: company.score_provider_results ?? [],
        reason: company.score_reason ?? null,
        criteria: {
          segment: company.cnae_descricao ?? null,
          region: [company.municipio, company.uf].filter(Boolean).join('/') || null,
          distance_km: company.distance_km ?? null,
          size: company.porte ?? null,
          whatsapp: initialChannels.whatsapp.available,
          email: initialChannels.email.available,
          phone: initialChannels.phone.available,
          website: Boolean(company.website),
        },
        source: company.source,
        captured_at: new Date().toISOString(),
      },
      score_explanation: company.score_reason ?? 'Score calculado com os sinais disponíveis na prospecção.',
      score_source: company.source,
      score_verified_at: new Date().toISOString(),
      temp: (company.score ?? 0) >= 75 ? 'hot' : (company.score ?? 0) >= 50 ? 'warm' : 'cold',
      stage: 'Prospecção',
      origin: originTag,
      prospect_identity: identity,
      contact_channels: initialChannels,
      contact_approval_status: approval.approved ? 'approved' : 'pending',
      contact_approved_at: approvedAt,
      contact_approved_by: approval.approved ? context.userId : null,
      contact_approval_reason: approval.reason,
      automation_status: approval.approved ? 'not_started' : 'pending_approval',
      automation_error: null,
      automation_updated_at: new Date().toISOString(),
    }

    const { data: row, error } = await context.supabase.from('leads').insert(payload as never).select().single()
    if (error?.code === '23505') {
      const { data: duplicate } = await context.supabase
        .from('leads')
        .select('*')
        .eq('prospect_identity', identity)
        .maybeSingle()
      if (duplicate) return { ...duplicate, _already_imported: true }
    }
    if (error) throw new Error(error.message)

    await context.supabase.from('audit_logs').insert({
      actor_id: context.userId,
      actor_name: context.claims?.email ?? 'user',
      actor_type: 'human',
      action: approval.approved ? 'lead_import_approved' : 'lead_import_pending_approval',
      detail: `Importado de ${company.source}: ${company.razao_social}. ${approval.reason}`,
      rule: `${approval.mode}${approval.mode === 'score' ? `>=${approval.minScore}` : ''}`,
    } as never)

    if (!approval.approved) {
      return {
        ...row,
        _approval_status: 'pending' as const,
        _approval_reason: approval.reason,
        _outreach: null,
      }
    }

    // A aprovação formal cria o ticket via trigger; em seguida a Ana entra na
    // cadência e tenta imediatamente o primeiro passo (sempre WhatsApp).
    try {
      const { triggerOutreachInternal } = await import('./outreach.functions')
      const outreach = await triggerOutreachInternal(context as never, row.id as string)
      const failed = !outreach?.ok
      const humanTaskCreated = outreach?.channel === 'phone' && outreach?.status === 'pending'
      await context.supabase
        .from('leads')
        .update({
          automation_status: humanTaskCreated ? 'human' : failed ? 'failed' : 'running',
          automation_error: failed ? (outreach?.reason ?? 'outreach_start_failed') : null,
          automation_updated_at: new Date().toISOString(),
        } as never)
        .eq('id', row.id)
      return {
        ...row,
        _approval_status: 'approved' as const,
        _approval_reason: approval.reason,
        _outreach: outreach,
      }
    } catch (err) {
      const message = (err as Error).message
      await context.supabase
        .from('leads')
        .update({
          automation_status: 'failed',
          automation_error: message,
          automation_updated_at: new Date().toISOString(),
        } as never)
        .eq('id', row.id)
      return {
        ...row,
        _approval_status: 'approved' as const,
        _approval_reason: approval.reason,
        _outreach: { ok: false as const, reason: message },
      }
    }
  })

export const getPendingApprovalQueue = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc('has_role', {
      _user_id: context.userId,
      _role: 'administrador',
    })
    if (roleError) throw new Error(roleError.message)
    if (!isAdmin) return { is_admin: false as const, leads: [] }
    const { data: leads, error } = await context.supabase
      .from('leads')
      .select('id, company, segment, city, uf, score, origin, contact_approval_reason, created_at, whatsapp, email, phone')
      .eq('contact_approval_status', 'pending')
      .order('score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(100)
    if (error) throw new Error(error.message)
    return { is_admin: true as const, leads: leads ?? [] }
  })

export const rejectProspects = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse(value))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const decidedAt = new Date().toISOString()
    const { error } = await context.supabase
      .from('leads')
      .update({
        contact_approval_status: 'rejected',
        contact_approval_reason: 'Contato rejeitado manualmente pelo administrador.',
        contact_approved_at: decidedAt,
        contact_approved_by: context.userId,
        automation_status: 'paused',
        automation_error: 'contact_rejected',
        automation_updated_at: decidedAt,
        ai_paused: true,
      } as never)
      .in('id', data.ids)
      .eq('contact_approval_status', 'pending')
    if (error) throw new Error(error.message)
    await context.supabase.from('audit_logs').insert({
      actor_id: context.userId,
      actor_name: context.claims?.email ?? 'Administrador',
      actor_type: 'human',
      action: 'prospect_contact_rejected',
      detail: `${data.ids.length} prospecto(s) rejeitado(s) na fila de aprovação.`,
    } as never)
    return { ok: true, count: data.ids.length }
  })



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

export const renameSavedSearch = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from('prospecting_cache')
      .update({ name: data.name } as never)
      .eq('id', data.id)
      .eq('user_id', context.userId)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

// ============= Preview de impacto do Score =============
// Retorna amostras recentes do usuário para o painel de pesos calcular
// a distribuição hot/warm/cold dos dois cenários (atual x rascunho) no cliente,
// sem duplicar a lógica de scoring no servidor.
export const listRecentProspectingSamples = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from('prospecting_cache')
      .select('id, name, filters, results, total_found, created_at, saved')
      .eq('user_id', context.userId)
      .order('created_at', { ascending: false })
      .limit(5)
    if (error) throw new Error(error.message)
    return (data ?? []).map((r) => {
      const f = (r.filters as unknown) as Filters
      return {
        id: r.id as string,
        name: (r.name as string | null) ?? null,
        saved: (r.saved as boolean | null) ?? false,
        source: f?.source ?? 'cnpj_ws',
        porteFilter: (f?.porte as string | null) ?? null,
        ufFilter: (f?.uf as string | null) ?? null,
        radiusKm: (f?.radius_km as number | null) ?? null,
        total_found: (r.total_found as number) ?? 0,
        created_at: r.created_at as string,
        results: ((r.results as unknown) as ExternalCompany[]) ?? [],
      }
    })
  })

// ============= Internal: executar campanha agendada =============
// Chamado pelo cron `/api/public/prospecting-tick`. Usa supabaseAdmin
// mas grava tudo com owner_id = schedule.owner_id (mesma semântica de RLS).
export type CampaignRunResult = {
  found: number
  approved: number
  imported: number
  skipped: number
  reasons: Record<string, number>
}

export async function runProspectingCampaignInternal(
  supabaseAdmin: any,
  schedule: {
    id: string
    organization_id: string
    owner_id: string
    filters: Record<string, any>
    quantity: number
    auto_approve_min_score: number
    sequence_id: string | null
    assignment_strategy: 'owner' | 'round_robin' | 'ia_only'
    daily_cap: number
    monthly_cap: number
  },
): Promise<CampaignRunResult> {
  const reasons: Record<string, number> = {}
  const bump = (k: string) => { reasons[k] = (reasons[k] ?? 0) + 1 }

  // ---- Cap check ----
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const startOfMonth = new Date(startOfDay.getUTCFullYear(), startOfDay.getUTCMonth(), 1)
  const { data: dayRuns } = await supabaseAdmin
    .from('prospecting_schedule_runs')
    .select('imported_count')
    .eq('schedule_id', schedule.id)
    .gte('started_at', startOfDay.toISOString())
  const importedToday = (dayRuns ?? []).reduce((a: number, r: any) => a + (r.imported_count ?? 0), 0)
  const { data: monthRuns } = await supabaseAdmin
    .from('prospecting_schedule_runs')
    .select('imported_count')
    .eq('schedule_id', schedule.id)
    .gte('started_at', startOfMonth.toISOString())
  const importedMonth = (monthRuns ?? []).reduce((a: number, r: any) => a + (r.imported_count ?? 0), 0)
  const capRemaining = Math.max(
    0,
    Math.min(schedule.daily_cap - importedToday, schedule.monthly_cap - importedMonth),
  )
  if (capRemaining <= 0) {
    return { found: 0, approved: 0, imported: 0, skipped: 0, reasons: { cap_reached: 1 } }
  }

  // ---- Load settings for scoring ----
  const [{ data: settingsRow }, { data: weightsRow }] = await Promise.all([
    supabaseAdmin
      .from('company_settings')
      .select('name, description, differentiators, prospecting_sources, ai_provider, ai_model, prospecting_ai_providers, prospecting_ai_strategy, contact_approval_mode, contact_approval_min_score')
      .eq('organization_id', schedule.organization_id)
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('score_weights')
      .select('*')
      .eq('organization_id', schedule.organization_id)
      .limit(1)
      .maybeSingle(),
  ])
  const enabled = (settingsRow?.prospecting_sources as Record<string, boolean> | null) ?? {
    cnpj_ws: true, google_places: false, ai_only: false, apify: false,
  }
  const aiConfig = buildAiConfig((settingsRow ?? null) as Record<string, unknown> | null)
  const weights = buildWeights((weightsRow ?? null) as Record<string, unknown> | null)

  const rawFilters = {
    source: (schedule.filters.source as SourceId) ?? 'google_places',
    cnae: schedule.filters.cnae ?? null,
    uf: schedule.filters.uf ?? null,
    municipio: schedule.filters.municipio ?? null,
    porte: schedule.filters.porte ?? null,
    min_capital: schedule.filters.min_capital ?? null,
    keyword: schedule.filters.keyword ?? null,
    radius_km: schedule.filters.radius_km ?? null,
    limit: Math.min(30, Math.max(1, Math.min(schedule.quantity, capRemaining))),
  }
  const filters = filtersSchema.parse(rawFilters)

  if (!enabled[filters.source]) {
    throw new Error(`Fonte ${filters.source} desativada`)
  }

  // ---- Search ----
  let raw: ExternalCompany[] = []
  if (filters.source === 'cnpj_ws') raw = await fetchFromCnpjWs(filters)
  else if (filters.source === 'google_places') raw = await fetchFromGooglePlaces(filters)
  else if (filters.source === 'apify') raw = await fetchFromApify(filters)
  else raw = await fetchFromAI(filters, {
    name: settingsRow?.name, description: settingsRow?.description, differentiators: settingsRow?.differentiators,
  }, aiConfig)

  if (raw.length && filters.source !== 'ai_only') {
    raw = await scoreWithAiProviders(raw, {
      name: settingsRow?.name, description: settingsRow?.description, differentiators: settingsRow?.differentiators, icp: null,
    }, aiConfig, weights, {
      porteFilter: filters.porte,
      ufFilter: filters.uf,
      radiusKm: filters.radius_km,
    })
  }

  const found = raw.length

  // ---- Selection filter ----
  // O score da campanha decide quais prospectos entram; o modo global decide
  // se entram aprovados automaticamente ou aguardando o administrador.
  const candidates = raw.filter((c) => (c.score ?? 0) >= schedule.auto_approve_min_score)
  raw.filter((c) => (c.score ?? 0) < schedule.auto_approve_min_score).forEach(() => bump('below_campaign_min_score'))

  // ---- Round-robin owner pool ----
  let ownerPool: string[] = [schedule.owner_id]
  if (schedule.assignment_strategy === 'round_robin') {
    const { data: memberships } = await supabaseAdmin
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', schedule.organization_id)
      .eq('role', 'vendedor')
    const sellerIds = (memberships ?? []).map((member: any) => member.user_id as string)
    const { data: sellers } = sellerIds.length
      ? await supabaseAdmin.from('profiles').select('id').in('id', sellerIds).eq('active', true)
      : { data: [] }
    ownerPool = (sellers ?? []).map((seller: any) => seller.id as string)
    if (ownerPool.length === 0) ownerPool = [schedule.owner_id]
  }

  // ---- Import loop ----
  let imported = 0
  let formallyApproved = 0
  let idx = 0
  for (const company of candidates) {
    if (imported >= capRemaining) { bump('cap_reached'); break }
    if (company.source === 'ai_only') { bump('ai_only_needs_validation'); continue }
    if (!company.whatsapp && !company.telefone && !company.email) { bump('no_contact_channel'); continue }

    const { isAnyContactSuppressed } = await import('./outreach.functions')
    if (await isAnyContactSuppressed({ supabase: supabaseAdmin } as never, null, {
      whatsapp: company.whatsapp, phone: company.telefone, email: company.email,
    })) { bump('suppressed'); continue }

    const assignedOwner = ownerPool[idx % ownerPool.length]
    idx++

    const originTag = `${company.source}:${company.cnpj || company.razao_social}`
    const identity = prospectIdentity(company)
    const { data: dup } = await supabaseAdmin
      .from('leads')
      .select('id')
      .eq('organization_id', schedule.organization_id)
      .eq('prospect_identity', identity)
      .maybeSingle()
    if (dup) { bump('duplicate_organization'); continue }
    const { data: legacyDup } = await supabaseAdmin
      .from('leads')
      .select('id')
      .eq('organization_id', schedule.organization_id)
      .ilike('origin', `%${originTag}`)
      .limit(1)
      .maybeSingle()
    if (legacyDup) { bump('duplicate_legacy'); continue }

    const sizeMap: Record<string, 'pequena' | 'media' | 'grande'> = {
      'micro empresa': 'pequena', 'me': 'pequena', 'empresa de pequeno porte': 'pequena', 'epp': 'pequena', 'demais': 'media',
    }
    const porteLower = (company.porte ?? '').toLowerCase()
    const size = Object.entries(sizeMap).find(([k]) => porteLower.includes(k))?.[1] ?? 'media'

    const initialChannels = {
      whatsapp: { available: ((company.whatsapp ?? detectWhatsapp(company.telefone)) || '').replace(/\D/g, '').length >= 10, last_status: null, last_attempt_at: null },
      email: { available: /.+@.+\..+/.test((company.email ?? '').trim()), last_status: null, last_attempt_at: null },
      phone: { available: (company.telefone ?? '').replace(/\D/g, '').length >= 10, last_status: null, last_attempt_at: null },
    }

    const approval = approvalDecision(
      (settingsRow ?? null) as Record<string, unknown> | null,
      company.score,
    )
    const approvedAt = approval.approved ? new Date().toISOString() : null
    const payload = {
      organization_id: schedule.organization_id,
      owner_id: assignedOwner,
      company: company.nome_fantasia || company.razao_social,
      contact: null, title: null,
      phone: company.telefone, whatsapp: company.whatsapp ?? detectWhatsapp(company.telefone), email: company.email,
      segment: company.cnae_descricao, uf: company.uf, city: company.municipio,
      distance: company.distance_km == null ? null : Math.round(company.distance_km),
      size, annual_revenue: null,
      score: company.score ?? null,
      score_snapshot: {
        total: company.score ?? 0,
        deterministic: company.deterministic_score ?? null,
        ai: company.ai_score ?? null,
        providers: company.score_provider_results ?? [],
        reason: company.score_reason ?? null,
        criteria: {
          segment: company.cnae_descricao ?? null,
          region: [company.municipio, company.uf].filter(Boolean).join('/') || null,
          distance_km: company.distance_km ?? null, size: company.porte ?? null,
          whatsapp: initialChannels.whatsapp.available, email: initialChannels.email.available,
          phone: initialChannels.phone.available, website: Boolean(company.website),
        },
        source: company.source, captured_at: new Date().toISOString(),
      },
      score_explanation: company.score_reason ?? 'Score da campanha agendada.',
      score_source: company.source, score_verified_at: new Date().toISOString(),
      temp: (company.score ?? 0) >= 75 ? 'hot' : (company.score ?? 0) >= 50 ? 'warm' : 'cold',
      stage: 'Prospecção',
      origin: `schedule:${schedule.id}|${originTag}`,
      prospect_identity: identity,
      contact_channels: initialChannels,
      contact_approval_status: approval.approved ? 'approved' : 'pending',
      contact_approved_at: approvedAt,
      contact_approved_by: approval.approved ? schedule.owner_id : null,
      contact_approval_reason: approval.reason,
      automation_status: approval.approved ? 'not_started' : 'pending_approval',
      automation_error: null,
      automation_updated_at: new Date().toISOString(),
    }
    const { data: row, error } = await supabaseAdmin.from('leads').insert(payload as never).select('id').single()
    if (error?.code === '23505') { bump('duplicate_race'); continue }
    if (error) { bump(`insert_error:${error.code ?? 'unknown'}`); continue }

    await supabaseAdmin.from('audit_logs').insert({
      organization_id: schedule.organization_id,
      actor_id: assignedOwner, actor_name: 'Agendador de prospecção', actor_type: 'ia',
      action: approval.approved ? 'schedule_lead_approved' : 'schedule_lead_pending_approval',
      detail: `Campanha ${schedule.id} · ${company.razao_social}. ${approval.reason}`,
      rule: `campaign_score>=${schedule.auto_approve_min_score};approval=${approval.mode}`,
    } as never)

    if (approval.approved) {
      formallyApproved++
      try {
        if (schedule.sequence_id) {
          const { ensureEnrollmentInternal } = await import('./outreach-sequences.functions')
          await ensureEnrollmentInternal(supabaseAdmin, row.id as string, schedule.sequence_id)
        }
        const { triggerOutreachInternal } = await import('./outreach.functions')
        const outreach = await triggerOutreachInternal(
          { supabase: supabaseAdmin, userId: assignedOwner, claims: { email: 'Agendador' } } as never,
          row.id as string,
        )
        if (!outreach.ok) bump(`outreach:${outreach.reason ?? 'not_started'}`)
        for (const integrationError of outreach.integration_errors ?? []) {
          bump(`integration:${integrationError.channel}:${integrationError.error}`)
        }
      } catch (err) {
        bump('outreach_start_failed')
        await supabaseAdmin
          .from('leads')
          .update({
            automation_status: 'failed',
            automation_error: (err as Error).message,
            automation_updated_at: new Date().toISOString(),
          } as never)
          .eq('id', row.id)
        console.error('schedule outreach start failed', (err as Error).message)
      }
    } else {
      bump('awaiting_admin_approval')
    }

    imported++
  }

  return { found, approved: formallyApproved, imported, skipped: found - imported, reasons }
}
