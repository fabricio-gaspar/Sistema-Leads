import { afterEach, describe, expect, it, vi } from 'vitest';

const productionOrigin = 'https://leadai-crm-preview.fabricio926564.chatgpt.site';
const localOrigin = 'http://127.0.0.1:4173';

function stubEnv(values: Record<string, string | undefined> = {}) {
  vi.stubGlobal('Deno', { env: { get: (name: string) => values[name] } });
}

afterEach(() => vi.unstubAllGlobals());

describe('CORS das Edge Functions', () => {
  it('permite o painel publicado e a homologação local sem usar wildcard', async () => {
    stubEnv();
    const { allowedCorsHeaders, hasAllowedOrigin, preflight } = await import('../functions/_shared/http.ts');

    for (const origin of [productionOrigin, localOrigin]) {
      const request = new Request('https://example.invalid/function', {
        method: 'OPTIONS',
        headers: { Origin: origin },
      });
      expect(hasAllowedOrigin(request)).toBe(true);
      expect(allowedCorsHeaders(request)['Access-Control-Allow-Origin']).toBe(origin);
      expect(preflight(request)?.status).toBe(204);
    }
  });

  it('respeita uma lista explícita de origens e recusa origens fora dela', async () => {
    stubEnv({ ALLOWED_ORIGINS: `${productionOrigin}, https://crm.example.com` });
    const { hasAllowedOrigin, preflight } = await import('../functions/_shared/http.ts');

    const localRequest = new Request('https://example.invalid/function', {
      method: 'OPTIONS',
      headers: { Origin: localOrigin },
    });
    const allowedRequest = new Request('https://example.invalid/function', {
      method: 'OPTIONS',
      headers: { Origin: 'https://crm.example.com' },
    });

    expect(hasAllowedOrigin(localRequest)).toBe(false);
    expect(preflight(localRequest)?.status).toBe(403);
    expect(hasAllowedOrigin(allowedRequest)).toBe(true);
  });
});
