import { describe, expect, it } from 'vitest';
import { parseWaAkgEvent, sanitizeWaAkgPayload } from '../functions/_shared/waAkgInbound.ts';

describe('WA-AKG inbound parser', () => {
  it('accepts a personal incoming text', () => {
    const payload = {
      event: 'message.received', sessionId: 'seller_12345678', timestamp: '2026-10-04T15:00:00Z',
      data: { key: { id: 'wamid-1', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false }, type: 'text', content: { text: 'Quero saber mais' } },
    };
    expect(parseWaAkgEvent(payload)).toMatchObject({ kind: 'inbound', phone: '5511999999999', text: 'Quero saber mais' });
    expect(sanitizeWaAkgPayload(payload)).not.toHaveProperty('sessionId');
  });

  it('ignores groups and echoes', () => {
    expect(parseWaAkgEvent({ event: 'message.received', data: { key: { id: '1', remoteJid: '120@g.us' } } })).toMatchObject({ kind: 'ignored', reason: 'non_personal_chat' });
    expect(parseWaAkgEvent({ event: 'message.received', data: { key: { id: '2', remoteJid: '5511999999999@s.whatsapp.net', fromMe: true } } })).toMatchObject({ kind: 'ignored', reason: 'outbound_echo' });
  });

  it('maps receipts and connection state', () => {
    expect(parseWaAkgEvent({ event: 'message.status', data: { key: { id: 'msg-1' }, status: 'READ' } }))
      .toMatchObject({ kind: 'receipt', providerMessageIds: ['msg-1'], status: 'read' });
    expect(parseWaAkgEvent({ event: 'connection.update', data: { status: 'CONNECTED' } }))
      .toMatchObject({ kind: 'connection', state: 'connected' });
  });
});
