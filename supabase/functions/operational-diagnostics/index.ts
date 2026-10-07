import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';
import { zapiBaseUrl } from '../_shared/runtimeSafety.ts';

type Action = 'status' | 'set_kill_switch' | 'activate_real' | 'events' | 'configure_whatsapp_webhook' | 'activate_scheduler';
type WebhookDiagnosticState = 'not_configured' | 'credentials_changed' | 'waiting_callback' | 'lead_not_matched' | 'unsupported_callback' | 'processing_failed' | 'homologated';

const ZAPI_WEBHOOK_ENDPOINTS = [
  'update-webhook-received',
  'update-webhook-delivery',
  'update-webhook-message-status',
] as const;

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function textArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))]
    : [];
}

function safeNonNegativeNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(number) && number >= 0 && number <= 1_000_000_000 ? number : null;
}

function safeIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
}

function safeIntegrationTelemetry(value: unknown) {
  const configuration = asObject(value);
  const creditsRemaining = [
    configuration.credits_remaining,
    configuration.credit_balance,
    configuration.credits_available,
    configuration.quota_remaining,
  ].map(safeNonNegativeNumber).find((candidate): candidate is number => candidate !== null) ?? null;
  const expiresAt = [
    configuration.expires_at,
    configuration.session_expires_at,
    configuration.subscription_expires_at,
  ].map(safeIsoDate).find((candidate): candidate is string => candidate !== null) ?? null;
  return { creditsRemaining, expiresAt, available: creditsRemaining !== null || expiresAt !== null };
}

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

async function upsertOperationalIntegration(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  definition: { key: string; label: string; provider: string; category: string; detail: string },
) {
  const { data: existing, error: lookupError } = await admin.from('integrations')
    .select('id,configuration').eq('organization_id', organizationId).eq('key', definition.key).maybeSingle();
  if (lookupError) throw new Error('operational_integration_lookup_failed');
  if (existing) return existing;
  const { data: inserted, error: insertError } = await admin.from('integrations').insert({
    organization_id: organizationId,
    key: definition.key,
    label: definition.label,
    provider: definition.provider,
    category: definition.category,
    connected: false,
    enabled: false,
    paused: false,
    mode: 'production',
    status_detail: definition.detail,
    configuration: {},
  }).select('id,configuration').single();
  if (insertError || !inserted) throw new Error('operational_integration_create_failed');
  return inserted;
}

