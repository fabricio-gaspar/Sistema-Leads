export const MAX_PROSPECTING_TERMS = 10;
export const MAX_PROSPECTING_CATALOG_OFFERS = 3;
export const PROSPECTING_MINIMUM_SCORE_OPTIONS = [0, 50, 70, 85] as const;

export function toggleProspectingCatalogOffer(current: readonly string[], offerId: string): string[] {
  const id = offerId.trim();
  if (!id) return [...current];
  if (current.includes(id)) return current.filter((selectedId) => selectedId !== id);
  if (current.length >= MAX_PROSPECTING_CATALOG_OFFERS) return [...current];
  return [...current, id];
}

export function addProspectingManualChoice(current: readonly string[], value: string, limit: number): string[] {
  const maxItems = Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : 0;
  if (!maxItems) return [...current];

  const choices: string[] = [];
  const seen = new Set<string>();
  for (const candidate of [...current, value]) {
    const choice = candidate.trim().replace(/\s+/g, ' ');
    const key = normalizeKey(choice);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    choices.push(choice);
    if (choices.length === maxItems) break;
  }
  return choices;
}

export function sourceSupportsProspectingCompanySize(sourceKey: string): boolean {
  return sourceKey === 'linkedin';
}

export function normalizeProspectingMinimumScore(value: number): number {
  return PROSPECTING_MINIMUM_SCORE_OPTIONS.includes(value as typeof PROSPECTING_MINIMUM_SCORE_OPTIONS[number]) ? value : 0;
}

export function normalizeProspectingScore(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
}

