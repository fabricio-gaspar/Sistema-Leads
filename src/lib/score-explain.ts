import type { Database } from '@/integrations/supabase/types'
import type { ExternalCompany } from './prospecting.functions'

export type Weights = {
  segment: number
  whatsapp: number
  site: number
  porte: number
  google: number
  regiao: number
}

export const DEFAULT_WEIGHTS: Weights = {
  segment: 25,
  whatsapp: 20,
  site: 15,
  porte: 15,
  google: 15,
  regiao: 10,
}

export type ScoreCriterion = keyof Weights

export type ScoreLine = {
  key: ScoreCriterion
  label: string
  weight: number
  ratio: number // 0..1
  points: number
  signal: string // texto curto do sinal detectado
}

export type ScoreBreakdown = {
  total: number // 0..100 (dos pesos)
  deterministic: number // idem, redundante para clareza
  ai: number | null // score da IA quando existir
  combined: number // combinação usada para classificação final
  temp: 'hot' | 'warm' | 'cold'
  weightsSum: number // soma dos pesos (idealmente 100)
  lines: ScoreLine[]
}

export type ScoreContext = {
  // filtros usados na busca — importantes para "porte" e "região"
  porteFilter?: string | null
  ufFilter?: string | null
  radiusKm?: number | null
}

function ratioPorte(company: ExternalCompany, filter?: string | null): { r: number; sig: string } {
  const porte = (company.porte ?? '').toLowerCase()
  if (!porte) return { r: 0, sig: 'porte não informado' }
  if (filter) {
    const wanted = filter.toLowerCase()
    if (porte.includes(wanted)) return { r: 1, sig: `porte confere com filtro (${company.porte})` }
    return { r: 0.3, sig: `porte diferente do filtro (${company.porte})` }
  }
  return { r: 0.7, sig: `porte: ${company.porte}` }
}

function ratioRegiao(company: ExternalCompany, ctx: ScoreContext): { r: number; sig: string } {
  const { ufFilter, radiusKm } = ctx
  if (radiusKm != null && typeof company.distance_km === 'number') {
    if (company.distance_km <= radiusKm) {
      const r = Math.max(0.4, 1 - company.distance_km / (radiusKm * 1.5))
      return { r, sig: `${company.distance_km.toFixed(1)} km do centro (raio ${radiusKm} km)` }
    }
    return { r: 0.1, sig: `fora do raio (${company.distance_km.toFixed(1)} km)` }
  }
  if (ufFilter && company.uf) {
    if (company.uf.toUpperCase() === ufFilter.toUpperCase())
      return { r: 1, sig: `UF confere (${company.uf})` }
    return { r: 0.2, sig: `UF diferente (${company.uf} vs ${ufFilter})` }
  }
  if (company.municipio || company.uf)
    return { r: 0.6, sig: [company.municipio, company.uf].filter(Boolean).join(' / ') }
  return { r: 0, sig: 'localização não informada' }
}

function ratioSegment(company: ExternalCompany): { r: number; sig: string } {
  if (company.cnae_principal && company.cnae_descricao)
    return { r: 1, sig: company.cnae_descricao }
  if (company.cnae_descricao) return { r: 0.7, sig: company.cnae_descricao }
  if (company.cnae_principal) return { r: 0.5, sig: `CNAE ${company.cnae_principal}` }
  return { r: 0, sig: 'CNAE não informado' }
}

function ratioWhatsapp(company: ExternalCompany): { r: number; sig: string } {
  if (company.whatsapp) return { r: 1, sig: `celular detectado (${company.whatsapp})` }
  if (company.telefone) return { r: 0.4, sig: `apenas telefone fixo (${company.telefone})` }
  return { r: 0, sig: 'sem telefone' }
}

function ratioSite(company: ExternalCompany): { r: number; sig: string } {
  if (company.website) return { r: 1, sig: company.website }
  if (company.email) return { r: 0.5, sig: `sem site, mas tem e-mail (${company.email})` }
  return { r: 0, sig: 'sem site nem e-mail' }
}

function ratioGoogle(company: ExternalCompany): { r: number; sig: string } {
  if (company.source === 'google_places' || company.source === 'apify')
    return { r: 1, sig: `presença Google (${company.source})` }
  if (company.website && company.telefone) return { r: 0.6, sig: 'site + telefone (indício)' }
  if (company.website || company.email) return { r: 0.3, sig: 'sinal parcial' }
  return { r: 0, sig: 'sem presença detectada' }
}

const CRITERIA: {
  key: ScoreCriterion
  label: string
  compute: (c: ExternalCompany, ctx: ScoreContext) => { r: number; sig: string }
}[] = [
  { key: 'segment', label: 'Segmento (CNAE)', compute: (c) => ratioSegment(c) },
  { key: 'whatsapp', label: 'WhatsApp / celular', compute: (c) => ratioWhatsapp(c) },
  { key: 'site', label: 'Site / e-mail', compute: (c) => ratioSite(c) },
  { key: 'porte', label: 'Porte', compute: (c, ctx) => ratioPorte(c, ctx.porteFilter) },
  { key: 'google', label: 'Presença Google', compute: (c) => ratioGoogle(c) },
  { key: 'regiao', label: 'Região', compute: (c, ctx) => ratioRegiao(c, ctx) },
]

export function explainScore(
  company: ExternalCompany,
  weights: Weights,
  ctx: ScoreContext = {},
): ScoreBreakdown {
  const weightsSum =
    weights.segment + weights.whatsapp + weights.site + weights.porte + weights.google + weights.regiao
  const lines: ScoreLine[] = CRITERIA.map((c) => {
    const { r, sig } = c.compute(company, ctx)
    const weight = weights[c.key] ?? 0
    return {
      key: c.key,
      label: c.label,
      weight,
      ratio: r,
      points: Math.round(weight * r),
      signal: sig,
    }
  })
  const raw = lines.reduce((s, l) => s + l.weight * l.ratio, 0)
  // normaliza para 0..100 se a soma dos pesos não for 100
  const deterministic = weightsSum > 0 ? Math.round((raw / weightsSum) * 100) : 0
  // Novas buscas persistem `score` como classificacao final e preservam o
  // parecer bruto das IAs em `ai_score`. O fallback mantem compatibilidade
  // com caches antigos, nos quais `score` era o valor retornado pela Claude.
  const aiValue = company.ai_score ?? (company.deterministic_score == null ? company.score : undefined)
  const ai = typeof aiValue === 'number' ? Math.round(aiValue) : null
  // combina 60% determinístico + 40% IA quando IA existir
  const combined = ai != null ? Math.round(deterministic * 0.6 + ai * 0.4) : deterministic
  const temp: ScoreBreakdown['temp'] = combined >= 75 ? 'hot' : combined >= 50 ? 'warm' : 'cold'
  return { total: deterministic, deterministic, ai, combined, temp, weightsSum, lines }
}

export function distributionFor(
  companies: ExternalCompany[],
  weights: Weights,
  ctx: ScoreContext = {},
) {
  let hot = 0
  let warm = 0
  let cold = 0
  let sum = 0
  for (const c of companies) {
    const b = explainScore(c, weights, ctx)
    sum += b.combined
    if (b.temp === 'hot') hot += 1
    else if (b.temp === 'warm') warm += 1
    else cold += 1
  }
  const total = companies.length
  const avg = total > 0 ? Math.round(sum / total) : 0
  return { total, hot, warm, cold, avg }
}