async function operationalStatus(admin: ReturnType<typeof createAdminClient>, organizationId: string) {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const [
    companyRead,
    integrationsRead,
    runtimeRead,
    sourcesRead,
    sentHourRead,
    sentDayRead,
    dailyReportHourRead,
    dailyReportDayRead,
    inboundHourRead,
    inboundDayRead,
    deliveredDayRead,
    failedDayRead,
    policyRead,
    whatsappAccountsRead,
    providerControlsRead,
  ] = await Promise.all([
    admin.from('company_settings').select('active,sandbox_mode,can_use_ia,ai_actions_enabled,updated_at').eq('organization_id', organizationId).maybeSingle(),
    admin.from('integrations').select('id,key,label,category,provider,connected,enabled,paused,last_tested_at,last_success_at,last_error,status_detail,configuration').eq('organization_id', organizationId).order('label'),
    admin.from('organization_module_data').select('data,updated_at').eq('organization_id', organizationId).eq('module_key', 'configuracao_runtime').maybeSingle(),
    admin.from('lead_source_configs').select('source_key,label,enabled,mode,connection_status,last_success_at,last_error').eq('organization_id', organizationId).order('label'),
    admin.from('outreach_jobs').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('channel', 'whatsapp').eq('status', 'processed').gte('processed_at', oneHourAgo),
    admin.from('outreach_jobs').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('channel', 'whatsapp').eq('status', 'processed').gte('processed_at', oneDayAgo),
    admin.from('daily_lead_report_deliveries').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'sent').gte('sent_at', oneHourAgo),
    admin.from('daily_lead_report_deliveries').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'sent').gte('sent_at', oneDayAgo),
    admin.from('channel_inbound_events').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId).gte('created_at', oneHourAgo),
    admin.from('channel_inbound_events').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId).gte('created_at', oneDayAgo),
    admin.from('lead_outreach').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('channel', 'whatsapp').not('delivered_at', 'is', null).gte('delivered_at', oneDayAgo),
    admin.from('outreach_jobs').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('channel', 'whatsapp').eq('status', 'failed').gte('run_at', oneDayAgo),
    admin.from('channel_policy_events').select('id,risk_level,action,reason,created_at').eq('organization_id', organizationId).eq('channel', 'whatsapp').is('resolved_at', null).order('created_at', { ascending: false }).limit(20),
    admin.from('whatsapp_accounts').select('id,integration_id,provider,account_type,is_default,enabled,connection_status,status_checked_at,updated_at,verified_name,label')
      .eq('organization_id', organizationId).is('archived_at', null),
    admin.from('messaging_provider_controls').select('provider,inbound_enabled,send_enabled,automation_enabled,kill_switch,reason,updated_at')
      .eq('organization_id', organizationId).in('provider', ['zapi', 'meta_cloud']),
  ]);
  if ([
    companyRead,
    integrationsRead,
    runtimeRead,
    sourcesRead,
    sentHourRead,
    sentDayRead,
    dailyReportHourRead,
    dailyReportDayRead,
    inboundHourRead,
    inboundDayRead,
    deliveredDayRead,
    failedDayRead,
    policyRead,
    whatsappAccountsRead,
    providerControlsRead,
  ].some((read) => read.error)) throw new Error('operational_status_read_failed');

  const company = companyRead.data;
  const runtime = asObject(runtimeRead.data?.data);
  const integrations = Array.isArray(integrationsRead.data) ? integrationsRead.data : [];
  const whatsappAccounts = Array.isArray(whatsappAccountsRead.data) ? whatsappAccountsRead.data : [];
  const providerControls = Array.isArray(providerControlsRead.data) ? providerControlsRead.data : [];
  const integration = (key: string) => integrations.find((item) => item.key === key) ?? null;
  const ai = integration('ai');
  const whatsapp = integration('whatsapp');
  const whatsappWebhook = integration('zapi_webhook');
  const scheduler = integration('scheduler');
  const isFresh = (value: string | null | undefined) => {
    if (!value) return false;
    const testedAt = new Date(value).getTime();
    return Number.isFinite(testedAt) && Date.now() - testedAt <= 24 * 60 * 60 * 1000;
  };
  const isOnline = (item: Pick<NonNullable<typeof ai>, 'connected' | 'enabled' | 'paused' | 'last_error' | 'last_tested_at'> | null) => Boolean(item?.connected && item?.enabled && !item?.paused && !item?.last_error && isFresh(item?.last_tested_at));
  const accountForProvider = (provider: 'zapi' | 'meta_cloud') => whatsappAccounts.find((account) => account.provider === provider && account.is_default)
    ?? whatsappAccounts.find((account) => account.provider === provider && account.account_type === 'corporate')
    ?? whatsappAccounts.find((account) => account.provider === provider)
    ?? null;
  const controlForProvider = (provider: 'zapi' | 'meta_cloud') => providerControls.find((control) => control.provider === provider) ?? null;
  const providerActive = (provider: 'zapi' | 'meta_cloud') => {
    const control = controlForProvider(provider);
    if (control) return control.inbound_enabled === true && control.send_enabled === true
      && control.automation_enabled === true && control.kill_switch !== true;
    // Organizações anteriores aos controles explícitos continuam operando pela
    // integração já homologada até que um administrador faça a escolha.
    const account = accountForProvider(provider);
    const backing = account?.integration_id ? integrations.find((item) => item.id === account.integration_id) : integration('whatsapp');
    return provider === 'zapi' && (account ? account.enabled === true : true) && backing?.enabled === true && backing?.paused !== true;
  };
  const providerIntegration = (provider: 'zapi' | 'meta_cloud') => {
    const account = accountForProvider(provider);
    const backing = account?.integration_id ? integrations.find((item) => item.id === account.integration_id) : provider === 'zapi' ? integration('whatsapp') : null;
    const active = providerActive(provider);
    const connected = account ? account.connection_status === 'connected' && backing?.connected === true : backing?.connected === true;
    const name = provider === 'zapi' ? 'Z-API' : 'Meta WhatsApp Cloud API';
    const control = controlForProvider(provider);
    return {
      key: provider === 'zapi' ? 'whatsapp_zapi' : 'whatsapp_meta',
      label: name,
      category: 'communication',
      provider: name,
      connected,
      enabled: active,
      paused: false,
      last_tested_at: account?.status_checked_at ?? backing?.last_tested_at ?? account?.updated_at ?? null,
      last_success_at: backing?.last_success_at ?? null,
      last_error: active ? (backing?.last_error ?? null) : null,
      status_detail: active
        ? `Ativo no WayFlex para entrada, saída e automações da Ana.${control?.reason ? ` ${control.reason}` : ''}`
        : account
          ? `Desativado no WayFlex. ${control?.reason || 'A configuração e a sessão remota foram preservadas.'}`
          : 'Nenhuma conta conectada para este provedor.',
      configuration: backing?.configuration ?? {},
    };
  };
  const zapiProvider = providerIntegration('zapi');
  const metaProvider = providerIntegration('meta_cloud');
  const activeProvider = [zapiProvider, metaProvider].find((item) => item.enabled) ?? null;
  const activeWhatsappPolicies = policyRead.data ?? [];
  const sentLastHour = (sentHourRead.count ?? 0) + (dailyReportHourRead.count ?? 0);
  const sentLast24Hours = (sentDayRead.count ?? 0) + (dailyReportDayRead.count ?? 0);
  const inboundLastHour = inboundHourRead.count ?? 0;
  const inboundLast24Hours = inboundDayRead.count ?? 0;
  const deliveredLast24Hours = deliveredDayRead.count ?? 0;
  const failedLast24Hours = failedDayRead.count ?? 0;
  const pausedByPolicy = activeWhatsappPolicies.some((event) => event.action === 'pause');
  const activeMessagingOnline = Boolean(activeProvider?.connected && activeProvider.enabled && !activeProvider.paused && !activeProvider.last_error);
  const whatsappMonitoringState = pausedByPolicy
    ? 'paused'
    : !activeMessagingOnline
      ? 'unavailable'
      : activeWhatsappPolicies.length > 0 || failedLast24Hours > 0
        ? 'attention'
        : 'stable';
  const whatsappMonitoringDetail = whatsappMonitoringState === 'paused'
    ? 'Envios estão pausados por uma política de risco ativa.'
    : whatsappMonitoringState === 'unavailable'
      ? activeProvider
        ? `${activeProvider.label} não está conectado e habilitado para enviar mensagens.`
        : 'Nenhum provedor corporativo do WhatsApp está ativo.'
      : whatsappMonitoringState === 'attention'
        ? 'Há falha recente ou evento de risco aberto; consulte os detalhes antes de aumentar o volume.'
        : 'Sem evento de risco aberto na leitura atual.';
  const webhookConfiguration = asObject(whatsappWebhook?.configuration);
  const registeredAt = typeof webhookConfiguration.registered_at === 'string' ? webhookConfiguration.registered_at : null;
  const registrationInvalidatedAt = typeof webhookConfiguration.registration_invalidated_at === 'string'
    ? webhookConfiguration.registration_invalidated_at
    : null;
  const registrationInvalidated = webhookConfiguration.registration_complete === false && registrationInvalidatedAt !== null;
  const registeredEndpoints = textArray(webhookConfiguration.registration_endpoints);
  const webhookRegistered = !registrationInvalidated && registeredAt !== null
    && ZAPI_WEBHOOK_ENDPOINTS.every((endpoint) => registeredEndpoints.includes(endpoint));
  const [webhookEventRead, testLeadRead] = await Promise.all([
    webhookRegistered
      // `channel_inbound_events` is intentionally created only after a lead was
      // resolved. Read the raw, audited webhook event here as well, otherwise an
      // unmatched callback is misleadingly reported as if Z-API never called us.
      ? admin.from('webhook_events').select('status,error,created_at,processed_at,lead_id,event_type')
        .eq('organization_id', organizationId).eq('provider', whatsapp?.provider || 'Z-API').eq('event_type', 'ReceivedCallback')
        .gte('created_at', registeredAt).order('created_at', { ascending: false }).limit(1)
      : Promise.resolve({ data: [], error: null }),
    admin.from('leads').select('id,company,contact,phone,whatsapp,updated_at').eq('organization_id', organizationId)
      .order('updated_at', { ascending: false }).limit(10),
  ]);
  if (webhookEventRead.error || testLeadRead.error) throw new Error('operational_webhook_diagnostic_read_failed');
  const latestWebhookEvent = (webhookEventRead.data ?? [])[0] as {
    status?: string;
    error?: string | null;
    created_at?: string | null;
    processed_at?: string | null;
    lead_id?: string | null;
  } | undefined;
  const testLead = (testLeadRead.data ?? []).find((lead) => typeof lead.phone === 'string' || typeof lead.whatsapp === 'string') ?? null;
  const testLeadPhone = typeof testLead?.whatsapp === 'string' && testLead.whatsapp.trim()
    ? testLead.whatsapp : typeof testLead?.phone === 'string' ? testLead.phone : '';
  const testLeadLabel = testLead ? [testLead.contact, testLead.company].filter((value) => typeof value === 'string' && value.trim()).join(' · ') : null;
  const testLeadSummary = testLead && testLeadPhone ? {
    id: testLead.id,
    label: testLeadLabel || 'Lead cadastrado',
    phoneSuffix: testLeadPhone.replace(/\D/g, '').slice(-4),
  } : null;
  const webhookDiagnostic = (() => {
    if (registrationInvalidated) return {
      state: 'credentials_changed' as WebhookDiagnosticState,
      registeredAt,
      lastEventAt: null,
      detail: 'As credenciais da instância Z-API foram alteradas depois do último cadastro de entrada. Recadastre os callbacks antes de esperar novas respostas.',
      testLead: testLeadSummary,
    };
    if (webhookRegistered && isOnline(whatsappWebhook)) return {
      state: 'homologated' as WebhookDiagnosticState,
      registeredAt,
      lastEventAt: latestWebhookEvent?.created_at ?? whatsappWebhook?.last_success_at ?? null,
      detail: whatsappWebhook?.status_detail || 'Uma resposta recebida foi vinculada a um lead e processada pela Ana.',
      testLead: null,
    };
    if (!webhookRegistered) return {
      state: 'not_configured' as WebhookDiagnosticState,
      registeredAt: null,
      lastEventAt: null,
      detail: 'A saída da Z-API pode estar validada; cadastre os callbacks de entrada, entrega e status de mensagem antes de homologar respostas para a Ana.',
      testLead: null,
    };
    if (!latestWebhookEvent) return {
      state: 'waiting_callback' as WebhookDiagnosticState,
      registeredAt,
      lastEventAt: null,
      detail: 'A Z-API aceitou o cadastro, mas ainda não entregou nenhum callback ao WayFlex desde esse momento. Não há falha da Ana nem do cadastro do lead a corrigir no sistema.',
      testLead: testLeadSummary,
    };
    if (latestWebhookEvent.error === 'lead_not_matched') return {
      state: 'lead_not_matched' as WebhookDiagnosticState,
      registeredAt,
      lastEventAt: latestWebhookEvent.created_at ?? null,
      detail: 'A Z-API entregou uma mensagem, mas ela não corresponde a nenhum WhatsApp cadastrado em Leads. Use o mesmo número do lead antes de repetir o teste.',
      testLead: testLeadSummary,
    };
    if (latestWebhookEvent.status === 'ignored') return {
      state: 'unsupported_callback' as WebhookDiagnosticState,
      registeredAt,
      lastEventAt: latestWebhookEvent.created_at ?? null,
      detail: latestWebhookEvent.error === 'non_direct_conversation'
        ? 'A Z-API recebeu o teste, mas ele veio de um grupo, lista ou canal. Para homologar, envie uma mensagem em conversa individual do número cadastrado no lead.'
        : latestWebhookEvent.error === 'outgoing_or_unknown_direction'
          ? 'A Z-API recebeu um evento de saída. Para homologar, o lead precisa enviar uma mensagem ao número conectado, e não o contrário.'
          : 'A Z-API entregou um callback que não é uma mensagem direta de texto de um lead. Envie uma mensagem comum, individual e recebida de um lead cadastrado.',
      testLead: testLeadSummary,
    };
    return {
      state: 'processing_failed' as WebhookDiagnosticState,
      registeredAt,
      lastEventAt: latestWebhookEvent.created_at ?? null,
      detail: 'A mensagem chegou ao WayFlex, mas o processamento não foi concluído. Consulte o Registro do Sistema antes de repetir o teste.',
      testLead: testLeadSummary,
    };
  })();
  const killSwitch = asBoolean(runtime.killSwitchGlobal, true);
  const checks = [
    { id: 'empresa', label: 'Empresa ativa', ok: company?.active === true, detail: company?.active === true ? 'Empresa habilitada.' : 'Empresa desativada no backend.' },
    { id: 'ia_empresa', label: 'Ações da Ana autorizadas', ok: company?.can_use_ia === true && company?.ai_actions_enabled === true, detail: company?.can_use_ia === true && company?.ai_actions_enabled === true ? 'Ações de IA permitidas.' : 'Ações de IA ainda bloqueadas pela empresa.' },
    { id: 'kill_switch', label: 'Pausa global desligada', ok: killSwitch === false, detail: killSwitch ? 'A automação está pausada pelo kill switch.' : 'Automação liberada por esta regra.' },
    { id: 'ia', label: 'IA online e validada', ok: isOnline(ai), detail: isOnline(ai) ? (ai?.status_detail || 'Provedor validado nas últimas 24 horas.') : 'Configure ou teste novamente o provedor de IA.' },
    {
      id: 'whatsapp',
      label: 'WhatsApp online e validado',
      ok: isOnline(activeProvider),
      detail: isOnline(activeProvider)
        ? (activeProvider?.status_detail || 'Canal validado nas últimas 24 horas.')
        : activeProvider
          ? `${activeProvider.label} precisa de uma validação recente.`
          : 'Ative e valide Z-API ou Meta WhatsApp Cloud API antes de liberar mensagens.',
    },
    {
      id: 'whatsapp_webhook',
      label: activeProvider?.key === 'whatsapp_meta' ? 'Respostas da Meta homologadas' : 'Respostas do WhatsApp homologadas',
      ok: activeProvider?.key === 'whatsapp_meta' ? false : isOnline(whatsappWebhook),
      detail: activeProvider?.key === 'whatsapp_meta'
        ? 'A Meta está ativa, mas a entrada ainda precisa ser homologada com um callback real antes de liberar a Ana automaticamente.'
        : webhookDiagnostic.detail,
    },
    {
      id: 'scheduler',
      label: 'Heartbeat recente do worker',
      ok: isOnline(scheduler),
      detail: isOnline(scheduler)
        ? 'O worker respondeu recentemente. Isso não comprova conclusão de buscas, mensagens ou entrega; consulte as execuções e a fila no Registro do Sistema.'
        : scheduler?.enabled
          ? 'O worker foi preparado e está aguardando seu primeiro heartbeat do servidor.'
          : 'Ative o worker seguro. Não é necessário cadastrar chave ou credencial manualmente.',
    },
  ];

  return {
    mode: company?.sandbox_mode === false ? 'real' : 'setup',
    modeLabel: company?.sandbox_mode === false ? 'Ambiente Real ativo' : 'Ambiente Real em preparação',
    updatedAt: company?.updated_at ?? null,
    runtimeUpdatedAt: runtimeRead.data?.updated_at ?? null,
    killSwitch,
    productionReady: checks.every((check) => check.ok),
    checks,
    webhookDiagnostic,
    integrations: [...integrations, zapiProvider, metaProvider].map((item) => ({
      key: item.key, label: item.label, category: item.category, provider: item.provider, connected: item.connected === true,
      enabled: item.enabled === true, paused: item.paused === true, lastTestedAt: item.last_tested_at,
      lastSuccessAt: item.last_success_at, lastError: item.last_error, detail: item.status_detail,
      health: item.connected === true && item.enabled === true && item.paused !== true && !item.last_error
        ? (isFresh(item.last_tested_at) ? 'online' : 'stale')
        : 'offline',
      telemetry: safeIntegrationTelemetry(item.configuration),
    })),
    sources: (sourcesRead.data ?? []).map((source) => ({
      key: source.source_key,
      label: source.label,
      enabled: source.enabled === true,
      mode: source.mode,
      connectionStatus: source.connection_status,
      lastSuccessAt: source.last_success_at,
      lastError: source.last_error,
      health: source.connection_status === 'connected' && !source.last_error
        ? (source.enabled === true ? 'online' : 'stale')
        : 'offline',
    })),
    whatsappMonitoring: {
      updatedAt: now.toISOString(),
      state: whatsappMonitoringState,
      detail: whatsappMonitoringDetail,
      sentLastHour,
      sentLast24Hours,
      inboundLastHour,
      inboundLast24Hours,
      deliveredLast24Hours,
      failedLast24Hours,
      openRiskEvents: activeWhatsappPolicies.length,
    },
  };
}

