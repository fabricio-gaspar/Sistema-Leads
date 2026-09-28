import type { Lead } from '@/mocks/leadsData';

/**
 * Shared presentation rules for the operational lead portfolio.  Keeping these
 * rules outside the page prevents the visible counters from drifting away from
 * the filters that power the table.
 */
export const HIGH_FIT_SCORE = 80;

export type LeadQuickView = 'all' | 'without-contact' | 'without-next-action' | 'high-fit';

export function normalizePortfolioText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

export function normalizePortfolioPhone(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

export function leadHasContact(lead: Lead): boolean {
  return Boolean(
    normalizePortfolioPhone(lead.telefone)
    || normalizePortfolioPhone(lead.whatsapp)
    || lead.email.trim(),
  );
}

export function leadHasNextAction(lead: Lead, hasOpenTask = false, qualificationAction?: string | null): boolean {
  return Boolean(
    hasOpenTask
    || lead.proximaAcao?.trim()
    || lead.nextFollowUpAt
    || qualificationAction?.trim(),
  );
}

function domainFrom(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '').toLocaleLowerCase('pt-BR');
  } catch {
    return '';
  }
}

function emailDomain(value: string): string {
  const match = value.trim().toLocaleLowerCase('pt-BR').match(/@([^\s@]+)$/);
  return match?.[1] ?? '';
}

export function leadMatchesPortfolioQuery(lead: Lead, query: string): boolean {
  const raw = query.trim();
  if (!raw) return true;

  const normalized = normalizePortfolioText(raw);
  const phone = normalizePortfolioPhone(raw);
  const email = raw.trim().toLocaleLowerCase('pt-BR');
  const sourceDomain = domainFrom(lead.sourceUrl ?? '');
  const searchable = [lead.nome, lead.empresa, lead.email, lead.segmento, sourceDomain]
    .map(normalizePortfolioText)
    .join(' ');

  if (email.includes('@') && lead.email.trim().toLocaleLowerCase('pt-BR') === email) return true;
  if (phone.length >= 7) {
    const phones = [lead.telefone, lead.whatsapp].map(normalizePortfolioPhone);
    if (phones.some((value) => value === phone || value.endsWith(phone) || phone.endsWith(value))) return true;
  }
  return searchable.includes(normalized);
}

export type PotentialLeadDuplicateReason = 'email' | 'phone' | 'domain' | 'external-id' | 'company-location';

export interface PotentialLeadDuplicate {
  lead: Lead;
  reasons: PotentialLeadDuplicateReason[];
}

export function findPotentialLeadDuplicates(candidate: Pick<Lead, 'id' | 'email' | 'telefone' | 'whatsapp' | 'empresa' | 'cidade' | 'estado' | 'sourceUrl' | 'sourceRecordId'>, leads: Lead[]): PotentialLeadDuplicate[] {
  const candidateEmail = candidate.email.trim().toLocaleLowerCase('pt-BR');
  const candidatePhones = [candidate.telefone, candidate.whatsapp].map(normalizePortfolioPhone).filter(Boolean);
  const candidateDomain = emailDomain(candidate.email) || domainFrom(candidate.sourceUrl ?? '');
  const candidateCompany = normalizePortfolioText(candidate.empresa);
  const candidateCity = normalizePortfolioText(candidate.cidade);
  const candidateState = normalizePortfolioText(candidate.estado);

  return leads.flatMap((lead) => {
    if (lead.id === candidate.id) return [];
    const reasons: PotentialLeadDuplicateReason[] = [];
    if (candidateEmail && lead.email.trim().toLocaleLowerCase('pt-BR') === candidateEmail) reasons.push('email');
    const existingPhones = [lead.telefone, lead.whatsapp].map(normalizePortfolioPhone).filter(Boolean);
    if (candidatePhones.some((phone) => existingPhones.includes(phone))) reasons.push('phone');
    const existingDomain = emailDomain(lead.email) || domainFrom(lead.sourceUrl ?? '');
    if (candidateDomain && existingDomain && candidateDomain === existingDomain) reasons.push('domain');
    if (candidate.sourceRecordId && lead.sourceRecordId && candidate.sourceRecordId === lead.sourceRecordId) reasons.push('external-id');
    if (candidateCompany && candidateCompany === normalizePortfolioText(lead.empresa)
      && candidateCity && candidateState
      && candidateCity === normalizePortfolioText(lead.cidade)
      && candidateState === normalizePortfolioText(lead.estado)) reasons.push('company-location');
    return reasons.length ? [{ lead, reasons }] : [];
  });
}

export function formatPortfolioDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function isPortfolioDateOverdue(value: string | null | undefined, now = Date.now()): boolean {
  if (!value) return false;
  const dueAt = new Date(value).getTime();
  return Number.isFinite(dueAt) && dueAt < now;
}
