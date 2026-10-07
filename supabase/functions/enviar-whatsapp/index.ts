import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

const text = (value: unknown, max = 8_000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const firstRow = (value: unknown): Record<string, unknown> | null => {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' ? row as Record<string, unknown> : null;
};

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
    const requestId = text(body.request_id, 80);
    const proposalId = text(body.proposal_id, 64);
    const catalogItemId = text(body.content_item_id, 64);
    const catalogPresentationFormat = text(body.content_presentation_format, 24).toLowerCase();
    const catalogSendImage = body.content_send_image === true;
    const controlledTestRequested = body.teste_controlado === true;
    if (!isUuid(leadId) || !/^\+?\d{10,15}$/.test(recipient) || !message) throw new Error('lead_recipient_and_message_required');
    if (!isUuid(requestId)) throw new Error('message_request_id_required');
    if (proposalId && !isUuid(proposalId)) throw new Error('proposal_id_invalid');
    if (catalogItemId && (!isUuid(catalogItemId) || !['quick', 'commercial', 'technical', 'link', 'document'].includes(catalogPresentationFormat))) {
      throw new Error('catalog_content_input_required');
    }
    if (!catalogItemId && catalogPresentationFormat) throw new Error('catalog_content_input_required');
    if (body.content_send_image !== undefined && typeof body.content_send_image !== 'boolean') throw new Error('catalog_media_input_required');
    if (catalogSendImage && !catalogItemId) throw new Error('catalog_media_input_required');
    if (proposalId && catalogItemId) throw new Error('proposal_catalog_combination_not_supported');
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (profileError || !profile?.active_organization_id) throw new Error('organization_context_required');
    const organizationId = profile.active_organization_id as string;
    const { data: membership } = await admin.from('organization_members').select('role,status').eq('organization_id', organizationId).eq('user_id', user.id).maybeSingle();
    if (!membership || membership.status !== 'active') throw new Error('organization_access_denied');
    const { data: lead } = await admin.from('leads').select('id,opt_out,last_contact,owner_id,assigned_to,whatsapp_account_id').eq('id', leadId).eq('organization_id', organizationId).maybeSingle();
    if (!lead) throw new Error('lead_not_found');
    const elevated = ['owner', 'admin', 'administrador', 'manager', 'gerente', 'sdr', 'cx'].includes(String(membership.role));
    if (!elevated && lead.owner_id !== user.id && lead.assigned_to !== user.id) throw new Error('lead_access_denied');
    const idempotencyKey = `human:${organizationId}:${user.id}:${requestId}`;
    const { data: existingJob, error: existingError } = await admin.from('outreach_jobs')
      .select('id,lead_id,status,payload').eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existingError) throw new Error('message_request_reconciliation_failed');
    if (existingJob) {
      const payload = object(existingJob.payload);
      if (existingJob.id === undefined
        || existingJob.lead_id !== lead.id
        || payload.requested_by !== user.id
        || payload.recipient !== recipient
        || payload.message !== message
        || payload.request_id !== requestId
        || text(payload.catalog_item_id, 64) !== catalogItemId
        || text(payload.catalog_presentation_format, 24) !== catalogPresentationFormat
        || (payload.catalog_send_image === true) !== catalogSendImage
        || text(payload.proposal_id, 64) !== proposalId
        || (payload.controlled_test === true) !== controlledTestRequested
        || String(existingJob.status ?? '') === '') throw new Error('idempotency_payload_mismatch');
      return json({
        ok: true,
        enviado: existingJob.status === 'processed',
        id: existingJob.id,
        message_id: payload.message_id,
        duplicate: true,
        job_status: existingJob.status,
        detalhe: 'existing_request_reused',
      }, 200, headers);
    }
    if (proposalId) {
      const { data: proposal } = await admin.from('proposals')
        .select('id,status,need_approval,lead_id')
        .eq('id', proposalId).eq('organization_id', organizationId).maybeSingle();
      if (!proposal || proposal.lead_id !== lead.id) throw new Error('proposal_not_found_or_unlinked');
      if (!['draft', 'pending', 'rascunho'].includes(String(proposal.status)) || proposal.need_approval) {
        throw new Error('proposal_not_ready_for_delivery');
      }
    }
    if (lead.opt_out) throw new Error('lead_opted_out');
    // O modo humano pausa somente a Ana. Ele jamais pode impedir que o
    // atendente responsável responda ao contato por esse canal.
    const { data: company, error: companyError } = await admin.from('company_settings')
      .select('active,sandbox_mode').eq('organization_id', organizationId).maybeSingle();
    if (companyError || !company?.active) throw new Error('company_not_active');
    const controlledSandboxTest = company.sandbox_mode === true && controlledTestRequested;
    if (company.sandbox_mode !== false && !controlledSandboxTest) throw new Error('operational_mode_protected');
    if (controlledSandboxTest) await requireOrganizationRole(admin, user.id, organizationId, ['owner', 'admin', 'manager']);
    const { data: accountRows, error: accountError } = await admin.rpc('resolve_lead_whatsapp_account', {
      p_organization_id: organizationId,
      p_lead_id: lead.id,
    });
    const account = firstRow(accountRows);
    if (accountError || !account?.integration_id || !account?.account_id) throw new Error('whatsapp_account_not_configured');
    const { data: integration } = await admin.from('integrations').select('id,key,provider,connected,enabled,paused')
      .eq('organization_id', organizationId).eq('id', account.integration_id).maybeSingle();
    if (!integration?.connected || !integration.enabled || integration.paused) throw new Error('whatsapp_integration_not_ready');
    const { data: operationalAccount, error: operationalAccountError } = await admin.from('whatsapp_accounts')
      .select('id,provider,enabled,connection_status').eq('id', account.account_id)
      .eq('organization_id', organizationId).eq('integration_id', integration.id).is('archived_at', null).maybeSingle();
    if (operationalAccountError || !operationalAccount || operationalAccount.enabled !== true || operationalAccount.connection_status !== 'connected') {
      throw new Error('whatsapp_account_not_ready');
    }
    if (['evolution_go', 'wa_akg'].includes(String(operationalAccount.provider))) {
      const controlledProvider = String(operationalAccount.provider);
      const { data: controls, error: controlsError } = await admin.from('messaging_provider_controls')
        .select('send_enabled,kill_switch').eq('organization_id', organizationId).eq('provider', controlledProvider).maybeSingle();
      if (controlsError) throw new Error(`${controlledProvider}_control_read_failed`);
      if (!controls || controls.send_enabled !== true || controls.kill_switch === true) throw new Error(`${controlledProvider}_send_not_ready`);
    }
    const { data: blockingPolicy } = await admin.from('channel_policy_events')
      .select('id,risk_level,action').eq('organization_id', organizationId).eq('channel', 'whatsapp')
      .is('resolved_at', null).in('action', ['pause', 'throttle']).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (blockingPolicy?.action === 'pause') throw new Error('whatsapp_paused_by_risk_policy');
    if (blockingPolicy?.action === 'throttle') throw new Error('whatsapp_throttled_by_risk_policy');
    const now = new Date();
    const controlledTestExpiresAt = controlledSandboxTest ? new Date(now.getTime() + 5 * 60_000).toISOString() : null;
    const queueInput = {
      p_organization_id: organizationId,
      p_lead_id: lead.id,
      p_user_id: user.id,
      p_sender_name: profile.name || 'Atendente',
      p_request_id: requestId,
      p_recipient: recipient,
      p_message: message,
      p_integration_id: integration.id,
      p_context_last_contact: lead.last_contact ?? null,
      p_controlled_test: controlledSandboxTest,
      p_controlled_test_expires_at: controlledTestExpiresAt,
    };
    const { data: queuedRows, error: queueError } = await admin.rpc(
      proposalId
        ? 'queue_human_whatsapp_proposal_message'
        : catalogItemId
          ? 'queue_human_whatsapp_catalog_message'
          : 'queue_human_whatsapp_message',
      proposalId
        ? { ...queueInput, p_proposal_id: proposalId }
        : catalogItemId
          ? { ...queueInput, p_item_id: catalogItemId, p_presentation_format: catalogPresentationFormat, p_send_image: catalogSendImage }
          : queueInput,
    );
    const queued = firstRow(queuedRows);
    if (queueError || !queued?.job_id) throw queueError ?? new Error('outreach_job_not_created');
    const duplicate = queued.duplicate === true;
    if (!duplicate) {
      await admin.from('audit_logs').insert({
        organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user',
        action: controlledSandboxTest ? 'outreach.whatsapp_controlled_test_queued' : 'outreach.whatsapp_queued',
        detail: controlledSandboxTest ? 'Teste controlado colocado na fila segura.' : 'Mensagem colocada na fila segura.',
        entity_table: 'outreach_jobs', entity_id: queued.job_id,
        event_data: { lead_id: lead.id, integration_id: integration.id, whatsapp_account_id: account.account_id, request_id: requestId, controlled_test: controlledSandboxTest, proposal_id: proposalId || null, catalog_item_id: catalogItemId || null, catalog_presentation_format: catalogPresentationFormat || null, catalog_send_image: catalogSendImage },
      });
    }
    return json({
      ok: true,
      enviado: queued.job_status === 'processed',
      id: queued.job_id,
      message_id: queued.message_id,
      duplicate,
      job_status: queued.job_status,
      detalhe: duplicate ? 'existing_request_reused' : controlledSandboxTest ? 'controlled_test_queued_for_authorized_worker' : 'queued_for_authorized_worker',
      teste_controlado: controlledSandboxTest,
      provedor: integration.provider,
    }, 202, headers);
  } catch (error) { return json({ ok: false, enviado: false, erro: safeError(error) }, 400, headers); }
});
