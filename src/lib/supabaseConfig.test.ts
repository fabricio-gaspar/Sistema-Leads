import { describe, expect, it } from 'vitest';
import { resolveSupabaseConfig } from './supabaseConfig';

describe('resolveSupabaseConfig', () => {
  it('indica configuração pendente sem URL ou chave pública', () => {
    expect(resolveSupabaseConfig({})).toEqual({
      url: undefined,
      key: undefined,
      isConfigured: false,
    });

    expect(resolveSupabaseConfig({ url: 'https://example.supabase.co' }).isConfigured).toBe(false);
  });

  it('prioriza a chave publicável e mantém compatibilidade com anon key', () => {
    expect(
      resolveSupabaseConfig({
        url: ' https://example.supabase.co ',
        publishableKey: ' sb_publishable_key ',
        anonKey: ' legacy-anon-key ',
      }),
    ).toEqual({
      url: 'https://example.supabase.co',
      key: 'sb_publishable_key',
      isConfigured: true,
    });

    expect(
      resolveSupabaseConfig({
        url: 'https://example.supabase.co',
        anonKey: 'legacy-anon-key',
      }),
    ).toMatchObject({ isConfigured: true, key: 'legacy-anon-key' });
  });
});