async function configureWhatsAppWebhook(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  actor: { id: string; name: string | null },
) {
  const { data: whatsapp, error: whatsappError } = await admin.from('integrations')
    .select('id').eq('organization_id', organizationId).eq('key', 'whatsapp').maybeSingle();
  if (whatsappError || !whatsapp) throw new Error('whatsapp_credentials_missing');
  const { data: credentials, error: credentialsError } = await admin.rpc('read_integration_secret', { p_integration: whatsapp.id });
  const zapi = credentials as { instancia_id?: unknown; token?: unknown; client_token?: unknown; url_base?: unknown; webhook_token?: unknown } | null;
  const instanceId = typeof zapi?.instancia_id === 'string' ? zapi.instancia_id.trim() : '';
  const token = typeof zapi?.token === 'string' ? zapi.token.trim() : '';
  const clientToken = typeof zapi?.client_token === 'string' ? zapi.client_token.trim() : '';
  const webhookToken = typeof zapi?.webhook_token === 'string' ? zapi.webhook_token.trim() : '';
  if (credentialsError || !instanceId || !token || !clientToken || !webhookToken) throw new Error('whatsapp_webhook_credentials_missing');

  const webhook = await upsertOperationalIntegration(admin, organizationId, {
    key: 'zapi_webhook',
    label: 'Webhooks do WhatsApp',
    provider: 'Z-API',
    category: 'communication',
    detail: 'Recebe respostas, confirmações de entrega e status de mensagens do WhatsApp.',
  });
  const now = new Date().toISOString();
  const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-whatsapp?integration_id=${encodeURIComponent(whatsapp.id)}&token=${encodeURIComponent(webhookToken)}`;
  const registered: string[] = [];
  try {
    for (const endpoint of ZAPI_WEBHOOK_ENDPOINTS) {
      const response = await fetch(`${zapiBaseUrl(typeof zapi?.url_base === 'string' ? zapi.url_base : undefined)}/instances/${encodeURIComponent(instanceId)}/token/${encodeURIComponent(token)}/${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({ value: callbackUrl }),
        signal: AbortSignal.timeout(20_000),
        redirect: 'error',
      });
      const providerBody = await response.json().catch(() => null) as Record<string, unknown> | null;
      if (!response.ok || providerBody?.value === false) throw new Error(`zapi_webhook_setup_${endpoint}_${response.status}`);
      registered.push(endpoint);
    }
  } catch (error) {
    const { error: partialStateError } = await admin.from('integrations').update({
      connected: false,
      enabled: true,
      paused: false,
      last_error: safeError(error).slice(0, 160),
      last_error_at: now,
      status_detail: 'Cadastro dos callbacks Z-API não foi concluído; nenhuma resposta da Ana foi homologada.',
      configuration: {
        ...asObject(webhook.configuration),
        registration_attempted_at: now,
        registration_endpoints: registered,
        registration_complete: false,
      },
      updated_at: now,
    }).eq('id', webhook.id).eq('organization_id', organizationId);
    if (partialStateError) throw new Error('whatsapp_webhook_partial_state_save_failed');
    throw error;
  }
  const configuration: Record<string, unknown> = {
    ...asObject(webhook.configuration),
    registered_at: now,
    registration_endpoints: ZAPI_WEBHOOK_ENDPOINTS,
    registration_complete: true,
  };
  delete configuration.registration_invalidated_at;
  delete configuration.registration_invalidation_reason;
  const { error: updateError } = await admin.from('integrations').update({
    connected: false,
    enabled: true,
    paused: false,
    last_tested_at: null,
    last_success_at: null,
    last_error: null,
    status_detail: 'Callbacks Z-API cadastrados; aguardando uma mensagem direta de teste de um lead cadastrado.',
    configuration,
    updated_at: now,
  }).eq('id', webhook.id).eq('organization_id', organizationId);
  if (updateError) throw new Error('whatsapp_webhook_status_save_failed');
  await admin.from('audit_logs').insert({
    organization_id: organizationId,
    actor_id: actor.id,
    actor_name: actor.name,
    actor_type: 'user',
    action: 'integration.whatsapp_webhooks_registered',
    detail: 'Callbacks de entrada, entrega e status registrados na Z-API; aguardando callback controlado.',
    entity_table: 'integrations',
    entity_id: webhook.id,
    event_data: { provider: 'Z-API', endpoints: ZAPI_WEBHOOK_ENDPOINTS },
  });
  return 'Os callbacks de entrada, entrega e status foram cadastrados na Z-API. Agora envie uma mensagem direta de um número que já exista como lead para concluir a homologação.';
}

