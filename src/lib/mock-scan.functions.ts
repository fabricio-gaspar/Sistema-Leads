import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export type MockFinding = {
  table: string
  id: string | null
  column: string
  value: string | null
  reason: string
  severity: 'high' | 'medium' | 'low'
}

export type MockScanReport = {
  scannedAt: string
  totals: { table: string; rows: number; findings: number }[]
  findings: MockFinding[]
}

// Padrões suspeitos comuns
const SUSPICIOUS_TEXT = [
  /\blorem\b/i,
  /\bipsum\b/i,
  /\bfoo\b/i,
  /\bbar\b/i,
  /\bbaz\b/i,
  /\bmock\b/i,
  /\bfake\b/i,
  /\bdummy\b/i,
  /\bplaceholder\b/i,
  /\btodo\b/i,
  /\bfixme\b/i,
  /\bexample\b/i,
  /\bexemplo\b/i,
  /\bacme\b/i,
  /\bempresa\s*(a|b|c|x|xyz|teste)\b/i,
  /\bteste?\d*\b/i,
  /\bcontato\s*(a|b|x|xyz|teste)?\b/i,
  /\bcliente\s*(a|b|c|x|xyz|teste)\b/i,
  /^\s*(test|teste)\s*$/i,
  /\bjohn\s+doe\b/i,
  /\bjane\s+doe\b/i,
  /\bfulano\b/i,
  /\bciclano\b/i,
  /\bbeltrano\b/i,
]

const SUSPICIOUS_EMAIL = [
  /@example\.(com|org|net)$/i,
  /@test\./i,
  /@mock\./i,
  /@fake\./i,
  /@localhost/i,
  /^(test|teste|mock|fake|dummy|noreply|no-reply)@/i,
]

const SUSPICIOUS_PHONE = [
  /^0+$/,
  /^1+$/,
  /^(\d)\1{7,}$/, // 8+ dígitos repetidos
  /^123456/,
  /^987654/,
  /^0000/,
  /^1111/,
  /^5555/,
  /^99999/,
]

function checkText(v: unknown): { hit: boolean; reason: string } {
  if (v == null) return { hit: false, reason: '' }
  const s = String(v).trim()
  if (!s) return { hit: false, reason: '' }
  for (const rx of SUSPICIOUS_TEXT) {
    if (rx.test(s)) return { hit: true, reason: `Texto suspeito: /${rx.source}/` }
  }
  return { hit: false, reason: '' }
}

function checkEmail(v: unknown): { hit: boolean; reason: string } {
  if (v == null) return { hit: false, reason: '' }
  const s = String(v).trim()
  if (!s) return { hit: false, reason: '' }
  for (const rx of SUSPICIOUS_EMAIL) {
    if (rx.test(s)) return { hit: true, reason: `Domínio/prefixo de e-mail de teste` }
  }
  const textCheck = checkText(s.split('@')[0])
  if (textCheck.hit) return { hit: true, reason: `Prefixo de e-mail suspeito` }
  return { hit: false, reason: '' }
}

function checkPhone(v: unknown): { hit: boolean; reason: string } {
  if (v == null) return { hit: false, reason: '' }
  const digits = String(v).replace(/\D/g, '')
  if (!digits) return { hit: false, reason: '' }
  if (digits.length < 8) return { hit: true, reason: 'Telefone muito curto (menos de 8 dígitos)' }
  for (const rx of SUSPICIOUS_PHONE) {
    if (rx.test(digits)) return { hit: true, reason: 'Telefone com padrão simulado' }
  }
  return { hit: false, reason: '' }
}

function checkCnpj(v: unknown): { hit: boolean; reason: string } {
  if (v == null) return { hit: false, reason: '' }
  const digits = String(v).replace(/\D/g, '')
  if (!digits) return { hit: false, reason: '' }
  if (digits.length !== 14) return { hit: true, reason: 'CNPJ com quantidade de dígitos inválida' }
  if (/^(\d)\1{13}$/.test(digits)) return { hit: true, reason: 'CNPJ com todos dígitos iguais' }
  return { hit: false, reason: '' }
}