export function prospectingSourceCriteria(sourceKey: string, companySizes: readonly string[], minimumScore: number) {
  const sizes = sourceSupportsProspectingCompanySize(sourceKey)
    ? [...new Set(companySizes.map((size) => size.trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'pt-BR'))
      .slice(0, 10)
    : [];
  return {
    companySize: sizes,
    portes: sizes,
    minimumScore: normalizeProspectingMinimumScore(minimumScore),
  };
}

export interface ProspectingResultDiagnostics {
  providerItemsRead: number;
  normalizedCount: number;
  matchedCount: number;
  rejectedByContact: number;
  rejectedByEmail: number;
  rejectedByWebsite: number;
  rejectedByRadius?: number;
  missingCoordinates?: number;
  rejectedByDuplicate?: number;
  rejectedByMinimumScore?: number;
  rejectedByActivityEvidence?: number;
}

export function prospectingFilterSummary(diagnostics?: ProspectingResultDiagnostics): string {
  if (!diagnostics) return '';
  const discarded = Math.max(0, diagnostics.normalizedCount - diagnostics.matchedCount);
  const throughput = `${diagnostics.providerItemsRead} lidos · ${diagnostics.normalizedCount} identificados · ${diagnostics.matchedCount} elegíveis`;
  if (!discarded) return `${throughput}.`;
  const reasons = [
    diagnostics.rejectedByContact > 0 ? `${diagnostics.rejectedByContact} sem telefone` : '',
    diagnostics.rejectedByEmail > 0 ? `${diagnostics.rejectedByEmail} sem e-mail` : '',
    diagnostics.rejectedByWebsite > 0 ? `${diagnostics.rejectedByWebsite} sem site` : '',
    (diagnostics.rejectedByRadius ?? 0) > 0 ? `${diagnostics.rejectedByRadius} fora do raio` : '',
    (diagnostics.missingCoordinates ?? 0) > 0 ? `${diagnostics.missingCoordinates} sem coordenadas` : '',
    (diagnostics.rejectedByMinimumScore ?? 0) > 0 ? `${diagnostics.rejectedByMinimumScore} abaixo da aderência mínima` : '',
    (diagnostics.rejectedByActivityEvidence ?? 0) > 0 ? `${diagnostics.rejectedByActivityEvidence} sem atividade compatível` : '',
    (diagnostics.rejectedByDuplicate ?? 0) > 0 ? `${diagnostics.rejectedByDuplicate} duplicada${diagnostics.rejectedByDuplicate === 1 ? '' : 's'} removida${diagnostics.rejectedByDuplicate === 1 ? '' : 's'} antes da revisão` : '',
  ].filter(Boolean).join(', ');
  const overlapping = diagnostics.rejectedByContact + diagnostics.rejectedByEmail + diagnostics.rejectedByWebsite
    + (diagnostics.rejectedByRadius ?? 0) + (diagnostics.missingCoordinates ?? 0) + (diagnostics.rejectedByMinimumScore ?? 0) + (diagnostics.rejectedByActivityEvidence ?? 0) > discarded;
  return `${throughput}. ${discarded} fora dos critérios${reasons ? `: ${reasons}` : ''}.${overlapping ? ' Os motivos podem se sobrepor.' : ''}`;
}

export function prospectingEmptyResultMessage(sourceName: string, diagnostics?: ProspectingResultDiagnostics): string {
  if (!diagnostics) return `${sourceName} concluiu a busca sem leads para estes filtros. Nenhum lead foi importado.`;
  if (diagnostics.providerItemsRead === 0) return `${sourceName} não encontrou empresas para o termo e a região escolhidos. Tente um termo mais amplo ou outra região; nenhuma importação foi feita.`;
  if (diagnostics.normalizedCount === 0) return `${sourceName} devolveu ${diagnostics.providerItemsRead} registros, mas nenhum pôde ser identificado como empresa. Verifique o formato de saída da fonte; nenhuma importação foi feita.`;
  if ((diagnostics.rejectedByRadius ?? 0) + (diagnostics.missingCoordinates ?? 0) === diagnostics.normalizedCount) {
    return `${diagnostics.normalizedCount} empresas foram descartadas pela área no mapa. ${prospectingFilterSummary(diagnostics)} Revise o centro ou amplie o raio antes de iniciar outra busca paga.`;
  }
  if ((diagnostics.rejectedByMinimumScore ?? 0) === diagnostics.normalizedCount) {
    return `${diagnostics.normalizedCount} empresas ficaram abaixo da aderência mínima escolhida. ${prospectingFilterSummary(diagnostics)} Reduza a aderência mínima ou revise os termos antes de iniciar outra busca paga.`;
  }
  if ((diagnostics.rejectedByActivityEvidence ?? 0) === diagnostics.normalizedCount) {
    return `${diagnostics.normalizedCount} empresas não demonstraram atividade compatível com a oferta escolhida. ${prospectingFilterSummary(diagnostics)} Revise os produtos ou reduza a aderência mínima antes de iniciar outra busca paga.`;
  }
  if (diagnostics.matchedCount === 0) return `${diagnostics.normalizedCount} empresas foram descartadas pelos critérios obrigatórios. ${prospectingFilterSummary(diagnostics)} Desmarque um critério e faça uma nova busca somente após revisar o custo da fonte.`;
  return `${sourceName} concluiu a busca sem leads revisáveis. Nenhuma importação foi feita.`;
}

export function shouldClearProspectingRequestKey(code: string, recoverable = false): boolean {
  if (code === 'prospecting_run_not_pending') return true;
  if (recoverable) return false;
  // Malformed/400 start responses can represent an accepted, billable Actor.
  return /^(source_|apify_auth_rejected|apify_token_rejected|apify_resource_forbidden|apify_actor_not_found|linkedin_credentials_required|linkedin_token_rejected|linkedin_actor_not_found|linkedin_resource_forbidden)/.test(code);
}

export function termsForProspectingSource(sourceKey: string, terms: string[]): string[] {
  return sourceKey === 'linkedin' ? terms.slice(0, 1) : terms;
}

export function requestKeyBelongsToRun(stored: { runId?: string; key?: string } | null, runId: string, requestKey?: string): boolean {
  return Boolean(runId && stored && (stored.runId === runId || (!stored.runId && requestKey && stored.key === requestKey)));
}

export function shouldApplyProspectingHistoryResponse(requestedSource: string, selectedSource: string): boolean {
  return requestedSource === selectedSource;
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ');
}

/**
 * Produz um UUID estável a partir de um pedido de importação. Ele não guarda o
 * conteúdo do CSV no navegador; apenas permite que o mesmo arquivo seja
 * reconhecido pelo lote atômico caso o usuário o envie novamente.
 */
export async function deterministicProspectingUuid(seed: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('browser_crypto_unavailable');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function normalizeProspectingTerms(values: string[]): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];

  for (const value of values) {
    const term = value.trim().replace(/\s+/g, ' ');
    const key = normalizeKey(term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
    if (terms.length === MAX_PROSPECTING_TERMS) break;
  }

  return terms;
}

export function nextProspectingTerms(current: string[], value: string): string[] {
  return normalizeProspectingTerms([...current, value]);
}

export function prospectingVolumePerTerm(volume: number, termsCount: number): number {
  if (termsCount <= 0) return 0;
  return Math.max(1, Math.floor(Math.max(1, volume) / termsCount));
}

export type ProspectingReviewFilter = 'todos' | 'elegiveis' | 'duplicados';

export function filterProspectingReview<T extends { duplicado: boolean }>(
  leads: T[],
  filter: ProspectingReviewFilter,
): T[] {
  if (filter === 'duplicados') return leads.filter((lead) => lead.duplicado);
  if (filter === 'elegiveis') return leads.filter((lead) => !lead.duplicado);
  return leads;
}

export type CsvLeadInput = Record<string, string>;

export interface PreparedCsvLead {
  sourceLine: number;
  nome: string;
  empresa: string;
  email: string;
  telefone: string;
  segmento: string;
  cidade: string;
  estado: string;
  endereco: string;
  site: string;
  data: string;
}

export interface PreparedCsvLeads {
  rows: PreparedCsvLead[];
  invalidLines: number[];
  duplicateLines: number[];
}

export function chunkProspectingImportRows<T>(rows: readonly T[], chunkSize = 100): T[][] {
  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > 100) {
    throw new Error('prospecting_import_invalid_chunk_size');
  }
  const chunks: T[][] = [];
  for (let offset = 0; offset < rows.length; offset += chunkSize) chunks.push(rows.slice(offset, offset + chunkSize));
  return chunks;
}