async function activateScheduler(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  actor: { id: string; name: string | null },
) {
  const scheduler = await upsertOperationalIntegration(admin, organizationId, {
    key: 'scheduler',
    label: 'Worker 24/7',
    provider: 'WayFlex',
    category: 'scheduling',
    detail: 'Processa a fila de saída em servidor, sem depender do painel aberto.',
  });
  const { error: secretError } = await admin.rpc('store_integration_secret', {
    p_integration: scheduler.id,
    p_secret: { scheduler_token: randomSecret(), purpose: 'server_scheduler' },
  });
  if (secretError) throw new Error('scheduler_secret_save_failed');
  const { error: updateError } = await admin.from('integrations').update({
    connected: false,
    enabled: true,
    paused: false,
    last_tested_at: null,
    last_success_at: null,
    last_error: null,
    status_detail: 'Worker preparado com segurança; aguardando o primeiro heartbeat do servidor.',
    updated_at: new Date().toISOString(),
  }).eq('id', scheduler.id).eq('organization_id', organizationId);
  if (updateError) throw new Error('scheduler_status_save_failed');
  await admin.from('audit_logs').insert({
    organization_id: organizationId,
    actor_id: actor.id,
    actor_name: actor.name,
    actor_type: 'user',
    action: 'automation.scheduler_activated',
    detail: 'Worker 24/7 preparado para o agendador server-side.',
    entity_table: 'integrations',
    entity_id: scheduler.id,
    event_data: { source: 'operational_setup' },
  });
  return 'Worker preparado. O servidor fará a primeira verificação em até um minuto; atualize este painel para confirmar o heartbeat.';
}

