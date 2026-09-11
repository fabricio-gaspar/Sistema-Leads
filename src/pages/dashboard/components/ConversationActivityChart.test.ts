import { describe, expect, it } from 'vitest';
import { buildConversationActivity } from './conversationActivity';
import type { Conversa } from '@/mocks/atendimentoData';

const conversa: Conversa = {
  id: 'lead-1', protocolo: '#TCK-001', contato: 'Brics', empresa: 'Brics', canal: 'whatsapp', status: 'ativo', sla: '—', fila: 'Novo', ultimaMensagem: 'Olá', hora: '12:00', naoLidas: 0,
  mensagens: [
    { id: 'inbound', autor: 'cliente', nome: 'Brics', texto: 'Olá', hora: '11:10', criadoEm: '2026-09-11T11:10:00.000Z' },
    { id: 'outbound', autor: 'ana', nome: 'Ana', texto: 'Olá!', hora: '11:30', criadoEm: '2026-09-11T11:30:00.000Z' },
    { id: 'internal', autor: 'sistema', nome: 'Sistema', texto: 'Nota', hora: '11:35', criadoEm: '2026-09-11T11:35:00.000Z', notaInterna: true },
    { id: 'old', autor: 'cliente', nome: 'Brics', texto: 'Antiga', hora: '10:00', criadoEm: '2026-09-10T10:00:00.000Z' },
  ],
};

describe('buildConversationActivity', () => {
  it('agrega somente mensagens operacionais da janela de 24 horas', () => {
    const now = new Date('2026-09-11T12:00:00.000Z');
    const activity = buildConversationActivity([conversa], now);
    const bucket = activity.find((point) => point.timestamp === new Date('2026-09-11T11:00:00.000Z').getTime());

    expect(activity).toHaveLength(24);
    expect(bucket).toMatchObject({ recebidas: 1, enviadas: 1, total: 2 });
    expect(activity.reduce((sum, point) => sum + point.total, 0)).toBe(2);
  });

  it('mantém a série zerada quando não há mensagens reais no período', () => {
    const activity = buildConversationActivity([{ ...conversa, mensagens: [] }], new Date('2026-09-11T12:00:00.000Z'));
    expect(activity.every((point) => point.total === 0)).toBe(true);
  });
});
