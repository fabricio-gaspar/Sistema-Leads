import { describe, expect, it } from 'vitest';
import { proposalForSale } from '@/lib/reporting';

describe('proposalForSale', () => {
  it('joins an operational sale to its proposal by commercial number, not UUID', () => {
    const proposal = {
      id: '11111111-1111-4111-8111-111111111111',
      numero: 'PRP-20260826-ABC123',
    } as Parameters<typeof proposalForSale>[0][number];
    expect(proposalForSale([proposal], { proposta: 'PRP-20260826-ABC123' })).toBe(proposal);
  });
});
