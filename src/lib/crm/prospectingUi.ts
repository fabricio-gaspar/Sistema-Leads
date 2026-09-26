export const MAX_PROSPECTING_TERMS = 10;

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
}

export interface PreparedCsvLeads {
  rows: PreparedCsvLead[];
  invalidLines: number[];
  duplicateLines: number[];
}

export function normalizeProspectingPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits;
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function prepareCsvLeads(rows: CsvLeadInput[]): PreparedCsvLeads {
  const invalidLines: number[] = [];
  const duplicateLines: number[] = [];
  const identities = new Set<string>();
  const prepared: PreparedCsvLead[] = [];

  rows.forEach((row, index) => {
    const sourceLine = index + 2;
    const nome = (row.nome ?? '').trim();
    const empresa = (row.empresa ?? '').trim();
    const email = (row.email ?? '').trim().toLocaleLowerCase('pt-BR');
    const telefone = (row.telefone ?? '').trim();

    if (!nome || !empresa || (email && !isValidEmail(email))) {
      invalidLines.push(sourceLine);
      return;
    }

    const strongIdentities = [
      email ? `email:${email}` : '',
      normalizeProspectingPhone(telefone).length >= 10 ? `phone:${normalizeProspectingPhone(telefone)}` : '',
    ].filter(Boolean);

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
      segmento: (row.segmento ?? '').trim(),
      cidade: (row.cidade ?? '').trim(),
      estado: (row.estado ?? '').trim().toUpperCase(),
    });
  });

  return { rows: prepared, invalidLines, duplicateLines };
}

export function csvLeadIdentity(row: Pick<PreparedCsvLead, 'email' | 'telefone'>): string[] {
  const phone = normalizeProspectingPhone(row.telefone);
  return [
    row.email ? `email:${row.email.trim().toLocaleLowerCase('pt-BR')}` : '',
    phone.length >= 10 ? `phone:${phone}` : '',
  ].filter(Boolean);
}
