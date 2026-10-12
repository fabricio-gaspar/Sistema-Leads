import { channelLifecycleBlocked } from './channelLifecycle';
import { isWaAkgOperational } from './waAkgOnboarding';
import type { WaAkgChannelStatus } from './whatsappAccountsRepository';

export type CentralChannelState = { label: string; tone: 'ok' | 'warning' | 'neutral' };

/**
 * Keeps the compact Central indicator honest: a connected device alone does
 * not mean that inbound/outbound traffic is released for the seller.
 */
export function centralChannelState(status: WaAkgChannelStatus | null | undefined, unconfirmed: boolean): CentralChannelState {
  if (unconfirmed) return { label: 'Não confirmado', tone: 'warning' };
  if (!status?.account) return { label: 'Não configurado', tone: 'warning' };
  if (channelLifecycleBlocked(status.lifecycle)) return { label: 'Ação pendente', tone: 'warning' };
  if (isWaAkgOperational(status)) return { label: 'Liberado', tone: 'ok' };
  if (status.account.connectionStatus !== 'connected') return { label: 'Conexão pendente', tone: 'warning' };
  if (!status.account.enabled) return { label: 'Canal pausado', tone: 'neutral' };
  if (status.integration?.connected !== true) return { label: 'Gateway pendente', tone: 'warning' };
  if (status.integration.enabled !== true || status.integration.paused) return { label: 'Integração pausada', tone: 'neutral' };
  if (status.controls?.killSwitch) return { label: 'Proteção ativa', tone: 'warning' };
  if (status.controls?.inboundEnabled !== true) return { label: 'Recebimento pausado', tone: 'warning' };
  if (status.controls?.sendEnabled !== true) return { label: 'Envio pausado', tone: 'warning' };
  return { label: 'Revisão necessária', tone: 'warning' };
}
