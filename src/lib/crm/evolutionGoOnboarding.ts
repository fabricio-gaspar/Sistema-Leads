import type { EvolutionGoChannelStatus } from '@/lib/crm/whatsappAccountsRepository';

/**
 * A seller can complete the connection ceremony, but a channel only becomes
 * ready for the Central after the account, integration and the inbound/send
 * provider controls have all been confirmed by the backend. Ana automation is
 * deliberately separate: an administrator may pause it while keeping a human
 * seller's conversations available.
 */
export function isEvolutionGoOperational(status: EvolutionGoChannelStatus | null | undefined): boolean {
  return Boolean(
    status?.account?.enabled
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
 * Sellers are directed to their private connection screen on the first
 * dashboard visit of a browser session whenever the server has not yet
 * confirmed an operational private channel. A missing account is treated as
 * provisioning pending, not as a successful connection.
 */
export function evolutionGoSellerNeedsOnboarding(status: EvolutionGoChannelStatus | null | undefined): boolean {
  return !isEvolutionGoOperational(status);
}

export function evolutionGoOnboardingSessionKey(userId: string): string {
  return `wayflex.evolution-go-onboarding:${userId}`;
}