export function normalizeProspectingPhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (!trimmed.startsWith('+') && (digits.length === 10 || digits.length === 11)) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits;
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
}

export function normalizeProspectingCompanyIdentity(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeImportWebsite(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500) return '';
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname ? parsed.toString() : '';
  } catch {
    return '';
  }
}

const BRAZIL_STATE_CODES: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE',
  'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO', maranhao: 'MA',
  'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA',
  paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR',
  'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};

export function normalizeBrazilState(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const key = trimmed.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
  return BRAZIL_STATE_CODES[key] ?? trimmed.toLocaleUpperCase('pt-BR');
}

export function prepareCsvLeads(rows: CsvLeadInput[]): PreparedCsvLeads {
  const invalidLines: number[] = [];
  const duplicateLines: number[] = [];
  const identities = new Set<string>();
  const prepared: PreparedCsvLead[] = [];

  rows.forEach((row, index) => {
    const sourceLine = index + 2;
    const empresa = (row.empresa ?? '').trim();
    const nome = (row.nome ?? '').trim() || empresa;
    const email = (row.email ?? '').trim().toLocaleLowerCase('pt-BR');
    const telefone = (row.telefone ?? '').trim();
    const segmento = (row.segmento ?? '').trim();
    const cidade = (row.cidade ?? '').trim();
    const estadoOriginal = (row.estado ?? '').trim();
    const endereco = (row.endereco ?? '').trim();
    const siteOriginal = (row.site ?? '').trim();
    const data = (row.data ?? '').trim();

    if (!nome || !empresa || (email && (!isValidEmail(email) || email.length > 254))
      || nome.length > 200 || empresa.length > 200 || telefone.length > 32
      || segmento.length > 160 || cidade.length > 120 || estadoOriginal.length > 64
      || endereco.length > 500 || siteOriginal.length > 500 || data.length > 64) {
      invalidLines.push(sourceLine);
      return;
    }

    const strongIdentities = [
      email ? `email:${email}` : '',
      normalizeProspectingPhone(telefone).length >= 10 ? `phone:${normalizeProspectingPhone(telefone)}` : '',
    ].filter(Boolean);
    if (!strongIdentities.length) {
      const company = normalizeProspectingCompanyIdentity(empresa);
      if (company) strongIdentities.push(`company:${company}`);
    }

    if (strongIdentities.some((identity) => identities.has(identity))) {
      duplicateLines.push(sourceLine);
      return;
    }

    strongIdentities.forEach((identity) => identities.add(identity));
    prepared.push({
      sourceLine,
      nome,
      empresa,
      email,
      telefone,
      segmento,
      cidade,
      estado: normalizeBrazilState(estadoOriginal),
      endereco,
      site: normalizeImportWebsite(siteOriginal),
      data,
    });
  });

  return { rows: prepared, invalidLines, duplicateLines };
}

export function csvLeadIdentity(row: Pick<PreparedCsvLead, 'email' | 'telefone' | 'empresa'>): string[] {
  const phone = normalizeProspectingPhone(row.telefone);
  const identities = [
    row.email ? `email:${row.email.trim().toLocaleLowerCase('pt-BR')}` : '',
    phone.length >= 10 ? `phone:${phone}` : '',
  ].filter(Boolean);
  if (!identities.length) {
    const company = normalizeProspectingCompanyIdentity(row.empresa);
    if (company) identities.push(`company:${company}`);
  }
  return identities;
}
