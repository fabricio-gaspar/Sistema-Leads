import { describe, expect, it } from 'vitest';
import { assertProspectingFilters, prospectingFiltersIssue } from '../functions/ana-operations/settings';

const valid = { cidade: 'Campinas', estados: ['SP'], atividades: ['transportadores'] };
describe('R11 paid prospecting location contract', () => {
  it('accepts a delimited city, UF and activity or segment', () => {
    expect(prospectingFiltersIssue(valid)).toBeNull();
    expect(prospectingFiltersIssue({ ...valid, atividades: [], segmentos: ['logística'] })).toBeNull();
  });
  it.each([null, {}, { ...valid, cidade: '' }, { ...valid, cidade: 12 }])('refuses missing city before any provider work (%j)', (filters) => {
    expect(() => assertProspectingFilters(filters)).toThrow('operation_city_required');
  });
  it.each([[], ['SP', 'PR'], ['XX'], ['sp'], null].map((estados) => ({ estados })))('refuses invalid or multiple states ($estados)', ({ estados }) => {
    expect(prospectingFiltersIssue({ ...valid, estados })).toBe('operation_single_state_required');
  });
  it.each([[], [' '], ['x'], [true], ['x'.repeat(121)]].map((atividades) => ({ atividades })))('refuses missing usable search terms ($atividades)', ({ atividades }) => {
    expect(prospectingFiltersIssue({ ...valid, atividades })).toBe('operation_search_terms_required');
  });
});