async function activateRealEnvironment(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  actor: { id: string; name: string | null },
) {
  let status = await operationalStatus(admin, organizationId);
  const realAlreadyEnabled = status.mode === 'real';
  if (realAlreadyEnabled && status.productionReady) return {
    activated: true,
    message: 'O Ambiente Real já está ativo e validado pelo servidor.',
    actions: [] as string[],
    remaining: [],
    status,
  };

  const actions: string[] = [];
  const check = (id: string) => status.checks.find((item) => item.id === id);

  if (!check('scheduler')?.ok) {
    const scheduler = status.integrations.find((item) => item.key === 'scheduler');
    if (!scheduler?.enabled) {
      await activateScheduler(admin, organizationId, actor);
      actions.push('Worker 24/7 preparado automaticamente.');
    }
  }

  if (!check('whatsapp_webhook')?.ok && status.webhookDiagnostic.state === 'not_configured' && check('whatsapp')?.ok) {
    await configureWhatsAppWebhook(admin, organizationId, actor);
    actions.push('Entrada de respostas do WhatsApp cadastrada automaticamente.');
  }

  status = await operationalStatus(admin, organizationId);
  const checksExceptKillSwitch = status.checks.filter((item) => item.id !== 'kill_switch');
  if (status.killSwitch && checksExceptKillSwitch.every((item) => item.ok)) {
    const { data: current, error: currentError } = await admin.from('organization_module_data').select('data')
      .eq('organization_id', organizationId).eq('module_key', 'configuracao_runtime').maybeSingle();
    if (currentError) throw new Error('operational_runtime_read_failed');
    const data = { ...asObject(current?.data), killSwitchGlobal: false };
    const { error: writeError } = await admin.from('organization_module_data').upsert({
      organization_id: organizationId, module_key: 'configuracao_runtime', data, updated_by: actor.id, updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,module_key' });
    if (writeError) throw new Error('operational_runtime_save_failed');
    await admin.from('audit_logs').insert({
      organization_id: organizationId, actor_id: actor.id, actor_name: actor.name, actor_type: 'user',
      action: 'automation.kill_switch_disabled', detail: 'Pausa global liberada durante a ativação validada do Ambiente Real.',
      entity_table: 'organization_module_data', event_data: { module_key: 'configuracao_runtime', source: 'guided_real_activation' },
    });
    actions.push('Pausa global liberada após as demais verificações serem aprovadas.');
    status = await operationalStatus(admin, organizationId);
  }

  const remaining = status.checks.filter((item) => !item.ok);
  if (remaining.length > 0) return {
    activated: false,
    message: realAlreadyEnabled
      ? actions.length > 0
        ? 'A comunicação no Ambiente Real continua ativa. O sistema concluiu a preparação automática e falta somente a ação indicada para liberar as automações da Ana.'
        : 'A comunicação no Ambiente Real continua ativa. Conclua somente a ação indicada abaixo para liberar as automações da Ana.'
      : actions.length > 0
        ? 'O sistema concluiu a preparação automática. Falta somente a ação indicada abaixo.'
        : 'O Ambiente Real ainda está em preparação. Conclua somente a ação indicada abaixo e verifique novamente.',
    actions,
    remaining,
    status,
  };

  if (!realAlreadyEnabled) {
    const { error: modeWriteError } = await admin.from('company_settings').update({
      sandbox_mode: false,
      updated_at: new Date().toISOString(),
    }).eq('organization_id', organizationId);
    if (modeWriteError) throw new Error('operational_mode_save_failed');
    await admin.from('audit_logs').insert({
      organization_id: organizationId, actor_id: actor.id, actor_name: actor.name, actor_type: 'user',
      action: 'operation.real_mode_enabled',
      detail: 'Ambiente Real preparado e ativado após pré-verificação final do servidor.',
      entity_table: 'company_settings', event_data: { source: 'guided_real_activation', preflight: status.checks, automatic_actions: actions },
    });
    actions.push('Ambiente Real ativado.');
  } else {
    actions.push('Automações da Ana liberadas após a verificação final.');
  }
  status = await operationalStatus(admin, organizationId);
  return { activated: true, message: realAlreadyEnabled ? 'Ambiente Real ativo. As automações da Ana agora estão prontas para operar com as políticas de segurança.' : 'Ambiente Real ativo. O sistema está pronto para operar com as políticas de segurança.', actions, remaining: [], status };
}

async function diagnosticEvents(admin: ReturnType<typeof createAdminClient>, organizationId: string) {
  const [status, auditRead, runsRead, webhookRead, jobsRead, outreachRead, queuedRead, failedJobsRead, reconciliationRead, riskRead] = await Promise.all([
    operationalStatus(admin, organizationId),
    admin.from('audit_logs').select('id,actor_name,actor_type,action,detail,occurred_at,created_at').eq('organization_id', organizationId).order('occurred_at', { ascending: false }).limit(80),
    admin.from('agent_runs').select('id,event,status,error_code,error_message,created_at,completed_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(50),
    admin.from('channel_inbound_events').select('id,provider,event_type,status,error,created_at,processed_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(50),
    admin.from('outreach_jobs').select('id,lead_id,channel,status,attempt,run_at,processed_at,error').eq('organization_id', organizationId).order('run_at', { ascending: false }).limit(50),
    admin.from('lead_outreach').select('id,lead_id,channel,status,provider,scheduled_for,sent_at,delivered_at,read_at,replied_at,failed_at,error,created_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(50),
    admin.from('outreach_jobs').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId).in('status', ['queued', 'processing', 'reconciliation_required']),
    admin.from('outreach_jobs').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'failed'),
    admin.from('outreach_jobs').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'reconciliation_required'),
    admin.from('channel_policy_events').select('id,channel,risk_level,action,reason,created_at').eq('organization_id', organizationId).is('resolved_at', null).order('created_at', { ascending: false }).limit(20),
  ]);
  if ([auditRead, runsRead, webhookRead, jobsRead, outreachRead, queuedRead, failedJobsRead, reconciliationRead, riskRead].some((read) => read.error)) throw new Error('operational_diagnostics_read_failed');
  return {
    status,
    summary: { queuedJobs: queuedRead.count ?? 0, failedJobs: failedJobsRead.count ?? 0, reconciliationJobs: reconciliationRead.count ?? 0, openRiskEvents: (riskRead.data ?? []).length },
    audit: (auditRead.data ?? []).map((item) => ({ ...item, occurredAt: item.occurred_at ?? item.created_at })),
    runs: runsRead.data ?? [],
    inbound: webhookRead.data ?? [],
    jobs: jobsRead.data ?? [],
    outreach: outreachRead.data ?? [],
    risks: riskRead.data ?? [],
  };
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);
  try {
    const body = await request.json().catch(() => ({})) as { action?: Action; enabled?: unknown; mode?: unknown };
    const action = body.action ?? 'status';
    if (!['status', 'set_kill_switch', 'activate_real', 'events', 'configure_whatsapp_webhook', 'activate_scheduler'].includes(action)) throw new Error('unsupported_action');
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (profileError || !profile?.active_organization_id) throw new Error('organization_context_required');
    const organizationId = profile.active_organization_id;
    await requireOrganizationRole(admin, user.id, organizationId, ['owner', 'admin', 'manager']);

    if (action === 'configure_whatsapp_webhook') {
      const message = await configureWhatsAppWebhook(admin, organizationId, { id: user.id, name: profile.name ?? null });
      return json({ ok: true, message, status: await operationalStatus(admin, organizationId) }, 200, headers);
    }

    if (action === 'activate_scheduler') {
      const message = await activateScheduler(admin, organizationId, { id: user.id, name: profile.name ?? null });
      return json({ ok: true, message, status: await operationalStatus(admin, organizationId) }, 200, headers);
    }

    if (action === 'activate_real') {
      return json({ ok: true, ...(await activateRealEnvironment(admin, organizationId, { id: user.id, name: profile.name ?? null })) }, 200, headers);
    }

    if (action === 'set_kill_switch') {
      if (typeof body.enabled !== 'boolean') throw new Error('kill_switch_value_required');
      const { data: current, error: currentError } = await admin.from('organization_module_data').select('data')
        .eq('organization_id', organizationId).eq('module_key', 'configuracao_runtime').maybeSingle();
      if (currentError) throw currentError;
      const data = { ...asObject(current?.data), killSwitchGlobal: body.enabled };
      const { error: writeError } = await admin.from('organization_module_data').upsert({
        organization_id: organizationId, module_key: 'configuracao_runtime', data, updated_by: user.id, updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,module_key' });
      if (writeError) throw writeError;
      await admin.from('audit_logs').insert({
        organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user',
        action: body.enabled ? 'automation.kill_switch_enabled' : 'automation.kill_switch_disabled',
        detail: body.enabled ? 'Automação global pausada manualmente.' : 'Automação global liberada manualmente.',
        entity_table: 'organization_module_data', event_data: { module_key: 'configuracao_runtime', kill_switch: body.enabled },
      });
    }

    if (action === 'events') return json({ ok: true, ...(await diagnosticEvents(admin, organizationId)) }, 200, headers);
    return json({ ok: true, status: await operationalStatus(admin, organizationId) }, 200, headers);
  } catch (error) {
    return json({ ok: false, erro: safeError(error) }, 400, headers);
  }
});
