import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);
  try {
    const body = await request.json() as { canal?: string; credenciais?: Record<string, unknown> };
    const canal = String(body.canal ?? '').trim();
    if (!['whatsapp', 'apify', 'google_places'].includes(canal)) throw new Error('unsupported_channel');
    const credenciais = body.credenciais ?? {};
    const instanceId = String(credenciais.instancia_id ?? '').trim();
    const token = String(credenciais.token ?? '').trim();
    const apifyToken = String(credenciais.api_token ?? '').trim();
    const actorId = String(credenciais.actor_id ?? '').trim();
    const taskId = String(credenciais.task_id ?? '').trim();
    const googleApiKey = String(credenciais.api_key ?? '').trim();
    if (canal === 'whatsapp' && (!instanceId || !token)) throw new Error('zapi_credentials_required');
    if (canal === 'apify' && (!apifyToken || (!actorId && !taskId))) throw new Error('apify_credentials_required');
    if (canal === 'google_places' && !googleApiKey) throw new Error('google_places_credentials_required');
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const { data: profile } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (!profile?.active_organization_id) throw new Error('organization_context_required');
    const organizationId = profile.active_organization_id as string;
    await requireOrganizationRole(admin, user.id, organizationId, ['owner', 'admin', 'manager']);
    const labels: Record<string, { label: string; provider: string; detail: string }> = {
      whatsapp: { label: 'WhatsApp (Z-API)', provider: 'Z-API', detail: 'Mensageria WhatsApp.' },
      apify: { label: 'Apify — Google Maps', provider: 'Apify', detail: 'Busca real por Actor ou Task autorizado.' },
      google_places: { label: 'Google Places', provider: 'Google Places', detail: 'Busca real de empresas por texto e localização.' },
    };
    const definition = labels[canal];
    const { data: existing, error } = await admin.from('integrations').select('id').eq('organization_id', organizationId).eq('key', canal).maybeSingle();
    if (error) throw error;
    const integration = existing ?? (await admin.from('integrations').insert({ organization_id: organizationId, key: canal, label: definition.label, provider: definition.provider, connected: false, enabled: false, paused: false, mode: 'production', status_detail: definition.detail, configuration: {} }).select('id').single()).data;
    if (!integration) throw new Error('integration_not_found');
    const credentials = canal === 'whatsapp'
      ? { instancia_id: instanceId, token, client_token: String(credenciais.client_token ?? '').trim(), numero_origem: String(credenciais.numero_origem ?? '').trim(), url_base: String(credenciais.url_base ?? 'https://api.z-api.io').trim() }
      : canal === 'apify'
        ? { api_token: apifyToken, actor_id: actorId, task_id: taskId, input_json: String(credenciais.input_json ?? '').trim() }
        : { api_key: googleApiKey };
    const { error: secretError } = await admin.rpc('store_integration_secret', { p_integration: integration.id, p_secret: credentials });
    if (secretError) throw secretError;
    const publicConfiguration = canal === 'apify' ? { actor_id: actorId || null, task_id: taskId || null } : {};
    await admin.from('integrations').update({ label: definition.label, provider: definition.provider, configuration: publicConfiguration, connected: false, enabled: false, paused: false, mode: 'production', status_detail: 'Credenciais guardadas. Valide a conexão para ativar.', last_error: null, last_error_at: null, updated_at: new Date().toISOString() }).eq('id', integration.id);
    const sourceConfig = await admin.from('lead_source_configs').select('id').eq('organization_id', organizationId).eq('source_key', canal).maybeSingle();
    if (sourceConfig.data?.id) {
      await admin.from('lead_source_configs').update({ label: definition.label, enabled: false, mode: 'production', connection_status: 'configured', configuration: publicConfiguration, last_error: null, last_error_at: null, updated_at: new Date().toISOString() }).eq('id', sourceConfig.data.id);
    } else {
      await admin.from('lead_source_configs').insert({ organization_id: organizationId, source_key: canal, label: definition.label, enabled: false, mode: 'production', connection_status: 'configured', configuration: publicConfiguration, created_by: user.id });
    }
    await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: `integration.${canal}_configured`, detail: `Credenciais de ${definition.provider} guardadas no cofre seguro.`, entity_table: 'integrations', entity_id: integration.id, event_data: { provider: definition.provider, configured_fields: Object.keys(credentials).filter((key) => key !== 'token' && key !== 'api_token' && key !== 'api_key' && Boolean(credentials[key as keyof typeof credentials])) } });
    return json({ ok: true, mensagem: 'Credenciais guardadas com segurança. Valide a conexão para ativar a fonte.' }, 200, headers);
  } catch (error) { return json({ ok: false, erro: safeError(error) }, 400, headers); }
});
