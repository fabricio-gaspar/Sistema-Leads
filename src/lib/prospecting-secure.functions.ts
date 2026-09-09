import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import {
  importExternalAsLead,
  getPendingApprovalQueue,
  rejectProspects,
  saveProspectingSearch,
  listSavedSearches,
  getSavedSearch,
  deleteSavedSearch,
  renameSavedSearch,
  listRecentProspectingSamples,
  prospectIdentity,
} from './prospecting.functions'
import type { ExternalCompany, SourceId, SavedSearch } from './prospecting.functions'

export {
  importExternalAsLead,
  getPendingApprovalQueue,
  rejectProspects,
  saveProspectingSearch,
  listSavedSearches,
  getSavedSearch,
  deleteSavedSearch,
  renameSavedSearch,
  listRecentProspectingSamples,
  prospectIdentity,
}
export type { ExternalCompany, SourceId, SavedSearch }

type ApprovalMode = 'automatic' | 'score' | 'manual'
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

function detectWhatsapp(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  const local = digits.length === 13 && digits.startsWith('55') ? digits.slice(2) : digits
  return local.length === 11 && local[2] === '9'
    ? `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
    : null
}

function deterministicScore(company: ExternalCompany, filters: Filters) {
  let score = 35
  const reasons: string[] = []
  if (company.whatsapp) { score += 20; reasons.push('WhatsApp disponível') }
  else if (company.telefone) { score += 12; reasons.push('telefone disponível') }
  if (company.email) { score += 12; reasons.push('e-mail disponível') }
  if (company.website) { score += 10; reasons.push('site disponível') }
  if (filters.uf && company.uf?.toUpperCase() === filters.uf.toUpperCase()) {
    score += 10
    reasons.push('região desejada')
  }
  if (company.situacao?.toLowerCase().includes('ativa')) {
    score += 8
    reasons.push('situação ativa')
  }
  return {
    score: Math.min(100, score),
    reason: reasons.length ? reasons.join(' · ') : 'Score baseado nos sinais públicos disponíveis.',
  }
}

type CnpjWsEstab = {
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

function normalizeCnpjWs(item: CnpjWsEstab, filters: Filters): ExternalCompany {
  const establishment = item.estabelecimento || {}
  const porte = typeof item.porte === 'string' ? item.porte : item.porte?.descricao ?? null
  const capital = item.capital_social != null ? Number(item.capital_social) : null
  const phone = establishment.ddd1 && establishment.telefone1
    ? `(${establishment.ddd1}) ${establishment.telefone1}`
    : establishment.telefone1 ?? null
  const company: ExternalCompany = {
    cnpj: establishment.cnpj || item.cnpj || '',
    razao_social: item.razao_social || establishment.nome_fantasia || '',
    nome_fantasia: establishment.nome_fantasia ?? null,
    cnae_principal: establishment.atividade_principal?.subclasse ?? null,
    cnae_descricao: establishment.atividade_principal?.descricao ?? null,
    porte,
    capital_social: Number.isFinite(capital as number) ? capital as number : null,
    situacao: establishment.situacao_cadastral ?? null,
    data_abertura: establishment.data_inicio_atividade ?? null,
    telefone: phone,
    whatsapp: detectWhatsapp(phone),
    email: establishment.email ?? null,
    logradouro: [establishment.tipo_logradouro, establishment.logradouro].filter(Boolean).join(' ') || null,
    numero: establishment.numero ?? null,
    bairro: establishment.bairro ?? null,
    municipio: establishment.cidade?.nome ?? null,
    uf: establishment.estado?.sigla ?? null,
    cep: establishment.cep ?? null,
    source: 'cnpj_ws',
  }
  const scored = deterministicScore(company, filters)
  return { ...company, deterministic_score: scored.score, score: scored.score, score_reason: scored.reason }
}

async function fetchCnpj(filters: Filters): Promise<ExternalCompany[]> {
  const params = new URLSearchParams()
  if (filters.cnae) params.set('estabelecimento.atividade_principal', filters.cnae.replace(/\D/g, ''))
  if (filters.uf) params.set('estabelecimento.estado', filters.uf.toUpperCase())
  if (filters.municipio) params.set('estabelecimento.cidade', filters.municipio)
  params.set('estabelecimento.situacao_cadastral', 'Ativa')
  params.set('estabelecimento.tipo', 'matriz')
  const response = await fetch(`https://publica.cnpj.ws/cnpj?${params.toString()}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(25_000),
  })
  if (response.status === 429) throw new Error('CNPJ.ws atingiu o limite temporário. Tente novamente após o limite do provedor.')
  if (!response.ok) throw new Error(`CNPJ.ws não respondeu corretamente (HTTP ${response.status}).`)
  const payload = await response.json() as { data?: CnpjWsEstab[] } | CnpjWsEstab[]
  const items = Array.isArray(payload) ? payload : payload.data ?? []
  const minCapital = filters.min_capital ?? 0
  const porte = filters.porte?.toLowerCase()
  return items
    .map((item) => normalizeCnpjWs(item, filters))
    .filter((item) => !porte || (item.porte ?? '').toLowerCase().includes(porte))
    .filter((item) => minCapital <= 0 || (item.capital_social ?? 0) >= minCapital)
    .slice(0, filters.limit)
}

