import { describe, expect, it } from 'vitest';
import { apifyErrorCode } from '../functions/_shared/apifyErrors.ts';

describe('classificação segura de erros do cliente Apify', () => {
  it.each([
    [401, 'apify_token_rejected'],
    [403, 'apify_resource_forbidden'],
    [404, 'apify_actor_not_found'],
    [429, 'apify_rate_limited'],
  ])('mapeia status %s sem expor a resposta do provedor', (statusCode, expected) => {
    expect(apifyErrorCode({ statusCode })).toBe(expected);
  });

  it('distingue timeout de falha genérica', () => {
    expect(apifyErrorCode(new Error('request timed out'))).toBe('provider_timeout');
    expect(apifyErrorCode(new Error('upstream unavailable'))).toBe('apify_provider_error');
  });
});
