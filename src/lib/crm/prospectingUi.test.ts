import { describe, expect, it } from 'vitest';
import {
  MAX_PROSPECTING_TERMS,
  csvLeadIdentity,
  deterministicProspectingUuid,
  filterProspectingReview,
  normalizeProspectingTerms,
  prepareCsvLeads,
  prospectingVolumePerTerm,
  prospectingEmptyResultMessage,
  prospectingFilterSummary,
  normalizeProspectingMinimumScore,
  normalizeProspectingScore,
  prospectingSourceCriteria,
  sourceSupportsProspectingCompanySize,
  shouldClearProspectingRequestKey,
  requestKeyBelongsToRun,
  shouldApplyProspectingHistoryResponse,
  termsForProspectingSource,
  toggleProspectingCatalogOffer,
} from '@/lib/crm/prospectingUi';
import {
  PROSPECTING_TERM_SUGGESTION_GROUPS,
  findProspectingTermSuggestions,
} from '@/lib/crm/prospectingTermSuggestions';

describe('prospecting UI safeguards', () => {
  it('keeps up to three explicitly selected catalog offers without replacing an earlier choice', () => {
    expect(toggleProspectingCatalogOffer([], 'offer-a')).toEqual(['offer-a']);
    expect(toggleProspectingCatalogOffer(['offer-a', 'offer-b'], 'offer-c')).toEqual(['offer-a', 'offer-b', 'offer-c']);
    expect(toggleProspectingCatalogOffer(['offer-a', 'offer-b', 'offer-c'], 'offer-d')).toEqual(['offer-a', 'offer-b', 'offer-c']);
    expect(toggleProspectingCatalogOffer(['offer-a', 'offer-b'], 'offer-a')).toEqual(['offer-b']);
  });

  it('allows company-size criteria only for the source that actually returns it', () => {
    expect(sourceSupportsProspectingCompanySize('linkedin')).toBe(true);
    expect(sourceSupportsProspectingCompanySize('apify')).toBe(false);
    expect(sourceSupportsProspectingCompanySize('unknown')).toBe(false);
  });

  it('accepts only the score thresholds the operator can choose in the wizard', () => {
    expect(normalizeProspectingMinimumScore(0)).toBe(0);
    expect(normalizeProspectingMinimumScore(50)).toBe(50);
    expect(normalizeProspectingMinimumScore(70)).toBe(70);
    expect(normalizeProspectingMinimumScore(85)).toBe(85);
    expect(normalizeProspectingMinimumScore(71)).toBe(0);
  });

  it('never invents a warm score when a source did not calculate one', () => {
    expect(normalizeProspectingScore(undefined)).toBe(0);
    expect(normalizeProspectingScore(Number.NaN)).toBe(0);
    expect(normalizeProspectingScore(73.6)).toBe(74);
    expect(normalizeProspectingScore(120)).toBe(100);
  });

  it('sends company-size criteria only to LinkedIn while retaining the chosen minimum score', () => {
    expect(prospectingSourceCriteria('linkedin', ['51-200', '11-50', '51-200'], 70)).toEqual({
      companySize: ['11-50', '51-200'],
      portes: ['11-50', '51-200'],
      minimumScore: 70,
    });
    expect(prospectingSourceCriteria('apify', ['11-50'], 85)).toEqual({
      companySize: [],
      portes: [],
      minimumScore: 85,
    });
  });

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

  it('distinguishes no provider records from records discarded by filters', () => {
    expect(prospectingEmptyResultMessage('Google Maps', { providerItemsRead: 0, normalizedCount: 0, matchedCount: 0, rejectedByContact: 0, rejectedByEmail: 0, rejectedByWebsite: 0 }))
      .toContain('não encontrou empresas');
    expect(prospectingEmptyResultMessage('Google Maps', { providerItemsRead: 8, normalizedCount: 8, matchedCount: 0, rejectedByContact: 8, rejectedByEmail: 0, rejectedByWebsite: 0 }))
      .toContain('8 empresas foram descartadas pelos critérios');
    expect(prospectingFilterSummary({ providerItemsRead: 8, normalizedCount: 8, matchedCount: 0, rejectedByContact: 8, rejectedByEmail: 3, rejectedByWebsite: 0 }))
      .toContain('8 fora dos critérios: 8 sem telefone, 3 sem e-mail. Os motivos podem se sobrepor.');
    expect(prospectingFilterSummary({ providerItemsRead: 8, normalizedCount: 7, matchedCount: 7, rejectedByContact: 0, rejectedByEmail: 0, rejectedByWebsite: 0 }))
      .toContain('8 lidos · 7 identificados · 7 elegíveis');
    expect(prospectingEmptyResultMessage('LinkedIn', { providerItemsRead: 4, normalizedCount: 0, matchedCount: 0, rejectedByContact: 0, rejectedByEmail: 0, rejectedByWebsite: 0 }))
      .toContain('4 registros, mas nenhum pôde ser identificado');
  });

  it('explica rejeições por raio e ausência de coordenadas separadamente', () => {
    const diagnostics = { providerItemsRead: 8, normalizedCount: 8, matchedCount: 0, rejectedByContact: 0, rejectedByEmail: 0, rejectedByWebsite: 0, rejectedByRadius: 5, missingCoordinates: 3 };
    expect(prospectingFilterSummary(diagnostics)).toContain('5 fora do raio');
    expect(prospectingFilterSummary(diagnostics)).toContain('3 sem coordenadas');
    expect(prospectingEmptyResultMessage('Google Maps', diagnostics)).toContain('centro ou amplie o raio');
  });

  it('explica resultados repetidos e abaixo da aderência mínima sem ocultar o motivo', () => {
    const diagnostics = {
      providerItemsRead: 6,
      normalizedCount: 5,
      matchedCount: 0,
      rejectedByContact: 0,
      rejectedByEmail: 0,
      rejectedByWebsite: 0,
      rejectedByDuplicate: 1,
      rejectedByMinimumScore: 5,
    };

    expect(prospectingFilterSummary(diagnostics)).toContain('1 duplicada');
    expect(prospectingFilterSummary(diagnostics)).toContain('5 abaixo da aderência mínima');
    expect(prospectingEmptyResultMessage('Google Maps', diagnostics)).toContain('aderência mínima');

    const withoutActivityEvidence = {
      providerItemsRead: 2,
      normalizedCount: 2,
      matchedCount: 0,
      rejectedByContact: 0,
      rejectedByEmail: 0,
      rejectedByWebsite: 0,
      rejectedByActivityEvidence: 2,
    };
    expect(prospectingFilterSummary(withoutActivityEvidence)).toContain('2 sem atividade compatível');
    expect(prospectingEmptyResultMessage('Google Maps', withoutActivityEvidence)).toContain('atividade compatível');
  });

  it('releases the idempotency key after a rejected token but preserves uncertain provider starts', () => {
    expect(shouldClearProspectingRequestKey('apify_token_rejected')).toBe(true);
    expect(shouldClearProspectingRequestKey('apify_token_rejected', true)).toBe(false);
    expect(shouldClearProspectingRequestKey('prospecting_run_not_pending')).toBe(true);
    expect(shouldClearProspectingRequestKey('prospecting_start_unconfirmed')).toBe(false);
    expect(shouldClearProspectingRequestKey('linkedin_processing_timeout')).toBe(false);
    expect(shouldClearProspectingRequestKey('provider_invalid_response')).toBe(false);
    expect(shouldClearProspectingRequestKey('apify_http_400')).toBe(false);
  });

  it('signs only the one search term sent to the LinkedIn company Actor', () => {
    expect(termsForProspectingSource('linkedin', ['borracha', 'silicone'])).toEqual(['borracha']);
    expect(termsForProspectingSource('linkedin', ['borracha', 'poliuretano'])).toEqual(['borracha']);
    expect(termsForProspectingSource('apify', ['borracha', 'silicone'])).toEqual(['borracha', 'silicone']);
  });

  it('releases a resumed run key only for the same recorded execution', () => {
    expect(requestKeyBelongsToRun({ runId: 'run-a' }, 'run-a')).toBe(true);
    expect(requestKeyBelongsToRun({ runId: 'run-b' }, 'run-a')).toBe(false);
    expect(requestKeyBelongsToRun({}, 'run-a')).toBe(false);
    expect(requestKeyBelongsToRun({ key: 'request-a' }, 'run-a', 'request-a')).toBe(true);
    expect(requestKeyBelongsToRun({ key: 'request-b' }, 'run-a', 'request-a')).toBe(false);
  });

  it('ignores an old history response after the operator switches sources', () => {
    expect(shouldApplyProspectingHistoryResponse('apify', 'linkedin')).toBe(false);
    expect(shouldApplyProspectingHistoryResponse('linkedin', 'linkedin')).toBe(true);
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
