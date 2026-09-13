import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';
import { readJson, requiredString } from '../_shared/validation.ts';

type Filters = {
  pais?: string; estado?: string; cidade?: string; raio?: number; atividades?: string[]; segmentos?: string[];
  portes?: string[]; cargo?: string; exigeSite?: boolean; exigeWhatsApp?: boolean; exigeEmail?: boolean; volumeMaximo?: number;
};
type SourceRow = { id: string; enabled: boolean; mode: string; connection_status: string };
type IntegrationRow = { id: string; provider: string; enabled: boolean; connected: boolean; paused: boolean };
type ProspectingRun = { id: string; source_key: 'apify' | 'google_places'; source_config_id: string; status: string; filters: unknown; provider_run_id: string | null };

const text = (value: unknown, maximum = 500): string => typeof value === 'string' ? value.trim().slice(0, maximum) : '';
const list = (value: unknown, maximum = 20): string[] => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, maximum)
  : [];
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

function normalizeFilters(value: unknown): Filters {
  const input = object(value);
  const volume = typeof input.volumeMaximo === 'number' && Number.isFinite(input.volumeMaximo) ? Math.floor(input.volumeMaximo) : 30;
  const raio = typeof input.raio === 'number' && Number.isFinite(input.raio) ? Math.floor(input.raio) : 50;
  return {
    pais: text(input.pais, 80) || 'Brasil', estado: text(input.estado, 2).toUpperCase(), cidade: text(input.cidade, 120),
    raio: Math.max(1, Math.min(200, raio)), atividades: list(input.atividades), segmentos: list(input.segmentos), portes: list(input.portes),
    cargo: text(input.cargo, 80), exigeSite: input.exigeSite === true, exigeWhatsApp: input.exigeWhatsApp === true,
    exigeEmail: input.exigeEmail === true, volumeMaximo: Math.max(1, Math.min(100, volume)),
  };
}

function locationQuery(filters: Filters) { return [filters.cidade, filters.estado, filters.pais || 'Brasil'].filter(Boolean).join(', '); }
function terms(filters: Filters) { const values = [...(filters.atividades ?? []), ...(filters.segmentos ?? [])]; return values.length ? values.slice(0, 10) : ['indústria', 'empresa']; }
function stringFrom(record: Record<string, unknown>, keys: string[]): string { for (const key of keys) { const value = record[key]; if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 1_000); } return ''; }
function coordinate(value: unknown, limit: number): number | null { const parsed = typeof value === 'number' ? value : Number(value); return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : null; }

type RawProspect = { id: string; name: string; phone: string; whatsapp: string; email: string; website: string; sourceUrl: string; cnpj: string; city: string; uf: string; segment: string; address: string; latitude?: number | null; longitude?: number | null };

function score(raw: RawProspect, filters: Filters) {
  const reasons: string[] = [];
  const requestedTerms = terms(filters).map((item) => item.toLocaleLowerCase('pt-BR'));
  const segment = raw.segment.toLocaleLowerCase('pt-BR');
  const segmentMatch = requestedTerms.some((term) => segment.includes(term) || term.includes(segment));
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
  if ((filters.exigeWhatsApp && !raw.whatsapp) || (filters.exigeEmail && !raw.email) || (filters.exigeSite && !raw.website)) {
    reasons.push('um canal obrigatório não foi comprovado');
  }
  const overall = Math.round(Math.min(100, fit) * 0.65 + Math.min(100, contactability) * 0.35);
  return { overall, fit: Math.min(100, fit), contactability: Math.min(100, contactability), engagement, reason: reasons.join(' · ') || 'Empresa identificada pela fonte configurada' };
}

