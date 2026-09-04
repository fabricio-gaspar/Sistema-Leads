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
    const clientToken = String(credenciais.client_token ?? '').trim();
    const apifyToken = String(credenciais.api_token ?? '').trim();
    const actorId = String(credenciais.actor_id ?? '').trim();
    const taskId = String(credenciais.task_id ?? '').trim();
    const googleApiKey = String(credenciais.api_key ?? '').trim();
    if (canal === 'whatsapp' && (!instanceId || !token || !clientToken)) throw new Error('zapi_credentials_required');
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
    const { data: existing, error } = await admin.from('integrations').select('id,configuration').eq('organization_id', organizationId).eq('key', canal).maybeSingle();
    if (error) throw new Error('integration_lookup_failed');
    const inserted = existing ? null : await admin.from('integrations').insert({ organization_id: organizationId, key: canal, label: definition.label, provider: definition.provider, connected: false, enabled: false, paused: false, mode: 'production', status_detail: definition.detail, configuration: {} }).select('id,configuration').single();
    if (inserted?.error) throw new Error('integration_create_failed');
    const integration = existing ?? inserted?.data;
    if (!integration) throw new Error('integration_not_found');
    const credentials = canal === 'whatsapp'
      ? { instancia_id: instanceId, token, client_token: clientToken, numero_origem: String(credenciais.numero_origem ?? '').trim(), url_base: String(credenciais.url_base ?? 'https://api.z-api.io').trim() }
      : canal === 'apify'
        ? { api_token: apifyToken, actor_id: actorId, task_id: taskId, input_json: String(credenciais.input_json ?? '').trim() }
        : { api_key: googleApiKey };
    const { error: secretError } = await admin.rpc('store_integration_secret', { p_integration: integration.id, p_secret: credentials });
    if (secretError) throw new Error('integration_secret_save_failed');
    const publicConfiguration = canal === 'apify' ? { actor_id: actorId || null, task_id: taskId || null } : {};
    const { error: integrationUpdateError } = await admin.from('integrations').update({
      label: definition.label,
      provider: definition.provider,
      // O cofre grava secret_ref nesta mesma coluna. Mesclar evita apagar a
      // referência quando o usuário salva novamente as credenciais.
      configuration: { ...(integration.configuration ?? {}), ...publicConfiguration },
      connected: false,
      enabled: false,
      paused: false,
      mode: 'production',
      status_detail: 'Credenciais guardadas. Valide a conexão para ativar.',
      last_error: null,
      last_error_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', integration.id);
    if (integrationUpdateError) throw new Error('integration_update_failed');
    // Somente provedores de busca aparecem em Fontes de Prospecção. WhatsApp
    // é um canal de atendimento e não pode ser gravado nessa tabela.
    if (canal === 'apify' || canal === 'google_places') {
      const { data: sourceConfig, error: sourceLookupError } = await admin.from('lead_source_configs').select('id').eq('organization_id', organizationId).eq('source_key', canal).maybeSingle();
      if (sourceLookupError) throw new Error('integration_source_config_lookup_failed');
      if (sourceConfig?.id) {
        const { error: sourceUpdateError } = await admin.from('lead_source_configs').update({ label: definition.label, enabled: false, mode: 'production', connection_status: 'configured', configuration: publicConfiguration, last_error: null, last_error_at: null, updated_at: new Date().toISOString() }).eq('id', sourceConfig.id);
        if (sourceUpdateError) throw new Error('integration_source_config_save_failed');
      } else {
        const { error: sourceInsertError } = await admin.from('lead_source_configs').insert({ organization_id: organizationId, source_key: canal, label: definition.label, enabled: false, mode: 'production', connection_status: 'configured', configuration: publicConfiguration, created_by: user.id });
        if (sourceInsertError) throw new Error('integration_source_config_save_failed');
      }
    }
    const { error: auditError } = await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: `integration.${canal}_configured`, detail: `Credenciais de ${definition.provider} guardadas no cofre seguro.`, entity_table: 'integrations', entity_id: integration.id, event_data: { provider: definition.provider, configured_fields: Object.keys(credentials).filter((key) => key !== 'token' && key !== 'api_token' && key !== 'api_key' && Boolean(credentials[key as keyof typeof credentials])) } });
    if (auditError) throw new Error('integration_audit_log_failed');
    return json({ ok: true, mensagem: 'Credenciais guardadas com segurança. Valide a conexão para ativar a fonte.' }, 200, headers);
  } catch (error) { return json({ ok: false, erro: safeError(error) }, 400, headers); }
});