export const runMockScan = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MockScanReport> => {
    const { supabase, userId } = context

    // Só admins podem rodar
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    })
    if (!isAdmin) throw new Error('Apenas administradores podem executar a varredura.')

    const findings: MockFinding[] = []
    const totals: MockScanReport['totals'] = []

    function push(
      table: string,
      id: string | null,
      column: string,
      value: unknown,
      reason: string,
      severity: MockFinding['severity'] = 'medium',
    ) {
      findings.push({
        table,
        id,
        column,
        value: value == null ? null : String(value),
        reason,
        severity,
      })
    }

    // ===== LEADS =====
    {
      const { data: rows = [] } = await supabase
        .from('leads')
        .select('id, company, contact, email, phone, segment, city')
        .limit(2000)
      let f = 0
      for (const r of rows ?? []) {
        for (const col of ['company', 'contact', 'segment', 'city'] as const) {
          const c = checkText(r[col])
          if (c.hit) { push('leads', r.id, col, r[col], c.reason, 'high'); f++ }
        }
        const em = checkEmail(r.email)
        if (em.hit) { push('leads', r.id, 'email', r.email, em.reason, 'high'); f++ }
        const ph = checkPhone(r.phone)
        if (ph.hit) { push('leads', r.id, 'phone', r.phone, ph.reason, 'medium'); f++ }
      }
      totals.push({ table: 'leads', rows: rows?.length ?? 0, findings: f })
    }

    // ===== PROFILES =====
    {
      const { data: rows = [] } = await supabase
        .from('profiles')
        .select('id, name, email')
        .limit(2000)
      let f = 0
      for (const r of rows ?? []) {
        const n = checkText(r.name)
        if (n.hit) { push('profiles', r.id, 'name', r.name, n.reason, 'medium'); f++ }
        const em = checkEmail(r.email)
        if (em.hit) { push('profiles', r.id, 'email', r.email, em.reason, 'medium'); f++ }
      }
      totals.push({ table: 'profiles', rows: rows?.length ?? 0, findings: f })
    }

    // ===== COMPANY_SETTINGS =====
    {
      const { data: rows = [] } = await supabase
        .from('company_settings')
        .select('id, name, cnpj, city, segment, email, phone')
        .limit(500)
      let f = 0
      for (const r of rows ?? []) {
        for (const col of ['name', 'city', 'segment'] as const) {
          const c = checkText(r[col])
          if (c.hit) { push('company_settings', r.id, col, r[col], c.reason, 'high'); f++ }
        }
        const cn = checkCnpj(r.cnpj)
        if (cn.hit) { push('company_settings', r.id, 'cnpj', r.cnpj, cn.reason, 'high'); f++ }
        const em = checkEmail(r.email)
        if (em.hit) { push('company_settings', r.id, 'email', r.email, em.reason, 'medium'); f++ }
        const ph = checkPhone(r.phone)
        if (ph.hit) { push('company_settings', r.id, 'phone', r.phone, ph.reason, 'medium'); f++ }
      }
      totals.push({ table: 'company_settings', rows: rows?.length ?? 0, findings: f })
    }

    // ===== PROPOSALS =====
    {
      const { data: rows = [] } = await supabase
        .from('proposals')
        .select('id, client, number')
        .limit(2000)
      let f = 0
      for (const r of rows ?? []) {
        const c = checkText(r.client)
        if (c.hit) { push('proposals', r.id, 'client', r.client, c.reason, 'medium'); f++ }
      }
      totals.push({ table: 'proposals', rows: rows?.length ?? 0, findings: f })
    }

    // ===== ORDERS =====
    {
      const { data: rows = [] } = await supabase
        .from('orders')
        .select('id, company, number, contact')
        .limit(2000)
      let f = 0
      for (const r of rows ?? []) {
        for (const col of ['company', 'contact'] as const) {
          const c = checkText(r[col])
          if (c.hit) { push('orders', r.id, col, r[col], c.reason, 'medium'); f++ }
        }
      }
      totals.push({ table: 'orders', rows: rows?.length ?? 0, findings: f })
    }

    // ===== SERVICES =====
    {
      const { data: rows = [] } = await supabase
        .from('services')
        .select('id, name, description')
        .limit(1000)
      let f = 0
      for (const r of rows ?? []) {
        for (const col of ['name', 'description'] as const) {
          const c = checkText(r[col])
          if (c.hit) { push('services', r.id, col, r[col], c.reason, 'low'); f++ }
        }
      }
      totals.push({ table: 'services', rows: rows?.length ?? 0, findings: f })
    }

    // ===== INTEGRATIONS (detectar status "conectado" sem config) =====
    {
      const { data: rows = [] } = await supabase
        .from('integrations')
        .select('id, provider, status, config')
        .limit(200)
      let f = 0
      for (const r of rows ?? []) {
        const cfg = r.config as Record<string, unknown> | null
        const empty = !cfg || Object.keys(cfg).length === 0
        if (r.status === 'connected' && empty) {
          push('integrations', r.id, 'status', r.status, 'Marcada como conectada sem configuração real', 'high')
          f++
        }
      }
      totals.push({ table: 'integrations', rows: rows?.length ?? 0, findings: f })
    }

    findings.sort((a, b) => {
      const w = { high: 0, medium: 1, low: 2 } as const
      return w[a.severity] - w[b.severity]
    })

    return {
      scannedAt: new Date().toISOString(),
      totals,
      findings,
    }
  })
