import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';
import { readJson, requiredString } from '../_shared/validation.ts';

type Filters = {
  pais?: string;
  estado?: string;
  cidade?: string;
  raio?: number;
  atividades?: string[];
  segmentos?: string[];
  portes?: string[];
  cargo?: string;
  exigeSite?: boolean;
  exigeWhatsApp?: boolean;
  exigeEmail?: boolean;
  volumeMaximo?: number;
};

type SourceRow = {
  id: string;
  enabled: boolean;
  mode: string;
  connection_status: string;
};

type IntegrationRow = {
  id: string;
  provider: string;
  enabled: boolean;
  connected: boolean;
  paused: boolean;
};

const text = (value: unknown, max = 500): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
const list = (value: unknown, maxItems = 20): string[] => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, maxItems)
  : [];
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

function normalizeFilters(value: unknown): Filters {
  const raw = object(value);
  const volume = typeof raw.volumeMaximo === 'number' && Number.isFinite(raw.volumeMaximo) ? Math.floor(raw.volumeMaximo) : 30;
  const radius = typeof raw.raio === 'number' && Number.isFinite(raw.raio) ? Math.floor(raw.raio) : 50;
  return {
    pais: text(raw.pais, 80), estado: text(raw.estado, 2).toUpperCase(), cidade: text(raw.cidade, 120), raio: Math.max(1, Math.min(200, radius)),
    atividades: list(raw.atividades), segmentos: list(raw.segmentos), portes: list(raw.portes), cargo: text(raw.cargo, 80),
    exigeSite: raw.exigeSite === true, exigeWhatsApp: raw.exigeWhatsApp === true, exigeEmail: raw.exigeEmail === true,
    volumeMaximo: Math.max(1, Math.min(500, volume)),
  };
}

function locationQuery(filters: Filters): string {
  return [filters.cidade, filters.estado, filters.pais || 'Brasil'].filter(Boolean).join(', ');
}

function searchTerms(filters: Filters): string[] {
  const values = [...(filters.atividades ?? []), ...(filters.segmentos ?? [])];
  return values.length ? values.slice(0, 10) : ['empresas'];
}

function stringFrom(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 1_000);
  }
  return '';
}

function normalizeApifyItem(item: unknown, index: number, filters: Filters): Record<string, unknown> {
  const record = object(item);
  const address = object(record.address);
  const location = object(record.location);
  const phone = stringFrom(record, ['phone', 'phoneNumber', 'telephone', 'contactPhone']);
  const website = stringFrom(record, ['website', 'websiteUrl', 'url', 'companyWebsite']);
  const name = stringFrom(record, ['title', 'name', 'businessName', 'companyName']) || `Empresa ${index + 1}`;
  const addressText = stringFrom(record, ['address', 'streetAddress', 'fullAddress']) || stringFrom(address, ['full', 'label', 'address']);
  const externalId = stringFrom(record, ['placeId', 'place_id', 'cid', 'id']) || `apify-${index}-${crypto.randomUUID()}`;
  return {
    externalId,
    nome: stringFrom(record, ['contactName', 'contact', 'ownerName']),
    empresa: name,
    telefone: phone,
    whatsapp: phone,
    email: stringFrom(record, ['email', 'emailAddress']),
    site: website,
    cidade: stringFrom(record, ['city', 'municipality']) || stringFrom(address, ['city']) || filters.cidade || stringFrom(location, ['city']),
    estado: stringFrom(record, ['state', 'stateCode', 'region']) || filters.estado || stringFrom(address, ['state']),
    cargo: filters.cargo || '',
    segmento: stringFrom(record, ['categoryName', 'category', 'industry']) || searchTerms(filters)[0],
    porte: '',
    sourceUrl: website || stringFrom(record, ['url']),
    sourceMetadata: { provider: 'apify', address: addressText, rating: record.rating ?? null },
  };
}

function normalizeGooglePlace(item: unknown, index: number, filters: Filters): Record<string, unknown> {
  const record = object(item);
  const displayName = object(record.displayName);
  const types = Array.isArray(record.types)
    ? record.types.filter((type): type is string => typeof type === 'string').join(', ')
    : '';
  const name = text(displayName.text, 1_000) || `Empresa ${index + 1}`;
  const phone = text(record.internationalPhoneNumber || record.nationalPhoneNumber, 100);
  return {
    externalId: text(record.id, 300) || `google-${index}-${crypto.randomUUID()}`,
    nome: '',
    empresa: name,
    telefone: phone,
    whatsapp: phone,
    email: '',
    site: text(record.websiteUri, 1_000),
    cidade: filters.cidade || '',
    estado: filters.estado || '',
    cargo: filters.cargo || '',
    segmento: types || searchTerms(filters)[0],
    porte: '',
    sourceUrl: text(record.googleMapsUri || record.websiteUri, 1_000),
    sourceMetadata: { provider: 'google_places', address: text(record.formattedAddress, 1_000), rating: record.rating ?? null },
  };
}

