import {
  PROSPECTING_CUSTOMER_SEGMENTS,
  PROSPECTING_TARGET_PROFILES,
  termsFromIdealProfile,
  type ProspectingTargetProfile,
} from './prospectingIdealProfile';
import { MAX_PROSPECTING_TERMS, normalizeProspectingTerms } from './prospectingUi';

export interface ProspectingAiDraft {
  city: string;
  state: string;
  offer: string;
  targetProfile: ProspectingTargetProfile;
  customerSegments: string[];
  terms: string[];
  volume: number;
  requireSite: boolean;
  requireWhatsApp: boolean;
  requireEmail: boolean;
}

export interface ProspectingAiPlan extends ProspectingAiDraft {
  summary: string;
  rationale: string;
}

const MAX_TEXT = 240;
const MAX_SUMMARY = 420;

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown, fallback: string, max = MAX_TEXT): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized && normalized.length <= max ? normalized : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function boundedNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const normalized = Math.round(value);
  return normalized >= 1 && normalized <= 100 ? normalized : fallback;
}

function targetProfile(value: unknown, fallback: ProspectingTargetProfile): ProspectingTargetProfile {
  return PROSPECTING_TARGET_PROFILES.some((profile) => profile.id === value)
    ? value as ProspectingTargetProfile
    : fallback;
}

function segments(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const allowed = new Set<string>(PROSPECTING_CUSTOMER_SEGMENTS);
  const selected = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => allowed.has(item));
  return [...new Set(selected)].slice(0, PROSPECTING_CUSTOMER_SEGMENTS.length);
}

function terms(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const normalized = normalizeProspectingTerms(value.filter((item): item is string => typeof item === 'string')).slice(0, MAX_PROSPECTING_TERMS);
  return normalized.length ? normalized : fallback;
}

export function normalizeProspectingAiPlan(candidate: unknown, current: ProspectingAiDraft): ProspectingAiPlan {
  const input = object(candidate);
  const state = text(input.state, current.state, 2).toUpperCase();
  const safeState = /^[A-Z]{2}$/.test(state) ? state : current.state;
  const nextSegments = segments(input.customerSegments, current.customerSegments);
  const nextTerms = terms(input.terms, current.terms);
  return {
    city: text(input.city, current.city, 120),
    state: safeState,
    offer: text(input.offer, current.offer, MAX_TEXT),
    targetProfile: targetProfile(input.targetProfile, current.targetProfile),
    customerSegments: nextSegments,
    terms: nextTerms,
    volume: boundedNumber(input.volume, current.volume),
    requireSite: bool(input.requireSite, current.requireSite),
    requireWhatsApp: bool(input.requireWhatsApp, current.requireWhatsApp),
    requireEmail: bool(input.requireEmail, current.requireEmail),
    summary: text(input.summary, 'Estratégia preparada para revisão antes da busca.', MAX_SUMMARY),
    rationale: text(input.rationale, 'Os filtros foram organizados a partir do perfil comercial e dos critérios informados.', MAX_SUMMARY),
  };
}

/**
 * Fallback determinístico: oferece termos curados, mas nunca consulta um
 * provedor nem interpreta dados fora do perfil já confirmado pelo usuário.
 */
export function buildLocalProspectingAiPlan(current: ProspectingAiDraft): ProspectingAiPlan {
  const suggested = termsFromIdealProfile(current.offer, current.targetProfile, current.customerSegments);
  return normalizeProspectingAiPlan({
    ...current,
    terms: normalizeProspectingTerms([...current.terms, ...suggested]),
    summary: 'Sugestões locais preparadas para sua revisão; nenhuma busca foi iniciada.',
    rationale: 'Use os termos curados do perfil comercial ou ajuste os filtros antes de executar a busca.',
  }, current);
}