function external(source: 'apify' | 'google_places', raw: RawProspect, filters: Filters) {
  const telefone = raw.phone || null, whatsapp = raw.whatsapp || null, website = raw.website || null;
  const scored = score(raw, filters);
  return {
    cnpj: raw.cnpj || null, razao_social: raw.name, nome_fantasia: raw.name || null, cnae_principal: null, cnae_descricao: raw.segment || terms(filters)[0] || null,
    porte: null, capital_social: null, situacao: 'Fonte externa validada', data_abertura: null, telefone, whatsapp, email: raw.email || null,
    logradouro: raw.address || null, numero: null, bairro: null, municipio: raw.city || filters.cidade || null, uf: (raw.uf || filters.estado || '').slice(0, 2).toUpperCase() || null,
    cep: null, website, latitude: raw.latitude ?? null, longitude: raw.longitude ?? null, distance_km: null,
    deterministic_score: scored.overall, score: scored.overall, fit_score: scored.fit, contactability_score: scored.contactability, engagement_score: scored.engagement,
    score_reason: scored.reason, source, source_record_id: raw.id, source_url: raw.sourceUrl || null,
    channel_verification: { whatsapp: whatsapp ? 'source_reported' : telefone ? 'unverified' : 'absent', email: raw.email ? 'format_pending' : 'absent' },
    contact_approval_status: 'pending',
  };
}

function normalizeApify(item: unknown, index: number, filters: Filters) {
  const record = object(item), address = object(record.address), location = object(record.location);
  const phone = stringFrom(record, ['phone', 'phoneNumber', 'telephone', 'contactPhone']);
  const whatsapp = stringFrom(record, ['whatsapp', 'whatsappNumber']);
  const website = stringFrom(record, ['website', 'websiteUrl', 'companyWebsite']);
  const name = stringFrom(record, ['title', 'name', 'businessName', 'companyName']) || `Empresa ${index + 1}`;
  const id = stringFrom(record, ['placeId', 'place_id', 'cid', 'id']) || `apify-${crypto.randomUUID()}`;
  return external('apify', {
    id, name, phone, whatsapp, email: stringFrom(record, ['email', 'emailAddress']), website, sourceUrl: stringFrom(record, ['url', 'googleMapsUrl', 'placeUrl']), cnpj: stringFrom(record, ['cnpj', 'taxId']), city: stringFrom(record, ['city', 'municipality']) || stringFrom(address, ['city']),
    uf: stringFrom(record, ['state', 'stateCode', 'region']) || stringFrom(address, ['state']), segment: stringFrom(record, ['categoryName', 'category', 'industry']),
    address: stringFrom(record, ['address', 'streetAddress', 'fullAddress']) || stringFrom(address, ['full', 'label', 'address']),
    latitude: coordinate(record.latitude ?? record.lat ?? location.lat ?? location.latitude, 85), longitude: coordinate(record.longitude ?? record.lng ?? location.lng ?? location.longitude, 180),
  }, filters);
}

function normalizeGoogle(item: unknown, index: number, filters: Filters) {
  const record = object(item), display = object(record.displayName), location = object(record.location);
  const name = text(display.text, 1_000) || `Empresa ${index + 1}`;
  const phone = text(record.internationalPhoneNumber || record.nationalPhoneNumber, 100);
  const types = Array.isArray(record.types) ? record.types.filter((item): item is string => typeof item === 'string').join(', ') : '';
  return external('google_places', { id: text(record.id, 300) || `google-${crypto.randomUUID()}`, name, phone, whatsapp: '', email: '', website: text(record.websiteUri, 1_000), sourceUrl: text(record.googleMapsUri, 1_000), cnpj: '', city: filters.cidade || '', uf: filters.estado || '', segment: types, address: text(record.formattedAddress, 1_000), latitude: coordinate(location.latitude, 85), longitude: coordinate(location.longitude, 180) }, filters);
}

function apifyInput(credentials: Record<string, unknown>, filters: Filters) {
  let configured: Record<string, unknown> = {};
  const inputJson = text(credentials.input_json, 20_000);
  if (inputJson) { try { configured = object(JSON.parse(inputJson)); } catch { throw new Error('source_input_invalid'); } }
  return { ...configured, searchStringsArray: terms(filters), locationQuery: locationQuery(filters), maxCrawledPlacesPerSearch: filters.volumeMaximo };
}

