import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseConfig } from './supabaseConfig';

const configuration = resolveSupabaseConfig({
  url: import.meta.env.VITE_PUBLIC_SUPABASE_URL as string | undefined,
  publishableKey: import.meta.env.VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined,
  anonKey: import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string | undefined,
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
