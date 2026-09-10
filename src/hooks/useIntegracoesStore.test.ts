import { describe, expect, it } from 'vitest';
import { integrationDisplayStatus } from './useIntegracoesStore';

describe('integrationDisplayStatus', () => {
  it('só apresenta a integração como ativa quando conexão e uso operacional estão habilitados', () => {
    expect(integrationDisplayStatus({ connected: true, enabled: true, paused: false, last_error: null })).toBe('conectado');
  });

  it('distingue uma conexão validada porém inativa de uma integração não configurada', () => {
    expect(integrationDisplayStatus({ connected: true, enabled: false, paused: false, last_error: null })).toBe('sandbox');
    expect(integrationDisplayStatus({ connected: false, enabled: false, paused: false, last_error: null })).toBe('pendente');
  });

  it('prioriza pausa e erro sobre os sinais de conexão', () => {
    expect(integrationDisplayStatus({ connected: true, enabled: true, paused: true, last_error: null })).toBe('erro');
    expect(integrationDisplayStatus({ connected: true, enabled: true, paused: false, last_error: 'provider_error' })).toBe('erro');
  });
});
