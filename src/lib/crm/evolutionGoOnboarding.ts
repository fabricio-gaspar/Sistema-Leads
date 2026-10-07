import type { EvolutionGoChannelStatus } from '@/lib/crm/whatsappAccountsRepository';
import { channelLifecycleBlocked } from './channelLifecycle';

/**
 * A seller can complete the connection ceremony, but a channel only becomes
 * ready for the Central after the account, integration and the inbound/send
 * provider controls have all been confirmed by the backend. Ana automation is
 * deliberately separate: an administrator may pause it while keeping a human
 * seller's conversations available.
 */
export function isEvolutionGoOperational(status: EvolutionGoChannelStatus | null | undefined): boolean {
  return Boolean(
    !channelLifecycleBlocked(status?.lifecycle) && status?.account?.enabled
      && status.account.connectionStatus === 'connected'
      && status.integration?.connected === true
      && status.integration.enabled === true
      && status.integration.paused === false
      && status.controls?.inboundEnabled === true
      && status.controls.sendEnabled === true
      && status.controls.killSwitch === false,
  );
}

export function isEvolutionGoAutomationReady(status: EvolutionGoChannelStatus | null | undefined): boolean {
  return isEvolutionGoOperational(status) && status?.controls?.automationEnabled === true;
}

/**
 * Pairing and operational authorization are different states. The dashboard
 * should open the private connection screen only for the authenticated
 * seller's connectable account when its physical WhatsApp session is not
 * connected. Administrative gates may remain deliberately disabled after a
 * successful scan and must not trigger another pairing redirect.
 */
export function evolutionGoSellerNeedsPairing(status: EvolutionGoChannelStatus | null | undefined): boolean {
  return Boolean(
    status?.account?.accountType === 'seller'
      && status.canConnect
      && status.account.connectionStatus !== 'connected',
  );
}

export function evolutionGoOnboardingSessionKey(userId: string): string {
  return `wayflex.evolution-go-onboarding:${userId}`;
}
