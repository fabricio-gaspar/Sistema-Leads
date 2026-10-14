import { describe, expect, it } from 'vitest';
import { mapCentralConversationDetail, mapCentralInboxCounts, mapCentralInboxPage } from './centralInboxRepository';

describe('central inbox mapper', () => {
  it('maps the server page without inventing status or unread values', () => {
    const page = mapCentralInboxPage({
      total: 1,
      has_more: false,
      items: [{
        lead_id: '11111111-1111-4111-8111-111111111111', protocol: '#CRM-11111111', contact: 'Fabricio', company: 'Wayflex',
        channel: 'whatsapp', stage: 'apresentado', stage_label: 'Apresentado', owner_id: null, owner_name: 'Ana',
        situation: 'ana', preview: 'Olá.', latest_at: '2026-09-28T12:00:00.000Z', unread_count: 0, sla_due_at: null, delivery_status: 'sent', has_failure: false,
      }],
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ situation: 'ana', unreadCount: 0, channel: 'whatsapp' });
  });

  it('keeps source-linked knowledge details and only persisted qualification values', () => {
    const detail = mapCentralConversationDetail({
      conversation: { lead_id: '11111111-1111-4111-8111-111111111111', protocol: '#CRM-11111111', contact: 'Fabricio', company: 'Wayflex', channel: 'whatsapp', stage: 'apresentado', stage_label: 'Apresentado', owner_name: 'Ana', mode: 'ana', blocked: false },
      messages: [{ id: '22222222-2222-4222-8222-222222222222', sender: 'ana', sender_name: 'Ana', type: 'sent', text: 'Resposta', created_at: '2026-09-28T12:00:00.000Z', message_at: '2026-09-28T12:00:00.000Z', knowledge_events: [{ item_name: 'Catálogo', item_type: 'catalog', presentation_format: 'document', event_type: 'sent', source_url: 'https://wayflex.ind.br/catalogos' }] }],
      has_more_messages: false,
      qualification: { technical_context: { need: 'Vedação' }, missing_fields: ['Prazo'] }, tasks: [], notes: [], activities: [],
    });
    expect(detail?.qualification?.technicalContext.need).toBe('Vedação');
    expect(detail?.messages[0].knowledgeEvents[0].sourceUrl).toContain('wayflex.ind.br');
    expect(detail?.conversation.mode).toBe('ana');
  });

  it('keeps the server totals for each inbox view instead of deriving them from one page', () => {
    expect(mapCentralInboxCounts({ all: 42, unread: 7, waiting: 4, mine: 3 }))
      .toEqual({ all: 42, unread: 7, waiting: 4, mine: 3 });
  });

  it('uses the factual phone when an older backend row still has the anonymous placeholder', () => {
    const page = mapCentralInboxPage({
      total: 1, has_more: false,
      items: [{ lead_id: '33333333-3333-4333-8333-333333333333', contact: 'Contato não identificado', phone: '+5511999999999', whatsapp: null }],
    });
    expect(page.items[0].contact).toBe('+5511999999999');
  });

  it('uses the factual phone for a legacy placeholder regardless of casing or surrounding whitespace', () => {
    const page = mapCentralInboxPage({
      total: 1, has_more: false,
      items: [{
        lead_id: '55555555-5555-4555-8555-555555555555',
        contact: '  CONTATO NÃO IDENTIFICADO  ',
        phone: '+5511977777777',
      }],
    });

    expect(page.items[0].contact).toBe('+5511977777777');
  });

  it('uses the factual phone for the plural placeholder reported by the operator', () => {
    const page = mapCentralInboxPage({
      total: 1, has_more: false,
      items: [{
        lead_id: '66666666-6666-4666-8666-666666666666',
        contact: 'Contatos não identificados',
        whatsapp: '+5511966666666',
      }],
    });

    expect(page.items[0].contact).toBe('+5511966666666');
  });

  it('does not leak placeholder variants when a factual WhatsApp identity exists', () => {
    const page = mapCentralInboxPage({
      total: 1, has_more: false,
      items: [{ lead_id: '33333333-3333-4333-8333-333333333334', contact: 'Contato nao informado', phone: null, whatsapp: '+5511888888888' }],
    });
    expect(page.items[0].contact).toBe('+5511888888888');
  });

  it('labels an unresolved sender as a new contact instead of repeating an anonymous placeholder', () => {
    const page = mapCentralInboxPage({
      total: 1, has_more: false,
      items: [{ lead_id: '77777777-7777-4777-8777-777777777777', contact: 'Contatos não identificados' }],
    });

    expect(page.items[0].contact).toBe('Novo contato');
  });

  it('keeps a resolved agenda name ahead of phone identity', () => {
    const detail = mapCentralConversationDetail({
      conversation: { lead_id: '44444444-4444-4444-8444-444444444444', contact: 'Vanessa', phone: '+5511888888888', channel: 'whatsapp' },
      messages: [], has_more_messages: false, tasks: [], notes: [], activities: [],
    });
    expect(detail?.conversation.contact).toBe('Vanessa');
  });
});
