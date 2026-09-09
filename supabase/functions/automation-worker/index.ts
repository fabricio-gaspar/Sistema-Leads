import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';
import { automationBlockReason, zapiBaseUrl } from '../_shared/runtimeSafety.ts';
import { suppressionHashes, suppressionOrFilter } from '../_shared/contactSuppression.ts';

function secureEqual(actual: string | null, expected: string): boolean {
  if (!actual || !expected || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function canonicalChannel(value: unknown): string {
  const normalized = String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized === 'whatsapp' ? 'whatsapp' : normalized;
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ error: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, headers);
  let schedulerIntegrationId: string | null = null;
  let schedulerOrganizationId: string | null = null;
  let serverScheduler = false;
  try {
    const body = await request.json().catch(() => ({})) as { run?: string; organization_id?: unknown; source?: unknown };
    const admin = createAdminClient();
    const schedulerToken = request.headers.get('x-leadai-scheduler-token');
    let orgId: string;
    let actor: { id: string; name: string } | null = null;

    if (schedulerToken) {
      if (body.run !== 'outreach' || !isUuid(body.organization_id) || body.source !== 'server_scheduler') throw new Error('scheduler_request_invalid');
      const { data: scheduler, error: schedulerError } = await admin.from('integrations').select('id,organization_id').eq('organization_id', body.organization_id).eq('key', 'scheduler').maybeSingle();
      if (schedulerError || !scheduler) throw new Error('scheduler_not_configured');
      const { data: secret, error: secretError } = await admin.rpc('read_integration_secret', { p_integration: scheduler.id });
      const expectedToken = typeof secret === 'object' && secret !== null && 'scheduler_token' in secret ? String((secret as Record<string, unknown>).scheduler_token ?? '') : '';
      if (secretError || expectedToken.length < 48 || !secureEqual(schedulerToken, expectedToken)) throw new Error('scheduler_authentication_failed');
      orgId = scheduler.organization_id;
      schedulerIntegrationId = scheduler.id;
      schedulerOrganizationId = orgId;
      serverScheduler = true;
    } else {
      const { user } = await requireUser(request);
      const { data: profile } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
      if (!profile?.active_organization_id) throw new Error('organization_context_required');
      orgId = profile.active_organization_id as string;
      await requireOrganizationRole(admin, user.id, orgId, ['owner', 'admin', 'manager']);
      actor = { id: user.id, name: profile.name || 'Usuário' };
    }

    const safetyReads = await Promise.all([
      admin.from('company_settings').select('active,sandbox_mode,can_use_ia,ai_actions_enabled').eq('organization_id', orgId).maybeSingle(),
      admin.from('integrations').select('enabled,connected,paused').eq('organization_id', orgId).eq('key', 'ai').maybeSingle(),
      admin.from('organization_module_data').select('data').eq('organization_id', orgId).eq('module_key', 'configuracao_runtime').maybeSingle(),
    ]);
    if (safetyReads.some((read) => read.error)) throw new Error('runtime_safety_read_failed');
    if (serverScheduler && schedulerIntegrationId) {
      const { error: heartbeatError } = await admin.from('integrations').update({
        connected: true, enabled: true, paused: false,
        last_tested_at: new Date().toISOString(), last_success_at: new Date().toISOString(), last_error: null,
        status_detail: 'Worker server-side em execução; heartbeat confirmado pelo agendador.', updated_at: new Date().toISOString(),
      }).eq('id', schedulerIntegrationId).eq('organization_id', orgId);
      if (heartbeatError) throw new Error('scheduler_heartbeat_persist_failed');
    }
    const blocked = safetyReads[0].data?.active !== true ? 'company_not_active' : safetyReads[0].data?.sandbox_mode !== false ? 'sandbox_mode' : null;
    if (blocked) return json({ ok: true, skipped: true, reason: blocked, sent_jobs: 0, timeout_runs: 0 }, 200, headers);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ count: sent }, { count: failed }, { count: optOuts }, { data: integration }, { data: activePolicy }] = await Promise.all([
      admin.from('outreach_jobs').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('channel', 'whatsapp').eq('status', 'processed').gte('processed_at', since),
      admin.from('outreach_jobs').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('channel', 'whatsapp').eq('status', 'failed').gte('run_at', since),
      admin.from('contact_suppressions').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).ilike('channel', 'whatsapp').gte('created_at', since),
      admin.from('integrations').select('id').eq('organization_id', orgId).ilike('key', '%whatsapp%').limit(1).maybeSingle(),
      admin.from('channel_policy_events').select('risk_level,action').eq('organization_id', orgId).eq('channel', 'whatsapp').is('resolved_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const sentCount = sent ?? 0; const failedCount = failed ?? 0; const optOutCount = optOuts ?? 0;
    await admin.from('channel_health_samples').insert({ organization_id: orgId, integration_id: integration?.id ?? null, channel: 'whatsapp', source: 'provider_queue', sent_count: sentCount, delivered_count: 0, failed_count: failedCount, opt_out_count: optOutCount, complaint_count: 0, raw_metrics: { window_hours: 24, worker: 'automation-worker' } });
    const optOutRate = sentCount > 0 ? optOutCount / sentCount : 0;
    const failureRate = sentCount + failedCount > 0 ? failedCount / (sentCount + failedCount) : 0;
    const shouldPause = sentCount + failedCount >= 20 && (optOutRate >= 0.08 || failureRate >= 0.15);
    if (shouldPause) {
      if (!activePolicy) await admin.from('channel_policy_events').insert({ organization_id: orgId, integration_id: integration?.id ?? null, channel: 'whatsapp', risk_level: 'high', action: 'pause', reason: optOutRate >= 0.08 ? 'Taxa de opt-out acima do limite operacional configurado.' : 'Taxa de falhas acima do limite operacional configurado.', evidence: { sent_count: sentCount, failed_count: failedCount, opt_out_count: optOutCount, failure_rate: failureRate, opt_out_rate: optOutRate } });
      if (integration?.id) await admin.from('integrations').update({ paused: true, status_detail: 'Envios pausados automaticamente pelo monitor de risco.' }).eq('id', integration.id).eq('organization_id', orgId);
    }

    const timeoutRuns = 0;
    let sentJobs = 0;
    let failedJobs = 0;
    if (body.run === 'outreach' || body.run === 'all') {
      const { data: jobs, error: jobsError } = await admin.from('outreach_jobs').select('id,lead_id,channel,attempt,payload').eq('organization_id', orgId).eq('status', 'queued').lte('run_at', new Date().toISOString()).order('run_at', { ascending: true }).limit(25);
      if (jobsError) throw jobsError;
      for (const job of jobs ?? []) {
        const { data: claimed, error: claimError } = await admin.from('outreach_jobs').update({ status: 'processing' }).eq('id', job.id).eq('organization_id', orgId).eq('status', 'queued').select('id').maybeSingle();
        if (claimError) throw claimError;
        if (!claimed) continue;
        const payload = (job.payload ?? {}) as Record<string, unknown>;
        const manualMessage = payload.manual === true;
        let dispatchStarted = false;
        let providerAccepted = false;
        let providerMessageId: string | null = null;
        try {
          const initialReads = await Promise.all([
            admin.from('leads').select('phone,whatsapp,email,opt_out,ai_paused,owner_id,modo_atendimento,last_contact').eq('organization_id', orgId).eq('id', job.lead_id).maybeSingle(),
            admin.from('company_settings').select('active,sandbox_mode,can_use_ia,ai_actions_enabled').eq('organization_id', orgId).maybeSingle(),
            admin.from('integrations').select('enabled,connected,paused').eq('organization_id', orgId).eq('key', 'ai').maybeSingle(),
            admin.from('organization_module_data').select('data').eq('organization_id', orgId).eq('module_key', 'configuracao_runtime').maybeSingle(),
            admin.from('integrations').select('id,connected,enabled,paused').eq('organization_id', orgId).eq('key', 'whatsapp').maybeSingle(),
          ]);
          if (initialReads.some((read) => read.error)) throw new Error('dispatch_safety_read_failed');
          const [{ data: lead }, { data: company }, { data: ai }, { data: runtime }, { data: integration }] = initialReads;
          const { data: suppressions, error: suppressionError } = await admin.from('contact_suppressions').select('id,channel').eq('organization_id', orgId).or(suppressionOrFilter(job.lead_id, await suppressionHashes(lead ?? {}))).limit(1);
          if (suppressionError) throw new Error('dispatch_suppression_read_failed');
          const block = manualMessage ? (company?.active !== true ? 'company_not_active' : company?.sandbox_mode !== false ? 'operational_mode_protected' : null) : automationBlockReason({ company, ai, runtime: runtime?.data ?? null, lead });
          if (block) throw new Error(block);
          if (suppressions?.some((suppression) => ['all', 'whatsapp'].includes(canonicalChannel(suppression.channel)))) throw new Error('contact_suppressed');
          const { data: credentials, error: credentialsError } = integration?.id ? await admin.rpc('read_integration_secret', { p_integration: integration.id }) : { data: null, error: null };
          if (credentialsError) throw new Error('channel_credentials_unavailable');
          const recipient = String(lead?.whatsapp || lead?.phone || '').replace(/\D/g, '');
          const message = String(payload.message ?? payload.text ?? '').trim().slice(0, 4_096);
          if (canonicalChannel(job.channel) !== 'whatsapp' || !integration?.connected || !integration.enabled || integration.paused || !credentials) throw new Error('channel_not_ready');
          if (!lead || !/^\d{10,15}$/.test(recipient) || !message || typeof payload.message_id !== 'string' || (!manualMessage && typeof payload.agent_run_id !== 'string')) throw new Error('lead_or_payload_blocked');
          if (payload.recipient && String(payload.recipient).replace(/\D/g, '') !== recipient) throw new Error('recipient_mismatch');
          if (!Object.hasOwn(payload, 'context_last_contact') || (lead.last_contact ? Date.parse(lead.last_contact) : null) !== (typeof payload.context_last_contact === 'string' ? Date.parse(payload.context_last_contact) : null)) throw new Error('outbound_context_stale');
          if (!manualMessage) {
            const { data: decisionRun, error: decisionRunError } = await admin.from('agent_runs').select('id,status,result').eq('id', payload.agent_run_id).eq('organization_id', orgId).eq('lead_id', job.lead_id).maybeSingle();
            if (decisionRunError || decisionRun?.status !== 'completed' || decisionRun.result?.status_canal !== 'enfileirado') throw new Error('outbound_decision_not_completed');
          }
          const { data: draft, error: draftError } = await admin.from('lead_messages').select('id,text,type').eq('id', payload.message_id).eq('organization_id', orgId).eq('lead_id', job.lead_id).eq('sender', manualMessage ? 'human' : 'ana').maybeSingle();
          if (draftError || !draft || draft.type !== (manualMessage ? 'queued' : 'draft') || draft.text !== message) throw new Error('outbound_message_mismatch');
          const zapi = credentials as { instancia_id?: string; token?: string; client_token?: string; url_base?: string };
          if (!zapi.instancia_id || !zapi.token || !zapi.client_token) throw new Error('channel_credentials_incomplete');
          const baseUrl = zapiBaseUrl(zapi.url_base);
          const { error: pendingError } = await admin.from('lead_outreach').upsert({ id: job.id, organization_id: orgId, lead_id: job.lead_id, owner_id: lead.owner_id, channel: 'whatsapp', status: 'pending', provider: 'zapi', content: message, metadata: { job_id: job.id, message_id: draft.id } }, { onConflict: 'id', ignoreDuplicates: true });
          if (pendingError) throw pendingError;
          dispatchStarted = true;
          const response = await fetch(`${baseUrl}/instances/${encodeURIComponent(zapi.instancia_id)}/token/${encodeURIComponent(zapi.token)}/send-text`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Client-Token': zapi.client_token }, body: JSON.stringify({ phone: recipient, message }), signal: AbortSignal.timeout(20_000), redirect: 'error' });
          if (!response.ok) throw new Error(`provider_http_${response.status}`);
          providerAccepted = true;
          const receipt = await response.json() as { messageId?: unknown };
          if (typeof receipt.messageId !== 'string' || !receipt.messageId) throw new Error('provider_receipt_missing');
          providerMessageId = receipt.messageId;
          const sentAt = new Date().toISOString();
          const messageWrite = await admin.from('lead_messages').update({ type: 'sent', sent_at: sentAt, provider_message_id: receipt.messageId }).eq('id', draft.id).eq('organization_id', orgId);
          if (messageWrite.error) throw messageWrite.error;
          const outreachWrite = await admin.from('lead_outreach').update({ status: 'sent', provider_message_id: receipt.messageId, sent_at: sentAt }).eq('id', job.id).eq('organization_id', orgId);
          if (outreachWrite.error) throw outreachWrite.error;
          let leadUpdate = admin.from('leads').update({ last_contact: sentAt, no_reply_deadline_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), no_reply_processed_at: null }).eq('id', job.lead_id).eq('organization_id', orgId);
          if (!manualMessage) leadUpdate = leadUpdate.eq('ai_paused', false);
          leadUpdate = lead.last_contact ? leadUpdate.eq('last_contact', lead.last_contact) : leadUpdate.is('last_contact', null);
          const { error: leadError } = await leadUpdate;
          if (leadError) throw leadError;
          const { error: processedError } = await admin.from('outreach_jobs').update({ status: 'processed', processed_at: sentAt, error: null, payload: { ...payload, provider_message_id: receipt.messageId } }).eq('id', job.id).eq('organization_id', orgId).eq('status', 'processing');
          if (processedError) throw processedError;
          sentJobs += 1;
        } catch (error) {
          const attempt = Number(job.attempt ?? 0) + 1;
          const code = providerAccepted ? 'provider_accepted_reconciliation_required' : dispatchStarted ? 'delivery_unknown_reconciliation_required' : safeError(error);
          const failedStatus = dispatchStarted ? 'reconciliation_required' : 'failed';
          const { error: failureError } = await admin.from('outreach_jobs').update({ status: failedStatus, attempt, error: code, payload: { ...payload, ...(providerMessageId ? { provider_message_id: providerMessageId } : {}) } }).eq('id', job.id).eq('organization_id', orgId).eq('status', 'processing');
          if (failureError) throw new Error('job_failure_persist_failed');
          if (manualMessage && typeof payload.message_id === 'string') {
            const { error: messageFailureError } = await admin.from('lead_messages').update({ type: failedStatus }).eq('id', payload.message_id).eq('organization_id', orgId).eq('lead_id', job.lead_id).eq('sender', 'human').eq('type', 'queued');
            if (messageFailureError) throw new Error('manual_message_failure_persist_failed');
          }
          failedJobs += 1;
        }
      }
    }
    if (!serverScheduler && actor) {
      await admin.from('audit_logs').insert({ organization_id: orgId, actor_id: actor.id, actor_name: actor.name, actor_type: 'user', action: 'automation.worker_ran', detail: 'Telemetria, políticas de canal e timeouts avaliados.', entity_table: 'channel_health_samples', event_data: { sent_count: sentCount, opt_out_count: optOutCount, pause_recommended: shouldPause, timeout_runs: timeoutRuns } });
    }
    return json({ ok: true, sent_count: sentCount, failed_count: failedCount, opt_out_count: optOutCount, pause_recommended: shouldPause, timeout_runs: timeoutRuns, sent_jobs: sentJobs, failed_jobs: failedJobs }, 200, headers);
  } catch (error) {
    if (serverScheduler && schedulerIntegrationId && schedulerOrganizationId) {
      const admin = createAdminClient();
      await admin.from('integrations').update({ connected: false, last_error: safeError(error).slice(0, 120), status_detail: 'Worker server-side encontrou uma falha; consulte o Registro do Sistema.', updated_at: new Date().toISOString() }).eq('id', schedulerIntegrationId).eq('organization_id', schedulerOrganizationId);
    }
    return json({ error: safeError(error) }, 400, headers);
  }
});
