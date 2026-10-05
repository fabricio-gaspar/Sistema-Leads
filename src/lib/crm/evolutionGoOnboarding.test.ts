import { describe, expect, it } from 'vitest';
import {
  evolutionGoOnboardingSessionKey,
  evolutionGoSellerNeedsOnboarding,
  isEvolutionGoAutomationReady,
  isEvolutionGoOperational,
} from './evolutionGoOnboarding';
import type { EvolutionGoChannelStatus } from './whatsappAccountsRepository';

function status(overrides: Partial<EvolutionGoChannelStatus> = {}): EvolutionGoChannelStatus {
  return {
    configured: true,
    canManage: false,
    canConnect: true,
    canViewQr: true,
    account: {
      id: 'account-1',
      label: 'WhatsApp da vendedora',
      accountType: 'seller',
      ownerUserId: 'seller-1',
      enabled: true,
      isDefault: false,
      connectionStatus: 'connected',
      phoneSuffix: '1234',
      connectedAt: '2026-10-04T12:00:00Z',
      checkedAt: '2026-10-04T12:00:00Z',
      webhookRegisteredAt: null,
      errorCode: null,
    },
    integration: {
      id: 'integration-1',
      connected: true,
      enabled: true,
      paused: false,
      statusDetail: null,
      lastTestedAt: '2026-10-04T12:00:00Z',
      lastSuccessAt: '2026-10-04T12:00:00Z',
      lastError: null,
      baseUrlConfigured: true,
      instanceName: 'seller-1',
      version: '2',
    },
    controls: {
      inboundEnabled: true,
      sendEnabled: true,
      automationEnabled: true,
      killSwitch: false,
      reason: null,
    },
    ...overrides,
  };
}

describe('Evolution GO seller onboarding', () => {
  it('recognizes a fully confirmed private channel as operational', () => {
    expect(isEvolutionGoOperational(status())).toBe(true);
    expect(isEvolutionGoAutomationReady(status())).toBe(true);
    expect(evolutionGoSellerNeedsOnboarding(status())).toBe(false);
  });

  it('keeps QR, inactive and globally protected channels in onboarding', () => {
    const awaitingQr = status({ account: { ...status().account!, connectionStatus: 'qr' } });
    const inactive = status({ account: { ...status().account!, enabled: false } });
    const protectedChannel = status({ controls: { ...status().controls!, sendEnabled: false } });

    expect(evolutionGoSellerNeedsOnboarding(awaitingQr)).toBe(true);
    expect(evolutionGoSellerNeedsOnboarding(inactive)).toBe(true);
    expect(evolutionGoSellerNeedsOnboarding(protectedChannel)).toBe(true);
    expect(isEvolutionGoOperational(status({ controls: { ...status().controls!, automationEnabled: false } }))).toBe(true);
    expect(isEvolutionGoAutomationReady(status({ controls: { ...status().controls!, automationEnabled: false } }))).toBe(false);
  });

  it('treats a still-provisioning account as onboarding pending and scopes its session key to the user', () => {
    expect(evolutionGoSellerNeedsOnboarding(status({ account: null, integration: null, controls: null }))).toBe(true);
    expect(evolutionGoOnboardingSessionKey('seller-a')).toBe('wayflex.evolution-go-onboarding:seller-a');
    expect(evolutionGoOnboardingSessionKey('seller-a')).not.toBe(evolutionGoOnboardingSessionKey('seller-b'));
  });
});
