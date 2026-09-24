import { describe, expect, it } from 'vitest';
import { verifyMetaSignature } from '../functions/_shared/messaging/metaSignature.ts';

async function signature(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const result = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)));
  return `sha256=${[...result].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

describe('Meta webhook signature', () => {
  it('accepts only the exact raw body signed with the app secret', async () => {
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const header = await signature(body, 'synthetic-app-secret');
    await expect(verifyMetaSignature(body, header, 'synthetic-app-secret')).resolves.toBe(true);
    await expect(verifyMetaSignature(`${body} `, header, 'synthetic-app-secret')).resolves.toBe(false);
    await expect(verifyMetaSignature(body, header, 'different-secret')).resolves.toBe(false);
  });

  it('rejects absent and malformed headers before processing', async () => {
    await expect(verifyMetaSignature('{}', null, 'secret')).resolves.toBe(false);
    await expect(verifyMetaSignature('{}', 'sha1=abc', 'secret')).resolves.toBe(false);
    await expect(verifyMetaSignature('{}', 'sha256=not-hex', 'secret')).resolves.toBe(false);
  });
});

