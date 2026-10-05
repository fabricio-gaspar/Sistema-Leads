import { describe, expect, it } from 'vitest';
import type { WaAkgChannelStatus } from '@/lib/crm/whatsappAccountsRepository';
import { isWaAkgOperational, waAkgOnboardingSessionKey, waAkgSellerNeedsOnboarding } from './waAkgOnboarding';

const status = (overrides: Partial<WaAkgChannelStatus> = {}): WaAkgChannelStatus => ({
  configured: true,
  canManage: false,
  canConnect: true,
  canViewQr: true,
  account: { id: 'seller-a', label: 'Vendedor', accountType: 'seller', ownerUserId: 'seller-a', enabled: true, isDefault: true, connectionStatus: 'connected', phoneSuffix: '1234', connectedAt: null, checkedAt: null, webhookRegisteredAt: null, errorCode: null, messagingMode: 'assisted' },
  integration: { id: 'integration-a', connected: true, enabled: true, paused: false, statusDetail: null, lastTestedAt: null, lastSuccessAt: null, baseUrlConfigured: true, sessionName: 'seller-a', version: null },
  controls: { inboundEnabled: true, sendEnabled: true, automationEnabled: false, killSwitch: false, reason: null, minDelaySeconds: 10, maxDelaySeconds: 30, burstLimit: 3, burstWindowSeconds: 60, dailyLimit: 100 },
  ...overrides,
});

describe('WA-AKG seller onboarding', () => {
  it.each(['pending', 'in_flight', 'needs_review', 'failed'] as const)('never calls a %s lifecycle operational even with open gates', (state) => {
    expect(isWaAkgOperational(status({ lifecycle: { state, revision: 2, desiredAction: 'disconnect', errorCode: null } }))).toBe(false);
  });
  it('requires the Central connection surface until the private channel is server-confirmed', () => {
    expect(isWaAkgOperational(status())).toBe(true);
    expect(waAkgSellerNeedsOnboarding(status())).toBe(false);
    expect(waAkgSellerNeedsOnboarding(status({ account: null }))).toBe(true);
    expect(waAkgSellerNeedsOnboarding(status({ controls: { ...status().controls!, sendEnabled: false } }))).toBe(true);
  });

  it('keeps the once-per-session onboarding marker scoped to each seller', () => {
    expect(waAkgOnboardingSessionKey('seller-a')).toBe('wayflex.wa-akg-onboarding:seller-a');
    expect(waAkgOnboardingSessionKey('seller-a')).not.toBe(waAkgOnboardingSessionKey('seller-b'));
  });
});
