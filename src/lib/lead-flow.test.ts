import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LEAD_FLOW,
  NO_REPLY_STAGE,
  approachBlockReason,
  computeNoReplyDeadline,
  isNoReplyExpired,
  normalizeLeadFlow,
  shouldShowConversation,
} from './lead-flow'

describe('normalizeLeadFlow', () => {
  it('aplica padrões seguros', () => {
    expect(normalizeLeadFlow(undefined)).toEqual(DEFAULT_LEAD_FLOW)
  })
  it('limita o timeout a faixas seguras', () => {
    expect(normalizeLeadFlow({ no_reply_timeout_hours: 0 }).no_reply_timeout_hours).toBe(1)
    expect(normalizeLeadFlow({ no_reply_timeout_hours: 5000 }).no_reply_timeout_hours).toBe(720)
    expect(normalizeLeadFlow({ human_sla_hours: 999 }).human_sla_hours).toBe(168)
  })
})

describe('computeNoReplyDeadline', () => {
  it('só existe após o primeiro envio', () => {
    expect(computeNoReplyDeadline(null, DEFAULT_LEAD_FLOW)).toBeNull()
  })
  it('soma o timeout ao primeiro envio', () => {
    const base = '2026-01-01T00:00:00.000Z'
    expect(computeNoReplyDeadline(base, { no_reply_timeout_hours: 48 })).toBe('2026-01-03T00:00:00.000Z')
  })
})

describe('isNoReplyExpired', () => {
  const now = new Date('2026-01-05T00:00:00.000Z')
  it('não expira sem primeiro contato de saída (inclui abordagem humana)', () => {
    expect(isNoReplyExpired({ no_reply_deadline_at: '2026-01-01T00:00:00.000Z' }, now)).toBe(false)
  })
  it('não expira se o lead respondeu antes do prazo', () => {
    expect(
      isNoReplyExpired(
        {
          first_outreach_at: '2026-01-01T00:00:00.000Z',
          first_inbound_at: '2026-01-02T00:00:00.000Z',
          no_reply_deadline_at: '2026-01-03T00:00:00.000Z',
        },
        now,
      ),
    ).toBe(false)
  })
  it('expira quando houve envio, não houve resposta e o prazo venceu', () => {
    expect(
      isNoReplyExpired(
        {
          first_outreach_at: '2026-01-01T00:00:00.000Z',
          no_reply_deadline_at: '2026-01-03T00:00:00.000Z',
        },
        now,
      ),
    ).toBe(true)
  })
  it('é idempotente: não reprocessa lead já processado ou já na etapa', () => {
    const base = {
      first_outreach_at: '2026-01-01T00:00:00.000Z',
      no_reply_deadline_at: '2026-01-03T00:00:00.000Z',
    }
    expect(isNoReplyExpired({ ...base, no_reply_processed_at: '2026-01-04T00:00:00.000Z' }, now)).toBe(false)
    expect(isNoReplyExpired({ ...base, stage: NO_REPLY_STAGE }, now)).toBe(false)
  })
})

describe('shouldShowConversation', () => {
  const cfg = { open_conversation_on_reply_only: true }
  it('não abre só porque o lead foi criado ou atribuído', () => {
    expect(shouldShowConversation({ first_outreach_at: '2026-01-01T00:00:00.000Z' }, cfg)).toBe(false)
  })
  it('abre com resposta recebida', () => {
    expect(shouldShowConversation({ first_inbound_at: '2026-01-02T00:00:00.000Z' }, cfg)).toBe(true)
  })
  it('abre com handoff ou abertura manual', () => {
    expect(shouldShowConversation({ escalated: true }, cfg)).toBe(true)
    expect(shouldShowConversation({ conversation_opened_at: '2026-01-02T00:00:00.000Z' }, cfg)).toBe(true)
  })
  it('mostra tudo quando a regra está desligada', () => {
    expect(shouldShowConversation({}, { open_conversation_on_reply_only: false })).toBe(true)
  })
})

describe('approachBlockReason', () => {
  it('bloqueia opt-out', () => {
    expect(approachBlockReason({ opt_out: true, email: 'a@b.com' })).toBe('opt_out')
  })
  it('bloqueia contato reprovado', () => {
    expect(approachBlockReason({ contact_approval_status: 'rejected', email: 'a@b.com' })).toBe('contato_reprovado')
  })
  it('é idempotente: lead já abordado não é reabordado', () => {
    expect(approachBlockReason({ approach_type: 'ia', email: 'a@b.com' })).toBe('ja_abordado')
  })
  it('bloqueia lead sem canal', () => {
    expect(approachBlockReason({})).toBe('sem_canal')
  })
  it('libera lead válido', () => {
    expect(approachBlockReason({ whatsapp: '5511999999999' })).toBeNull()
  })
})
