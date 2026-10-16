import { describe, expect, it } from 'vitest';
import { importedLeadListHref, indexLeadListMemberships, leadMatchesExactList } from './csvImportNavigation';

describe('CSV import navigation', () => {
  it('opens the exact imported list by immutable list id instead of its display name', () => {
    expect(importedLeadListHref('11111111-1111-4111-8111-111111111111'))
      .toBe('/dashboard/leads?listaId=11111111-1111-4111-8111-111111111111');
    expect(importedLeadListHref('Importação CSV · 15/10/2026')).toBeNull();
  });

  it('keeps multiple list memberships without losing an earlier list name', () => {
    const index = indexLeadListMemberships([
      { id: '11111111-1111-4111-8111-111111111111', leadIds: ['lead-a', 'lead-b'] },
      { id: '22222222-2222-4222-8222-222222222222', leadIds: ['lead-a'] },
    ]);

    expect(leadMatchesExactList(index, 'lead-a', '11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(leadMatchesExactList(index, 'lead-a', '33333333-3333-4333-8333-333333333333')).toBe(false);
    expect(leadMatchesExactList(index, 'lead-b', '22222222-2222-4222-8222-222222222222')).toBe(false);
  });
});
