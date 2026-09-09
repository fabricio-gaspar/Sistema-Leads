import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

type Action = 'status' | 'set_kill_switch' | 'set_mode' | 'events';
type RequestedMode = 'demo' | 'protected' | 'real';

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

async function operationalStatus(admin: ReturnType<typeof createAdminClient>, organizationId: string) {
  const [companyRead, integrationsRead, runtimeRead] = await Promise.all([
    admin.from('company_settings').select('active,sandbox_mode,can_use_ia,ai_actions_enabled,updated_at').eq('organization_id', organizationId).maybeSingle(),
    admin.from('integrations').select('key,label,category,provider,connected,enabled,paused,last_tested_at,last_success_at,last_error,status_detail').eq('organization_id', organizationId).order('label'),
    admin.from('organization_module_data').select('data,updated_at').eq('organization_id', organizationId).eq('module_key', 'configuracao_runtime').maybeSingle(),
  ]);
  if (companyRead.error || integrationsRead.error || runtimeRead.error) throw new Error('operational_status_read_failed');

  const company = companyRead.data;
  const runtime = asObject(runtimeRead.data?.data);
  const integrations = integrationsRead.data ?? [];
  const integration = (key: string) => integrations.find((item) => item.key === key) ?? null;
  const ai = integration('ai');
  const whatsapp = integration('whatsapp');
  const whatsappWebhook = integration('zapi_webhook');
  const scheduler = integration('scheduler');
  const killSwitch = asBoolean(runtime.killSwitchGlobal, true);
  const isFresh = (value: string | null | undefined) => {
    if (!value) return false;
    const testedAt = new Date(value).getTime();
    return Number.isFinite(testedAt) && Date.now() - testedAt <= 24 * 60 * 60 * 1000;
  };
  const isOnline = (item: typeof ai) => Boolean(item?.connected && item?.enabled && !item?.paused && !item?.last_error && isFresh(item?.last_tested_at));
  const checks = [
    { id: 'empresa', label: 'Empresa ativa', ok: company?.active === true, detail: company?.active === true ? 'Empresa habilitada.' : 'Empresa desativada no backend.' },
    { id: 'ia_empresa', label: 'Ações da Ana autorizadas', ok: company?.can_use_ia === true && company?.ai_actions_enabled === true, detail: company?.can_use_ia === true && company?.ai_actions_enabled === true ? 'Ações de IA permitidas.' : 'Ações de IA ainda bloqueadas pela empresa.' },
    { id: 'kill_switch', label: 'Pausa global desligada', ok: killSwitch === false, detail: killSwitch ? 'A automação está pausada pelo kill switch.' : 'Automação liberada por esta regra.' },
    { id: 'ia', label: 'IA online e validada', ok: isOnline(ai), detail: isOnline(ai) ? (ai?.status_detail || 'Provedor validado nas últimas 24 horas.') : 'Configure ou teste novamente o provedor de IA.' },
    { id: 'whatsapp', label: 'WhatsApp online e validado', ok: isOnline(whatsapp), detail: isOnline(whatsapp) ? (whatsapp?.status_detail || 'Canal validado nas últimas 24 horas.') : 'Configure ou teste novamente o canal de saída.' },
    { id: 'whatsapp_webhook', label: 'Entrada do WhatsApp homologada', ok: isOnline(whatsappWebhook), detail: isOnline(whatsappWebhook) ? (whatsappWebhook?.status_detail || 'Webhook de entrada validado.') : 'O webhook de respostas ainda não foi homologado nas últimas 24 horas.' },
    { id: 'scheduler', label: 'Worker 24/7 ativo', ok: isOnline(scheduler), detail: isOnline(scheduler) ? (scheduler?.status_detail || 'Agendador server-side validado.') : 'O processamento ainda não possui worker server-side monitorado.' },
  ];

  return {
    mode: company?.sandbox_mode === false ? 'real' : 'demo',
    modeLabel: company?.sandbox_mode === false ? 'Ambiente real' : 'Ambiente de demonstração',
    updatedAt: company?.updated_at ?? null,
    runtimeUpdatedAt: runtimeRead.data?.updated_at ?? null,
    killSwitch,
    productionReady: checks.every((check) => check.ok),
    checks,
    integrations: integrations.map((item) => ({
      key: item.key, label: item.label, category: item.category, provider: item.provider, connected: item.connected === true,
      enabled: item.enabled === true, paused: item.paused === true, lastTestedAt: item.last_tested_at,
      lastSuccessAt: item.last_success_at, lastError: item.last_error, detail: item.status_detail,
      health: item.connected === true && item.enabled === true && item.paused !== true && !item.last_error
        ? (isFresh(item.last_tested_at) ? 'online' : 'stale')
        : 'offline',
    })),
  };
}

