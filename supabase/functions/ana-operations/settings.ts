export function normalizeHandoffWhatsappNotification(
  initialAssignmentMode: string,
  handoffStage: string | null,
  requested: unknown,
): boolean {
  return initialAssignmentMode === 'ana' && Boolean(handoffStage) && requested === true;
}

const BRAZIL_UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));

/** Mirrors the paid prospecting boundary; missing location is never guessed. */
export function prospectingFiltersIssue(value: unknown): string | null {
  const filters = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const city = typeof filters.cidade === 'string' ? filters.cidade.trim() : '';
  if (city.length < 2 || city.length > 120) return 'operation_city_required';
  if (!Array.isArray(filters.estados) || filters.estados.length !== 1 || !BRAZIL_UFS.has(String(filters.estados[0]))) {
    return 'operation_single_state_required';
  }
  const terms = [...(Array.isArray(filters.atividades) ? filters.atividades : []), ...(Array.isArray(filters.segmentos) ? filters.segmentos : [])];
  if (!terms.some((term) => typeof term === 'string' && term.trim().length >= 2 && term.trim().length <= 120)) {
    return 'operation_search_terms_required';
  }
  return null;
}

export function assertProspectingFilters(value: unknown): void {
  const issue = prospectingFiltersIssue(value);
  if (issue) throw new Error(issue);
}
