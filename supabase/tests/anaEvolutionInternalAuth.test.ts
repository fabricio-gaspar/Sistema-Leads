import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../functions/_shared/auth.ts', () => ({
  createAdminClient: () => ({}),
  requireOrganizationRole: async () => undefined,
  requireUser: async () => ({ user: { id: 'synthetic-user' } }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('Deno', {
    env: { get: () => undefined },
    serve: () => undefined,
  });
});

describe('Ana internal Evolution GO authentication', () => {
  it('accepts the account-scoped Evolution GO webhook secret', async () => {
    const { matchesIntegrationWebhookSecret } = await import('../functions/ana-run/index');
    expect(matchesIntegrationWebhookSecret(
      'synthetic-evolution-webhook-secret',
      'whatsapp_evolution_go:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      { webhook_secret: 'synthetic-evolution-webhook-secret' },
    )).toBe(true);
  });

  it('accepts the account-scoped WA-AKG webhook secret', async () => {
    const { matchesIntegrationWebhookSecret } = await import('../functions/ana-run/index');
    expect(matchesIntegrationWebhookSecret(
      'synthetic-wa-akg-webhook-secret',
      'whatsapp_wa_akg:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      { webhook_secret: 'synthetic-wa-akg-webhook-secret' },
    )).toBe(true);
  });

  it('keeps the legacy webhook token and rejects Evolution secret reuse elsewhere', async () => {
    const { matchesIntegrationWebhookSecret } = await import('../functions/ana-run/index');
    expect(matchesIntegrationWebhookSecret(
      'synthetic-legacy-webhook-token',
      'whatsapp',
      { webhook_token: 'synthetic-legacy-webhook-token' },
    )).toBe(true);
    expect(matchesIntegrationWebhookSecret(
      'synthetic-evolution-webhook-secret',
      'whatsapp',
      { webhook_secret: 'synthetic-evolution-webhook-secret' },
    )).toBe(false);
    expect(matchesIntegrationWebhookSecret(
      'different-secret',
      'whatsapp_evolution_go:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      { webhook_secret: 'synthetic-evolution-webhook-secret' },
    )).toBe(false);
  });
});
