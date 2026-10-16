export type ProspectingTargetProfile = 'potential_customers' | 'distributors' | 'resellers' | 'suppliers';

export interface ProspectingAiFilters {
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

export interface ProspectingAiPlan extends ProspectingAiFilters {
  summary: string;
  rationale: string;
}

const TARGET_PROFILES = new Set<ProspectingTargetProfile>(['potential_customers', 'distributors', 'resellers', 'suppliers']);
const CUSTOMER_SEGMENTS = new Set(['Automotivo', 'Alimentos e bebidas', 'Máquinas e equipamentos', 'Construção', 'Mineração']);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown, fallback: string, max: number): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized && normalized.length <= max ? normalized : fallback;
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function volume(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const normalized = Math.round(value);
  return normalized >= 1 && normalized <= 100 ? normalized : fallback;
}

function terms(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().replace(/\s+/g, ' '))
    .filter((item) => item.length > 0 && item.length <= 120)
    .filter((item, index, all) => all.findIndex((candidate) => candidate.localeCompare(item, 'pt-BR', { sensitivity: 'base' }) === 0) === index)
    .slice(0, 10);
  return normalized.length ? normalized : fallback;
}

function selectedCustomerSegments(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().replace(/\s+/g, ' '))
    .filter((item) => item.length > 0 && item.length <= 120))].slice(0, 20);
}

export function normalizeProspectingAiFilters(input: unknown, fallback: ProspectingAiFilters): ProspectingAiPlan {
  const raw = record(input);
  const state = text(raw.state, fallback.state, 2).toUpperCase();
  const profile = TARGET_PROFILES.has(raw.targetProfile as ProspectingTargetProfile)
    ? raw.targetProfile as ProspectingTargetProfile
    : fallback.targetProfile;
  const selectedSegments = Array.isArray(raw.customerSegments)
    ? selectedCustomerSegments(raw.customerSegments).filter((item) => CUSTOMER_SEGMENTS.has(item) || fallback.customerSegments.includes(item))
    : fallback.customerSegments;

  return {
    city: text(raw.city, fallback.city, 120),
    state: /^[A-Z]{2}$/.test(state) ? state : fallback.state,
    offer: text(raw.offer, fallback.offer, 240),
    targetProfile: profile,
    customerSegments: selectedSegments,
    terms: terms(raw.terms, fallback.terms),
    volume: volume(raw.volume, fallback.volume),
    requireSite: boolean(raw.requireSite, fallback.requireSite),
    requireWhatsApp: boolean(raw.requireWhatsApp, fallback.requireWhatsApp),
    requireEmail: boolean(raw.requireEmail, fallback.requireEmail),
    summary: text(raw.summary, 'Estratégia preparada para revisão antes da busca.', 420),
    rationale: text(raw.rationale, 'Os filtros foram organizados a partir do perfil comercial e dos critérios informados.', 420),
  };
}

export function currentProspectingAiFilters(value: unknown): ProspectingAiFilters {
  const raw = record(value);
  return normalizeProspectingAiFilters(raw, {
    city: '', state: 'SP', offer: '', targetProfile: 'potential_customers', customerSegments: selectedCustomerSegments(raw.customerSegments), terms: [], volume: 10,
    requireSite: false, requireWhatsApp: false, requireEmail: false,
  });
}

/** Keeps only commercial fields explicitly selected by the server. */
export function companyProspectingContext(value: unknown): Record<string, string> {
  const company = record(value);
  const ui = record(company.ui_settings);
  const organization = record(ui.organizacao);
  return {
    name: text(company.name, text(organization.nomeComercial, text(organization.nome, '', 160), 160), 160),
    segment: text(company.segment, text(ui.ramo, '', 240), 240),
    description: text(company.description, text(ui.publico, '', 500), 500),
    city: text(company.city, text(ui.regiao, '', 120), 120),
  };
}

/** Only a currently active offer from an enabled knowledge source may guide buyer suggestions. */
export function catalogProspectingContext(value: unknown, sourceEnabled: boolean): { name: string; category: string; description: string; applications: string[] } | null {
  const item = record(value);
  if (!sourceEnabled || item.status !== 'active' || !['product', 'service'].includes(String(item.item_type))) return null;
  const name = text(item.name, '', 160);
  if (!name) return null;
  const applications = Array.isArray(item.applications)
    ? item.applications.filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => text(entry, '', 100)).filter(Boolean).slice(0, 8)
    : [];
  return { name, category: text(item.category, '', 120), description: text(item.short_description, '', 500), applications };
}