function apifyToken(credentials: Record<string, unknown>) { return text(credentials.api_token || credentials.token, 500); }
function apifyFailure(status: string) { return `apify_run_${status.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`; }

async function apifyResponse(url: string, token: string, init?: RequestInit) {
  const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`, { ...init, signal: AbortSignal.timeout(25_000) });
  if (response.status === 401 || response.status === 403) throw new Error('apify_auth_rejected');
  if (response.status === 404) throw new Error('apify_actor_not_found');
  if (response.status === 429) throw new Error('apify_rate_limited');
  if (!response.ok) throw new Error(`apify_http_${response.status}`);
  return object(await response.json());
}

async function startApify(credentials: Record<string, unknown>, filters: Filters) {
  const token = apifyToken(credentials), actor = text(credentials.actor_id, 300), task = text(credentials.task_id, 300);
  if (!token || (!actor && !task)) throw new Error('source_credentials_missing');
  const path = task ? `/v2/actor-tasks/${encodeURIComponent(task)}/runs` : `/v2/acts/${encodeURIComponent(actor)}/runs`;
  const body = await apifyResponse(`https://api.apify.com${path}`, token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(apifyInput(credentials, filters)) });
  const data = object(body.data), providerRunId = text(data.id, 300);
  if (!providerRunId) throw new Error('provider_invalid_response');
  return { providerRunId, status: text(data.status, 80).toUpperCase(), datasetId: text(data.defaultDatasetId, 300) };
}

async function apifyRun(credentials: Record<string, unknown>, providerRunId: string) {
  const token = apifyToken(credentials); if (!token) throw new Error('source_credentials_missing');
  const body = await apifyResponse(`https://api.apify.com/v2/actor-runs/${encodeURIComponent(providerRunId)}`, token);
  const data = object(body.data);
  return { status: text(data.status, 80).toUpperCase(), datasetId: text(data.defaultDatasetId, 300) };
}

