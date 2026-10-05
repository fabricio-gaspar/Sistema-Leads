import { describe, expect, it } from 'vitest';
import { normalizeHandoffWhatsappNotification } from '../functions/ana-operations/settings.ts';

describe('Ana operation settings', () => {
  it('stores false, never null, when Ana has no programmed handoff stage', () => {
    expect(normalizeHandoffWhatsappNotification('ana', null, true)).toBe(false);
  });

  it('enables the notice only for an explicit Ana handoff stage and explicit approval', () => {
    expect(normalizeHandoffWhatsappNotification('ana', 'reuniao', true)).toBe(true);
    expect(normalizeHandoffWhatsappNotification('ana', 'reuniao', false)).toBe(false);
    expect(normalizeHandoffWhatsappNotification('human', 'reuniao', true)).toBe(false);
  });
});
