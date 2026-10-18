import { describe, expect, it } from 'vitest';
import { normalizeBrazilianState } from '../functions/_shared/prospectingState.ts';

describe('Brazilian state normalization for lead prospecting', () => {
  it('normalizes the chosen state without truncating full state names', () => {
    expect(normalizeBrazilianState('SP')).toBe('SP');
    expect(normalizeBrazilianState('São Paulo')).toBe('SP');
    expect(normalizeBrazilianState('rio-de-janeiro')).toBe('RJ');
    expect(normalizeBrazilianState('not a state')).toBe('');
  });
});
