import { createAdminClient, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);
  try {
    const body = await request.json() as { canal?: string };
    if (!['whatsapp', 'email'].includes(body.canal ?? '')) throw new Error('unsupported_channel');
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const { data: profile } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (!profile?.active_organization_id) throw new Error('organization_context_required');
    const organizationId = profile.active_organization_id as string;
    const { data: member } = await admin.from('organization_members').select('status,role').eq('organization_id', organizationId).eq('user_id', user.id).maybeSingle();
    if (!member || member.status !== 'active' || !['owner', 'admin', 'manager'].includes(member.role)) throw new Error('organization_access_denied');
    const { data: integration, error } = await admin.from('integrations').select('id,provider,connected,enabled,paused,status_detail,last_tested_at')
      .eq('organization_id', organizationId).ilike('key', `%${body.canal}%`).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    const ready = Boolean(integration?.connected && integration.enabled && !integration.paused);
    await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: `integration.${body.canal}_checked`, detail: ready ? 'Integração pronta para a fila.' : 'Integração não está pronta para a fila.', entity_table: 'integrations', entity_id: integration?.id, event_data: { ready } });
    return json({ ok: true, pronto: ready, provedor: integration?.provider, detalhe: ready ? 'Conexão válida. Envios continuam passando pela fila segura.' : integration?.status_detail ?? 'Conexão ausente, pausada ou desabilitada.' }, 200, headers);
  } catch (error) { return json({ ok: false, erro: safeError(error) }, 400, headers); }
});
