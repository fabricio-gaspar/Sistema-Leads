import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';
import { resolveWaAkgOperational } from '../_shared/waAkgOperational.ts';

type Action = 'status' | 'set_kill_switch' | 'activate_real' | 'events' | 'configure_whatsapp_webhook' | 'activate_scheduler';
type WebhookDiagnosticState = 'not_configured' | 'waiting_callback' | 'homologated';

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
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
    admin.from('whatsapp_accounts').select('id,integration_id,provider,account_type,is_default,enabled,connection_status,status_checked_at,updated_at,verified_name,label,connected_phone_suffix,last_error_code')
      .eq('organization_id', organizationId).is('archived_at', null),
    admin.from('messaging_provider_controls').select('provider,inbound_enabled,send_enabled,automation_enabled,kill_switch,reason,updated_at')
      .eq('organization_id', organizationId).in('provider', ['wa_akg', 'meta_cloud']),
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
  const scheduler = integration('scheduler');
  const isFresh = (value: string | null | undefined) => {
    if (!value) return false;
    const testedAt = new Date(value).getTime();
    return Number.isFinite(testedAt) && Date.now() - testedAt <= 24 * 60 * 60 * 1000;
  };
  const isOnline = (item: Pick<NonNullable<typeof ai>, 'connected' | 'enabled' | 'paused' | 'last_error' | 'last_tested_at'> | null) => Boolean(item?.connected && item?.enabled && !item?.paused && !item?.last_error && isFresh(item?.last_tested_at));
  const metaAccount = whatsappAccounts.find((account) => account.provider === 'meta_cloud' && account.is_default)
    ?? whatsappAccounts.find((account) => account.provider === 'meta_cloud' && account.account_type === 'corporate')
    ?? whatsappAccounts.find((account) => account.provider === 'meta_cloud')
    ?? null;
  const metaBacking = metaAccount?.integration_id ? integrations.find((item) => item.id === metaAccount.integration_id) : null;
  const metaControl = providerControls.find((control) => control.provider === 'meta_cloud') ?? null;
  const metaActive = metaControl
    ? metaControl.inbound_enabled === true && metaControl.send_enabled === true
      && metaControl.automation_enabled === true && metaControl.kill_switch !== true
    : metaAccount?.enabled === true && metaBacking?.enabled === true && metaBacking?.paused !== true;
  const metaProvider = metaAccount ? {
    key: 'whatsapp_meta',
    label: 'Meta WhatsApp Cloud API',
    category: 'communication',
    provider: 'Meta WhatsApp Cloud API',
    connected: metaAccount.connection_status === 'connected' && metaBacking?.connected === true,
    enabled: metaActive,
    paused: metaBacking?.paused === true,
    last_tested_at: metaAccount.status_checked_at ?? metaBacking?.last_tested_at ?? metaAccount.updated_at ?? null,
    last_success_at: metaBacking?.last_success_at ?? null,
    last_error: metaActive ? (metaBacking?.last_error ?? null) : null,
    status_detail: metaActive
      ? `Ativo no WayFlex para entrada, saída e automações da Ana.${metaControl?.reason ? ` ${metaControl.reason}` : ''}`
      : `Desativado no WayFlex. ${metaControl?.reason || 'A configuração e a sessão remota foram preservadas.'}`,
    configuration: metaBacking?.configuration ?? {},
  } : null;
  const waAkgSnapshot = resolveWaAkgOperational(whatsappAccounts, integrations, providerControls);
  const waAkgProvider = waAkgSnapshot.present ? {
    key: waAkgSnapshot.key,
    label: waAkgSnapshot.label,
    category: waAkgSnapshot.category,
    provider: waAkgSnapshot.provider,
    connected: waAkgSnapshot.connected,
    enabled: waAkgSnapshot.enabled,
    paused: waAkgSnapshot.paused,
    last_tested_at: waAkgSnapshot.lastTestedAt,
    last_success_at: waAkgSnapshot.lastSuccessAt,
    last_error: waAkgSnapshot.lastError,
    status_detail: waAkgSnapshot.statusDetail,
    configuration: { phone_suffix: waAkgSnapshot.phoneSuffix },
  } : null;
  // WA-AKG is the sole operational transport. Legacy rows remain historical
  // data only and never participate in readiness or status decisions.
  const activeProvider = waAkgProvider;
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
  const webhookDiagnostic = waAkgProvider
    ? {
      state: waAkgProvider.enabled ? 'homologated' as WebhookDiagnosticState
        : waAkgProvider.connected ? 'waiting_callback' as WebhookDiagnosticState : 'not_configured' as WebhookDiagnosticState,
      registeredAt: waAkgProvider.last_tested_at,
      lastEventAt: waAkgProvider.last_success_at,
      detail: waAkgProvider.status_detail,
      testLead: null,
    }
    : {
      state: 'not_configured' as WebhookDiagnosticState,
      registeredAt: null,
      lastEventAt: null,
      detail: 'Conecte o dispositivo pelo WA-AKG para habilitar a entrada de mensagens e a operação da Ana.',
      testLead: null,
    };
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
          : 'Conecte e valide o canal WA-AKG antes de liberar mensagens.',
    },
    {
      id: 'whatsapp_webhook',
      label: 'Respostas do WhatsApp homologadas',
      ok: activeProvider?.key.startsWith('whatsapp_wa_akg:') ? isOnline(activeProvider) : false,
      detail: webhookDiagnostic.detail,
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
    integrations: [...integrations.filter((item) => item.key !== 'zapi_webhook' && item.key !== 'whatsapp_zapi' && !['zapi', 'z-api', 'evolution', 'evolution_go'].includes(String(item.provider ?? '').toLowerCase())), ...(waAkgProvider && !integrations.some((item) => item.key === waAkgProvider.key) ? [waAkgProvider] : []), ...(metaProvider ? [metaProvider] : [])].map((item) => ({
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
      throw new Error('channel_not_supported');
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