async function callApify(credentials: Record<string, unknown>, filters: Filters): Promise<{ leads: Record<string, unknown>[]; providerRunId: string }> {
  const token = text(credentials.api_token || credentials.token, 300);
  const actorId = text(credentials.actor_id, 300);
  const taskId = text(credentials.task_id, 300);
  if (!token || (!actorId && !taskId)) throw new Error('source_credentials_missing');

  let configuredInput = object(credentials.input);
  const inputJson = text(credentials.input_json, 20_000);
  if (inputJson) {
    try { configuredInput = object(JSON.parse(inputJson)); } catch { throw new Error('source_input_invalid'); }
  }
  const input: Record<string, unknown> = {
    ...configuredInput,
    searchStringsArray: searchTerms(filters),
    locationQuery: locationQuery(filters),
    maxCrawledPlacesPerSearch: filters.volumeMaximo,
    maxResults: filters.volumeMaximo,
  };
  const path = taskId ? `/v2/actor-tasks/${encodeURIComponent(taskId)}/runs` : `/v2/acts/${encodeURIComponent(actorId)}/runs`;
  const response = await fetch(`https://api.apify.com${path}?token=${encodeURIComponent(token)}&waitForFinish=120`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('provider_error');
  const runBody = object(await response.json());
  const runData = object(runBody.data);
  const datasetId = text(runData.defaultDatasetId, 300);
  const providerRunId = text(runData.id, 300);
  if (!datasetId || !providerRunId) throw new Error('provider_invalid_response');

  const datasetResponse = await fetch(`https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=true&limit=${filters.volumeMaximo}&token=${encodeURIComponent(token)}`);
  if (!datasetResponse.ok) throw new Error('provider_error');
  const items = await datasetResponse.json();
  if (!Array.isArray(items)) throw new Error('provider_invalid_response');
  return { providerRunId, leads: items.slice(0, filters.volumeMaximo).map((item, index) => normalizeApifyItem(item, index, filters)) };
}

async function callGooglePlaces(credentials: Record<string, unknown>, filters: Filters): Promise<{ leads: Record<string, unknown>[]; providerRunId: string }> {
  const apiKey = text(credentials.api_key, 300);
  if (!apiKey) throw new Error('source_credentials_missing');
  const query = `${searchTerms(filters).join(' ')} em ${locationQuery(filters)}`;
  const limite = Math.min(filters.volumeMaximo, 60);
  const fieldMask = 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.types,places.googleMapsUri,places.rating,nextPageToken';
  const results: unknown[] = [];
  let pageToken = '';

  // A Places API (New) retorna até 60 resultados paginados. O limite pedido
  // pelo usuário é sempre respeitado antes de devolvermos qualquer lead.
  while (results.length < limite) {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: 'pt-BR',
        regionCode: 'BR',
        pageSize: Math.min(20, limite - results.length),
        ...(pageToken ? { pageToken } : {}),
      }),
    });
    if (!response.ok) throw new Error('provider_error');
    const body = object(await response.json());
    const page = Array.isArray(body.places) ? body.places : [];
    results.push(...page.slice(0, limite - results.length));
    pageToken = text(body.nextPageToken, 1_000);
    if (!pageToken || page.length === 0) break;
  }
  const leads = results.slice(0, limite).map((item, index) => normalizeGooglePlace(item, index, filters));
  return { providerRunId: `google-${crypto.randomUUID()}`, leads };
}

