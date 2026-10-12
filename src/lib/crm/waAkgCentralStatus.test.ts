import { describe, expect, it } from 'vitest';
import type { WaAkgChannelStatus } from './whatsappAccountsRepository';
import { centralChannelState } from './waAkgCentralStatus';

function connectedStatus(overrides: Partial<WaAkgChannelStatus> = {}): WaAkgChannelStatus {
  return {
    configured: true,
    canManage: false,
    canConnect: true,
    canViewQr: true,
    account: {
      id: 'seller-1',
      label: 'WhatsApp do vendedor',
      accountType: 'seller',
      ownerUserId: 'user-1',
      enabled: true,
      isDefault: false,
      connectionStatus: 'connected',
      phoneSuffix: '9876',
      connectedAt: null,
      checkedAt: null,
      webhookRegisteredAt: null,
      errorCode: null,
      messagingMode: 'assisted',
    },
    integration: {
      id: 'integration-1',
      connected: true,
      enabled: true,
      paused: false,
      statusDetail: null,
      lastTestedAt: null,
      lastSuccessAt: null,
      baseUrlConfigured: true,
      sessionName: 'seller-1',
      version: '1',
    },
    controls: {
      inboundEnabled: true,
      sendEnabled: true,
      automationEnabled: true,
      killSwitch: false,
      reason: null,
      minDelaySeconds: 10,
      maxDelaySeconds: 30,
      burstLimit: 5,
      burstWindowSeconds: 60,
      dailyLimit: 50,
    },
    ...overrides,
  };
}

describe('centralChannelState', () => {
  it('only reports a channel as released when every traffic gate is operational', () => {
    expect(centralChannelState(connectedStatus(), false)).toEqual({ label: 'Liberado', tone: 'ok' });
  });

  it('does not present a connected account as available when outbound sending is paused', () => {
    const status = connectedStatus({ controls: { ...connectedStatus().controls!, sendEnabled: false } });

    expect(centralChannelState(status, false)).toEqual({ label: 'Envio pausado', tone: 'warning' });
  });
});
