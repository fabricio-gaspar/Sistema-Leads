import { createAdminClient, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

type Row = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asObject(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
}

function asText(value: unknown, maximum = 4_096): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function asUuid(value: unknown): string {
  const candidate = asText(value, 80);
  return UUID.test(candidate) ? candidate : '';
}

function phoneIdentity(value: unknown): string {
  const raw = asText(value, 80);
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (!raw.startsWith('+') && [10, 11].includes(digits.length)) return `55${digits}`;
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);
  try {
    const body = await request.json().catch(() => ({})) as Row;
    const leadId = asUuid(body.lead_id ?? body.leadId);
    const requestId = asUuid(body.request_id ?? body.requestId);
    const recipient = phoneIdentity(body.recipient ?? body.para);
    const messageKind = asText(body.message_kind ?? body.kind, 40) || 'text';
    if (!leadId || !requestId || !recipient || !['text', 'template', 'image', 'document'].includes(messageKind)) {
      throw new Error('meta_message_input_required');
    }
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from('profiles')
      .select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (profileError || !profile?.active_organization_id) throw new Error('organization_context_required');
    const organizationId = profile.active_organization_id as string;
    const { data: lead, error: leadError } = await admin.from('leads')
      .select('id,whatsapp_account_id,phone_identity,whatsapp_identity')
      .eq('id', leadId).eq('organization_id', organizationId).maybeSingle();
    if (leadError || !lead?.whatsapp_account_id) throw new Error('meta_lead_account_required');
    if (![lead.phone_identity, lead.whatsapp_identity].filter(Boolean).includes(recipient)) throw new Error('recipient_mismatch');
    const { data: account, error: accountError } = await admin.from('whatsapp_accounts')
      .select('id,provider').eq('id', lead.whatsapp_account_id)
      .eq('organization_id', organizationId).is('archived_at', null).maybeSingle();
    if (accountError || account?.provider !== 'meta_cloud') throw new Error('meta_account_not_found');

    let content: Row;
    if (messageKind === 'text') content = { text: asText(body.text ?? body.texto) };
    else if (messageKind === 'template') content = {
      name: asText(body.template_name, 512),
      language: asText(body.template_language, 40),
      components: Array.isArray(body.components) ? body.components : [],
    };
    else content = {
      id: asText(body.media_id, 300) || undefined,
      link: asText(body.media_link, 2_000) || undefined,
      caption: asText(body.caption, 1_024) || undefined,
      filename: asText(body.filename, 240) || undefined,
    };
    if (messageKind === 'text' && !asText(content.text)) throw new Error('meta_message_content_invalid');

    const { data: queuedRows, error: queueError } = await admin.rpc('queue_meta_whatsapp_message', {
      p_organization_id: organizationId,
      p_lead_id: leadId,
      p_whatsapp_account_id: account.id,
      p_user_id: user.id,
      p_sender_name: asText(profile.name, 160) || 'Atendente',
      p_request_id: requestId,
      p_recipient_identity: recipient,
      p_message_kind: messageKind,
      p_content: content,
    });
    const queued = Array.isArray(queuedRows) ? asObject(queuedRows[0]) : asObject(queuedRows);
    if (queueError || !queued.job_id) throw new Error(queueError?.message || 'meta_outbox_create_failed');

    let immediate: Row | null = null;
    const workerToken = Deno.env.get('META_WORKER_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (workerToken && supabaseUrl && queued.job_status === 'queued') {
      const response = await fetch(`${supabaseUrl}/functions/v1/meta-whatsapp-worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-meta-worker-token': workerToken },
        body: JSON.stringify({ job_id: queued.job_id }),
        signal: AbortSignal.timeout(25_000),
      });
      immediate = asObject(await response.json().catch(() => null));
    }
    return json({
      ok: true,
      id: queued.job_id,
      message_id: queued.message_id,
      job_status: queued.job_status,
      duplicate: queued.duplicate === true,
      immediate,
    }, 200, headers);
  } catch (error) {
    return json({ ok: false, erro: safeError(error) }, 400, headers);
  }
});

