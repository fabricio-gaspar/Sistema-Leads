import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';
import { getApifyRun, listApifyItems, startApifyRun } from '../_shared/apifyClient.ts';
import { buildLinkedInActorInput, dedupeLinkedInCompanies, linkedInErrorCode, normalizeLinkedInCompany, type LinkedInCompanyFilters } from '../_shared/linkedinCompanySearch.ts';
import { filterProspectingCandidates } from '../_shared/prospectingResultFilter.ts';
import { filterProspectsByRadius, parseProspectingGeoRadius } from '../_shared/prospectingGeo.ts';
import { readJson, requiredString } from '../_shared/validation.ts';

type Filters = {
  pais?: string; estado?: string; cidade?: string; raio?: number; centerLatitude?: number; centerLongitude?: number; atividades?: string[]; segmentos?: string[];
  portes?: string[]; cargo?: string; exigeSite?: boolean; exigeWhatsApp?: boolean; exigeEmail?: boolean; volumeMaximo?: number;
  industryIds?: string[]; companySize?: string[]; scraperMode?: 'short' | 'full'; startPage?: number; takePages?: number;
};
type SourceRow = { id: string; enabled: boolean; mode: string; connection_status: string };
type IntegrationRow = { id: string; provider: string; enabled: boolean; connected: boolean; paused: boolean };
type ProspectingRun = {
  id: string;
  source_key: 'apify' | 'linkedin';
  source_config_id: string;
  status: string;
  filters: unknown;
  provider_run_id: string | null;
  result_cache_id: string | null;
  requested_by: string | null;
  provider_start_state: 'ready' | 'attempting' | 'accepted' | 'unknown' | 'rejected';
};
type ReservedProspectingRun = {
  run_id: string;
  run_status: string;
  provider_run_id: string | null;
  result_cache_id: string | null;
  provider_start_state: ProspectingRun['provider_start_state'];
  reused: boolean;
  start_claimed: boolean;
};

const text = (value: unknown, maximum = 500): string => typeof value === 'string' ? value.trim().slice(0, maximum) : '';
const list = (value: unknown, maximum = 20): string[] => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string').map((item) => text(item, 80)).filter(Boolean).slice(0, maximum)
  : [];
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
function secureEqual(actual: string | null, expected: string): boolean { if (!actual || !expected || actual.length !== expected.length) return false; let difference = 0; for (let i = 0; i < actual.length; i += 1) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i); return difference === 0; }

function normalizeFilters(value: unknown): Filters {
  const input = object(value);
  const volume = typeof input.volumeMaximo === 'number' && Number.isFinite(input.volumeMaximo) ? Math.floor(input.volumeMaximo) : 30;
  const geo = parseProspectingGeoRadius(input, false);
  return {
    pais: text(input.pais, 80) || 'Brasil', estado: (text(input.estado, 2) || list(input.estados, 27)[0] || '').toUpperCase().slice(0, 2), cidade: text(input.cidade, 120),
    ...(geo ?? {}), atividades: list(input.atividades), segmentos: list(input.segmentos), portes: list(input.portes),
    cargo: text(input.cargo, 80), exigeSite: input.exigeSite === true, exigeWhatsApp: input.exigeWhatsApp === true,
    exigeEmail: input.exigeEmail === true, volumeMaximo: Math.max(1, Math.min(100, volume)),
    industryIds: list(input.industryIds, 20), companySize: list(input.companySize, 10),
    scraperMode: input.scraperMode === 'full' ? 'full' : 'short',
    startPage: typeof input.startPage === 'number' && Number.isFinite(input.startPage) ? Math.max(1, Math.min(100, Math.floor(input.startPage))) : 1,
    takePages: typeof input.takePages === 'number' && Number.isFinite(input.takePages) ? Math.max(1, Math.min(10, Math.floor(input.takePages))) : 1,
  };
}

function locationQuery(filters: Filters) { return [filters.cidade, filters.estado, filters.pais || 'Brasil'].filter(Boolean).join(', '); }
function terms(filters: Filters) {
  const seen = new Set<string>();
  const values = [...(filters.atividades ?? []), ...(filters.segmentos ?? [])]
    .map((value) => value.trim().replace(/\s+/g, ' '))
    .filter((value) => {
      const key = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
  return values;
}
function canonicalFilterHashPayload(filters: Filters) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const canonicalTerms = terms(filters).map(normalize).sort((left, right) => left.localeCompare(right, 'pt-BR'));
  const canonicalPorte = [...new Set((filters.portes ?? []).map(normalize))].sort((left, right) => left.localeCompare(right, 'pt-BR'));
  return JSON.stringify({ ...filters, atividades: canonicalTerms, segmentos: [], portes: canonicalPorte });
}
function stringFrom(record: Record<string, unknown>, keys: string[]): string { for (const key of keys) { const value = record[key]; if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 1_000); } return ''; }
function firstString(record: Record<string, unknown>, keys: string[]): string {
  const direct = stringFrom(record, keys);
  if (direct) return direct;
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) return value[0].trim().slice(0, 1_000);
  }
  return '';
}
function coordinate(value: unknown, limit: number): number | null { if (value == null || value === '') return null; const parsed = typeof value === 'number' ? value : Number(value); return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : null; }
const brazilianStates: Record<string, string> = { acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', distritofederal: 'DF', espiritosanto: 'ES', goias: 'GO', maranhao: 'MA', matogrosso: 'MT', matogrossodosul: 'MS', minasgerais: 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', riodejaneiro: 'RJ', riograndedonorte: 'RN', riograndedosul: 'RS', rondonia: 'RO', roraima: 'RR', santacatarina: 'SC', saopaulo: 'SP', sergipe: 'SE', tocantins: 'TO' };
function stateCode(value: string): string {
  const clean = value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase();
  return clean.length === 2 ? clean.toUpperCase() : brazilianStates[clean] || '';
}

