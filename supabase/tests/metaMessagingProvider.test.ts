import { describe, expect, it, vi } from 'vitest';
import { MetaCoexistenceProvider } from '../functions/_shared/messaging/MetaCoexistenceProvider.ts';

describe('MetaCoexistenceProvider', () => {
  it('builds the official individual text-message request without exposing a token in the URL', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: 'wamid.accepted-1' }] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    const provider = new MetaCoexistenceProvider({
      accessToken: 'synthetic-token', phoneNumberId: '1234567890', graphApiVersion: 'v99.0', fetchImpl: fetchMock,
    });
    await expect(provider.send({ to: '+55 (11) 98888-7777', kind: 'text', text: 'Mensagem sintética', idempotencyKey: 'test-1' }))
      .resolves.toMatchObject({ accepted: true, providerMessageId: 'wamid.accepted-1', provider: 'meta_cloud' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://graph.facebook.com/v99.0/1234567890/messages');
    expect(String(url)).not.toContain('synthetic-token');
    expect((options?.headers as Record<string, string>).Authorization).toBe('Bearer synthetic-token');
    expect(JSON.parse(String(options?.body))).toMatchObject({
      messaging_product: 'whatsapp', recipient_type: 'individual', to: '5511988887777',
      type: 'text', text: { preview_url: false, body: 'Mensagem sintética' },
    });
  });

  it('fails closed for invalid destination and provider rejection', async () => {
    const provider = new MetaCoexistenceProvider({
      accessToken: 'synthetic-token', phoneNumberId: '1234567890', graphApiVersion: 'v99.0',
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ error: { code: 131000 } }), { status: 400 })),
    });
    await expect(provider.send({ to: 'invalid', kind: 'text', text: 'Teste', idempotencyKey: 'test-2' }))
      .rejects.toThrow('meta_recipient_invalid');
    await expect(provider.send({ to: '5511988887777', kind: 'text', text: 'Teste', idempotencyKey: 'test-3' }))
      .rejects.toThrow('meta_send_rejected_131000');
  });
});

