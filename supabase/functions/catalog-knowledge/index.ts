import { createAdminClient, requireOrganizationPermission, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';
import {
  catalogItemTraceUrl,
  extractCatalogKnowledgeItems,
  extractSpaModuleUrls,
  extractWayflexSegmentSnapshotItems,
  extractWayflexSpaBundleItems,
  type CatalogKnowledgeImportShape,
  type CatalogKnowledgeSourceDefinition,
  type ExtractedCatalogKnowledgeItem,
} from '../_shared/catalogKnowledgeParser.ts';

const text = (value: unknown, max = 12_000): string => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const MAX_SPA_BUNDLE_BYTES = 4_500_000;

function sourceDefinition(raw: unknown): CatalogKnowledgeSourceDefinition {
  const candidate = text(raw, 2_000);
  let parsed: URL;
  try { parsed = new URL(candidate); } catch { throw new Error('knowledge_source_url_invalid'); }
  if (parsed.protocol !== 'https:' || !['wayflex.ind.br', 'www.wayflex.ind.br'].includes(parsed.hostname.toLowerCase())) {
    throw new Error('knowledge_source_adapter_not_available');
  }
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  if (pathname === '/acessorios') return { url: parsed.toString(), itemType: 'product', scope: 'products', name: 'Wayflex — Produtos e acessórios' };
  if (pathname === '/servicos') return { url: parsed.toString(), itemType: 'service', scope: 'services', name: 'Wayflex — Segmentos e aplicações' };
  if (pathname === '/catalogos') return { url: parsed.toString(), itemType: 'catalog', scope: 'catalogs', name: 'Wayflex — Catálogos' };
  throw new Error('knowledge_source_adapter_not_available');
}

function adapterFor(shape: CatalogKnowledgeImportShape | undefined): string {
  if (shape === 'spa_bundle') return 'wayflex_spa_bundle_v2';
  if (shape === 'public_snapshot') return 'wayflex_public_segments_snapshot_v1';
  if (shape === 'html_card') return 'wayflex_html_card_v2';
  return 'wayflex_page_fallback_v2';
}

function shapesOf(items: ExtractedCatalogKnowledgeItem[]): Record<string, number> {
  return items.reduce<Record<string, number>>((result, item) => {
    const shape = item.importShape || 'unknown';
    result[shape] = (result[shape] || 0) + 1;
    return result;
  }, {});
}

async function fetchPublishedSpaBundle(html: string, definition: CatalogKnowledgeSourceDefinition): Promise<{ url: string | null; bundle: string | null }> {
  const urls = extractSpaModuleUrls(html, definition.url);
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/javascript,text/javascript,*/*;q=0.8', 'user-agent': 'WayflexKnowledgeSync/2.0 (+https://wayflex.ind.br)' },
        signal: AbortSignal.timeout(25_000), redirect: 'follow',
      });
      if (!response.ok) continue;
      const declaredBytes = Number(response.headers.get('content-length') || 0);
      if (Number.isFinite(declaredBytes) && declaredBytes > MAX_SPA_BUNDLE_BYTES) continue;
      const bundle = await response.text();
      if (!bundle || bundle.length > MAX_SPA_BUNDLE_BYTES) continue;
      return { url, bundle };
    } catch {
      // The HTML fallback remains available. A bundle request never causes a
      // fabricated item or hides a verified prior import.
    }
  }
  return { url: null, bundle: null };
}

async function getOrganization(request: Request) {
  const { user } = await requireUser(request);
  const admin = createAdminClient();
  const { data: profile, error } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
  if (error || !profile?.active_organization_id) throw new Error('organization_context_required');
  const organizationId = profile.active_organization_id as string;
  await requireOrganizationPermission(admin, organizationId, user.id, 'configuration.manage');
  return { admin, user, organizationId, actorName: profile.name || 'Administrador' };
}

async function upsertSource(
  admin: ReturnType<typeof createAdminClient>, organizationId: string, userId: string, definition: ReturnType<typeof sourceDefinition>,
) {
  const { data: current, error: currentError } = await admin.from('knowledge_sources').select('id').eq('organization_id', organizationId).eq('source_url', definition.url).maybeSingle();
  if (currentError) throw currentError;
  const values = {
    organization_id: organizationId, name: definition.name, source_url: definition.url, source_kind: definition.scope === 'catalogs' ? 'catalog' : 'website',
    content_scope: definition.scope, enabled: true, sync_status: 'syncing', last_error: null, created_by: userId, updated_at: new Date().toISOString(),
  };
  const query = current?.id ? admin.from('knowledge_sources').update(values).eq('id', current.id) : admin.from('knowledge_sources').insert(values);
  const { data, error } = await query.select('id').single();
  if (error || !data) throw error ?? new Error('knowledge_source_not_saved');
  return data.id as string;
}

interface SyncFailureContext {
  admin: ReturnType<typeof createAdminClient>;
  organizationId: string;
  sourceId: string;
  importId: string;
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);
  let syncFailureContext: SyncFailureContext | null = null;
  try {
    const body = object(await request.json().catch(() => ({})));
    if (text(body.action, 32) !== 'sync') throw new Error('unsupported_action');
    const definition = sourceDefinition(body.source_url);
    const { admin, user, organizationId, actorName } = await getOrganization(request);
    const sourceId = await upsertSource(admin, organizationId, user.id, definition);
    const { data: importRow, error: importError } = await admin.from('knowledge_source_imports').insert({
      organization_id: organizationId, source_id: sourceId, status: 'running', created_by: user.id,
      metadata: { adapter: 'wayflex_source_adapter_v2', source_url: definition.url },
    }).select('id').single();
    if (importError || !importRow) throw importError ?? new Error('knowledge_import_not_created');
    syncFailureContext = { admin, organizationId, sourceId, importId: importRow.id as string };

    let response: Response;
    try {
      response = await fetch(definition.url, {
        headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'WayflexKnowledgeSync/2.0 (+https://wayflex.ind.br)' },
        signal: AbortSignal.timeout(25_000), redirect: 'follow',
      });
    } catch { throw new Error('knowledge_source_fetch_failed'); }
    if (!response.ok) throw new Error(`knowledge_source_http_${response.status}`);
    const html = await response.text();
    if (!html || html.length < 80) throw new Error('knowledge_source_empty');

    const htmlItems = extractCatalogKnowledgeItems(html, definition);
    const wasSpaShell = htmlItems.length === 1 && htmlItems[0].importShape === 'page_fallback';
    const spa = wasSpaShell ? await fetchPublishedSpaBundle(html, definition) : { url: null, bundle: null };
    const bundleItems = spa.bundle ? extractWayflexSpaBundleItems(spa.bundle, definition) : [];
    const snapshotItems = wasSpaShell && bundleItems.length === 0 ? extractWayflexSegmentSnapshotItems(definition) : [];
    const items = bundleItems.length > 0 ? bundleItems : snapshotItems.length > 0 ? snapshotItems : htmlItems;
    const shapeCounts = shapesOf(items);
    const keys = items.map((item) => item.externalKey);
    const { data: existing, error: existingError } = await admin.from('knowledge_catalog_items')
      .select('external_key,status,ana_enabled').eq('organization_id', organizationId).eq('source_id', sourceId).in('external_key', keys);
    if (existingError) throw existingError;
    const existingByKey = new Map((existing ?? []).map((row) => [row.external_key, row]));
    const now = new Date().toISOString();
    const rows = items.map((item) => {
      const prior = existingByKey.get(item.externalKey);
      const traceUrl = catalogItemTraceUrl(item, definition);
      return {
        organization_id: organizationId, source_id: sourceId, item_type: item.type, external_key: item.externalKey,
        status: prior?.status ?? 'active', ana_enabled: prior?.ana_enabled ?? true,
        name: item.name, short_description: item.shortDescription, technical_description: item.technicalDescription,
        category: item.category || definition.scope, material: null, applications: item.applications ?? [], keywords: item.keywords, image_url: item.imageUrl,
        attachment_url: item.attachmentUrl, website_url: item.websiteUrl || definition.url, source_url: traceUrl,
        source_label: definition.name,
        source_payload: {
          adapter: adapterFor(item.importShape), import_shape: item.importShape || 'unknown', page: definition.url,
          canonical_source_url: item.sourceUrl || definition.url,
          source_asset_url: item.sourceAssetUrl || null, imported_at: now,
        },
        content_fingerprint: `${item.name}:${item.category || ''}:${item.shortDescription || ''}:${item.attachmentUrl || item.websiteUrl || ''}:${item.imageUrl || ''}`.slice(0, 12_000),
        imported_at: now, created_by: user.id, updated_at: now,
      };
    });
    const { error: upsertError } = await admin.from('knowledge_catalog_items').upsert(rows, { onConflict: 'organization_id,source_id,external_key' });
    if (upsertError) throw upsertError;
    const { error: sourceDoneError } = await admin.from('knowledge_sources').update({ sync_status: 'healthy', last_synced_at: now, last_error: null, updated_at: now })
      .eq('id', sourceId).eq('organization_id', organizationId);
    if (sourceDoneError) throw sourceDoneError;
    await admin.from('knowledge_source_imports').update({
      status: 'completed', items_seen: items.length, items_upserted: rows.length, completed_at: now,
      metadata: { adapter: 'wayflex_source_adapter_v2', source_url: definition.url, spa_bundle_url: spa.url, import_shapes: shapeCounts },
    }).eq('id', importRow.id).eq('organization_id', organizationId);
    await admin.from('audit_logs').insert({
      organization_id: organizationId, actor_id: user.id, actor_name: actorName, actor_type: 'user',
      action: 'knowledge.source_synchronized', detail: 'Fonte de conhecimento sincronizada e vinculada à base da Ana.',
      entity_table: 'knowledge_sources', entity_id: sourceId,
      event_data: { source_url: definition.url, scope: definition.scope, items_seen: items.length, items_upserted: rows.length, import_shapes: shapeCounts },
    });
    return json({ ok: true, seen: items.length, upserted: rows.length, message: `${rows.length} item(ns) publicados e rastreáveis foram sincronizados.` }, 200, headers);
  } catch (error) {
    const message = safeError(error);
    if (syncFailureContext) {
      const finishedAt = new Date().toISOString();
      await Promise.allSettled([
        syncFailureContext.admin.from('knowledge_sources').update({ sync_status: 'error', last_error: message, updated_at: finishedAt })
          .eq('id', syncFailureContext.sourceId).eq('organization_id', syncFailureContext.organizationId),
        syncFailureContext.admin.from('knowledge_source_imports').update({ status: 'failed', error: message, completed_at: finishedAt })
          .eq('id', syncFailureContext.importId).eq('organization_id', syncFailureContext.organizationId),
      ]);
    }
    return json({ ok: false, erro: message }, 400, headers);
  }
});
