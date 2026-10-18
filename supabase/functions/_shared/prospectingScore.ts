import { normalizeBrazilianState } from './prospectingState.ts';

export type ProspectingScoreInput = {
  id?: string;
  name?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  segment?: string;
  uf?: string;
  porte?: string;
};

export type ProspectingScoreFilters = {
  atividades?: string[];
  estado?: string;
  portes?: string[];
  exigeSite?: boolean;
  exigeWhatsApp?: boolean;
  exigeEmail?: boolean;
};

function comparable(value: string): string {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
}

/**
 * The source must explicitly contain the requested activity. A generic
 * category is not enough evidence to claim fit for a more specific offer.
 */
export function hasProspectingActivityEvidence(sourceActivity: string | null | undefined, requestedActivities: readonly string[] | undefined): boolean {
  const requested = [...new Set((requestedActivities ?? []).map(comparable).filter(Boolean))];
  if (!requested.length) return true;
  const source = comparable(sourceActivity || '');
  return Boolean(source) && requested.some((activity) => source.includes(activity));
}

export function calculateProspectingScore(raw: ProspectingScoreInput, filters: ProspectingScoreFilters) {
  const reasons: string[] = [];
  const segment = comparable(raw.segment || '');
  const hasRequestedActivities = (filters.atividades ?? []).some((activity) => Boolean(comparable(activity)));
  const segmentMatch = Boolean(segment) && hasRequestedActivities && hasProspectingActivityEvidence(segment, filters.atividades);
  let fit = 0;
  if (segmentMatch) {
    fit += 60;
    reasons.push('atividade compatível com o filtro');
  } else if (segment) {
    fit += 20;
    reasons.push('atividade empresarial identificada');
  }

  if (filters.estado && normalizeBrazilianState(raw.uf) === normalizeBrazilianState(filters.estado)) {
    fit += 25;
    reasons.push('região desejada');
  }

  const requestedSizes = (filters.portes ?? []).map(comparable).filter(Boolean);
  if (requestedSizes.length && raw.porte && requestedSizes.includes(comparable(raw.porte))) {
    fit += 15;
    reasons.push('porte compatível');
  }

  let contactability = 0;
  if (raw.phone) {
    contactability += 30;
    reasons.push('telefone encontrado, ainda não validado como WhatsApp');
  }
  if (raw.whatsapp) {
    contactability += 30;
    reasons.push('WhatsApp informado explicitamente pela fonte');
  }
  if (raw.email) {
    contactability += 25;
    reasons.push('e-mail encontrado');
  }
  if (raw.website) {
    contactability += 15;
    reasons.push('site empresarial encontrado');
  }

  if ((filters.exigeWhatsApp && !raw.phone && !raw.whatsapp) || (filters.exigeEmail && !raw.email) || (filters.exigeSite && !raw.website)) {
    reasons.push('um canal obrigatório não foi comprovado');
  }

  const normalizedFit = Math.min(100, fit);
  const normalizedContactability = Math.min(100, contactability);
  return {
    overall: Math.round(normalizedFit * 0.65 + normalizedContactability * 0.35),
    fit: normalizedFit,
    contactability: normalizedContactability,
    engagement: 0,
    reason: reasons.join(' · ') || 'Sem evidência suficiente de aderência ou contato.',
  };
}
