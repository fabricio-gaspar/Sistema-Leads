import { describe, expect, it } from 'vitest';
import { resolveRuntimeSupabaseConfig } from './runtimeSupabaseConfig';

describe('resolveRuntimeSupabaseConfig', () => {
  const buildValues = {
    url: 'https://build.example.supabase.co',
    publishableKey: 'build-publishable-key',
    anonKey: 'build-anon-key',
  };

  it('prefere apenas valores públicos válidos entregues em runtime', () => {
    expect(resolveRuntimeSupabaseConfig({
      VITE_PUBLIC_SUPABASE_URL: 'https://runtime.example.supabase.co',
      VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'runtime-publishable-key',
    }, buildValues)).toEqual({
      url: 'https://runtime.example.supabase.co',
      publishableKey: 'runtime-publishable-key',
      anonKey: 'build-anon-key',
    });
  });

  it('mantém o fallback do build quando o Worker não tiver valor configurado', () => {
    expect(resolveRuntimeSupabaseConfig({
      VITE_PUBLIC_SUPABASE_URL: '   ',
      VITE_PUBLIC_SUPABASE_ANON_KEY: 42,
    }, buildValues)).toEqual(buildValues);
  });
});
