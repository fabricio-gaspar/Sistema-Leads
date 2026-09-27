import { describe, expect, it } from 'vitest';
import { canonicalStageKeyFromLabel, commercialTransitionMessages } from './leadStageRepository';

describe('comandos comerciais canônicos', () => {
  it('converte somente os rótulos do pipeline oficial', () => {
    expect(canonicalStageKeyFromLabel('Novo')).toBe('novo');
    expect(canonicalStageKeyFromLabel('Orçamento')).toBe('orcamento');
    expect(canonicalStageKeyFromLabel('Ganho')).toBe('ganho');
    expect(canonicalStageKeyFromLabel('Fechado — Ganho')).toBeNull();
  });

  it('explica bloqueios do servidor sem expor detalhes internos', () => {
    expect(commercialTransitionMessages.rpcMessage(new Error('terminal_stage_cannot_be_reopened')))
      .toContain('estados finais');
    expect(commercialTransitionMessages.rpcMessage(new Error('unexpected backend detail')))
      .toContain('servidor');
  });
});
