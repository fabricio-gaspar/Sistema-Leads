import { describe, expect, it } from 'vitest';
import { parseEvolutionGoEvent, sanitizeEvolutionGoPayload } from '../functions/_shared/evolutionGoInbound.ts';

const inbound = {
  event: 'Message',
  data: {
    key: { id: 'EVO-INBOUND-1', remoteJid: '5511999990000@s.whatsapp.net', fromMe: false },
    messageTimestamp: 1_772_494_009,
    message: { conversation: 'Preciso de uma peça de borracha.' },
  },
};

describe('Evolution GO inbound parser', () => {
  it('accepts only a direct inbound message with a stable message id', () => {
    expect(parseEvolutionGoEvent(inbound)).toMatchObject({
      kind: 'inbound', messageId: 'EVO-INBOUND-1', phone: '5511999990000', text: 'Preciso de uma peça de borracha.',
    });
  });

  it.each([
    { data: { ...inbound.data, key: { ...inbound.data.key, fromMe: true } } },
    { data: { ...inbound.data, key: { ...inbound.data.key, remoteJid: 'group@g.us' } } },
    { data: { ...inbound.data, key: { ...inbound.data.key, remoteJid: '5511999990000@lid' } } },
    { data: { ...inbound.data, key: { ...inbound.data.key, id: '' } } },
    { event: 'Presence', data: {} },
  ])('never routes an unsafe or unsupported callback into a lead %#', (patch) => {
    expect(parseEvolutionGoEvent({ ...inbound, ...patch }).kind).toBe('ignored');
  });

  it('keeps delivery receipts and connection events out of the conversation flow', () => {
    expect(parseEvolutionGoEvent({ event: 'Receipt', data: { key: { id: 'provider-1' }, status: 'READ' } }))
      .toMatchObject({ kind: 'receipt', providerMessageIds: ['provider-1'], status: 'read' });
    expect(parseEvolutionGoEvent({ event: 'Disconnected', data: {} })).toMatchObject({ kind: 'connection', state: 'disconnected' });
  });

  it('marks incoming media for review and removes secrets or QR material from persisted diagnostics', () => {
    expect(parseEvolutionGoEvent({
      ...inbound, data: { ...inbound.data, message: { imageMessage: { caption: '', jpegThumbnail: 'base64-not-stored' } } },
    })).toMatchObject({ kind: 'inbound', mediaKind: 'image', text: expect.stringContaining('Revisão humana') });
    expect(sanitizeEvolutionGoPayload({ ...inbound, token: 'secret', qrcode: 'base64-secret', data: { ...inbound.data, apiKey: 'secret' } }))
      .toEqual(expect.not.objectContaining({ token: expect.anything(), qrcode: expect.anything(), apiKey: expect.anything() }));
  });
});
