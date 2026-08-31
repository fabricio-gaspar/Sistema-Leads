import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);
  try {
    const body = await request.json() as { canal?: string };
    const canal = String(body.canal ?? '').trim();
    if (!['whatsapp', 'email', 'apify', 'google_places'].includes(canal)) throw new Error('unsupported_channel');
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const { data: profile } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (!profile?.active_organization_id) throw new Error('organization_context_required');
    const organizationId = profile.active_organization_id as string;
    await requireOrganizationRole(admin, user.id, organizationId, ['owner', 'admin', 'manager']);
    const { data: integration, error } = await admin.from('integrations').select('id,provider,connected,enabled,paused,status_detail,last_tested_at')
      .eq('organization_id', organizationId).eq('key', canal).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!integration) throw new Error('integration_not_found');
    const { data: credentials, error: credentialsError } = await admin.rpc('read_integration_secret', { p_integration: integration.id });
    if (credentialsError || !credentials) throw credentialsError ?? new Error('integration_credentials_missing');
    const sourceKey = ['apify', 'google_places'].includes(canal) ? canal : null;
    let response: Response;
    if (canal === 'whatsapp') {
      const zapi = credentials as { instancia_id?: string; token?: string; client_token?: string; url_base?: string };
      const baseUrl = (zapi.url_base || 'https://api.z-api.io').replace(/\/$/, '');
      response = await fetch(`${baseUrl}/instances/${encodeURIComponent(zapi.instancia_id ?? '')}/token/${encodeURIComponent(zapi.token ?? '')}/status`, { headers: zapi.client_token ? { 'Client-Token': zapi.client_token } : {} });
    } else if (canal === 'apify') {
      const apify = credentials as { api_token?: string; actor_id?: string; task_id?: string };
      if (!apify.api_token || (!apify.actor_id && !apify.task_id)) throw new Error('source_credentials_missing');
      response = await fetch(`https://api.apify.com/v2/users/me?token=${encodeURIComponent(apify.api_token)}`);
      if (response.ok) {
        const path = apify.task_id ? `/v2/actor-tasks/${encodeURIComponent(apify.task_id)}` : `/v2/acts/${encodeURIComponent(apify.actor_id ?? '')}`;
        response = await fetch(`https://api.apify.com${path}?token=${encodeURIComponent(apify.api_token)}`);
      }
    } else if (canal === 'google_places') {
      const google = credentials as { api_key?: string };
      if (!google.api_key) throw new Error('source_credentials_missing');
      response = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=Wayflex&language=pt-BR&region=br&key=${encodeURIComponent(google.api_key)}`);
      if (response.ok) {
        const result = await response.clone().json() as { status?: string };
        if (result.status && !['OK', 'ZERO_RESULTS'].includes(result.status)) throw new Error('provider_error');
      }
    } else {
      throw new Error('provider_test_not_implemented');
    }
    if (!response.ok) throw new Error(canal === 'whatsapp' ? 'zapi_connection_failed' : 'provider_error');
    const ready = true;
    const statusDetail = canal === 'whatsapp' ? 'Conexão Z-API validada com segurança.' : `Conexão ${integration.provider} validada para a Busca de Leads.`;
    await admin.from('integrations').update({ connected: true, enabled: true, paused: false, status_detail: statusDetail, last_tested_at: new Date().toISOString(), last_success_at: new Date().toISOString(), last_error: null, last_error_at: null }).eq('id', integration.id);
    if (sourceKey) {
      await admin.from('lead_source_configs').update({ enabled: true, mode: 'production', connection_status: 'connected', last_success_at: new Date().toISOString(), last_error: null, last_error_at: null, updated_at: new Date().toISOString() }).eq('organization_id', organizationId).eq('source_key', sourceKey);
    }
    await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: `integration.${body.canal}_checked`, detail: ready ? 'Integração pronta para a fila.' : 'Integração não está pronta para a fila.', entity_table: 'integrations', entity_id: integration?.id, event_data: { ready } });
    return json({ ok: true, pronto: ready, provedor: integration?.provider, detalhe: ready ? (sourceKey ? 'Conexão válida. A fonte pode ser usada no Modo Real.' : 'Conexão válida. Envios continuam passando pela fila segura.') : integration?.status_detail ?? 'Conexão ausente, pausada ou desabilitada.' }, 200, headers);
  } catch (error) { return json({ ok: false, erro: safeError(error) }, 400, headers); }
});
