import { describe, expect, it } from 'vitest';
import { confirmedUnitPrice } from './proposalPricing';

describe('human-confirmed unit price', () => {
  it('does not interpret missing pricing as a free product', () => { expect(confirmedUnitPrice(0)).toBeNull(); });
  it('accepts an explicit human confirmation of zero', () => { expect(confirmedUnitPrice(0, '0')).toBe(0); });
  it('uses a positive catalog price until explicitly overridden', () => { expect(confirmedUnitPrice(100)).toBe(100); expect(confirmedUnitPrice(100, '85.25')).toBe(85.25); });
  it('rejects blank, negative and non-finite prices', () => { for (const input of ['', '-1', 'Infinity', 'abc']) expect(confirmedUnitPrice(100, input)).toBeNull(); });
});