type RawProspect = { id: string; name: string; phone: string; whatsapp: string; email: string; website: string; sourceUrl: string; cnpj: string; city: string; uf: string; segment: string; address: string; porte?: string; latitude?: number | null; longitude?: number | null };

function score(raw: RawProspect, filters: Filters) {
  const reasons: string[] = [];
  const requestedTerms = terms(filters).map((item) => item.toLocaleLowerCase('pt-BR'));
  const segment = raw.segment.toLocaleLowerCase('pt-BR');
  const segmentMatch = Boolean(segment) && requestedTerms.some((term) => segment.includes(term) || term.includes(segment));
  let fit = raw.name ? 20 : 0;
  if (segmentMatch) { fit += 40; reasons.push('atividade compatível com o filtro'); }
  else if (raw.segment) { fit += 20; reasons.push('atividade empresarial identificada'); }
  if (filters.estado && raw.uf.toUpperCase() === filters.estado) { fit += 20; reasons.push('região desejada'); }
  if (raw.website) { fit += 10; reasons.push('site empresarial encontrado'); }
  if (raw.id) fit += 10;

  let contactability = 0;
  if (raw.phone) { contactability += 30; reasons.push('telefone encontrado, ainda não validado como WhatsApp'); }
  if (raw.whatsapp) { contactability += 30; reasons.push('WhatsApp informado explicitamente pela fonte'); }
  if (raw.email) { contactability += 25; reasons.push('e-mail encontrado'); }
  if (raw.website) contactability += 15;
  const engagement = 0;
  if ((filters.exigeWhatsApp && !raw.phone && !raw.whatsapp) || (filters.exigeEmail && !raw.email) || (filters.exigeSite && !raw.website)) {
    reasons.push('um canal obrigatório não foi comprovado');
  }
  const overall = Math.round(Math.min(100, fit) * 0.65 + Math.min(100, contactability) * 0.35);
  return { overall, fit: Math.min(100, fit), contactability: Math.min(100, contactability), engagement, reason: reasons.join(' · ') || 'Empresa identificada pela fonte configurada' };
}

function external(source: 'apify' | 'linkedin', raw: RawProspect, filters: Filters) {
  const telefone = raw.phone || null, whatsapp = raw.whatsapp || null, website = raw.website || null;
  const scored = score(raw, filters);
  return {
    cnpj: raw.cnpj || null, razao_social: raw.name, nome_fantasia: raw.name || null, cnae_principal: null, cnae_descricao: raw.segment || null,
    porte: raw.porte || null, capital_social: null, situacao: null, data_abertura: null, telefone, whatsapp, email: raw.email || null,
    logradouro: raw.address || null, numero: null, bairro: null, municipio: raw.city || null, uf: stateCode(raw.uf) || null,
    cep: null, website, latitude: raw.latitude ?? null, longitude: raw.longitude ?? null, distance_km: null,
    deterministic_score: scored.overall, score: scored.overall, fit_score: scored.fit, contactability_score: scored.contactability, engagement_score: scored.engagement,
    score_reason: scored.reason, source, source_record_id: raw.id, source_url: raw.sourceUrl || null,
    channel_verification: { whatsapp: whatsapp ? 'source_reported' : telefone ? 'unverified' : 'absent', email: raw.email ? 'format_pending' : 'absent' },
    contact_approval_status: 'pending',
  };
}

