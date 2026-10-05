import { createAdminClient, hasOrganizationPermission, requireOrganizationPermission, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

type Action = 'snapshot' | 'purge';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value: unknown, max = 240) => typeof value === 'string' ? value.trim().slice(0, max) : '';

function leadIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && UUID.test(id)))].slice(0, 500);
}

async function organizationContext(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data: profile, error } = await admin.from('profiles').select('active_organization_id,name').eq('id', userId).maybeSingle();
  if (error || !profile?.active_organization_id) throw new Error('organization_context_required');
  return { organizationId: profile.active_organization_id, name: profile.name };
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = text(body.action, 32) as Action;
    if (action !== 'snapshot' && action !== 'purge') throw new Error('unsupported_action');
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const context = await organizationContext(admin, user.id);

    if (action === 'snapshot') {
      await requireOrganizationPermission(admin, context.organizationId, user.id, 'leads.read_all');
      const { data, error } = await admin.rpc('lead_governance_snapshot', { p_organization_id: context.organizationId });
      if (error) throw error;
      const canDelete = await hasOrganizationPermission(admin, context.organizationId, user.id, 'leads.delete');
      return json({ ok: true, leads: data ?? [], can_delete: canDelete }, 200, headers);
    }

    await requireOrganizationPermission(admin, context.organizationId, user.id, 'leads.delete');
    const ids = leadIds(body.lead_ids);
    if (!ids.length) throw new Error('lead_selection_required');
    const expectedConfirmation = `EXCLUIR ${ids.length} LEADS`;
    if (text(body.confirmation, 80) !== expectedConfirmation) throw new Error('lead_purge_confirmation_required');
    const { data, error } = await admin.rpc('purge_selected_operational_leads', {
      p_organization_id: context.organizationId,
      p_lead_ids: ids,
    });
    if (error) throw error;
    const deletedCount = Array.isArray(data) ? data.length : 0;
    if (deletedCount !== ids.length) throw new Error('lead_purge_selection_changed');
    const { error: auditError } = await admin.from('audit_logs').insert({
      organization_id: context.organizationId,
      actor_id: user.id,
      actor_name: context.name,
      actor_type: 'user',
      action: 'lead.operational_data_purged',
      detail: `${deletedCount} lead(s) removido(s) definitivamente com seus vínculos operacionais.`,
      entity_table: 'leads',
      event_data: { deleted_count: deletedCount },
    });
    if (auditError) throw auditError;
    return json({ ok: true, deleted_count: deletedCount }, 200, headers);
  } catch (error) {
    return json({ ok: false, erro: safeError(error) }, 400, headers);
  }
});
