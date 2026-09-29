import { createAdminClient, requireOrganizationPermission, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

const usageKeys = new Set(['profile', 'business', 'products', 'services', 'catalogs', 'documents', 'sources']);
const text = (value: unknown, max = 1_000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

async function context(request: Request) {
  const { user } = await requireUser(request);
  const admin = createAdminClient();
  const { data: profile, error } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
  if (error || !profile?.active_organization_id) throw new Error('organization_context_required');
  const organizationId = profile.active_organization_id as string;
  await requireOrganizationPermission(admin, organizationId, user.id, 'configuration.manage');
  return { admin, user, organizationId, actorName: profile.name || 'Administrador' };
}

async function settings(admin: ReturnType<typeof createAdminClient>, organizationId: string) {
  const { data, error } = await admin.from('company_settings').select('id,name,description,website,ui_settings').eq('organization_id', organizationId).maybeSingle();
  if (error) throw new Error('company_settings_read_failed');
  return data ?? { id: null, name: '', description: '', website: '', ui_settings: {} };
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);
  try {
    const body = object(await request.json().catch(() => ({})));
    const action = text(body.action, 32);
    const { admin, user, organizationId, actorName } = await context(request);
    const current = await settings(admin, organizationId);
    const currentUi = object(current.ui_settings);
    const currentUsage = object(currentUi.knowledge_usage);

    if (action === 'set_usage') {
      const key = text(body.key, 32);
      if (!usageKeys.has(key) || typeof body.enabled !== 'boolean') throw new Error('knowledge_usage_invalid');
      const nextUsage = { profile: true, business: true, products: true, services: true, catalogs: true, documents: true, sources: true, ...currentUsage, [key]: body.enabled };
      const nextUi = { ...currentUi, knowledge_usage: nextUsage };
      const { error } = await admin.from('company_settings').upsert({ organization_id: organizationId, ui_settings: nextUi, updated_at: new Date().toISOString() }, { onConflict: 'organization_id' });
      if (error) throw new Error('knowledge_usage_save_failed');
      await admin.from('audit_logs').insert({
        organization_id: organizationId, actor_id: user.id, actor_name: actorName, actor_type: 'user',
        action: body.enabled ? 'knowledge.usage_enabled' : 'knowledge.usage_disabled',
        detail: `${key} ${body.enabled ? 'habilitado' : 'desabilitado'} para a Ana.`, entity_table: 'company_settings',
        entity_id: current.id, event_data: { key, enabled: body.enabled, previous_enabled: currentUsage[key] ?? true },
      });
      return json({ ok: true, usage: nextUsage }, 200, headers);
    }

    if (action === 'publish') {
      if (!text(current.name || currentUi.organizacao && object(currentUi.organizacao).nome, 300) || !text(current.website || currentUi.organizacao && object(currentUi.organizacao).site, 500)) throw new Error('knowledge_company_profile_incomplete');
      const [{ data: items, error: itemsError }, { data: sources, error: sourcesError }] = await Promise.all([
        admin.from('knowledge_catalog_items').select('id,status,ana_enabled,item_type').eq('organization_id', organizationId),
        admin.from('knowledge_sources').select('id,enabled,sync_status').eq('organization_id', organizationId),
      ]);
      if (itemsError || sourcesError) throw new Error('knowledge_publication_read_failed');
      const pendingItems = (items ?? []).filter((item) => item.status !== 'active').length;
      const pendingSources = (sources ?? []).filter((source) => source.sync_status !== 'healthy').length;
      const previousPublication = object(currentUi.knowledge_publication);
      const version = Number(previousPublication.version) > 0 ? Number(previousPublication.version) + 1 : 1;
      const publishedAt = new Date().toISOString();
      const publication = { version, publishedAt, publishedBy: user.id, pendingItems, pendingSources, itemCount: (items ?? []).filter((item) => item.status === 'active' && item.ana_enabled === true).length, sourceCount: (sources ?? []).filter((source) => source.enabled === true).length };
      const nextUi = { ...currentUi, knowledge_publication: publication };
      const { error } = await admin.from('company_settings').upsert({ organization_id: organizationId, ui_settings: nextUi, updated_at: publishedAt }, { onConflict: 'organization_id' });
      if (error) throw new Error('knowledge_publication_save_failed');
      await admin.from('audit_logs').insert({
        organization_id: organizationId, actor_id: user.id, actor_name: actorName, actor_type: 'user',
        action: 'knowledge.published', detail: 'Estado de empresa e conhecimento publicado para a Ana.', entity_table: 'company_settings', entity_id: current.id,
        event_data: publication,
      });
      return json({ ok: true, publication }, 200, headers);
    }
    if (action === 'get_state') {
      const { data: audit } = await admin.from('audit_logs').select('id,action,detail,actor_name,created_at,event_data').eq('organization_id', organizationId).like('action', 'knowledge.%').order('created_at', { ascending: false }).limit(20);
      return json({ ok: true, usage: { profile: true, business: true, products: true, services: true, catalogs: true, documents: true, sources: true, ...currentUsage }, publication: currentUi.knowledge_publication ?? null, audit: audit ?? [] }, 200, headers);
    }
    throw new Error('unsupported_action');
  } catch (error) {
    return json({ ok: false, erro: safeError(error) }, 400, headers);
  }
});