function normalizeApify(item: unknown, filters: Filters) {
  const record = object(item), address = object(record.address), location = object(record.location);
  const phone = stringFrom(record, ['phone', 'phoneNumber', 'telephone', 'contactPhone']);
  const whatsapp = stringFrom(record, ['whatsapp', 'whatsappNumber']);
  const website = stringFrom(record, ['website', 'websiteUrl', 'companyWebsite']);
  const name = stringFrom(record, ['title', 'name', 'businessName', 'companyName']);
  const sourceUrl = stringFrom(record, ['url', 'googleMapsUrl', 'placeUrl']);
  const id = stringFrom(record, ['placeId', 'place_id', 'cid', 'id']) || sourceUrl;
  if (!name || !id) return null;
  return external('apify', {
    id, name, phone, whatsapp, email: firstString(record, ['email', 'emailAddress', 'emails']), website, sourceUrl, cnpj: stringFrom(record, ['cnpj', 'taxId']), city: stringFrom(record, ['city', 'municipality']) || stringFrom(address, ['city']),
    uf: stringFrom(record, ['state', 'stateCode', 'region']) || stringFrom(address, ['state']), segment: stringFrom(record, ['categoryName', 'category', 'industry']),
    address: stringFrom(record, ['address', 'streetAddress', 'fullAddress']) || stringFrom(address, ['full', 'label', 'address']),
    latitude: coordinate(record.latitude ?? record.lat ?? location.lat ?? location.latitude, 85), longitude: coordinate(record.longitude ?? record.lng ?? location.lng ?? location.longitude, 180),
  }, filters);
}

function linkedinFilters(filters: Filters): LinkedInCompanyFilters {
  return {
    // This Actor accepts one search expression, not a list of alternatives.
    searchQuery: terms(filters)[0] || '',
    locations: [locationQuery(filters)],
    industryIds: filters.industryIds,
    companySize: filters.companySize?.length ? filters.companySize : filters.portes,
    maxItems: filters.volumeMaximo ?? 30,
    startPage: filters.startPage,
    takePages: filters.takePages,
    mode: filters.scraperMode,
  };
}

function normalizeLinkedIn(item: unknown, filters: Filters) {
  const company = normalizeLinkedInCompany(item);
  if (!company) return null;
  return external('linkedin', {
    id: company.linkedinUrl,
    name: company.name,
    phone: company.phone || '',
    whatsapp: '',
    email: company.email || '',
    website: company.website,
    sourceUrl: company.sourceUrl,
    cnpj: '',
    city: company.city,
    uf: company.state,
    segment: company.segment,
    porte: company.size,
    address: '',
  }, filters);
}

function apifyInput(credentials: Record<string, unknown>, filters: Filters) {
  let configured: Record<string, unknown> = {};
  const inputJson = text(credentials.input_json, 20_000);
  if (inputJson) { try { configured = object(JSON.parse(inputJson)); } catch { throw new Error('source_input_invalid'); } }
  const volume = filters.volumeMaximo ?? 30;
  const searchStringsArray = terms(filters).slice(0, volume);
  const geo = parseProspectingGeoRadius(filters as Record<string, unknown>, false);
  if (geo) {
    // The Google Maps Actor treats customGeolocation and text geography as alternatives.
    // Do not let an old Vault input silently override the user's selected point.
    for (const key of ['locationQuery', 'customGeolocation', 'startUrls', 'placeIds', 'countryCode', 'country', 'state', 'city', 'county', 'postalCode', 'latitude', 'longitude', 'lat', 'lng']) delete configured[key];
  }
  // The Actor's limit is per search term, not per run. Keep the requested budget bounded.
  return {
    ...configured, searchStringsArray,
    ...(geo ? { customGeolocation: { type: 'Point', coordinates: [geo.centerLongitude, geo.centerLatitude], radiusKm: geo.raio } } : { locationQuery: locationQuery(filters) }),
    maxCrawledPlacesPerSearch: Math.max(1, Math.floor(volume / searchStringsArray.length)),
  };
}

function supportsMapRadius(credentials: Record<string, unknown>): boolean {
  if (text(credentials.task_id, 300)) return false;
  const actor = text(credentials.actor_id, 300).toLowerCase().replace('~', '/');
  return actor === 'compass/google-maps-extractor' || actor === 'compass/crawler-google-places';
}

function providerFailure(sourceKey: 'apify' | 'linkedin', status: string) { return `${sourceKey}_run_${status.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`; }
function providerStartWasRejected(message: string) {
  // Uma resposta de start sem identificador pode representar um POST aceito
  // cujo retorno foi corrompido. Ela é ambígua e jamais autoriza um novo POST.
  return /^(apify_auth_rejected|apify_token_rejected|apify_resource_forbidden|apify_actor_not_found|linkedin_token_rejected|linkedin_resource_forbidden|linkedin_actor_not_found|linkedin_credentials_required|source_credentials_missing|source_input_invalid)$/.test(message);
}

function isApifySource(sourceKey: 'apify' | 'linkedin'): boolean { return sourceKey === 'apify' || sourceKey === 'linkedin'; }

async function startApify(credentials: Record<string, unknown>, filters: Filters) {
  const run = await startApifyRun(credentials, apifyInput(credentials, filters));
  return { providerRunId: run.id, status: run.status, datasetId: run.defaultDatasetId };
}

async function apifyRun(credentials: Record<string, unknown>, providerRunId: string) {
  const run = await getApifyRun(credentials, providerRunId);
  return { status: run.status, datasetId: run.defaultDatasetId };
}

