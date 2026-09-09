import { describe, expect, test } from 'bun:test'
import {
  anaEventKey,
  anaResponseSucceeded,
  automationBlockReason,
  zapiBaseUrl,
} from '../supabase/functions/_shared/runtimeSafety'

const readyCompany = {
  active: true,
  sandbox_mode: false,
  can_use_ia: true,
  ai_actions_enabled: true,
}
const readyAi = { enabled: true, connected: true, paused: false }
const readyRuntime = { killSwitchGlobal: false }
const readyLead = {
  owner_id: 'owner-1',
  modo_atendimento: 'ia',
  ai_paused: false,
  opt_out: false,
}

describe('automationBlockReason', () => {
  test('bloqueia produção quando a empresa continua em sandbox', () => {
    expect(automationBlockReason({
      company: { ...readyCompany, sandbox_mode: true },
      ai: readyAi,
      runtime: readyRuntime,
      lead: readyLead,
    })).toBe('sandbox_mode')
  })

  test('permite dry-run mesmo em sandbox', () => {
    expect(automationBlockReason({
      company: { ...readyCompany, sandbox_mode: true },
      ai: readyAi,
      runtime: readyRuntime,
      lead: readyLead,
      dryRun: true,
    })).toBeNull()
  })

  test('bloqueia lead humano, pausado ou com opt-out', () => {
    expect(automationBlockReason({ company: readyCompany, ai: readyAi, runtime: readyRuntime, lead: { ...readyLead, modo_atendimento: 'humano' } })).toBe('human_mode')
    expect(automationBlockReason({ company: readyCompany, ai: readyAi, runtime: readyRuntime, lead: { ...readyLead, ai_paused: true } })).toBe('lead_paused')
    expect(automationBlockReason({ company: readyCompany, ai: readyAi, runtime: readyRuntime, lead: { ...readyLead, opt_out: true } })).toBe('lead_opt_out')
  })
})

describe('anaEventKey', () => {
  test('usa message id estável para inbound', () => {
    expect(anaEventKey('message.received', 'lead-1', 'msg-1', 'request-random'))
      .toBe('message.received:lead-1:message:msg-1')
  })

  test('rejeita inbound sem identidade da mensagem', () => {
    expect(() => anaEventKey('message.received', 'lead-1', '', 'request-1'))
      .toThrow('inbound_message_id_required')
  })

  test('impede dupla autoridade do timeout', () => {
    expect(() => anaEventKey('timeout.48h', 'lead-1', '', 'request-1'))
      .toThrow('timeout_owned_by_server_scheduler')
  })
})

describe('provider safety', () => {
  test('aceita somente a origem oficial da Z-API', () => {
    expect(zapiBaseUrl('https://api.z-api.io')).toBe('https://api.z-api.io')
    expect(() => zapiBaseUrl('https://example.com')).toThrow('provider_url_not_allowed')
    expect(() => zapiBaseUrl('https://api.z-api.io/evil')).toThrow('provider_url_not_allowed')
  })

  test('só considera a Ana bem-sucedida com HTTP 2xx e ok=true', () => {
    expect(anaResponseSucceeded(200, { ok: true })).toBe(true)
    expect(anaResponseSucceeded(200, { ok: false })).toBe(false)
    expect(anaResponseSucceeded(500, { ok: true })).toBe(false)
  })
})
