import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_API_KEYS,
  DASHBOARD_CHANNEL_KEYS,
  DASHBOARD_SOURCE_KEYS,
  integrationStatusDetail,
  presentIntegrationStatus,
  presentSourceStatus,
} from './operationalStatusPresentation';

describe('operational status presentation', () => {
  it('preserva o diagnóstico de callback sem lead como entrada pendente', () => {
    expect(presentIntegrationStatus({
      key: 'zapi_webhook',
      connected: false,
      enabled: true,
      paused: false,
      lastError: 'lead_not_matched',
      lastTestedAt: null,
    })).toMatchObject({ status: 'pending', label: 'Entrada pendente', tone: 'attention' });
  });

  it('separa fonte ativa, fonte pausada e fonte com falha', () => {
    expect(presentSourceStatus({ enabled: true, connectionStatus: 'connected', lastError: null })).toMatchObject({ status: 'active', label: 'Ativa' });
    expect(presentSourceStatus({ enabled: false, connectionStatus: 'connected', lastError: null })).toMatchObject({ status: 'paused', label: 'Pausada' });
    expect(presentSourceStatus({ enabled: true, connectionStatus: 'connected', lastError: 'apify_http_400' })).toMatchObject({ status: 'error', label: 'Falha na fonte' });
  });

  it('não deixa um detalhe histórico de sucesso contradizer uma validação vencida', () => {
    const stale = {
      key: 'whatsapp',
      connected: true,
      enabled: true,
      paused: false,
      lastError: null,
      lastTestedAt: '2026-09-18T10:41:30.000Z',
    };
    expect(integrationStatusDetail(stale, 'Conexão Z-API validada.', new Date('2026-09-22T12:00:00.000Z').getTime()))
      .toContain('validação venceu');
  });

  it('mostra no Dashboard somente os caminhos que existem no CRM atual', () => {
    expect(DASHBOARD_CHANNEL_KEYS).toEqual(['whatsapp_evolution_go:', 'whatsapp_meta']);
    expect(DASHBOARD_API_KEYS).toEqual(['ai', 'apify', 'google_places']);
    expect(DASHBOARD_SOURCE_KEYS).toEqual(['apify', 'manual', 'csv']);
  });
});
