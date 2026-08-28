import { createAdminClient, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

const text = (value: unknown, max = 8_000) => typeof value === 'string' ? value.trim().slice(0, max) : '';

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);
  try {
    const body = await request.json() as Record<string, unknown>;
    const leadId = text(body.leadId, 64);
    const recipient = text(body.para, 80).replace(/[^0-9+]/g, '');
    const message = text(body.texto, 4_096);
    if (!leadId || !recipient || !message) throw new Error('lead_recipient_and_message_required');
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (profileError || !profile?.active_organization_id) throw new Error('organization_context_required');
    const organizationId = profile.active_organization_id as string;
    const { data: membership } = await admin.from('organization_members').select('status').eq('organization_id', organizationId).eq('user_id', user.id).maybeSingle();
    if (!membership || membership.status !== 'active') throw new Error('organization_access_denied');
    const { data: lead } = await admin.from('leads').select('id,opt_out,ai_paused').eq('id', leadId).eq('organization_id', organizationId).maybeSingle();
    if (!lead) throw new Error('lead_not_found');
    if (lead.opt_out) throw new Error('lead_opted_out');
    if (lead.ai_paused) throw new Error('ana_paused_for_lead');
    const { data: integration } = await admin.from('integrations').select('id,key,provider,connected,enabled,paused')
      .eq('organization_id', organizationId).ilike('key', '%whatsapp%').order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (!integration?.connected || !integration.enabled || integration.paused) throw new Error('whatsapp_integration_not_ready');
    const { data: blockingPolicy } = await admin.from('channel_policy_events')
      .select('id,risk_level,action').eq('organization_id', organizationId).eq('channel', 'whatsapp')
      .is('resolved_at', null).in('action', ['pause', 'throttle']).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (blockingPolicy?.action === 'pause') throw new Error('whatsapp_paused_by_risk_policy');
    if (blockingPolicy?.action === 'throttle') throw new Error('whatsapp_throttled_by_risk_policy');
    const idempotencyKey = crypto.randomUUID();
    const { data: job, error: jobError } = await admin.from('outreach_jobs').insert({
      organization_id: organizationId, lead_id: lead.id, channel: 'whatsapp', attempt: 0, run_at: new Date().toISOString(), status: 'queued',
      payload: { recipient, message, mode: text(body.modo, 32), provider: text(body.provedor, 80), requested_by: user.id, integration_id: integration.id },
      idempotency_key: idempotencyKey,
    }).select('id').single();
    if (jobError || !job) throw jobError ?? new Error('outreach_job_not_created');
    await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'outreach.whatsapp_queued', detail: 'Mensagem colocada na fila segura.', entity_table: 'outreach_jobs', entity_id: job.id, event_data: { lead_id: lead.id, integration_id: integration.id, idempotency_key: idempotencyKey } });
    return json({ ok: true, enviado: false, id: job.id, detalhe: 'queued_for_authorized_worker', provedor: integration.provider }, 202, headers);
  } catch (error) { return json({ ok: false, enviado: false, erro: safeError(error) }, 400, headers); }
});
