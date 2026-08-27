import { describe, expect, it } from 'vitest';
import { conversationToCrmRow, crmRowsToConversation, messageToCrmRow } from '@/lib/crm/conversationMapper';

const leadId = '11111111-1111-4111-8111-111111111111';
const conversationId = '22222222-2222-4222-8222-222222222222';

describe('conversationMapper', () => {
  it('keeps a human handoff as waiting_human in the relational model', () => {
    const row = conversationToCrmRow({
      id: conversationId,
      protocolo: '#CRM-001',
      contato: 'Carlos',
      empresa: 'Empresa',
      canal: 'whatsapp',
      status: 'transferido',
      sla: '30 min',
      fila: 'Comercial',
      ultimaMensagem: 'Transferindo.',
      hora: '10:30',
      naoLidas: 0,
      mensagens: [],
      leadId,
    }, '33333333-3333-4333-8333-333333333333');
    expect(row.status).toBe('waiting_human');
    expect(row.metadata.displayStatus).toBe('transferido');
  });

  it('keeps an internal system note out of the outbound channel', () => {
    const message = messageToCrmRow(
      { id: '44444444-4444-4444-8444-444444444444', autor: 'sistema', nome: 'Sistema', texto: 'Handoff criado', hora: '10:31', notaInterna: true },
      '33333333-3333-4333-8333-333333333333',
      conversationId,
    );
    expect(message.direction).toBe('internal');
    expect(message.sender_type).toBe('system');
  });

  it('restores a display conversation without exposing provider details', () => {
    const conversation = crmRowsToConversation({
      id: conversationId,
      organization_id: '33333333-3333-4333-8333-333333333333',
      lead_id: leadId,
      channel: 'whatsapp',
      status: 'open',
      protocol: '#CRM-001',
      queue_name: 'Comercial',
      unread_count: 1,
      last_message_at: null,
      metadata: { contato: 'Carlos', empresa: 'Empresa', displayStatus: 'aguardando' },
      created_at: '2026-08-26T10:00:00.000Z',
    }, []);
    expect(conversation.status).toBe('aguardando');
    expect(conversation.canal).toBe('whatsapp');
  });
});
