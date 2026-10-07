import { describe, expect, it } from 'vitest';
import {
  evolutionGoOnboardingSessionKey,
  evolutionGoSellerNeedsPairing,
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
  it.each(['pending', 'in_flight', 'needs_review', 'failed'] as const)('never calls a %s lifecycle operational even with open gates', (state) => {
    const pending = status({ lifecycle: { state, revision: 2, desiredAction: 'disconnect', errorCode: null } });
    expect(isEvolutionGoOperational(pending)).toBe(false);
    expect(isEvolutionGoAutomationReady(pending)).toBe(false);
  });
  it('recognizes a fully confirmed private channel as operational', () => {
    expect(isEvolutionGoOperational(status())).toBe(true);
    expect(isEvolutionGoAutomationReady(status())).toBe(true);
    expect(evolutionGoSellerNeedsPairing(status())).toBe(false);
  });

  it('sends only a connectable own seller account that lacks a physical connection to pairing', () => {
    const awaitingQr = status({ account: { ...status().account!, connectionStatus: 'qr' } });
    const disconnected = status({ account: { ...status().account!, connectionStatus: 'disconnected' } });
    const inactive = status({ account: { ...status().account!, enabled: false } });
    const protectedChannel = status({ controls: { ...status().controls!, sendEnabled: false } });

    expect(evolutionGoSellerNeedsPairing(awaitingQr)).toBe(true);
    expect(evolutionGoSellerNeedsPairing(disconnected)).toBe(true);
    expect(evolutionGoSellerNeedsPairing(inactive)).toBe(false);
    expect(evolutionGoSellerNeedsPairing(protectedChannel)).toBe(false);
    expect(isEvolutionGoOperational(inactive)).toBe(false);
    expect(isEvolutionGoOperational(protectedChannel)).toBe(false);
    expect(isEvolutionGoOperational(status({ controls: { ...status().controls!, automationEnabled: false } }))).toBe(true);
    expect(isEvolutionGoAutomationReady(status({ controls: { ...status().controls!, automationEnabled: false } }))).toBe(false);
  });

  it('does not infer seller eligibility from a missing, corporate, or view-only account', () => {
    expect(evolutionGoSellerNeedsPairing(status({ account: null, integration: null, controls: null }))).toBe(false);
    expect(evolutionGoSellerNeedsPairing(status({ account: { ...status().account!, accountType: 'corporate' } }))).toBe(false);
    expect(evolutionGoSellerNeedsPairing(status({ canConnect: false, account: { ...status().account!, connectionStatus: 'qr' } }))).toBe(false);
  });

  it('scopes the onboarding session key to the user', () => {
    expect(evolutionGoOnboardingSessionKey('seller-a')).toBe('wayflex.evolution-go-onboarding:seller-a');
    expect(evolutionGoOnboardingSessionKey('seller-a')).not.toBe(evolutionGoOnboardingSessionKey('seller-b'));
  });
});