async function diagnosticEvents(admin: ReturnType<typeof createAdminClient>, organizationId: string) {
  const [status, auditRead, runsRead, webhookRead, queuedRead, failedJobsRead, riskRead] = await Promise.all([
    operationalStatus(admin, organizationId),
    admin.from('audit_logs').select('id,actor_name,actor_type,action,detail,occurred_at,created_at').eq('organization_id', organizationId).order('occurred_at', { ascending: false }).limit(80),
    admin.from('agent_runs').select('id,event,status,error_code,error_message,created_at,completed_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(50),
    admin.from('channel_inbound_events').select('id,provider,event_type,status,error,created_at,processed_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(50),
    admin.from('outreach_jobs').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId).in('status', ['queued', 'processing', 'reconciliation_required']),
    admin.from('outreach_jobs').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'failed'),
    admin.from('channel_policy_events').select('id,channel,risk_level,action,reason,created_at').eq('organization_id', organizationId).is('resolved_at', null).order('created_at', { ascending: false }).limit(20),
  ]);
  if ([auditRead, runsRead, webhookRead, queuedRead, failedJobsRead, riskRead].some((read) => read.error)) throw new Error('operational_diagnostics_read_failed');
  return {
    status,
    summary: { queuedJobs: queuedRead.count ?? 0, failedJobs: failedJobsRead.count ?? 0, openRiskEvents: (riskRead.data ?? []).length },
    audit: (auditRead.data ?? []).map((item) => ({ ...item, occurredAt: item.occurred_at ?? item.created_at })),
    runs: runsRead.data ?? [],
    inbound: webhookRead.data ?? [],
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
    if (!['status', 'set_kill_switch', 'set_mode', 'events'].includes(action)) throw new Error('unsupported_action');
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (profileError || !profile?.active_organization_id) throw new Error('organization_context_required');
    const organizationId = profile.active_organization_id;
    await requireOrganizationRole(admin, user.id, organizationId, ['owner', 'admin', 'manager']);

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

    if (action === 'set_mode') {
      if (!['demo', 'protected', 'real'].includes(String(body.mode))) throw new Error('operational_mode_value_required');
      const requestedMode = String(body.mode) as RequestedMode;
      const currentStatus = await operationalStatus(admin, organizationId);
      if (requestedMode === 'real' && !currentStatus.productionReady) {
        throw new Error('operational_preflight_failed');
      }
      const { error: modeWriteError } = await admin.from('company_settings').update({
        sandbox_mode: requestedMode !== 'real',
        updated_at: new Date().toISOString(),
      }).eq('organization_id', organizationId);
      if (modeWriteError) throw new Error('operational_mode_save_failed');
      await admin.from('audit_logs').insert({
        organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user',
        action: requestedMode === 'real' ? 'operation.real_mode_enabled' : 'operation.demo_mode_enabled',
        detail: requestedMode === 'real' ? 'Ambiente real ativado após pré-verificação do servidor.' : 'Ambiente de demonstração ativado; saídas reais bloqueadas.',
        entity_table: 'company_settings', event_data: { mode: requestedMode === 'protected' ? 'demo' : requestedMode, preflight: currentStatus.checks },
      });
    }

    if (action === 'events') return json({ ok: true, ...(await diagnosticEvents(admin, organizationId)) }, 200, headers);
    return json({ ok: true, status: await operationalStatus(admin, organizationId) }, 200, headers);
  } catch (error) {
    return json({ ok: false, erro: safeError(error) }, 400, headers);
  }
});
