import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

const AI_MODELS = {
  openai: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini'],
  claude: ['claude-sonnet-5', 'claude-haiku-4-5', 'claude-opus-5'],
} as const;
const APIFY_GOOGLE_MAPS_ACTOR = 'compass/google-maps-extractor';

type AiProvider = keyof typeof AI_MODELS;

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asText(value: unknown, maximum = 1_000): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function isAiProvider(value: string): value is AiProvider {
  return value === 'openai' || value === 'claude';
}

function acceptedModel(provider: AiProvider, submitted: string, stored: string): string {
  const allowedModels: readonly string[] = AI_MODELS[provider];
  if (submitted && !allowedModels.includes(submitted)) throw new Error('ai_model_not_allowed');
  const candidate = submitted || stored;
  return allowedModels.includes(candidate) ? candidate : '';
}

function storedSecretReference(configuration: Record<string, unknown>): string | null {
  const reference = asText(configuration.secret_ref, 80);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference)
    ? reference
    : null;
}

function zapiCallbackRouteChanged(previous: Record<string, unknown>, next: Record<string, unknown>): boolean {
  const previousInstance = asText(previous.instancia_id, 300);
  const nextInstance = asText(next.instancia_id, 300);
  const previousToken = asText(previous.token, 500);
  const nextToken = asText(next.token, 500);
  const previousBase = asText(previous.url_base, 500).replace(/\/+$/, '').toLowerCase();
  const nextBase = asText(next.url_base, 500).replace(/\/+$/, '').toLowerCase();

  // A registration stays valid when credentials are saved unchanged. If the
  // provider route changes, however, its callbacks may still point at the old
  // instance. Keep that state visible without logging either credential.
  return (Boolean(previousInstance && nextInstance) && previousInstance !== nextInstance)
    || (Boolean(previousToken && nextToken) && previousToken !== nextToken)
    || (Boolean(previousBase && nextBase) && previousBase !== nextBase);
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);
  try {
    const body = await request.json() as { action?: string; canal?: string; enabled?: unknown; credenciais?: Record<string, unknown> };
    const action = String(body.action ?? 'save').trim();
    const canal = String(body.canal ?? '').trim();
    if (!['whatsapp', 'apify', 'google_places', 'ai'].includes(canal)) throw new Error('unsupported_channel');
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const { data: profile } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (!profile?.active_organization_id) throw new Error('organization_context_required');
    const organizationId = profile.active_organization_id as string;
    await requireOrganizationRole(admin, user.id, organizationId, ['owner', 'admin', 'manager']);

    if (action === 'set_usage') {
      if (!['ai', 'apify', 'google_places'].includes(canal)) throw new Error('usage_channel_not_supported');
      if (typeof body.enabled !== 'boolean') throw new Error('usage_status_required');
      const { data: current, error: currentError } = await admin.from('integrations')
        .select('id,provider,connected,enabled,paused,last_tested_at,last_error')
        .eq('organization_id', organizationId).eq('key', canal).maybeSingle();
      if (currentError || !current) throw new Error('integration_not_found');
      if (body.enabled === true && (current.connected !== true || current.paused === true || Boolean(current.last_error) || !current.last_tested_at)) {
        throw new Error('integration_validation_required');
      }
      const now = new Date().toISOString();
      const { error: integrationError } = await admin.from('integrations').update({
        enabled: body.enabled,
        updated_at: now,
        status_detail: body.enabled ? 'Uso operacional habilitado após validação confirmada.' : 'Uso operacional desativado; configuração preservada.',
      }).eq('id', current.id).eq('organization_id', organizationId);
      if (integrationError) throw new Error('integration_usage_save_failed');
      if (['apify', 'google_places'].includes(canal)) {
        const { error: sourceError } = await admin.from('lead_source_configs').update({ enabled: body.enabled, updated_at: now })
          .eq('organization_id', organizationId).eq('source_key', canal);
        if (sourceError) throw new Error('integration_source_usage_save_failed');
      }
      await admin.from('audit_logs').insert({
        organization_id: organizationId,
        actor_id: user.id,
        actor_name: profile.name,
        actor_type: 'user',
        action: body.enabled ? `integration.${canal}_enabled` : `integration.${canal}_disabled`,
        detail: body.enabled ? 'Uso operacional habilitado após validação.' : 'Uso operacional desativado sem remover credenciais.',
        entity_table: 'integrations',
        entity_id: current.id,
        event_data: { enabled: body.enabled, previous_enabled: current.enabled },
      });
      return json({ ok: true, enabled: body.enabled }, 200, headers);
    }

    const credenciais = asObject(body.credenciais);
    const instanceId = asText(credenciais.instancia_id, 300);
    const token = asText(credenciais.token, 500);
    const clientToken = asText(credenciais.client_token, 500);
    const apifyToken = asText(credenciais.api_token, 1_000);
    const actorId = asText(credenciais.actor_id, 300);
    const taskId = asText(credenciais.task_id, 300);
    const useGoogleMapsActor = canal === 'apify' && credenciais.usar_actor_google_maps === true;
    const googleApiKey = asText(credenciais.api_key, 1_000);
    if (canal === 'whatsapp' && (!instanceId || !token || !clientToken)) throw new Error('zapi_credentials_required');
    if (canal === 'apify' && !useGoogleMapsActor && (!apifyToken || (!actorId && !taskId))) throw new Error('apify_credentials_required');
    if (canal === 'google_places' && !googleApiKey) throw new Error('google_places_credentials_required');
    const selectedAiProvider = asText(credenciais.provedor_principal, 30).toLowerCase();
    if (canal === 'ai' && !isAiProvider(selectedAiProvider)) throw new Error('ai_provider_required');
    const labels: Record<string, { label: string; provider: string; detail: string; category: string }> = {
      whatsapp: { label: 'WhatsApp (Z-API)', provider: 'Z-API', detail: 'Mensageria WhatsApp.', category: 'communication' },
      apify: { label: 'Apify — Google Maps', provider: 'Apify', detail: 'Busca real por Actor ou Task autorizado.', category: 'prospecting' },
      google_places: { label: 'Google Places', provider: 'Google Places', detail: 'Busca real de empresas por texto e localização.', category: 'prospecting' },
      ai: { label: 'IA da Ana', provider: 'OpenAI / Claude', detail: 'Provedor comercial da Ana, configurado no cofre.', category: 'intelligence' },
    };
    const definition = labels[canal];
    const { data: existing, error } = await admin.from('integrations').select('id,configuration').eq('organization_id', organizationId).eq('key', canal).maybeSingle();
    if (error) throw new Error('integration_lookup_failed');
    const inserted = existing ? null : await admin.from('integrations').insert({ organization_id: organizationId, key: canal, label: definition.label, provider: definition.provider, category: definition.category, connected: false, enabled: false, paused: false, mode: 'production', status_detail: definition.detail, configuration: {} }).select('id,configuration').single();
    if (inserted?.error) throw new Error('integration_create_failed');
    const integration = existing ?? inserted?.data;
    if (!integration) throw new Error('integration_not_found');
    // The webhook URL contains this credential. Rotating it when the operator
    // merely saves the Z-API settings leaves the provider calling the old URL
    // and the callback is rejected before it can be audited. Keep a valid
    // existing token; a new token is needed only for the first configuration.
    const storedWhatsAppSecret = canal === 'whatsapp' && existing
      ? await admin.rpc('read_integration_secret', { p_integration: integration.id })
      : { data: null, error: null };
    if (storedWhatsAppSecret.error) throw new Error('integration_secret_read_failed');
    const existingWhatsAppCredentials = asObject(storedWhatsAppSecret.data);
    const existingWebhookToken = asText(existingWhatsAppCredentials.webhook_token, 128);
    let selectedAiModel = '';
    let aiPublicConfiguration: Record<string, unknown> | null = null;
    let credentials: Record<string, unknown> = canal === 'whatsapp'
      ? {
        instancia_id: instanceId,
        token,
        client_token: clientToken,
        numero_origem: String(credenciais.numero_origem ?? '').trim(),
        url_base: String(credenciais.url_base ?? 'https://api.z-api.io').trim(),
        webhook_token: existingWebhookToken || crypto.randomUUID().replace(/-/g, ''),
      }
      : canal === 'apify'
        ? { api_token: apifyToken, actor_id: actorId, task_id: taskId, input_json: String(credenciais.input_json ?? '').trim() }
        : canal === 'google_places'
          ? { api_key: googleApiKey }
          : {};
    const whatsappCallbackRouteChanged = canal === 'whatsapp'
      && zapiCallbackRouteChanged(existingWhatsAppCredentials, credentials);

    if (canal === 'apify' && useGoogleMapsActor) {
      const { data: storedSecret, error: storedSecretError } = await admin.rpc('read_integration_secret', { p_integration: integration.id });
      if (storedSecretError) throw new Error('integration_secret_read_failed');
      const previousCredentials = asObject(storedSecret);
      const storedToken = asText(previousCredentials.api_token, 1_000);
      if (!storedToken) throw new Error('apify_credentials_missing');
      // O token nunca volta ao navegador: esta operação apenas troca o Actor no
      // cofre e remove uma Task que poderia sobrepor o payload Google Maps.
      credentials = {
        ...previousCredentials,
        api_token: storedToken,
        actor_id: APIFY_GOOGLE_MAPS_ACTOR,
        task_id: '',
        input_json: asText(previousCredentials.input_json, 20_000),
      };
    }

    if (canal === 'ai') {
      const { data: storedSecret, error: storedSecretError } = await admin.rpc('read_integration_secret', { p_integration: integration.id });
      if (storedSecretError) throw new Error('integration_secret_read_failed');
      const previousCredentials = asObject(storedSecret);
      const openaiKey = asText(credenciais.openai_key, 1_000) || asText(previousCredentials.openai_key, 1_000);
      const claudeKey = asText(credenciais.claude_key, 1_000) || asText(previousCredentials.claude_key, 1_000);
      const openaiModel = acceptedModel('openai', asText(credenciais.openai_model, 100), asText(previousCredentials.openai_model, 100));
      const claudeModel = acceptedModel('claude', asText(credenciais.claude_model, 100), asText(previousCredentials.claude_model, 100));
      const provider = selectedAiProvider as AiProvider;
      selectedAiModel = provider === 'openai' ? openaiModel : claudeModel;
      if (!selectedAiModel) throw new Error('ai_model_required');
      if (provider === 'openai' && !openaiKey) throw new Error('ai_provider_key_required');
      if (provider === 'claude' && !claudeKey) throw new Error('ai_provider_key_required');

      // Campos de senha em branco significam "manter no cofre", nunca apagar uma
      // chave já armazenada. Somente este objeto segue para a função de Vault.
      credentials = {
        openai_key: openaiKey,
        claude_key: claudeKey,
        provedor_principal: provider,
        openai_model: openaiModel,
        claude_model: claudeModel,
      };
      const secretRef = storedSecretReference(asObject(integration.configuration));
      aiPublicConfiguration = {
        ...(secretRef ? { secret_ref: secretRef } : {}),
        configured: false,
        provedor_principal: provider,
        modelo_principal: selectedAiModel,
        openai_model: openaiModel || null,
        claude_model: claudeModel || null,
        openai_configurado: Boolean(openaiKey),
        claude_configurado: Boolean(claudeKey),
        // A configuração nunca se passa por homologação: o teste atual verifica
        // credencial/provedor, não uma chamada ao modelo selecionado.
        modelo_principal_validado: false,
      };
      const { error: publicConfigurationError } = await admin.from('integrations').update({
        provider: provider === 'openai' ? 'OpenAI' : 'Claude',
        configuration: aiPublicConfiguration,
        connected: false,
        enabled: false,
        paused: false,
        status_detail: 'Configuração atualizada. Aguardando gravação segura no cofre.',
      }).eq('id', integration.id).eq('organization_id', organizationId);
      if (publicConfigurationError) throw new Error('integration_public_configuration_save_failed');
    }
    const { error: secretError } = await admin.rpc('store_integration_secret', { p_integration: integration.id, p_secret: credentials });
    if (secretError) throw new Error('integration_secret_save_failed');
    // Salvar credenciais não pode depender da configuração de callbacks do
    // provedor. A Z-API aceitou a instância, mas devolveu HTTP 400 para o
    // endpoint legado `update-every-webhooks`; tratar isso como falha de
    // salvamento deixava as chaves gravadas no cofre e a interface informando
    // o contrário. A homologação inbound é uma etapa própria: só será marcada
    // como pronta depois de um callback real controlado.
    let webhookRegistrationInvalidated = false;
    if (whatsappCallbackRouteChanged) {
      const { data: webhook, error: webhookLookupError } = await admin.from('integrations')
        .select('id,configuration').eq('organization_id', organizationId).eq('key', 'zapi_webhook').maybeSingle();
      if (webhookLookupError) {
        console.error('whatsapp_webhook_invalidation_lookup_failed', { integrationId: integration.id });
      } else if (webhook) {
        const now = new Date().toISOString();
        const { error: webhookUpdateError } = await admin.from('integrations').update({
          connected: false,
          enabled: true,
          paused: false,
          last_tested_at: null,
          last_success_at: null,
          last_error: 'whatsapp_credentials_changed',
          last_error_at: now,
          status_detail: 'As credenciais da instância Z-API foram alteradas. Recadastre a entrada antes de esperar novas respostas.',
          configuration: {
            ...asObject(webhook.configuration),
            registration_complete: false,
            registration_invalidated_at: now,
            registration_invalidation_reason: 'whatsapp_credentials_changed',
          },
          updated_at: now,
        }).eq('id', webhook.id).eq('organization_id', organizationId);
        if (webhookUpdateError) {
          // The Vault write already succeeded. Avoid telling the operator the
          // credential save failed after the fact; the diagnostics still block
          // inbound automation until a verified callback arrives.
          console.error('whatsapp_webhook_invalidation_save_failed', { integrationId: integration.id });
        } else {
          webhookRegistrationInvalidated = true;
        }
      }
    }

    const publicConfiguration = canal === 'apify'
      ? { actor_id: asText(credentials.actor_id, 300) || null, task_id: asText(credentials.task_id, 300) || null }
      : aiPublicConfiguration ?? {};
    // store_integration_secret já atualiza a integração e preserva a referência
    // do cofre. Uma segunda atualização era redundante e podia falhar depois de
    // as credenciais terem sido salvas, prendendo o usuário no modal.
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
    const nonSecretFields = new Set(['token', 'api_token', 'api_key', 'client_token', 'openai_key', 'claude_key', 'webhook_token']);
    const { error: auditError } = await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: `integration.${canal}_configured`, detail: useGoogleMapsActor ? 'Actor Google Maps atualizado no cofre seguro; valide a conexão antes de prospectar.' : `Credenciais de ${definition.provider} guardadas no cofre seguro.`, entity_table: 'integrations', entity_id: integration.id, event_data: { provider: canal === 'ai' ? selectedAiProvider : definition.provider, model: canal === 'ai' ? selectedAiModel : null, configured_fields: Object.keys(credentials).filter((key) => !nonSecretFields.has(key) && Boolean(credentials[key])), webhook_registration_invalidated: webhookRegistrationInvalidated, ...(useGoogleMapsActor ? { actor_strategy: 'google_maps' } : {}) } });
    if (auditError) console.error('integration_audit_log_failed', { canal, integrationId: integration.id });
    const mensagem = useGoogleMapsActor
      ? 'Actor Google Maps atualizado com segurança. Valide a conexão para ativar a fonte.'
      : webhookRegistrationInvalidated
        ? 'Credenciais guardadas com segurança. Recadastre agora a entrada da Z-API antes de esperar novas respostas.'
        : 'Credenciais guardadas com segurança. Valide a conexão para ativar a fonte.';
    return json({ ok: true, mensagem }, 200, headers);
  } catch (error) { return json({ ok: false, erro: safeError(error) }, 400, headers); }
});
