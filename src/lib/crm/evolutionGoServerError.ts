/** A published Edge revision without the server actions rejects before any provider call. */
export function evolutionGoServerActionsAvailable(integration: {
  serverConfigured?: boolean;
  serverValidation?: unknown;
} | null | undefined): boolean {
  return typeof integration?.serverConfigured === 'boolean' && integration.serverValidation !== undefined;
}

export function evolutionGoServerUnsupportedActionCopy(error: unknown, action: 'save' | 'test'): string | null {
  if (!(error instanceof Error) || error.message !== 'unsupported_action') return null;
  return action === 'save'
    ? 'A função Evolution GO publicada ainda não reconhece “Salvar servidor”. A configuração não foi gravada por esta tentativa; não repita o envio da chave. É necessário atualizar a Edge Function antes de prosseguir.'
    : 'A função Evolution GO publicada ainda não reconhece “Testar conexão”. O servidor externo não foi consultado por esta tentativa. É necessário atualizar a Edge Function antes de prosseguir.';
}
