import { createAdminClient, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

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
    const { data: member } = await admin.from('organization_members').select('role,status').eq('organization_id', orgId).eq('user_id', user.id).maybeSingle();
    if (!member || member.status !== 'active' || !['owner', 'admin', 'manager'].includes(member.role)) throw new Error('organization_access_denied');
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ count: sent }, { count: optOuts }, { data: integration }, { data: activePolicy }] = await Promise.all([
      admin.from('lead_messages').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).in('sender', ['ana', 'human']).gte('sent_at', since),
      admin.from('leads').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('opt_out', true),
      admin.from('integrations').select('id').eq('organization_id', orgId).ilike('key', '%whatsapp%').limit(1).maybeSingle(),
      admin.from('channel_policy_events').select('risk_level,action').eq('organization_id', orgId).eq('channel', 'whatsapp').is('resolved_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const sentCount = sent ?? 0; const optOutCount = optOuts ?? 0;
    await admin.from('channel_health_samples').insert({ organization_id: orgId, integration_id: integration?.id ?? null, channel: 'whatsapp', source: 'derived', sent_count: sentCount, delivered_count: 0, failed_count: 0, opt_out_count: optOutCount, complaint_count: 0, raw_metrics: { window_hours: 24, worker: 'manual_or_scheduler' } });
    const shouldPause = sentCount >= 20 && optOutCount / sentCount >= 0.08;
    if (shouldPause && !activePolicy) await admin.from('channel_policy_events').insert({ organization_id: orgId, integration_id: integration?.id ?? null, channel: 'whatsapp', risk_level: 'high', action: 'pause', reason: 'Taxa de opt-out acima do limite operacional configurado.', evidence: { sent_count: sentCount, opt_out_count: optOutCount } });
    await admin.from('audit_logs').insert({ organization_id: orgId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'automation.worker_ran', detail: 'Telemetria e políticas de canal avaliadas.', entity_table: 'channel_health_samples', event_data: { sent_count: sentCount, opt_out_count: optOutCount, pause_recommended: shouldPause } });
    return json({ ok: true, sent_count: sentCount, opt_out_count: optOutCount, pause_recommended: shouldPause }, 200, headers);
  } catch (error) { return json({ error: safeError(error) }, 400, headers); }
});
