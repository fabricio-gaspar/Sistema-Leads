import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

const ACTIONS = new Set(['start_ai', 'assign_human', 'record_inbound']);
const asText = (value: unknown, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, error: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, headers);

  try {
    const body = await request.json() as Record<string, unknown>;
    const action = asText(body.action, 40);
    const leadId = asText(body.lead_id, 80);
    if (!ACTIONS.has(action) || !/^[0-9a-f-]{36}$/i.test(leadId)) throw new Error('invalid_action_or_lead');

    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from('profiles')
      .select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (profileError || !profile?.active_organization_id) throw new Error('organization_context_required');
    const organizationId = profile.active_organization_id as string;
    await requireOrganizationRole(admin, user.id, organizationId, ['owner', 'admin', 'manager', 'seller', 'sdr']);

    const { data: lead, error: leadError } = await admin.from('leads')
      .select('id,company,contact,opt_out,owner_id,assigned_to,modo_atendimento,ai_paused')
      .eq('id', leadId).eq('organization_id', organizationId).maybeSingle();
    if (leadError || !lead) throw new Error('lead_not_found');

    if (action === 'record_inbound') {
      return json({
        ok: false,
        deprecated: true,
        error: 'inbound_must_arrive_via_provider_webhook',
        canonical_endpoint: 'webhook-whatsapp',
      }, 409, headers);
    }

    if (action === 'assign_human') {
      const ownerId = asText(body.owner_id, 80) || user.id;
      const { data: owner, error: ownerError } = await admin.from('profiles').select('id,name').eq('id', ownerId).maybeSingle();
      if (ownerError || !owner) throw new Error('owner_not_found');
      const { data: membership } = await admin.from('organization_members').select('status')
        .eq('organization_id', organizationId).eq('user_id', ownerId).eq('status', 'active').maybeSingle();
      if (!membership) throw new Error('owner_not_in_organization');

      const now = new Date().toISOString();
      const { error: updateError } = await admin.from('leads').update({
        modo_atendimento: 'humano',
        approach_type: 'humano',
        approach_set_at: now,
        owner_id: ownerId,
        assigned_to: ownerId,
        owner: owner.name,
        ai_paused: true,
        automation_status: 'human',
        automation_updated_at: now,
      }).eq('id', leadId).eq('organization_id', organizationId);
      if (updateError) throw updateError;

      const { data: existingTask } = await admin.from('lead_tasks').select('id')
        .eq('organization_id', organizationId).eq('lead_id', leadId).eq('owner_id', ownerId).eq('completed', false)
        .limit(1).maybeSingle();
      if (!existingTask) {
        const dueAt = new Date(Date.now() + Math.max(1, Math.min(168, Number(body.sla_hours || 24))) * 3600000).toISOString();
        const { error: taskError } = await admin.from('lead_tasks').insert({
          organization_id: organizationId,
          lead_id: leadId,
          text: `Assumir atendimento humano de ${lead.contact || lead.company}`,
          due_at: dueAt,
          owner_id: ownerId,
          owner_label: owner.name,
          completed: false,
          metadata: { source: 'lead-workflow-compat' },
        });
        if (taskError) throw taskError;
      }

      await admin.from('audit_logs').insert({
        organization_id: organizationId,
        actor_id: user.id,
        actor_name: profile.name,
        actor_type: 'user',
        action: 'lead.workflow.assign_human',
        detail: 'Lead transferido para atendimento humano.',
        entity_table: 'leads',
        entity_id: leadId,
        event_data: { owner_id: ownerId, canonical_authority: 'ana-run' },
      });
      return json({ ok: true, mode: 'humano', owner_id: ownerId }, 200, headers);
    }

    if (lead.opt_out) throw new Error('lead_opted_out');
    const ownerId = lead.owner_id || user.id;
    const now = new Date().toISOString();
    const { error: modeError } = await admin.from('leads').update({
      modo_atendimento: 'ia',
      approach_type: 'ia',
      approach_set_at: now,
      owner_id: ownerId,
      assigned_to: lead.assigned_to || ownerId,
      ai_paused: false,
      automation_status: 'running',
      automation_error: null,
      automation_updated_at: now,
    }).eq('id', leadId).eq('organization_id', organizationId);
    if (modeError) throw modeError;

    const authorization = request.headers.get('authorization') || '';
    const anaResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ana-run`, {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'manual.run',
        lead_id: leadId,
        modo: 'ia',
        contexto: { source: 'lead-workflow-compat', requested_by: user.id },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const anaResult = await anaResponse.json().catch(() => null);
    if (!anaResponse.ok || !anaResult || anaResult.ok !== true) {
      throw new Error(`ana_run_not_completed_${anaResponse.status}`);
    }

    await admin.from('audit_logs').insert({
      organization_id: organizationId,
      actor_id: user.id,
      actor_name: profile.name,
      actor_type: 'user',
      action: 'lead.workflow.start_ai',
      detail: 'Compatibilidade encaminhada para a autoridade canônica da Ana.',
      entity_table: 'leads',
      entity_id: leadId,
      event_data: { canonical_authority: 'ana-run', run_id: anaResult.run_id ?? null },
    });

    return json({ ok: true, canonical_authority: 'ana-run', ana: anaResult }, 200, headers);
  } catch (error) {
    return json({ ok: false, error: safeError(error) }, 400, headers);
  }
});