function edgeFilters(filters: Filters) {
  return {
    pais: 'Brasil',
    estado: filters.uf || '',
    cidade: filters.municipio || '',
    raio: filters.radius_km || 10,
    atividades: filters.cnae ? [filters.cnae] : [],
    segmentos: filters.keyword ? [filters.keyword] : [],
    portes: filters.porte ? [filters.porte] : [],
    exigeSite: false,
    exigeWhatsApp: false,
    exigeEmail: false,
    volumeMaximo: filters.limit,
  }
}

export const getEnabledSources = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: settings }, { data: integrations }, { data: sources }] = await Promise.all([
      context.supabase
        .from('company_settings')
        .select('prospecting_sources,prospecting_ai_providers,prospecting_ai_strategy,contact_approval_mode,contact_approval_min_score')
        .limit(1)
        .maybeSingle(),
      context.supabase
        .from('integrations')
        .select('key,enabled,connected,paused,configuration')
        .in('key', ['apify', 'google_places', 'ai']),
      context.supabase
        .from('lead_source_configs')
        .select('source_key,enabled,connection_status'),
    ])
    const sourceByKey = new Map((sources ?? []).map((row: any) => [row.source_key, row]))
    const integrationByKey = new Map((integrations ?? []).map((row: any) => [row.key, row]))
    const configured = (key: string) => {
      const row: any = integrationByKey.get(key)
      return Boolean(row?.enabled && row?.connected && !row?.paused)
    }
    const enabled = (key: string) => {
      const row: any = sourceByKey.get(key)
      return Boolean(row?.enabled && row?.connection_status === 'connected')
    }
    const requested = (settings?.prospecting_sources as Record<string, boolean> | null) ?? {}
    const aiReady = configured('ai')
    return {
      cnpj_ws: requested.cnpj_ws ?? enabled('cnpj') ?? true,
      google_places: (requested.google_places ?? true) && enabled('google_places') && configured('google_places'),
      ai_only: Boolean(requested.ai_only && aiReady),
      apify: (requested.apify ?? true) && enabled('apify') && configured('apify'),
      has_google_key: configured('google_places'),
      has_openai_key: aiReady,
      has_anthropic_key: aiReady,
      has_gemini_key: false,
      has_apify_token: configured('apify'),
      ai_providers: (settings?.prospecting_ai_providers as string[] | null) ?? [],
      ai_strategy: settings?.prospecting_ai_strategy === 'fallback' ? 'fallback' : 'consensus',
      approval_mode: (settings?.contact_approval_mode as ApprovalMode | null) ?? 'automatic',
      approval_min_score: Number(settings?.contact_approval_min_score ?? 70),
    }
  })

export const testApifyToken = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.functions.invoke('testar-integracao', {
      body: { canal: 'apify' },
    })
    if (error || !data?.ok) {
      return {
        ok: false as const,
        status: 0,
        message: data?.detalhe || error?.message || 'Não foi possível validar a Apify.',
      }
    }
    return { ok: true as const, status: 200, message: data.detalhe || 'Apify conectada.' }
  })

export const searchExternalCompanies = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => filtersSchema.parse(value))
  .handler(async ({ data, context }) => {
    if (data.source === 'ai_only') {
      throw new Error('IA pura é apenas apoio de pesquisa. Para contato real, use uma fonte verificável como CNPJ, Apify ou Google Places.')
    }

    if (data.source === 'apify' || data.source === 'google_places') {
      const { data: response, error } = await context.supabase.functions.invoke('prospectar-leads', {
        body: { sourceKey: data.source, mode: 'production', filters: edgeFilters(data) },
      })
      if (error || !response?.ok) {
        throw new Error(response?.error || error?.message || `Falha na busca real via ${data.source}.`)
      }
      return {
        cache_id: response.cacheId as string,
        cached: false,
        source: data.source,
        results: (response.leads ?? []) as ExternalCompany[],
      }
    }

    const results = await fetchCnpj(data)
    const hash = JSON.stringify({ source: data.source, ...data })
    const { data: cached } = await context.supabase
      .from('prospecting_cache')
      .select('id,results')
      .eq('user_id', context.userId)
      .eq('filters_hash', hash)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (cached) {
      return { cache_id: cached.id as string, cached: true, source: data.source, results: cached.results as unknown as ExternalCompany[] }
    }
    const { data: row, error } = await context.supabase
      .from('prospecting_cache')
      .insert({
        user_id: context.userId,
        filters: data as never,
        filters_hash: hash,
        results: results as never,
        total_found: results.length,
        scored: true,
        name: `CNPJ — ${[data.municipio, data.uf, data.keyword].filter(Boolean).join(' · ') || 'Brasil'}`,
        saved: true,
        expires_at: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      } as never)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return { cache_id: row.id as string, cached: false, source: data.source, results }
  })
