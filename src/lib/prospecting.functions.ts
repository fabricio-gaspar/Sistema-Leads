import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'

// ============= Types =============
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
  email: string | null
  logradouro: string | null
  numero: string | null
  bairro: string | null
  municipio: string | null
  uf: string | null
  cep: string | null
  score?: number
  score_reason?: string
}

// ============= Filters schema =============
const filtersSchema = z.object({
  cnae: z.string().optional().nullable(),
  uf: z.string().length(2).optional().nullable(),
  municipio: z.string().optional().nullable(),
  porte: z.string().optional().nullable(),
  min_capital: z.number().optional().nullable(),
  limit: z.number().int().min(1).max(30).default(15),
})

type Filters = z.infer<typeof filtersSchema>

function hashFilters(f: Filters): string {
  return JSON.stringify({
    cnae: f.cnae || null,
    uf: f.uf || null,
    municipio: (f.municipio || '').toLowerCase().trim() || null,
    porte: f.porte || null,
    min_capital: f.min_capital || null,
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

function normalize(item: CnpjWsEstab): ExternalCompany {
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
  const mapped = items.map(normalize)

  const porteFilter = filters.porte?.toLowerCase()
  const minCap = filters.min_capital ?? 0
  return mapped
    .filter((c) => (porteFilter ? (c.porte ?? '').toLowerCase().includes(porteFilter) : true))
    .filter((c) => (minCap > 0 ? (c.capital_social ?? 0) >= minCap : true))
    .slice(0, filters.limit)
}

// ============= Claude scoring =============
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

Score alto = alto potencial de fechamento. Considere porte, CNAE compatível, região, capital social e tempo de atividade.`

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

export const searchExternalCompanies = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => filtersSchema.parse(d))
  .handler(async ({ data, context }) => {
    const hash = hashFilters(data)

    // Cache hit (< 7 days)
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
        results: cached.results as unknown as ExternalCompany[],
      }
    }

    // Fresh fetch + score
    const raw = await fetchFromCnpjWs(data)
    const { data: settings } = await context.supabase
      .from('company_settings')
      .select('name, description, differentiators')
      .limit(1)
      .maybeSingle()

    const scored = await scoreWithClaude(raw, {
      name: settings?.name,
      description: settings?.description,
      differentiators: settings?.differentiators,
      icp: null,
    })

    const { data: row, error: insErr } = await context.supabase
      .from('prospecting_cache')
      .insert({
        user_id: context.userId,
        filters: data as never,
        filters_hash: hash,
        results: scored as never,
        total_found: scored.length,
        scored: scored.some((s) => s.score != null),
      } as never)
      .select('id')
      .single()
    if (insErr) throw new Error(insErr.message)

    return { cache_id: row.id as string, cached: false, results: scored }
  })

export const importExternalAsLead = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cache_id: z.string().uuid(), cnpj: z.string().min(8) }).parse(d),
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

    // Duplicate check by cnpj on leads (stored in `origin` field prefixed)
    const originTag = `cnpj:${company.cnpj}`
    const { data: dup } = await context.supabase
      .from('leads')
      .select('id')
      .eq('owner_id', context.userId)
      .eq('origin', originTag)
      .maybeSingle()
    if (dup) throw new Error('Este CNPJ já foi importado como lead')

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
      detail: `Importado da Receita Federal: ${company.razao_social} (${company.cnpj})`,
    } as never)

    return row
  })
