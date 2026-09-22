import { describe, expect, it } from 'vitest';
import { integrationDisplayStatus } from './useIntegracoesStore';

describe('integrationDisplayStatus', () => {
  const now = new Date('2026-09-22T15:00:00.000Z').getTime();
  const freshValidation = '2026-09-22T14:30:00.000Z';

  it('só apresenta a integração como validada quando conexão, uso operacional e validação recente estão confirmados', () => {
    expect(integrationDisplayStatus({ connected: true, enabled: true, paused: false, lastError: null, lastTestedAt: freshValidation }, now)).toBe('validated');
  });

  it('distingue validação vencida, integração inativa e integração não configurada', () => {
    expect(integrationDisplayStatus({ connected: true, enabled: true, paused: false, lastError: null, lastTestedAt: '2026-09-21T14:59:59.000Z' }, now)).toBe('validation_due');
    expect(integrationDisplayStatus({ connected: true, enabled: false, paused: false, lastError: null, lastTestedAt: freshValidation }, now)).toBe('inactive');
    expect(integrationDisplayStatus({ connected: false, enabled: false, paused: false, lastError: null, lastTestedAt: null }, now)).toBe('not_configured');
  });

  it('prioriza pausa e erro sobre os sinais de conexão', () => {
    expect(integrationDisplayStatus({ connected: true, enabled: true, paused: true, lastError: null, lastTestedAt: freshValidation }, now)).toBe('paused');
    expect(integrationDisplayStatus({ connected: true, enabled: true, paused: false, lastError: 'provider_error', lastTestedAt: freshValidation }, now)).toBe('error');
  });

  it('não apresenta o webhook da Z-API como erro de credencial quando o callback chegou sem lead correspondente', () => {
    expect(integrationDisplayStatus({ key: 'zapi_webhook', connected: false, enabled: true, paused: false, lastError: 'lead_not_matched', lastTestedAt: freshValidation }, now)).toBe('pending');
  });
});
