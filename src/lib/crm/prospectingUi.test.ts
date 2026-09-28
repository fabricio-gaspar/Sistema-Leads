import { describe, expect, it } from 'vitest';
import {
  MAX_PROSPECTING_TERMS,
  csvLeadIdentity,
  deterministicProspectingUuid,
  filterProspectingReview,
  normalizeProspectingTerms,
  prepareCsvLeads,
  prospectingVolumePerTerm,
} from '@/lib/crm/prospectingUi';
import {
  PROSPECTING_TERM_SUGGESTION_GROUPS,
  findProspectingTermSuggestions,
} from '@/lib/crm/prospectingTermSuggestions';

describe('prospecting UI safeguards', () => {
  it('derives a stable UUID without persisting CSV data in the browser', async () => {
    const first = await deterministicProspectingUuid('org-a:canonical-csv');
    const replay = await deterministicProspectingUuid('org-a:canonical-csv');
    const other = await deterministicProspectingUuid('org-b:canonical-csv');

    expect(first).toBe(replay);
    expect(first).not.toBe(other);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('deduplicates terms, preserves their first spelling, and applies the server limit', () => {
    const terms = normalizeProspectingTerms([
      ' Indústria ', 'industria', 'Construção civil', 'Construção   Civil',
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i',
    ]);

    expect(terms).toEqual(['Indústria', 'Construção civil', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(terms).toHaveLength(MAX_PROSPECTING_TERMS);
  });

  it('shows the same conservative volume division used by Apify input', () => {
    expect(prospectingVolumePerTerm(30, 3)).toBe(10);
    expect(prospectingVolumePerTerm(2, 3)).toBe(1);
    expect(prospectingVolumePerTerm(30, 0)).toBe(0);
  });

  it('suggests Wayflex search terms from a typed company segment', () => {
    expect(findProspectingTermSuggestions('borracha').map((group) => group.id)).toEqual(['borracha']);
    expect(findProspectingTermSuggestions('Silicone, PU').map((group) => group.id)).toEqual(['silicone', 'poliuretano']);
    expect(findProspectingTermSuggestions('vedações').map((group) => group.id)).toEqual(['vedacao']);
    expect(findProspectingTermSuggestions('química fina')).toEqual([]);
  });

  it('keeps every suggestion group within the same manual term limit', () => {
    expect(PROSPECTING_TERM_SUGGESTION_GROUPS.every((group) => group.terms.length <= MAX_PROSPECTING_TERMS)).toBe(true);
    expect(PROSPECTING_TERM_SUGGESTION_GROUPS.every((group) => new Set(group.terms).size === group.terms.length)).toBe(true);
  });

  it('filters the review without changing the underlying list', () => {
    const leads = [{ id: 'a', duplicado: false }, { id: 'b', duplicado: true }];
    expect(filterProspectingReview(leads, 'todos')).toEqual(leads);
    expect(filterProspectingReview(leads, 'elegiveis')).toEqual([{ id: 'a', duplicado: false }]);
    expect(filterProspectingReview(leads, 'duplicados')).toEqual([{ id: 'b', duplicado: true }]);
  });

  it('keeps only valid CSV leads and deduplicates strong identifiers inside the file', () => {
    const result = prepareCsvLeads([
      { nome: 'Ana', empresa: 'Alpha', email: 'ANA@EXAMPLE.COM', telefone: '(11) 99999-1111' },
      { nome: 'Ana duplicada', empresa: 'Alpha', email: 'ana@example.com', telefone: '' },
      { nome: 'Bruno', empresa: 'Alpha', email: '', telefone: '11 99999-1111' },
      { nome: '', empresa: 'Sem contato', email: '', telefone: '' },
      { nome: 'Carla', empresa: 'Beta', email: 'invalido', telefone: '' },
      { nome: 'Davi', empresa: 'Alpha', email: '', telefone: '' },
    ]);

    expect(result.rows.map((row) => row.nome)).toEqual(['Ana', 'Davi']);
    expect(result.duplicateLines).toEqual([3, 4]);
    expect(result.invalidLines).toEqual([5, 6]);
    expect(csvLeadIdentity(result.rows[0])).toEqual(['email:ana@example.com', 'phone:5511999991111']);
  });
});