async function apifyItems(credentials: Record<string, unknown>, datasetId: string, filters: Filters) {
  const token = apifyToken(credentials); if (!token || !datasetId) throw new Error('provider_invalid_response');
  const response = await fetch(`https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=true&limit=${filters.volumeMaximo}&token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`apify_dataset_${response.status}`);
  const items: unknown = await response.json();
  if (!Array.isArray(items)) throw new Error('provider_invalid_response');
  return items.slice(0, filters.volumeMaximo).map((item, index) => normalizeApify(item, index, filters));
}

async function callGoogle(credentials: Record<string, unknown>, filters: Filters) {
  const key = text(credentials.api_key, 1_000); if (!key) throw new Error('source_credentials_missing');
  const query = `${terms(filters).join(' ')} em ${locationQuery(filters)}`, limit = Math.min(filters.volumeMaximo ?? 20, 60), results: unknown[] = [];
  let pageToken = '';
  while (results.length < limit) {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST', headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.types,places.googleMapsUri,places.rating,places.location,nextPageToken' },
      body: JSON.stringify({ textQuery: query, languageCode: 'pt-BR', regionCode: 'BR', pageSize: Math.min(20, limit - results.length), ...(pageToken ? { pageToken } : {}) }), signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 400 || response.status === 401 || response.status === 403) throw new Error('google_places_key_rejected');
    if (response.status === 429) throw new Error('google_places_rate_limited');
    if (!response.ok) throw new Error(`google_places_http_${response.status}`);
    const body = object(await response.json()), page = Array.isArray(body.places) ? body.places : [];
    results.push(...page.slice(0, limit - results.length)); pageToken = text(body.nextPageToken, 1_000); if (!pageToken || !page.length) break;
  }
  return { providerRunId: `google-${crypto.randomUUID()}`, leads: results.slice(0, limit).map((item, index) => normalizeGoogle(item, index, filters)) };
}

async function hash(value: string) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, '0')).join(''); }

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, error: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request); if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, headers);
  let runId: string | null = null, admin: ReturnType<typeof createAdminClient> | null = null, sourceId: string | null = null, integrationId: string | null = null;
  try {
    const body = await readJson(request), sourceKey = requiredString(body.sourceKey, 'source_key', 80) as 'apify' | 'google_places';
    if (!['apify', 'google_places'].includes(sourceKey)) throw new Error('source_not_supported');
    if (body.mode !== 'production') throw new Error('production_mode_required');
    const requestedRunId = text(body.runId, 80);
    const { user } = await requireUser(request); admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (profileError || !profile?.active_organization_id) throw new Error('organization_context_required');
    const organizationId = profile.active_organization_id as string;
    await requireOrganizationRole(admin, user.id, organizationId, ['owner', 'admin', 'manager', 'seller', 'sdr']);
    const { data: source, error: sourceError } = await admin.from('lead_source_configs').select('id,enabled,mode,connection_status').eq('organization_id', organizationId).eq('source_key', sourceKey).maybeSingle() as { data: SourceRow | null; error: unknown };
    if (sourceError || !source) throw new Error('source_not_configured'); sourceId = source.id;
    if (!source.enabled || source.connection_status !== 'connected') throw new Error('source_disabled');
    const { data: integration, error: integrationError } = await admin.from('integrations').select('id,provider,enabled,connected,paused').eq('organization_id', organizationId).eq('key', sourceKey).maybeSingle() as { data: IntegrationRow | null; error: unknown };
    if (integrationError || !integration) throw new Error('source_not_configured'); integrationId = integration.id;
    if (!integration.enabled || !integration.connected || integration.paused) throw new Error('source_disabled');
    const { data: credentials, error: credentialsError } = await admin.rpc('read_integration_secret', { p_integration: integration.id });
    if (credentialsError || !credentials) throw new Error('source_credentials_missing');

    let filters: Filters, providerRunId = '', datasetId = '';
    if (requestedRunId) {
      const { data: run, error: runError } = await admin.from('prospecting_runs').select('id,source_key,source_config_id,status,filters,provider_run_id').eq('id', requestedRunId).eq('organization_id', organizationId).eq('requested_by', user.id).maybeSingle() as { data: ProspectingRun | null; error: unknown };
      if (runError || !run || run.source_key !== sourceKey || run.source_config_id !== source.id) throw new Error('prospecting_run_not_found');
      if (run.status !== 'running' || !run.provider_run_id) throw new Error('prospecting_run_not_pending');
      runId = run.id; filters = normalizeFilters(run.filters); providerRunId = run.provider_run_id;
      if (sourceKey !== 'apify') throw new Error('prospecting_run_not_pending');
      const provider = await apifyRun(credentials as Record<string, unknown>, providerRunId);
      if (provider.status !== 'SUCCEEDED') {
        if (['FAILED', 'ABORTED', 'TIMED-OUT', 'TIMED_OUT'].includes(provider.status)) throw new Error(apifyFailure(provider.status));
        return json({ ok: true, pending: true, runId, sourceKey, message: 'A fonte ainda está processando a busca.' }, 202, headers);
      }
      datasetId = provider.datasetId;
    } else {
      filters = normalizeFilters(body.filters);
      const filtersJson = JSON.parse(JSON.stringify(filters)), filtersHash = await hash(`${sourceKey}:${JSON.stringify(filtersJson)}`), startedAt = new Date().toISOString();
      const { data: run, error: runError } = await admin.from('prospecting_runs').insert({ organization_id: organizationId, source_config_id: source.id, source_key: sourceKey, mode: 'production', status: 'running', filters: filtersJson, filters_hash: filtersHash, requested_quantity: filters.volumeMaximo, estimated_records: filters.volumeMaximo, quote_expires_at: startedAt, requested_by: user.id, cost_known: false, requires_confirmation: false, estimate_basis: 'provider_actual', started_at: startedAt }).select('id').single();
      if (runError || !run) throw runError ?? new Error('prospecting_run_not_created'); runId = run.id as string;
      if (sourceKey === 'apify') {
        const provider = await startApify(credentials as Record<string, unknown>, filters); providerRunId = provider.providerRunId; datasetId = provider.datasetId;
        await admin.from('prospecting_runs').update({ provider_run_id: providerRunId, updated_at: new Date().toISOString() }).eq('id', runId);
        if (provider.status !== 'SUCCEEDED') {
          if (['FAILED', 'ABORTED', 'TIMED-OUT', 'TIMED_OUT'].includes(provider.status)) throw new Error(apifyFailure(provider.status));
          return json({ ok: true, pending: true, runId, sourceKey, message: 'A fonte iniciou a busca. Aguardando os resultados.' }, 202, headers);
        }
      }
    }

    const result = sourceKey === 'apify'
      ? { providerRunId, leads: await apifyItems(credentials as Record<string, unknown>, datasetId, filters) }
      : await callGoogle(credentials as Record<string, unknown>, filters);
    const leads = result.leads.filter((lead) => (!filters.exigeWhatsApp || Boolean(lead.whatsapp)) && (!filters.exigeEmail || Boolean(lead.email)) && (!filters.exigeSite || Boolean(lead.website))).slice(0, filters.volumeMaximo);
    const filtersHash = await hash(`${sourceKey}:${JSON.stringify(filters)}`);
    const { data: cache, error: cacheError } = await admin.from('prospecting_cache').insert({ organization_id: organizationId, user_id: user.id, filters_hash: filtersHash, filters: { source: sourceKey, uf: filters.estado || null, municipio: filters.cidade || null, keyword: terms(filters).join(' '), radius_km: filters.raio || null, limit: filters.volumeMaximo }, results: leads, total_found: leads.length, scored: true, name: `${sourceKey} · ${filters.cidade || filters.estado || 'Brasil'} · ${new Date().toLocaleDateString('pt-BR')}`, saved: true, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), source: sourceKey }).select('id').single();
    if (cacheError || !cache) throw cacheError ?? new Error('prospecting_cache_not_created');
    const now = new Date().toISOString();
    await admin.from('prospecting_runs').update({ status: 'completed', provider_run_id: result.providerRunId, result_cache_id: cache.id, result_count: leads.length, completed_at: now, updated_at: now, last_error: null }).eq('id', runId);
    await admin.from('lead_source_configs').update({ last_success_at: now, last_error: null, last_error_at: null }).eq('id', source.id);
    await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'prospecting.completed', detail: `Busca real concluída via ${sourceKey}.`, entity_table: 'prospecting_runs', entity_id: runId, event_data: { sourceKey, resultCount: leads.length, requestedQuantity: filters.volumeMaximo, cacheId: cache.id } });
    return json({ ok: true, pending: false, runId, cacheId: cache.id, sourceKey, leads }, 200, headers);
  } catch (error) {
    const message = safeError(error), now = new Date().toISOString();
    if (admin && runId) await admin.from('prospecting_runs').update({ status: 'failed', last_error: message, completed_at: now, updated_at: now }).eq('id', runId);
    if (admin && runId && sourceId) await admin.from('lead_source_configs').update({ connection_status: 'error', last_error: message, last_error_at: now, updated_at: now }).eq('id', sourceId);
    if (admin && runId && integrationId) await admin.from('integrations').update({ connected: false, status_detail: 'Falha na última busca real. Teste a conexão e consulte o erro específico.', last_error: message, last_error_at: now }).eq('id', integrationId);
    return json({ ok: false, error: message, runId }, 400, headers);
  }
});
