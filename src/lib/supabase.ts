import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseConfig } from './supabaseConfig';
import { readRuntimeSupabaseConfig } from './runtimeSupabaseConfig';

const runtimeConfig = readRuntimeSupabaseConfig();
const configuration = resolveSupabaseConfig({
  url: runtimeConfig.url,
  publishableKey: runtimeConfig.publishableKey,
  anonKey: runtimeConfig.anonKey,
});

export const isSupabaseConfigured = configuration.isConfigured;

// Cliente único do Backend. Em ambiente ainda não conectado, o placeholder
// impede uma interrupção antes do React renderizar a tela de configuração.
// Ele não é usado enquanto isSupabaseConfigured for falso.
export const supabase = createClient(
  configuration.url ?? 'https://supabase-not-configured.invalid',
  configuration.key ?? 'not-configured',
  {
    auth: {
      autoRefreshToken: isSupabaseConfigured,
      persistSession: isSupabaseConfigured,
      detectSessionInUrl: isSupabaseConfigured,
    },
  },
);
