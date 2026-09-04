import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

function canonicalChannel(value: unknown): string {
  const normalized = String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized === 'whatsapp' ? 'whatsapp' : normalized;
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ error: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, headers);
  try {
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const { data: profile } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (!profile?.active_organization_id) throw new Error('organization_context_required');
    const orgId = profile.active_organization_id as string;
    await requireOrganizationRole(admin, user.id, orgId, ['owner', 'admin', 'manager']);
    const body = await request.json().catch(() => ({})) as { run?: string };
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
      if (!activePolicy) await admin.from('channel_policy_events').insert({
        organization_id: orgId,
        integration_id: integration?.id ?? null,
        channel: 'whatsapp',
        risk_level: 'high',
        action: 'pause',
        reason: optOutRate >= 0.08 ? 'Taxa de opt-out acima do limite operacional configurado.' : 'Taxa de falhas acima do limite operacional configurado.',
        evidence: { sent_count: sentCount, failed_count: failedCount, opt_out_count: optOutCount, failure_rate: failureRate, opt_out_rate: optOutRate },
      });
      if (integration?.id) await admin.from('integrations').update({ paused: true, status_detail: 'Envios pausados automaticamente pelo monitor de risco.' }).eq('id', integration.id).eq('organization_id', orgId);
    }
    let timeoutRuns = 0;
    let sentJobs = 0;
    let failedJobs = 0;
    if (body.run === 'timeouts' || body.run === 'all') {
      const { data: dueLeads, error: dueError } = await admin.from('leads')
        .select('id,modo_atendimento,owner_id')
        .eq('organization_id', orgId)
        .eq('modo_atendimento', 'ia')
        .not('owner_id', 'is', null)
        .lte('no_reply_deadline_at', new Date().toISOString())
        .limit(50);
      if (dueError) throw dueError;
      const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ana-run`;
      const authorization = request.headers.get('authorization') ?? '';
      for (const lead of dueLeads ?? []) {
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: { Authorization: authorization, 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'timeout.48h', lead_id: lead.id, modo: 'ia', contexto: { source: 'automation-worker' } }),
        });
        if (response.ok) timeoutRuns += 1;
      }
    }
    if (body.run === 'outreach' || body.run === 'all') {
      const { data: jobs, error: jobsError } = await admin.from('outreach_jobs')
        .select('id,lead_id,channel,attempt,payload')
        .eq('organization_id', orgId).eq('status', 'queued').lte('run_at', new Date().toISOString())
        .order('run_at', { ascending: true }).limit(25);
      if (jobsError) throw jobsError;
      const { data: integration } = await admin.from('integrations').select('id,connected,enabled,paused')
        .eq('organization_id', orgId).eq('key', 'whatsapp').maybeSingle();
      const { data: credentials } = integration?.id ? await admin.rpc('read_integration_secret', { p_integration: integration.id }) : { data: null };
      for (const job of jobs ?? []) {
        const payload = (job.payload ?? {}) as Record<string, unknown>;
        const { data: lead } = await admin.from('leads').select('phone,whatsapp,opt_out,ai_paused').eq('organization_id', orgId).eq('id', job.lead_id).maybeSingle();
        const recipient = String(payload.recipient ?? lead?.whatsapp ?? lead?.phone ?? '').replace(/\D/g, '');
        const message = String(payload.message ?? payload.text ?? '').trim().slice(0, 4_096);
        try {
          if (canonicalChannel(job.channel) !== 'whatsapp' || !integration?.connected || !integration.enabled || integration.paused || !credentials) throw new Error('channel_not_ready');
          if (!lead || lead.opt_out || lead.ai_paused || !recipient || !message) throw new Error('lead_or_payload_blocked');
          const zapi = credentials as { instancia_id?: string; token?: string; client_token?: string; url_base?: string };
          const baseUrl = (zapi.url_base || 'https://api.z-api.io').replace(/\/$/, '');
          const response = await fetch(`${baseUrl}/instances/${encodeURIComponent(zapi.instancia_id ?? '')}/token/${encodeURIComponent(zapi.token ?? '')}/send-text`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(zapi.client_token ? { 'Client-Token': zapi.client_token } : {}) }, body: JSON.stringify({ phone: recipient, message }) });
          if (!response.ok) throw new Error(`provider_http_${response.status}`);
          await admin.from('outreach_jobs').update({ status: 'processed', processed_at: new Date().toISOString(), error: null }).eq('id', job.id).eq('organization_id', orgId);
          await admin.from('leads').update({
            last_contact: new Date().toISOString(),
            no_reply_deadline_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            no_reply_processed_at: null,
          }).eq('id', job.lead_id).eq('organization_id', orgId);
          sentJobs += 1;
        } catch (error) {
          const attempt = Number(job.attempt ?? 0) + 1;
          await admin.from('outreach_jobs').update({ status: attempt >= 3 ? 'failed' : 'queued', attempt, run_at: new Date(Date.now() + Math.min(30, attempt * 5) * 60_000).toISOString(), error: safeError(error) }).eq('id', job.id).eq('organization_id', orgId);
          failedJobs += 1;
        }
      }
    }
    await admin.from('audit_logs').insert({ organization_id: orgId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'automation.worker_ran', detail: 'Telemetria, políticas de canal e timeouts avaliados.', entity_table: 'channel_health_samples', event_data: { sent_count: sentCount, opt_out_count: optOutCount, pause_recommended: shouldPause, timeout_runs: timeoutRuns } });
    return json({ ok: true, sent_count: sentCount, failed_count: failedCount, opt_out_count: optOutCount, pause_recommended: shouldPause, timeout_runs: timeoutRuns, sent_jobs: sentJobs, failed_jobs: failedJobs }, 200, headers);
  } catch (error) { return json({ error: safeError(error) }, 400, headers); }
});
