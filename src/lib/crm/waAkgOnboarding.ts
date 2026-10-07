import type { WaAkgChannelStatus } from '@/lib/crm/whatsappAccountsRepository';
import { channelLifecycleBlocked } from './channelLifecycle';

/**
 * A seller may complete their own QR ceremony, but the Central is only ready
 * for WhatsApp traffic once the server has confirmed its private WA-AKG
 * session and the inbound/outbound controls. Ana automation remains a
 * separate company-level decision.
 */
export function isWaAkgOperational(status: WaAkgChannelStatus | null | undefined): boolean {
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

/** A missing account is provisioning pending, never a successful connection. */
export function waAkgSellerNeedsOnboarding(status: WaAkgChannelStatus | null | undefined): boolean {
  return !isWaAkgOperational(status);
}

export function waAkgOnboardingSessionKey(userId: string): string {
  return `wayflex.wa-akg-onboarding:${userId}`;
}
