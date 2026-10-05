import { describe, expect, it, vi } from 'vitest';
import { EvolutionGoProvider, normalizeEvolutionGoBaseUrl } from '../functions/_shared/messaging/EvolutionGoProvider.ts';

const allowedOrigins = ['https://evolution.wayflex.example'];

describe('EvolutionGoProvider', () => {
  it('uses the instance apikey header and a stable provider id without leaking the token in the URL', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { info: { id: 'evo-message-1' } } }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    const provider = new EvolutionGoProvider({
      baseUrl: 'https://evolution.wayflex.example', instanceToken: 'synthetic-instance-token', allowedOrigins, fetchImpl: fetchMock,
    });

    await expect(provider.send({
      to: '+55 (11) 98888-7777', kind: 'text', text: 'Mensagem sintética', idempotencyKey: 'outbox-1',
    })).resolves.toMatchObject({ accepted: true, providerMessageId: 'evo-message-1', provider: 'evolution_go' });

    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://evolution.wayflex.example/send/text');
    expect(String(url)).not.toContain('synthetic-instance-token');
    expect((options?.headers as Record<string, string>).apikey).toBe('synthetic-instance-token');
    expect(JSON.parse(String(options?.body))).toEqual({ number: '5511988887777', text: 'Mensagem sintética', id: 'outbox-1' });
  });

  it.each(['image', 'audio', 'video', 'document'] as const)('sends %s using the documented media endpoint', async (kind) => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { info: { id: `evo-${kind}` } } }), { status: 200 }));
    const provider = new EvolutionGoProvider({
      baseUrl: 'https://evolution.wayflex.example', instanceToken: 'token', allowedOrigins, fetchImpl: fetchMock,
    });
    await provider.send({
      to: '5511988887777', kind, idempotencyKey: `media-${kind}`,
      media: { link: 'https://cdn.wayflex.example/file', caption: 'Arquivo', filename: 'arquivo.pdf' },
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://evolution.wayflex.example/send/media');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      number: '5511988887777', type: kind, url: 'https://cdn.wayflex.example/file', id: `media-${kind}`,
    });
  });

  it('fails closed for an unapproved or unsafe provider URL and never retries a send after a timeout', async () => {
    expect(() => normalizeEvolutionGoBaseUrl('https://evil.example', allowedOrigins)).toThrow('evolution_go_base_url_not_allowed');
    expect(() => normalizeEvolutionGoBaseUrl('http://evolution.wayflex.example', allowedOrigins)).toThrow('evolution_go_base_url_unsafe');
    expect(() => normalizeEvolutionGoBaseUrl('https://127.0.0.1', ['https://127.0.0.1'])).toThrow('evolution_go_base_url_unsafe');

    const fetchMock = vi.fn(async () => { throw new DOMException('timeout', 'TimeoutError'); });
    const provider = new EvolutionGoProvider({
      baseUrl: 'https://evolution.wayflex.example', instanceToken: 'token', allowedOrigins, fetchImpl: fetchMock,
    });
    await expect(provider.send({ to: '5511988887777', kind: 'text', text: 'Teste', idempotencyKey: 'outbox-timeout' }))
      .rejects.toThrow('timeout');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps connection state and supports QR or pair-code flows supplied by the installed provider version', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { connected: true, loggedIn: true, myJid: '5511988887777@s.whatsapp.net', name: 'Comercial' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { qrcode: 'data:image/png;base64,synthetic', code: '123-456' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { pairingCode: 'ABC-123' } }), { status: 200 }));
    const provider = new EvolutionGoProvider({ baseUrl: 'https://evolution.wayflex.example', instanceToken: 'token', allowedOrigins, fetchImpl: fetchMock });
    await expect(provider.status()).resolves.toEqual({ connected: true, loggedIn: true, phone: '5511988887777@s.whatsapp.net', name: 'Comercial', confirmed: true });
    await expect(provider.qr()).resolves.toMatchObject({ qrcode: 'data:image/png;base64,synthetic', pairingCode: '123-456' });
    await expect(provider.pair('5511988887777')).resolves.toBe('ABC-123');
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://evolution.wayflex.example/instance/qr');
  });

  it('reads status and pairing code field casing used by Evolution GO v0.7', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { Connected: true, LoggedIn: true, Name: 'Comercial GO' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { PairingCode: '87654321' } }), { status: 200 }));
    const provider = new EvolutionGoProvider({ baseUrl: 'https://evolution.wayflex.example', instanceToken: 'token', allowedOrigins, fetchImpl: fetchMock });

    await expect(provider.status()).resolves.toEqual({ connected: true, loggedIn: true, phone: undefined, name: 'Comercial GO', confirmed: true });
    await expect(provider.pair('5511988887777')).resolves.toBe('87654321');
  });

  it.each([
    { label: 'absent fields', data: {}, connected: false, loggedIn: false, confirmed: false },
    { label: 'explicitly disconnected', data: { connected: false, loggedIn: false }, connected: false, loggedIn: false, confirmed: true },
    { label: 'incomplete connection', data: { connected: true }, connected: true, loggedIn: false, confirmed: false },
    { label: 'string booleans', data: { connected: 'true', loggedIn: 'true' }, connected: false, loggedIn: false, confirmed: false },
    { label: 'malformed original casing', data: { Connected: true, LoggedIn: 'true' }, connected: true, loggedIn: false, confirmed: false },
  ])('requires explicit boolean evidence for status confirmation: $label', async ({ data, connected, loggedIn, confirmed }) => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data }), { status: 200 }));
    const provider = new EvolutionGoProvider({ baseUrl: 'https://evolution.wayflex.example', instanceToken: 'token', allowedOrigins, fetchImpl: fetchMock });

    await expect(provider.status()).resolves.toEqual({ connected, loggedIn, phone: undefined, name: undefined, confirmed });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://evolution.wayflex.example/instance/status');
    expect(fetchMock.mock.calls[0][1]?.method).toBe('GET');
  });

  it('uses Evolution GO v0.7 event names while connecting and renders the image returned in code', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { qrcode: '2@raw-qr', code: 'data:image/png;base64,synthetic' } }), { status: 200 }));
    const provider = new EvolutionGoProvider({ baseUrl: 'https://evolution.wayflex.example', instanceToken: 'token', allowedOrigins, fetchImpl: fetchMock });

    await provider.connect({ webhookUrl: 'https://crm.wayflex.example/webhook' });
    await expect(provider.qr()).resolves.toMatchObject({ qrcode: 'data:image/png;base64,synthetic' });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      webhookUrl: 'https://crm.wayflex.example/webhook',
      subscribe: ['MESSAGE', 'SEND_MESSAGE', 'READ_RECEIPT', 'CONNECTION', 'QRCODE'],
    });
  });

  it('sends a pairing request with only the phone and accepts the documented data.code response', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { code: '12345678' } }), { status: 200 }));
    const provider = new EvolutionGoProvider({ baseUrl: 'https://evolution.wayflex.example', instanceToken: 'token', allowedOrigins, fetchImpl: fetchMock });

    await expect(provider.pair('+55 (11) 98888-7777')).resolves.toBe('12345678');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ phone: '5511988887777' });
  });
});