async function hash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, error: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, headers);

  let runId: string | null = null;
  let admin: ReturnType<typeof createAdminClient> | null = null;
  let organizationId: string | null = null;
  let sourceId: string | null = null;
  let integrationId: string | null = null;
  try {
    const body = await readJson(request);
    const sourceKey = requiredString(body.sourceKey, 'source_key', 80);
    if (!['apify', 'google_places'].includes(sourceKey)) throw new Error('source_not_supported');
    if (body.mode !== 'production') throw new Error('production_mode_required');
    const filters = normalizeFilters(body.filters);
    const { user } = await requireUser(request);
    admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (profileError || !profile?.active_organization_id) throw new Error('organization_context_required');
    organizationId = profile.active_organization_id as string;
    await requireOrganizationRole(admin, user.id, organizationId, ['owner', 'admin', 'manager', 'seller', 'sdr']);

    const { data: source, error: sourceError } = await admin.from('lead_source_configs')
      .select('id,enabled,mode,connection_status').eq('organization_id', organizationId).eq('source_key', sourceKey).maybeSingle() as { data: SourceRow | null; error: unknown };
    if (sourceError || !source) throw new Error('source_not_configured');
    sourceId = source.id;
    if (!source.enabled || source.connection_status !== 'connected') throw new Error('source_disabled');

    const { data: integration, error: integrationError } = await admin.from('integrations')
      .select('id,provider,enabled,connected,paused').eq('organization_id', organizationId).eq('key', sourceKey).maybeSingle() as { data: IntegrationRow | null; error: unknown };
    if (integrationError || !integration) throw new Error('source_not_configured');
    integrationId = integration.id;
    if (!integration.enabled || !integration.connected || integration.paused) throw new Error('source_disabled');
    const { data: credentials, error: credentialsError } = await admin.rpc('read_integration_secret', { p_integration: integration.id });
    if (credentialsError || !credentials) throw new Error('source_credentials_missing');

    const filtersJson = JSON.parse(JSON.stringify(filters));
    const filtersHash = await hash(`${sourceKey}:${JSON.stringify(filtersJson)}`);
    const { data: run, error: runError } = await admin.from('prospecting_runs').insert({
      organization_id: organizationId, source_config_id: source.id, source_key: sourceKey, mode: 'production', status: 'running', filters: filtersJson,
      filters_hash: filtersHash, requested_quantity: filters.volumeMaximo, requested_by: user.id, cost_known: false, requires_confirmation: false,
      estimate_basis: 'provider_actual', started_at: new Date().toISOString(),
    }).select('id').single();
    if (runError || !run) throw runError ?? new Error('prospecting_run_not_created');
    runId = run.id as string;

    const providerResult = sourceKey === 'apify'
      ? await callApify(credentials as Record<string, unknown>, filters)
      : await callGooglePlaces(credentials as Record<string, unknown>, filters);
    const results = providerResult.leads.slice(0, filters.volumeMaximo);
    const { data: cache, error: cacheError } = await admin.from('prospecting_cache').insert({
      organization_id: organizationId, user_id: user.id, filters_hash: filtersHash, filters: filtersJson, results,
      total_found: results.length, scored: false, name: `${sourceKey} ${filters.cidade || 'busca real'}`, saved: false,
      expires_at: new Date(Date.now() + 30 * 60_000).toISOString(), source: sourceKey,
    }).select('id').single();
    if (cacheError || !cache) throw cacheError ?? new Error('prospecting_cache_not_created');
    await admin.from('prospecting_runs').update({ status: 'completed', provider_run_id: providerResult.providerRunId, result_cache_id: cache.id, result_count: results.length, completed_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: null }).eq('id', runId);
    await admin.from('lead_source_configs').update({ last_success_at: new Date().toISOString(), last_error: null, last_error_at: null }).eq('id', source.id);
    await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'prospecting.completed', detail: `Busca real concluída via ${sourceKey}.`, entity_table: 'prospecting_runs', entity_id: runId, event_data: { sourceKey, resultCount: results.length, requestedQuantity: filters.volumeMaximo } });
    return json({ ok: true, runId, sourceKey, leads: results }, 200, headers);
  } catch (error) {
    const message = safeError(error);
    if (admin && runId) await admin.from('prospecting_runs').update({ status: 'failed', last_error: message, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', runId);
    // Mantém a falha visível no mesmo lugar em que a fonte é configurada, sem
    // perder o histórico da tentativa de busca. A fonte volta a ser liberada
    // somente após uma nova validação explícita.
    if (admin && runId && organizationId && sourceId) {
      await admin.from('lead_source_configs').update({
        enabled: false,
        connection_status: 'error',
        last_error: message,
        last_error_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', sourceId);
    }
    if (admin && runId && integrationId) {
      await admin.from('integrations').update({
        connected: false,
        enabled: false,
        status_detail: 'Falha na última busca real. Teste a conexão antes de tentar novamente.',
        last_error: message,
        last_error_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', integrationId);
    }
    const status = ['authentication_required', 'invalid_session', 'organization_access_denied', 'organization_role_denied'].includes(message) ? 403 : 400;
    return json({ ok: false, error: message, runId }, status, headers);
  }
});