async function apifyItems(credentials: Record<string, unknown>, datasetId: string, filters: Filters) {
  const items = await listApifyItems(credentials, datasetId, filters.volumeMaximo ?? 30);
  return { rawCount: items.length, leads: items.map((item) => normalizeApify(item, filters)).filter((item): item is NonNullable<typeof item> => item !== null) };
}

async function linkedinStart(credentials: Record<string, unknown>, filters: Filters) {
  try {
    const run = await startApifyRun(credentials, buildLinkedInActorInput(credentials, linkedinFilters(filters)));
    return { providerRunId: run.id, status: run.status, datasetId: run.defaultDatasetId };
  } catch (error) {
    throw new Error(linkedInErrorCode(error));
  }
}

async function linkedinItems(credentials: Record<string, unknown>, datasetId: string, filters: Filters) {
  const items = await listApifyItems(credentials, datasetId, filters.volumeMaximo ?? 30);
  const normalized = items.map((item) => normalizeLinkedIn(item, filters)).filter((item): item is NonNullable<typeof item> => item !== null);
  const leads = dedupeLinkedInCompanies(normalized.map((item) => ({
    name: item.razao_social || '', linkedinUrl: item.source_url || '', website: item.website || '', phone: item.telefone || null,
    email: item.email || null, city: item.municipio || '', state: item.uf || '', segment: item.cnae_descricao || '', size: item.porte || '', sourceUrl: item.source_url || '',
  }))).map((company) => external('linkedin', {
    id: company.linkedinUrl, name: company.name, phone: company.phone || '', whatsapp: '', email: company.email || '', website: company.website,
    sourceUrl: company.sourceUrl, cnpj: '', city: company.city, uf: company.state, segment: company.segment, porte: company.size, address: '',
  }, filters));
  return { rawCount: items.length, leads };
}

async function hash(value: string) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, '0')).join(''); }

