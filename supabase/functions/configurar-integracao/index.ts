import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);
  try {
    const body = await request.json() as { canal?: string; credenciais?: Record<string, unknown> };
    if (body.canal !== 'whatsapp') throw new Error('unsupported_channel');
    const instanceId = String(body.credenciais?.instancia_id ?? '').trim();
    const token = String(body.credenciais?.token ?? '').trim();
    if (!instanceId || !token) throw new Error('zapi_credentials_required');
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const { data: profile } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (!profile?.active_organization_id) throw new Error('organization_context_required');
    const organizationId = profile.active_organization_id as string;
    await requireOrganizationRole(admin, user.id, organizationId, ['owner', 'admin', 'manager']);
    const { data: integration, error } = await admin.from('integrations').select('id').eq('organization_id', organizationId).eq('key', 'whatsapp').maybeSingle();
    if (error || !integration) throw error ?? new Error('integration_not_found');
    const credentials = {
      instancia_id: instanceId, token,
      client_token: String(body.credenciais?.client_token ?? '').trim(),
      numero_origem: String(body.credenciais?.numero_origem ?? '').trim(),
      url_base: String(body.credenciais?.url_base ?? 'https://api.z-api.io').trim(),
    };
    const { error: secretError } = await admin.rpc('store_integration_secret', { p_integration: integration.id, p_secret: credentials });
    if (secretError) throw secretError;
    await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'integration.whatsapp_configured', detail: 'Credenciais da Z-API guardadas no cofre seguro.', entity_table: 'integrations', entity_id: integration.id, event_data: { provider: 'Z-API', configured_fields: Object.keys(credentials).filter((key) => key !== 'token' && credentials[key as keyof typeof credentials]) } });
    return json({ ok: true, mensagem: 'Credenciais guardadas com segurança. Valide a conexão para ativar o canal.' }, 200, headers);
  } catch (error) { return json({ ok: false, erro: safeError(error) }, 400, headers); }
});
