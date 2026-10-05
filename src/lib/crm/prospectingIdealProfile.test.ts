import { describe, expect, it } from 'vitest';
import {
  PROSPECTING_CUSTOMER_SEGMENTS,
  PROSPECTING_TARGET_PROFILES,
  termsFromIdealProfile,
} from './prospectingIdealProfile';

describe('ideal profile terms', () => {
  it('uses Wayflex catalogue suggestions and selected customer segments without a provider call', () => {
    expect(termsFromIdealProfile('Soluções em borracha e silicone', 'potential_customers', ['Mineração']))
      .toEqual(expect.arrayContaining(['artefatos de borracha', 'perfis de silicone', 'Mineração']));
  });

  it('adds a target-company term only when that target is not potential customers', () => {
    expect(termsFromIdealProfile('', 'distributors', [])).toEqual(['distribuidores industriais']);
    expect(termsFromIdealProfile('', 'potential_customers', [])).toEqual([]);
  });

  it('keeps the visible profiles and segments unique', () => {
    expect(new Set(PROSPECTING_TARGET_PROFILES.map((item) => item.id)).size).toBe(PROSPECTING_TARGET_PROFILES.length);
    expect(new Set(PROSPECTING_CUSTOMER_SEGMENTS).size).toBe(PROSPECTING_CUSTOMER_SEGMENTS.length);
  });
});
