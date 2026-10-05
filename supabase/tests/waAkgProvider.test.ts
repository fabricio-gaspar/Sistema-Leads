import { describe, expect, it, vi } from 'vitest';
import { WaAkgProvider, normalizeWaAkgBaseUrl } from '../functions/_shared/messaging/WaAkgProvider.ts';

const allowedOrigins = ['https://wa.example.com'];

describe('WaAkgProvider', () => {
  it('rejects unapproved and unsafe server origins', () => {
    expect(() => normalizeWaAkgBaseUrl('http://wa.example.com', allowedOrigins)).toThrow('wa_akg_base_url_unsafe');
    expect(() => normalizeWaAkgBaseUrl('https://127.0.0.1', ['https://127.0.0.1'])).toThrow('wa_akg_base_url_unsafe');
    expect(() => normalizeWaAkgBaseUrl('https://other.example.com', allowedOrigins)).toThrow('wa_akg_base_url_not_allowed');
  });

  it('sends text through the scoped session without exposing the key in the URL', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { key: { id: 'msg-1' } } }), { status: 200 }));
    const provider = new WaAkgProvider({
      baseUrl: 'https://wa.example.com', apiKey: 'secret', sessionId: 'seller_12345678', allowedOrigins, fetchImpl: fetchMock,
    });
    await expect(provider.send({ to: '5511999999999', kind: 'text', text: 'Olá', idempotencyKey: 'job-1' }))
      .resolves.toMatchObject({ provider: 'wa_akg', providerMessageId: 'msg-1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://wa.example.com/api/messages/seller_12345678/5511999999999%40s.whatsapp.net/send');
    expect(init.headers).toMatchObject({ 'X-API-Key': 'secret' });
    expect(String(url)).not.toContain('secret');
    expect(JSON.parse(String(init.body))).toEqual({ message: { text: 'Olá' } });
  });

  it('configures WA-AKG built-in automation off and bounded pacing on', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    const provider = new WaAkgProvider({
      baseUrl: 'https://wa.example.com', apiKey: 'secret', sessionId: 'seller_12345678', allowedOrigins, fetchImpl: fetchMock,
    });
    await provider.configureSafety();
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toMatchObject({ enabled: false, antiSpamEnabled: true, spamDelayMin: 10_000, spamDelayMax: 30_000 });
  });

  it('normalizes a QR image and pairing request', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, base64: 'iVBORw0KGgoAAA' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { pairingCode: '1234-5678' } }), { status: 200 }));
    const provider = new WaAkgProvider({
      baseUrl: 'https://wa.example.com', apiKey: 'secret', sessionId: 'seller_12345678', allowedOrigins, fetchImpl: fetchMock,
    });
    await expect(provider.qr()).resolves.toEqual({ qrcode: 'data:image/png;base64,iVBORw0KGgoAAA' });
    await expect(provider.pair('55 (11) 99999-9999')).resolves.toBe('1234-5678');
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).toEqual({ phoneNumber: '5511999999999' });
  });
});
