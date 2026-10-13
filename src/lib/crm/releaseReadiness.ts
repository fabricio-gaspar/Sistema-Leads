export type ReadinessGate = 'channel' | 'ai' | 'contact_protection' | 'queue' | 'environment';

export type ReadinessInput = {
  channel: { provider: string; connected: boolean; inboundEnabled: boolean; sendEnabled: boolean; automationEnabled: boolean; killSwitch: boolean };
  ai: { configured: boolean; connected: boolean; lastTestedAt: string | null };
  contactProtection: { enabled: boolean; syncConfirmed: boolean };
  queue: { idempotencyConfirmed: boolean; reconciliationConfirmed: boolean };
  environment: 'sandbox' | 'production';
};

export type ReadinessResult = {
  ready: boolean;
  gates: Record<ReadinessGate, { ok: boolean; detail: string }>;
};

/**
 * Release gate shared by acceptance checks. It is deliberately pure: it does
 * not send WhatsApp messages, change Supabase state, or infer delivery from a
 * provider HTTP response.
 */
export function evaluateReleaseReadiness(input: ReadinessInput): ReadinessResult {
  const gates: ReadinessResult['gates'] = {
    channel: {
      ok: input.channel.provider === 'wa_akg'
        && input.channel.connected
        && input.channel.inboundEnabled
        && input.channel.sendEnabled
        && input.channel.automationEnabled
        && !input.channel.killSwitch,
      detail: 'WA-AKG conectado, liberado para entrada/saída e sem kill switch.',
    },
    ai: {
      ok: input.ai.configured && input.ai.connected && Boolean(input.ai.lastTestedAt),
      detail: 'Provedor da Ana configurado e validado no backend.',
    },
    contact_protection: {
      ok: input.contactProtection.enabled && input.contactProtection.syncConfirmed,
      detail: 'Contatos protegidos sincronizados antes da automação.',
    },
    queue: {
      ok: input.queue.idempotencyConfirmed && input.queue.reconciliationConfirmed,
      detail: 'Fila idempotente e reconciliação de recibos confirmadas.',
    },
    environment: {
      ok: input.environment === 'sandbox' || (input.environment === 'production' && input.queue.reconciliationConfirmed),
      detail: input.environment === 'sandbox' ? 'Execução isolada em sandbox.' : 'Execução real liberada somente com reconciliação.',
    },
  };
  return { ready: Object.values(gates).every((gate) => gate.ok), gates };
}
