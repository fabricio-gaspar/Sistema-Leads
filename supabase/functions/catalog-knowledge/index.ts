import { createAdminClient, requireOrganizationPermission, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

type ItemType = 'product' | 'service' | 'catalog' | 'document';
type Scope = 'products' | 'services' | 'catalogs';

interface ExtractedItem {
  type: ItemType;
  name: string;
  externalKey: string;
  shortDescription: string | null;
  technicalDescription: string | null;
  imageUrl: string | null;
  attachmentUrl: string | null;
  websiteUrl: string | null;
  sourceUrl: string;
  keywords: string[];
}

const text = (value: unknown, max = 12_000): string => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const normalize = (value: string) => text(value, 800).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function sourceDefinition(raw: unknown): { url: string; itemType: ItemType; scope: Scope; name: string } {
  const candidate = text(raw, 2_000);
  let parsed: URL;
  try { parsed = new URL(candidate); } catch { throw new Error('knowledge_source_url_invalid'); }
  if (parsed.protocol !== 'https:' || !['wayflex.ind.br', 'www.wayflex.ind.br'].includes(parsed.hostname.toLowerCase())) {
    throw new Error('knowledge_source_adapter_not_available');
  }
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  if (pathname === '/acessorios') return { url: parsed.toString(), itemType: 'product', scope: 'products', name: 'Wayflex — Produtos e acessórios' };
  if (pathname === '/servicos') return { url: parsed.toString(), itemType: 'service', scope: 'services', name: 'Wayflex — Serviços' };
  if (pathname === '/catalogos') return { url: parsed.toString(), itemType: 'catalog', scope: 'catalogs', name: 'Wayflex — Catálogos' };
  throw new Error('knowledge_source_adapter_not_available');
}

function safeUrl(value: string | null | undefined, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return ['https:', 'http:'].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}

function elementText(element: Element | null | undefined, max = 2_000): string {
  return text(element?.textContent || '', max);
}

function uniqueValues(values: string[], max = 24): string[] {
  return [...new Set(values.map((value) => text(value, 80)).filter(Boolean))].slice(0, max);
}

function firstImage(container: Element, base: string): string | null {
  const image = container.querySelector('img[src]');
  return safeUrl(image?.getAttribute('src'), base);
}

function firstContentLink(container: Element, base: string): string | null {
  const links = Array.from(container.querySelectorAll('a[href]'));
  const match = links.find((link) => {
    const href = link.getAttribute('href') || '';
    return href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:');
  });
  return safeUrl(match?.getAttribute('href'), base);
}

function nearestTitle(container: Element): string {
  return elementText(container.querySelector('h1,h2,h3,h4,h5,[data-title],.title,.entry-title'), 300)
    || elementText(container.querySelector('a[href]'), 300);
}

function rootFor(document: Document): Element {
  return document.querySelector('main, #content, .site-main, .entry-content, article') || document.body;
}

function pageFallback(root: Element, definition: ReturnType<typeof sourceDefinition>): ExtractedItem {
  const title = elementText(root.querySelector('h1'), 300) || definition.name;
  const paragraphs = Array.from(root.querySelectorAll('p')).map((node) => elementText(node, 1_200)).filter((value) => value.length >= 24);
  const body = elementText(root, 10_000);
  return {
    type: definition.itemType,
    name: title,
    externalKey: `page:${normalize(definition.url)}`,
    shortDescription: paragraphs[0] || null,
    technicalDescription: body || null,
    imageUrl: firstImage(root, definition.url),
    attachmentUrl: null,
    websiteUrl: definition.url,
    sourceUrl: definition.url,
    keywords: uniqueValues([definition.scope, ...title.split(/\s+/), ...paragraphs.slice(0, 1).flatMap((value) => value.split(/\s+/))]),
  };
}

function extractCatalogs(root: Element, definition: ReturnType<typeof sourceDefinition>): ExtractedItem[] {
  const seen = new Set<string>();
  const items: ExtractedItem[] = [];
  for (const link of Array.from(root.querySelectorAll('a[href]'))) {
    const attachmentUrl = safeUrl(link.getAttribute('href'), definition.url);
    if (!attachmentUrl || !/\.pdf(?:$|[?#])/i.test(attachmentUrl)) continue;
    const container = link.closest('article,li,section,div') || link;
    const name = elementText(link, 300) || nearestTitle(container) || 'Catálogo Wayflex';
    const key = `pdf:${normalize(attachmentUrl)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const description = elementText(container.querySelector('p'), 1_600);
    items.push({
      type: 'catalog', name, externalKey: key, shortDescription: description || null,
      technicalDescription: description || null, imageUrl: firstImage(container, definition.url), attachmentUrl,
      websiteUrl: definition.url, sourceUrl: attachmentUrl,
      keywords: uniqueValues(['catalogo', 'catálogo', ...name.split(/\s+/), ...description.split(/\s+/)]),
    });
  }
  return items;
}

function extractCards(root: Element, definition: ReturnType<typeof sourceDefinition>): ExtractedItem[] {
  const nodes = Array.from(root.querySelectorAll('article, [class*="product" i], [class*="produto" i], [class*="service" i], [class*="servic" i], [class*="card" i]'));
  const seen = new Set<string>();
  const items: ExtractedItem[] = [];
  for (const node of nodes) {
    const name = nearestTitle(node);
    if (name.length < 3 || /^(menu|inicio|home|contato|saiba mais|ler mais)$/i.test(name)) continue;
    const description = elementText(node.querySelector('p'), 2_000) || elementText(node, 2_000);
    if (description.length < 16) continue;
    const websiteUrl = firstContentLink(node, definition.url) || definition.url;
    const key = `${normalize(name)}:${normalize(websiteUrl)}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push({
      type: definition.itemType, name, externalKey: key, shortDescription: description.slice(0, 500) || null,
      technicalDescription: description || null, imageUrl: firstImage(node, definition.url), attachmentUrl: null,
      websiteUrl, sourceUrl: websiteUrl,
      keywords: uniqueValues([definition.scope, ...name.split(/\s+/), ...description.split(/\s+/)]),
    });
    if (items.length >= 60) break;
  }
  return items;
}

function extractItems(html: string, definition: ReturnType<typeof sourceDefinition>): ExtractedItem[] {
  const document = new DOMParser().parseFromString(html, 'text/html');
  if (!document) throw new Error('knowledge_source_html_invalid');
  const root = rootFor(document);
  const extracted = definition.scope === 'catalogs' ? extractCatalogs(root, definition) : extractCards(root, definition);
  return extracted.length ? extracted : [pageFallback(root, definition)];
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
      metadata: { adapter: 'wayflex_html_v1', source_url: definition.url },
    }).select('id').single();
    if (importError || !importRow) throw importError ?? new Error('knowledge_import_not_created');
    syncFailureContext = { admin, organizationId, sourceId, importId: importRow.id as string };

    let response: Response;
    try {
      response = await fetch(definition.url, {
        headers: { 'accept': 'text/html,application/xhtml+xml', 'user-agent': 'WayflexKnowledgeSync/1.0 (+https://wayflex.ind.br)' },
        signal: AbortSignal.timeout(25_000), redirect: 'follow',
      });
    } catch { throw new Error('knowledge_source_fetch_failed'); }
    if (!response.ok) throw new Error(`knowledge_source_http_${response.status}`);
    const html = await response.text();
    if (!html || html.length < 80) throw new Error('knowledge_source_empty');
    const items = extractItems(html, definition);
    const keys = items.map((item) => item.externalKey);
    const { data: existing, error: existingError } = await admin.from('knowledge_catalog_items')
      .select('external_key,status,ana_enabled').eq('organization_id', organizationId).eq('source_id', sourceId).in('external_key', keys);
    if (existingError) throw existingError;
    const existingByKey = new Map((existing ?? []).map((row) => [row.external_key, row]));
    const now = new Date().toISOString();
    const rows = items.map((item) => {
      const prior = existingByKey.get(item.externalKey);
      return {
        organization_id: organizationId, source_id: sourceId, item_type: item.type, external_key: item.externalKey,
        status: prior?.status ?? 'active', ana_enabled: prior?.ana_enabled ?? true,
        name: item.name, short_description: item.shortDescription, technical_description: item.technicalDescription,
        category: definition.scope, material: null, applications: [], keywords: item.keywords, image_url: item.imageUrl,
        attachment_url: item.attachmentUrl, website_url: item.websiteUrl, source_url: item.sourceUrl,
        source_label: definition.name, source_payload: { adapter: 'wayflex_html_v1', page: definition.url, imported_at: now },
        content_fingerprint: `${item.name}:${item.shortDescription || ''}:${item.attachmentUrl || item.websiteUrl || ''}`.slice(0, 12_000),
        imported_at: now, created_by: user.id, updated_at: now,
      };
    });
    const { error: upsertError } = await admin.from('knowledge_catalog_items').upsert(rows, { onConflict: 'organization_id,source_id,external_key' });
    if (upsertError) throw upsertError;
    const { error: sourceDoneError } = await admin.from('knowledge_sources').update({ sync_status: 'healthy', last_synced_at: now, last_error: null, updated_at: now })
      .eq('id', sourceId).eq('organization_id', organizationId);
    if (sourceDoneError) throw sourceDoneError;
    await admin.from('knowledge_source_imports').update({ status: 'completed', items_seen: items.length, items_upserted: rows.length, completed_at: now })
      .eq('id', importRow.id).eq('organization_id', organizationId);
    await admin.from('audit_logs').insert({
      organization_id: organizationId, actor_id: user.id, actor_name: actorName, actor_type: 'user',
      action: 'knowledge.source_synchronized', detail: 'Fonte de conhecimento sincronizada e vinculada à base da Ana.',
      entity_table: 'knowledge_sources', entity_id: sourceId,
      event_data: { source_url: definition.url, scope: definition.scope, items_seen: items.length, items_upserted: rows.length },
    });
    return json({ ok: true, seen: items.length, upserted: rows.length, message: `${rows.length} item(ns) sincronizado(s) da fonte oficial.` }, 200, headers);
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
