export type LinkedInCompanyCredentials = {
  api_token?: unknown;
  actor_id?: unknown;
  task_id?: unknown;
  input_json?: unknown;
};

export type LinkedInCompanyFilters = {
  searchQuery: string;
  locations?: string[];
  industryIds?: string[];
  companySize?: string[];
  maxItems: number;
  startPage?: number;
  takePages?: number;
  mode?: 'short' | 'full';
};

export type LinkedInCompany = {
  name: string;
  linkedinUrl: string;
  website: string;
  phone: string | null;
  email: string | null;
  city: string;
  state: string;
  segment: string;
  size: string;
  sourceUrl: string;
};

const text = (value: unknown, maximum = 1_000): string => typeof value === 'string' ? value.trim().slice(0, maximum) : '';
const list = (value: unknown, maximum = 30): string[] => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string').map((item) => text(item, 160)).filter(Boolean).slice(0, maximum)
  : [];

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeUrl(value: string): string {
  const candidate = value.trim();
  if (!candidate) return '';
  try {
    const parsed = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
    parsed.hash = '';
    parsed.search = '';
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return candidate.toLowerCase().replace(/\/+$/, '');
  }
}

function normalizeDomain(value: string): string {
  const normalized = normalizeUrl(value);
  try { return new URL(normalized).hostname; } catch { return ''; }
}

function normalizeKey(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase();
}

function configuredInput(credentials: LinkedInCompanyCredentials): Record<string, unknown> {
  const raw = text(credentials.input_json, 20_000);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('source_input_invalid');
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error && error.message === 'source_input_invalid') throw error;
    throw new Error('source_input_invalid');
  }
}

export function validateLinkedInCredentials(credentials: LinkedInCompanyCredentials): void {
  if (!text(credentials.api_token, 1_000) || (!text(credentials.actor_id, 300) && !text(credentials.task_id, 300))) {
    throw new Error('source_credentials_missing');
  }
}

export function buildLinkedInActorInput(credentials: LinkedInCompanyCredentials, filters: LinkedInCompanyFilters): Record<string, unknown> {
  validateLinkedInCredentials(credentials);
  const searchQuery = text(filters.searchQuery, 500);
  if (!searchQuery) throw new Error('linkedin_search_terms_required');
  const maxItems = Number.isInteger(filters.maxItems) ? filters.maxItems : 0;
  if (maxItems < 1 || maxItems > 100) throw new Error('linkedin_limit_invalid');
  const configured = configuredInput(credentials);
  delete configured.mode; // Retired field previously sent by this adapter.
  const locations = list(filters.locations);
  const industryIds = list(filters.industryIds);
  const companySize = list(filters.companySize);
  const startPage = Number.isInteger(filters.startPage) && (filters.startPage ?? 0) > 0 ? filters.startPage : 1;
  const takePages = Number.isInteger(filters.takePages) && (filters.takePages ?? 0) > 0 ? Math.min(10, filters.takePages as number) : 1;
  const mode = filters.mode === 'full' ? 'full' : 'short';
  return {
    ...configured,
    searchQuery,
    ...(locations.length ? { locations } : {}),
    ...(industryIds.length ? { industryIds } : {}),
    ...(companySize.length ? { companySize } : {}),
    maxItems,
    startPage,
    takePages,
    scraperMode: mode,
  };
}

function firstString(record: Record<string, unknown>, keys: string[], maximum = 1_000): string {
  for (const key of keys) {
    const direct = text(record[key], maximum);
    if (direct) return direct;
    const values = list(record[key], 3);
    if (values[0]) return values[0].slice(0, maximum);
  }
  return '';
}

function locationFrom(record: Record<string, unknown>): { city: string; state: string } {
  const locations = Array.isArray(record.locations) ? record.locations : [];
  const first = object(locations[0]);
  const parsed = object(first.parsed || first.location || first);
  return {
    city: firstString(parsed, ['city', 'municipality', 'locality']) || firstString(record, ['city', 'municipality']),
    state: firstString(parsed, ['state', 'stateCode', 'region', 'province']) || firstString(record, ['state', 'stateCode', 'region']),
  };
}

function sizeFrom(record: Record<string, unknown>): string {
  const range = firstString(record, ['employeeCountRange', 'companySize', 'size', 'employeesRange'], 120);
  if (range) return range;
  const count = record.employeeCount ?? record.employees;
  if (typeof count === 'number' && Number.isFinite(count)) return String(Math.max(0, Math.floor(count)));
  return '';
}

export function normalizeLinkedInCompany(value: unknown): LinkedInCompany | null {
  const record = object(value);
  const name = firstString(record, ['name', 'companyName', 'title'], 500);
  const linkedinUrl = normalizeUrl(firstString(record, ['linkedinUrl', 'linkedinURL', 'url', 'companyUrl'], 1_000));
  if (!name || !linkedinUrl) return null;
  const location = locationFrom(record);
  const industries = Array.isArray(record.industries)
    ? record.industries.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 8).join(', ')
    : firstString(record, ['industry', 'sector'], 500);
  return {
    name,
    linkedinUrl,
    website: normalizeUrl(firstString(record, ['website', 'websiteUrl', 'companyWebsite'], 1_000)),
    phone: firstString(record, ['phone', 'phoneNumber', 'telephone'], 120) || null,
    email: firstString(record, ['email', 'emailAddress'], 254) || null,
    city: location.city,
    state: location.state,
    segment: industries,
    size: sizeFrom(record),
    sourceUrl: linkedinUrl,
  };
}

export function dedupeLinkedInCompanies(items: LinkedInCompany[]): LinkedInCompany[] {
  const seenLinkedin = new Set<string>(), seenDomains = new Set<string>(), seenCompanyLocation = new Set<string>();
  return items.filter((item) => {
    const linkedinKey = normalizeUrl(item.linkedinUrl);
    const domainKey = normalizeDomain(item.website);
    const companyLocationKey = `${normalizeKey(item.name)}|${normalizeKey(`${item.city} ${item.state}`)}`;
    if ((linkedinKey && seenLinkedin.has(linkedinKey)) || (domainKey && seenDomains.has(domainKey)) || (companyLocationKey !== '|' && seenCompanyLocation.has(companyLocationKey))) return false;
    if (linkedinKey) seenLinkedin.add(linkedinKey);
    if (domainKey) seenDomains.add(domainKey);
    if (companyLocationKey !== '|') seenCompanyLocation.add(companyLocationKey);
    return true;
  });
}

export function linkedInErrorCode(error: unknown): string {
  const status = typeof error === 'object' && error !== null && 'statusCode' in error ? Number((error as { statusCode?: unknown }).statusCode) : 0;
  const message = error instanceof Error ? error.message.toLowerCase() : text(error).toLowerCase();
  if (message === 'source_credentials_missing') return 'linkedin_credentials_required';
  if (message === 'apify_token_rejected' || message === 'apify_auth_rejected' || status === 401 || /unauthori[sz]|invalid token|token rejected/.test(message)) return 'linkedin_token_rejected';
  if (message === 'apify_resource_forbidden' || status === 403 || /forbidden|access denied/.test(message)) return 'linkedin_resource_forbidden';
  if (status === 429 || /rate.?limit|too many requests/.test(message)) return 'linkedin_rate_limited';
  if (/timeout|timed out|aborted/.test(message)) return 'linkedin_provider_timeout';
  if (message === 'apify_actor_not_found' || status === 404) return 'linkedin_actor_not_found';
  return 'linkedin_provider_error';
}
