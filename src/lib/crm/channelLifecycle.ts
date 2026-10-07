export interface ChannelLifecycle {
  state: 'idle' | 'completed' | 'pending' | 'in_flight' | 'needs_review' | 'failed';
  revision: number;
  desiredAction: string | null;
  errorCode: string | null;
}

export function channelLifecycleBlocked(lifecycle: ChannelLifecycle | null | undefined): boolean {
  return Boolean(lifecycle && lifecycle.state !== 'idle' && lifecycle.state !== 'completed');
}

export function channelLifecycleMessage(lifecycle: ChannelLifecycle | null | undefined): string | null {
  if (!channelLifecycleBlocked(lifecycle)) return null;
  if (lifecycle?.state === 'pending' || lifecycle?.state === 'in_flight') {
    return 'Operação pendente. Atualize a lista para consultar o resultado; nenhum novo envio foi autorizado.';
  }
  return 'A conta precisa de revisão administrativa. Não repita a conexão sem conferir o resultado no provedor.';
}

/** An HTTP 202 acknowledgement is not a completed connection or a fresh QR. */
export function assertChannelActionCompleted(action: unknown, lifecycle: ChannelLifecycle | null | undefined): void {
  if (action === 'list' || action === 'status' || action === 'my_account') return;
  if (!channelLifecycleBlocked(lifecycle)) return;
  throw new Error(lifecycle?.state === 'pending' || lifecycle?.state === 'in_flight'
    ? 'account_lifecycle_pending' : 'account_lifecycle_needs_review');
}

/** A failed/unknown response may follow a committed cutoff. Reload, never retry. */
export async function refreshAfterLifecycleError(error: unknown, refresh: () => Promise<void>): Promise<void> {
  const preflightDenials = ['permission_denied', 'organization_access_denied', 'origin_not_allowed', 'unsupported_action'];
  if (error instanceof Error && preflightDenials.includes(error.message)) return;
  await refresh();
}
