export interface SupabaseConfigInput {
  url?: string;
  publishableKey?: string;
  anonKey?: string;
}

export interface SupabaseConfig {
  url?: string;
  key?: string;
  isConfigured: boolean;
}

const trimEnvironmentValue = (value?: string) => value?.trim() || undefined;

/**
 * Resolve somente dados públicos necessários para o cliente do navegador.
 * A chave publicável é preferida; a anon key é aceita para projetos legados.
 */
export function resolveSupabaseConfig(input: SupabaseConfigInput): SupabaseConfig {
  const url = trimEnvironmentValue(input.url);
  const key = trimEnvironmentValue(input.publishableKey) ?? trimEnvironmentValue(input.anonKey);

  return {
    url,
    key,
    isConfigured: Boolean(url && key),
  };
}