async function loadRunDiagnostics(admin: ReturnType<typeof createAdminClient>, organizationId: string, runId: string) {
  const { data, error } = await admin.from('audit_logs').select('event_data')
    .eq('organization_id', organizationId).eq('entity_table', 'prospecting_runs')
    .eq('entity_id', runId).eq('action', 'prospecting.completed').limit(1).maybeSingle();
  if (error || !data) return undefined;
  const recorded = object(object(data.event_data).diagnostics);
  const keys = ['providerItemsRead', 'normalizedCount', 'matchedCount', 'rejectedByContact', 'rejectedByEmail', 'rejectedByWebsite'] as const;
  if (!keys.every((key) => Number.isInteger(recorded[key]) && Number(recorded[key]) >= 0)) return undefined;
  const diagnostics = Object.fromEntries(keys.map((key) => [key, recorded[key]]));
  for (const key of ['rejectedByRadius', 'missingCoordinates']) {
    if (Number.isInteger(recorded[key]) && Number(recorded[key]) >= 0) diagnostics[key] = recorded[key];
  }
  return diagnostics;
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, error: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request); if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, headers);
  let runId: string | null = null, admin: ReturnType<typeof createAdminClient> | null = null, sourceId: string | null = null;
  let failRunOnError = false, providerStartInFlight = false, providerStartRejected = false;
  try {
    const body = await readJson(request), sourceKey = requiredString(body.sourceKey, 'source_key', 80) as 'apify' | 'linkedin';
    if (!['apify', 'linkedin'].includes(sourceKey)) throw new Error('source_not_supported');
    if (body.action != null && !['list_runs', 'open_cache'].includes(String(body.action))) throw new Error('prospecting_action_not_allowed');
    if (body.mode !== 'production') throw new Error('production_mode_required');
    const requestedRunId = text(body.runId, 80);
    const requestedIdempotencyKey = text(body.idempotencyKey, 120);
    admin = createAdminClient();
    const schedulerToken = request.headers.get('x-leadai-scheduler-token');
    let organizationId = '', requestedBy = '', actorName = 'Ana · operação automática', actorType = 'user', canReadAll = false;
    let idempotencyKey = '', executionScopeKey = '';
    if (schedulerToken) {
      organizationId = text(body.organization_id, 80);
      const scheduleRunId = text(body.schedule_run_id, 80);
      if (!organizationId || !scheduleRunId || body.source !== 'server_scheduler' || sourceKey !== 'apify') throw new Error('scheduler_request_invalid');
      const [{ data: scheduler }, { data: scheduleRun }] = await Promise.all([
        admin.from('integrations').select('id').eq('organization_id', organizationId).eq('key', 'scheduler').maybeSingle(),
        admin.from('prospecting_schedule_runs').select('requested_by,schedule_id,status').eq('organization_id', organizationId).eq('id', scheduleRunId).in('status', ['queued','running']).maybeSingle(),
      ]);
      if (!scheduler || !scheduleRun?.requested_by) throw new Error('scheduler_request_invalid');
      const { data: secret, error: secretError } = await admin.rpc('read_integration_secret', { p_integration: scheduler.id });
      const expected = text(object(secret).scheduler_token, 1_000);
      if (secretError || expected.length < 48 || !secureEqual(schedulerToken, expected)) throw new Error('scheduler_authentication_failed');
      requestedBy = scheduleRun.requested_by; actorType = 'system';
      idempotencyKey = `schedule:${scheduleRunId}`;
      executionScopeKey = `schedule:${scheduleRunId}`;
    } else {
      const { user } = await requireUser(request);
      const { data: profile, error: profileError } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
      if (profileError || !profile?.active_organization_id) throw new Error('organization_context_required');
      organizationId = profile.active_organization_id as string; requestedBy = user.id; actorName = profile.name || 'Usuário';
      await requireOrganizationRole(admin, user.id, organizationId, ['owner', 'admin', 'manager', 'seller', 'sdr']);
      const { data: membership, error: membershipError } = await admin.from('organization_members')
        .select('role,status').eq('organization_id', organizationId).eq('user_id', user.id).maybeSingle();
      if (membershipError || !membership || membership.status !== 'active') throw new Error('organization_access_denied');
      canReadAll = ['owner', 'admin', 'administrador'].includes(membership.role);
      if (!requestedRunId && !body.action && !requestedIdempotencyKey) throw new Error('prospecting_request_key_required');
      if (requestedIdempotencyKey && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedIdempotencyKey)) throw new Error('prospecting_request_key_required');
      idempotencyKey = requestedIdempotencyKey ? `manual:${requestedBy}:${requestedIdempotencyKey}` : '';
      executionScopeKey = `manual:${requestedBy}`;
    }
    if (body.action === 'list_runs') {
      if (schedulerToken) throw new Error('prospecting_action_not_allowed');
      let runQuery = admin.from('prospecting_runs')
        .select('id,status,source_key,started_at,result_count,result_cache_id,provider_run_id,provider_start_state,last_error,filters,requested_by')
        .eq('organization_id', organizationId).eq('source_key', sourceKey);
      let cacheQuery = admin.from('prospecting_cache')
        .select('id,total_found,created_at,filters,user_id')
        .eq('organization_id', organizationId).eq('source', sourceKey)
        .gt('expires_at', new Date().toISOString());
      if (!canReadAll) {
        runQuery = runQuery.eq('requested_by', requestedBy);
        cacheQuery = cacheQuery.eq('user_id', requestedBy);
      }
      const [{ data: runs, error: listError }, { data: caches, error: cachesError }] = await Promise.all([
        runQuery.order('started_at', { ascending: false }).limit(20),
        cacheQuery.order('created_at', { ascending: false }).limit(20),
      ]);
      if (listError || cachesError) throw new Error('prospecting_runs_unavailable');
      const cacheIds = (caches ?? []).map((cache) => cache.id as string);
      const { data: linked, error: linkedError } = cacheIds.length
        ? await admin.from('prospecting_runs').select('result_cache_id').eq('organization_id', organizationId).in('result_cache_id', cacheIds)
        : { data: [], error: null };
      if (linkedError) throw new Error('prospecting_runs_unavailable');
      const linkedIds = new Set((linked ?? []).map((run) => run.result_cache_id));
      const runRows = (runs ?? []).map((run) => ({
        id: run.id, sourceKey: run.source_key, status: run.status, startedAt: run.started_at, resultCount: run.result_count,
        hasProvider: isApifySource(run.source_key) && Boolean(run.provider_run_id), hasResults: Boolean(run.result_cache_id),
        providerStartState: run.provider_start_state,
        lastError: run.last_error, location: locationQuery(normalizeFilters(run.filters)),
        fromTeam: run.requested_by !== requestedBy,
      }));
      const historicalCaches = (caches ?? []).filter((cache) => !linkedIds.has(cache.id)).map((cache) => ({
        id: cache.id, sourceKey, status: 'cached', startedAt: cache.created_at, resultCount: cache.total_found,
        hasProvider: false, hasResults: true, lastError: null, fromTeam: cache.user_id !== requestedBy,
        location: [text(object(cache.filters).municipio, 120), text(object(cache.filters).uf, 2), 'Brasil'].filter(Boolean).join(', '),
      }));
      return json({ ok: true, runs: [...runRows, ...historicalCaches].sort((left, right) => String(right.startedAt).localeCompare(String(left.startedAt))) }, 200, headers);
    }
    if (body.action === 'open_cache') {
      if (schedulerToken) throw new Error('prospecting_action_not_allowed');
      const cacheId = text(body.cacheId, 80);
      if (!cacheId) throw new Error('prospecting_results_unavailable');
      let cacheQuery = admin.from('prospecting_cache').select('results').eq('id', cacheId)
        .eq('organization_id', organizationId).eq('source', sourceKey).gt('expires_at', new Date().toISOString());
      if (!canReadAll) cacheQuery = cacheQuery.eq('user_id', requestedBy);
      const { data: cache, error: cacheError } = await cacheQuery.maybeSingle();
      if (cacheError || !cache || !Array.isArray(cache.results)) throw new Error('prospecting_results_unavailable');
      const { data: linkedRun } = await admin.from('prospecting_runs').select('id')
        .eq('organization_id', organizationId).eq('source_key', sourceKey).eq('result_cache_id', cacheId).limit(1).maybeSingle();
      const diagnostics = linkedRun?.id ? await loadRunDiagnostics(admin, organizationId, linkedRun.id) : undefined;
      return json({ ok: true, pending: false, cacheId, sourceKey, leads: cache.results, diagnostics }, 200, headers);
    }
    let existingRun: ProspectingRun | null = null;
    let providerStartClaimed = false;
    if (requestedRunId) {
      let existingQuery = admin.from('prospecting_runs')
        .select('id,source_key,source_config_id,status,filters,provider_run_id,result_cache_id,requested_by,provider_start_state')
        .eq('id', requestedRunId).eq('organization_id', organizationId);
      if (!canReadAll) existingQuery = existingQuery.eq('requested_by', requestedBy);
      const { data: run, error: runError } = await existingQuery.maybeSingle() as { data: ProspectingRun | null; error: unknown };
      if (runError || !run || run.source_key !== sourceKey) throw new Error('prospecting_run_not_found');
      existingRun = run;
      runId = run.id;
      if (run.status === 'completed') {
        if (!run.result_cache_id) throw new Error('prospecting_results_unavailable');
        const { data: cache, error: cacheError } = await admin.from('prospecting_cache')
          .select('results').eq('id', run.result_cache_id).eq('organization_id', organizationId).maybeSingle();
        if (cacheError || !cache || !Array.isArray(cache.results)) throw new Error('prospecting_results_unavailable');
        const diagnostics = await loadRunDiagnostics(admin, organizationId, runId);
        return json({ ok: true, pending: false, runId, cacheId: run.result_cache_id, sourceKey, leads: cache.results, diagnostics }, 200, headers);
      }
    }
    const { data: source, error: sourceError } = await admin.from('lead_source_configs').select('id,enabled,mode,connection_status').eq('organization_id', organizationId).eq('source_key', sourceKey).maybeSingle() as { data: SourceRow | null; error: unknown };
    if (sourceError || !source) throw new Error('source_not_configured'); sourceId = source.id;
    if (existingRun && existingRun.source_config_id !== source.id) throw new Error('prospecting_run_not_found');
    if (!source.enabled || source.connection_status !== 'connected') throw new Error('source_disabled');
    const { data: integration, error: integrationError } = await admin.from('integrations').select('id,provider,enabled,connected,paused').eq('organization_id', organizationId).eq('key', sourceKey).maybeSingle() as { data: IntegrationRow | null; error: unknown };
    if (integrationError || !integration) throw new Error('source_not_configured');
    if (!integration.enabled || !integration.connected || integration.paused) throw new Error('source_disabled');
    const { data: credentials, error: credentialsError } = await admin.rpc('read_integration_secret', { p_integration: integration.id });
    if (credentialsError || !credentials) throw new Error('source_credentials_missing');

    let filters: Filters, providerRunId = '', datasetId = '';
    if (!existingRun) {
      const requestedGeo = object(body.filters);
      if (sourceKey === 'linkedin' && ['raio', 'centerLatitude', 'centerLongitude'].some((key) => requestedGeo[key] !== undefined)) throw new Error('prospecting_radius_source_unsupported');
      const selectedGeo = parseProspectingGeoRadius(requestedGeo);
      if (sourceKey === 'apify' && selectedGeo && !supportsMapRadius(credentials as Record<string, unknown>)) throw new Error('prospecting_radius_actor_unsupported');
      filters = normalizeFilters(body.filters);
      if (!filters.cidade?.trim()) throw new Error('prospecting_city_required');
      if (!terms(filters).length) throw new Error('prospecting_terms_required');
      if (sourceKey === 'apify' && terms(filters).length > (filters.volumeMaximo ?? 30)) throw new Error('prospecting_volume_below_terms');
      if (sourceKey === 'linkedin') {
        filters.atividades = terms(filters).slice(0, 1);
        filters.segmentos = [];
      }
      const filtersJson = JSON.parse(JSON.stringify(filters));
      const filtersHash = await hash(`${sourceKey}:${canonicalFilterHashPayload(filters)}`);
      const { data: reserved, error: reserveError } = await admin.rpc('reserve_prospecting_run', {
        p_organization_id: organizationId,
        p_source_config_id: source.id,
        p_source_key: sourceKey,
        p_mode: 'production',
        p_filters: filtersJson,
        p_filters_hash: filtersHash,
        p_requested_quantity: filters.volumeMaximo,
        p_requested_by: requestedBy,
        p_idempotency_key: idempotencyKey,
        p_execution_scope_key: executionScopeKey,
      });
      const reservation = Array.isArray(reserved) ? reserved[0] as ReservedProspectingRun | undefined : undefined;
      if (reserveError || !reservation?.run_id) throw new Error('prospecting_run_reservation_failed');
      runId = reservation.run_id;
      providerStartClaimed = reservation.start_claimed === true;
      existingRun = {
        id: reservation.run_id,
        source_key: sourceKey,
        source_config_id: source.id,
        status: reservation.run_status,
        filters: filtersJson,
        provider_run_id: reservation.provider_run_id,
        result_cache_id: reservation.result_cache_id,
        requested_by: requestedBy,
        provider_start_state: reservation.provider_start_state,
      };
    } else {
      filters = normalizeFilters(existingRun.filters);
    }

    if (existingRun.status === 'completed') {
      if (!existingRun.result_cache_id) throw new Error('prospecting_results_unavailable');
      const { data: cache, error: cacheError } = await admin.from('prospecting_cache')
        .select('results').eq('id', existingRun.result_cache_id).eq('organization_id', organizationId).maybeSingle();
      if (cacheError || !cache || !Array.isArray(cache.results)) throw new Error('prospecting_results_unavailable');
      const diagnostics = await loadRunDiagnostics(admin, organizationId, existingRun.id);
      return json({ ok: true, pending: false, runId, cacheId: existingRun.result_cache_id, sourceKey, leads: cache.results, diagnostics }, 200, headers);
    }
    if (existingRun.status !== 'running' || !existingRun.requested_by) throw new Error('prospecting_run_not_pending');

    let providerState = existingRun.provider_start_state || (existingRun.provider_run_id ? 'accepted' : 'unknown');
    // Recupera com prova uma execução iniciada pela versão anterior durante a
    // troca: existe provider_run_id, mas o novo estado ainda não foi gravado.
    if (isApifySource(sourceKey) && existingRun.provider_run_id && providerState === 'ready') {
      const { data: recovered, error: recoveryError } = await admin.from('prospecting_runs').update({
        provider_start_state: 'accepted',
        provider_start_confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', runId).eq('status', 'running').eq('provider_start_state', 'ready').select('id').maybeSingle();
      if (recoveryError || !recovered) throw new Error('prospecting_start_recovery_unconfirmed');
      providerState = 'accepted';
      existingRun.provider_start_state = 'accepted';
    }
    if (isApifySource(sourceKey) && providerState === 'unknown') throw new Error('prospecting_start_unconfirmed');
    if (isApifySource(sourceKey) && providerState === 'rejected') throw new Error('prospecting_run_not_pending');
    if (isApifySource(sourceKey) && providerState === 'attempting' && !providerStartClaimed) {
      return json({ ok: true, pending: true, runId, sourceKey, message: 'O início da busca está sendo confirmado; nenhum novo pedido foi enviado.' }, 202, headers);
    }

    if (existingRun.provider_run_id) {
      if (!isApifySource(sourceKey)) throw new Error('prospecting_run_not_pending');
      providerRunId = existingRun.provider_run_id;
      const provider = await apifyRun(credentials as Record<string, unknown>, providerRunId);
      if (provider.status !== 'SUCCEEDED') {
        if (['FAILED', 'ABORTED', 'TIMED-OUT', 'TIMED_OUT'].includes(provider.status)) { failRunOnError = true; throw new Error(providerFailure(sourceKey, provider.status)); }
        return json({ ok: true, pending: true, runId, sourceKey, message: 'A fonte ainda está processando a busca.' }, 202, headers);
      }
      datasetId = provider.datasetId;
    } else if (isApifySource(sourceKey)) {
      if (!providerStartClaimed || providerState !== 'attempting') throw new Error('prospecting_start_unconfirmed');
      providerStartInFlight = true;
      const provider = sourceKey === 'linkedin'
        ? await linkedinStart(credentials as Record<string, unknown>, filters)
        : await startApify(credentials as Record<string, unknown>, filters);
      providerRunId = provider.providerRunId;
      datasetId = provider.datasetId;
      const { data: savedProviderRun, error: updateError } = await admin.from('prospecting_runs').update({
        provider_run_id: providerRunId,
        provider_start_state: 'accepted',
        provider_start_confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', runId).eq('status', 'running').eq('provider_start_state', 'attempting').select('id').maybeSingle();
      if (updateError || !savedProviderRun) throw new Error('prospecting_provider_id_not_saved');
      providerStartInFlight = false;
      if (provider.status !== 'SUCCEEDED') {
        if (['FAILED', 'ABORTED', 'TIMED-OUT', 'TIMED_OUT'].includes(provider.status)) { failRunOnError = true; throw new Error(providerFailure(sourceKey, provider.status)); }
        return json({ ok: true, pending: true, runId, sourceKey, message: 'A fonte iniciou a busca. Aguardando os resultados.' }, 202, headers);
      }
    } else {
      if (!providerStartClaimed) throw new Error('prospecting_start_unconfirmed');
      providerRunId = `google-${crypto.randomUUID()}`;
      const { data: savedProviderRun, error: updateError } = await admin.from('prospecting_runs').update({
        provider_run_id: providerRunId,
        provider_start_state: 'accepted',
        provider_start_confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', runId).eq('status', 'running').eq('provider_start_state', 'attempting').select('id').maybeSingle();
      if (updateError || !savedProviderRun) throw new Error('prospecting_provider_id_not_saved');
    }

    const result = sourceKey === 'apify'
      ? { providerRunId, ...await apifyItems(credentials as Record<string, unknown>, datasetId, filters) }
      : { providerRunId, ...await linkedinItems(credentials as Record<string, unknown>, datasetId, filters) };
    const geo = parseProspectingGeoRadius(filters as Record<string, unknown>, false);
    const geographicallyFiltered = geo ? filterProspectsByRadius(result.leads, geo) : null;
    const filtered = filterProspectingCandidates(geographicallyFiltered?.leads ?? result.leads, filters, filters.volumeMaximo ?? 30);
    const leads = filtered.leads;
    const diagnostics = {
      providerItemsRead: result.rawCount, ...filtered.diagnostics,
      normalizedCount: result.leads.length, matchedCount: leads.length,
      ...(geographicallyFiltered?.diagnostics ?? {}),
    };
    const { data: finalized, error: finalizeError } = await admin.rpc('finalize_prospecting_run', {
      p_run_id: runId, p_organization_id: organizationId, p_requested_by: existingRun?.requested_by || requestedBy,
      p_provider_run_id: result.providerRunId,
      p_cache_filters: { source: sourceKey, uf: filters.estado || null, municipio: filters.cidade || null, keyword: sourceKey === 'linkedin' ? terms(filters)[0] : terms(filters).join(' '), limit: filters.volumeMaximo, ...(geo ?? {}) },
      p_results: leads,
      p_name: `${sourceKey} · ${filters.cidade || filters.estado || 'Brasil'} · ${new Date().toLocaleDateString('pt-BR')}`,
    });
    if (finalizeError || !Array.isArray(finalized) || !finalized[0]?.cache_id) throw new Error('prospecting_result_not_saved');
    const cacheId = finalized[0].cache_id as string;
    let finalLeads = leads;
    if (!finalized[0].newly_completed) {
      const { data: savedCache, error: cacheError } = await admin.from('prospecting_cache').select('results').eq('id', cacheId).eq('organization_id', organizationId).maybeSingle();
      if (cacheError || !savedCache || !Array.isArray(savedCache.results)) throw new Error('prospecting_results_unavailable');
      finalLeads = savedCache.results;
    } else {
      const now = new Date().toISOString();
      const [{ error: sourceUpdateError }, { error: auditError }] = await Promise.all([
        admin.from('lead_source_configs').update({ last_success_at: now, last_error: null, last_error_at: null }).eq('id', source.id),
        admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: actorType === 'user' ? requestedBy : null, actor_name: actorName, actor_type: actorType, action: 'prospecting.completed', detail: `Busca real concluída via ${sourceKey}.`, entity_table: 'prospecting_runs', entity_id: runId, event_data: { sourceKey, resultCount: leads.length, requestedQuantity: filters.volumeMaximo, cacheId, diagnostics } }),
      ]);
      if (sourceUpdateError || auditError) console.error('prospecting_completion_metadata_failed', { sourceUpdateFailed: Boolean(sourceUpdateError), auditFailed: Boolean(auditError), runId });
    }
    return json({ ok: true, pending: false, runId, cacheId, sourceKey, leads: finalLeads, diagnostics }, 200, headers);
  } catch (error) {
    const message = safeError(error), now = new Date().toISOString();
    if (admin && runId && providerStartInFlight) {
      const rejected = providerStartWasRejected(message);
      providerStartRejected = rejected;
      await admin.from('prospecting_runs').update({
        provider_start_state: rejected ? 'rejected' : 'unknown',
        ...(rejected ? { status: 'failed', completed_at: now } : {}),
        last_error: message,
        updated_at: now,
      }).eq('id', runId).eq('status', 'running').eq('provider_start_state', 'attempting');
      failRunOnError = false;
    }
    if (admin && runId && failRunOnError) {
      await admin.from('prospecting_runs').update({ status: 'failed', last_error: message, completed_at: now, updated_at: now }).eq('id', runId).eq('status', 'running');
    }
    if (admin && sourceId && (providerStartRejected || failRunOnError || providerStartWasRejected(message))) {
      await admin.from('lead_source_configs').update({ last_error: message, last_error_at: now, updated_at: now }).eq('id', sourceId);
    }
    return json({ ok: false, error: message, runId, recoverable: Boolean(runId && !failRunOnError && !providerStartRejected) }, 400, headers);
  }
});
