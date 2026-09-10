export interface PublicSupabaseConfigValues {
  url?: string;
  publishableKey?: string;
  anonKey?: string;
}

type RuntimeValues = Record<string, unknown>;

function textValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/**
 * Prefere a configuração pública entregue pelo Worker do Site. O fallback do
 * Vite mantém desenvolvimento local e outros hosts estáticos compatíveis.
 */
export function resolveRuntimeSupabaseConfig(
  runtime: unknown,
  buildValues: PublicSupabaseConfigValues,
): PublicSupabaseConfigValues {
  const values = runtime && typeof runtime === 'object' ? runtime as RuntimeValues : {};

  return {
    url: textValue(values.VITE_PUBLIC_SUPABASE_URL) ?? buildValues.url,
    publishableKey: textValue(values.VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ?? buildValues.publishableKey,
    anonKey: textValue(values.VITE_PUBLIC_SUPABASE_ANON_KEY) ?? buildValues.anonKey,
  };
}

export function readRuntimeSupabaseConfig(): PublicSupabaseConfigValues {
  const runtime = typeof window === 'undefined'
    ? undefined
    : (window as Window & { __WAYFLEX_RUNTIME_CONFIG__?: RuntimeValues }).__WAYFLEX_RUNTIME_CONFIG__;

  return resolveRuntimeSupabaseConfig(runtime, {
    url: import.meta.env.VITE_PUBLIC_SUPABASE_URL as string | undefined,
    publishableKey: import.meta.env.VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined,
    anonKey: import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string | undefined,
  });
}
