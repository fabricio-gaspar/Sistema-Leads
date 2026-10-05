import { createAdminClient } from '../_shared/auth.ts';
import { json, safeError } from '../_shared/http.ts';
import { MetaCoexistenceProvider } from '../_shared/messaging/MetaCoexistenceProvider.ts';
import { metaServiceWindow } from '../_shared/messaging/messagingWindow.ts';
import type { ProviderSendRequest } from '../_shared/messaging/MessagingProvider.ts';

type Admin = ReturnType<typeof createAdminClient>;
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

function secureEqual(left: string | null, right: string | undefined): boolean {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function providerReady(admin: Admin, organizationId: string, origin: string) {
  const [flagRead, controlRead] = await Promise.all([
    admin.from('organization_feature_flags').select('enabled')
      .eq('organization_id', organizationId).eq('flag_key', 'meta_coexistence').maybeSingle(),
    admin.from('messaging_provider_controls').select('send_enabled,automation_enabled,kill_switch')
      .eq('organization_id', organizationId).eq('provider', 'meta_cloud').maybeSingle(),
  ]);
  if (flagRead.error || controlRead.error) throw new Error('meta_provider_control_read_failed');
  if (flagRead.data?.enabled !== true) throw new Error('meta_coexistence_feature_disabled');
  if (!controlRead.data || controlRead.data.kill_switch !== false) throw new Error('meta_provider_kill_switch_active');
  if (controlRead.data.send_enabled !== true) throw new Error('meta_send_disabled');
  if (origin === 'ana' && controlRead.data.automation_enabled !== true) throw new Error('meta_automation_disabled');
}

function requestFromJob(job: Row): ProviderSendRequest {
  const content = asObject(job.content);
  const kind = asText(job.message_kind, 40);
  const common = { to: asText(job.recipient_identity, 80), idempotencyKey: asText(job.idempotency_key, 300) };
  if (kind === 'text') return { ...common, kind: 'text', text: asText(content.text) };
  if (kind === 'template') return {
    ...common,
    kind: 'template',
    template: {
      name: asText(content.name, 512),
      language: asText(content.language, 40),
      components: Array.isArray(content.components) ? content.components : undefined,
    },
  };
  if (kind === 'image' || kind === 'document') return {
    ...common,
    kind,
    media: {
      id: asText(content.id, 300) || undefined,
      link: asText(content.link, 2_000) || undefined,
      caption: asText(content.caption, 1_024) || undefined,
      filename: asText(content.filename, 240) || undefined,
    },
  };
  throw new Error('meta_message_kind_unsupported');
}

async function enforceWindow(admin: Admin, job: Row, request: ProviderSendRequest) {
  const { data, error } = await admin.from('whatsapp_conversations')
    .select('last_inbound_at,service_window_expires_at')
    .eq('organization_id', job.organization_id)
    .eq('whatsapp_account_id', job.whatsapp_account_id)
    .eq('lead_id', job.lead_id)
    .order('last_message_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error('meta_service_window_read_failed');
  const state = metaServiceWindow(data?.last_inbound_at ?? null);
  if (request.kind !== 'template' && !state.isOpen) throw new Error('meta_template_required_outside_service_window');
  if (request.kind === 'template') {
    const { data: template, error: templateError } = await admin.from('whatsapp_templates')
      .select('id,status').eq('organization_id', job.organization_id)
      .eq('whatsapp_account_id', job.whatsapp_account_id)
      .eq('name', request.template?.name).eq('language', request.template?.language).maybeSingle();
    if (templateError || template?.status !== 'approved') throw new Error('meta_template_not_approved');
  }
}

async function processJob(admin: Admin, job: Row, workerId: string) {
  const organizationId = asText(job.organization_id, 80);
  const jobId = asText(job.id, 80);
  const { data: claimed, error: claimError } = await admin.from('messaging_outbox').update({
    status: 'processing', locked_at: new Date().toISOString(), locked_by: workerId,
  }).eq('id', jobId).in('status', ['queued', 'failed']).select('id').maybeSingle();
  if (claimError) throw new Error('meta_outbox_claim_failed');
  if (!claimed?.id) return { id: jobId, status: 'skipped', reason: 'already_claimed' };
  await providerReady(admin, organizationId, asText(job.origin, 40));

  const [{ data: account, error: accountError }, { data: lead, error: leadError }] = await Promise.all([
    admin.from('whatsapp_accounts')
      .select('id,integration_id,provider,enabled,connection_status,phone_number_id')
      .eq('id', job.whatsapp_account_id).eq('organization_id', organizationId)
      .is('archived_at', null).maybeSingle(),
    admin.from('leads').select('id,opt_out,whatsapp_account_id')
      .eq('id', job.lead_id).eq('organization_id', organizationId).maybeSingle(),
  ]);
  if (accountError || !account || account.provider !== 'meta_cloud') throw new Error('meta_account_not_found');
  if (!account.enabled || account.connection_status !== 'connected') throw new Error('meta_account_not_ready');
  if (leadError || !lead || lead.opt_out === true) throw new Error(lead?.opt_out ? 'lead_opted_out' : 'lead_not_found');
  if (lead.whatsapp_account_id !== account.id) throw new Error('meta_account_lead_mismatch');
  const request = requestFromJob(job);
  await enforceWindow(admin, job, request);
  const { data: secret, error: secretError } = await admin.rpc('read_integration_secret', { p_integration: account.integration_id });
  if (secretError) throw new Error('meta_credentials_read_failed');
  const credentials = asObject(secret);
  const provider = new MetaCoexistenceProvider({
    accessToken: asText(credentials.access_token, 8_000),
    phoneNumberId: asText(credentials.phone_number_id, 80),
    graphApiVersion: asText(credentials.graph_api_version, 20),
  });
  const result = await provider.send(request);
  const { error: outboxError } = await admin.from('messaging_outbox').update({
    status: 'sent',
    provider_message_id: result.providerMessageId,
    provider_status_at: result.acceptedAt,
    last_error_code: null,
    locked_at: null,
    locked_by: null,
  }).eq('id', jobId).eq('locked_by', workerId);
  if (outboxError) throw new Error('meta_outbox_acceptance_save_failed');
  if (job.lead_message_id) {
    await admin.from('lead_messages').update({
      provider_message_id: result.providerMessageId,
      provider: 'meta_cloud',
      delivery_status: 'sent',
      provider_status_at: result.acceptedAt,
      sent_at: result.acceptedAt,
      type: 'sent',
    }).eq('id', job.lead_message_id).eq('organization_id', organizationId);
  }
  await admin.from('audit_logs').insert({
    organization_id: organizationId,
    actor_id: job.requested_by || null,
    actor_name: asText(job.origin, 40) === 'ana' ? 'Ana' : 'Sistema',
    actor_type: asText(job.origin, 40) === 'ana' ? 'ai' : 'system',
    action: 'outreach.meta_provider_accepted',
    detail: 'Mensagem aceita pela Meta Cloud API; entrega e leitura aguardam webhook.',
    entity_table: 'messaging_outbox',
    entity_id: jobId,
    event_data: {
      lead_id: job.lead_id,
      whatsapp_account_id: job.whatsapp_account_id,
      message_kind: job.message_kind,
      origin: job.origin,
    },
  });
  return { id: jobId, status: 'sent', providerMessageId: result.providerMessageId };
}

async function recordFailure(admin: Admin, job: Row, error: unknown, workerId: string) {
  const attempt = Number(job.attempt_count ?? 0) + 1;
  const code = safeError(error).replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 160) || 'meta_dispatch_failed';
  const terminal = attempt >= 5 || [
    'lead_opted_out', 'lead_not_found', 'meta_account_lead_mismatch',
    'meta_template_required_outside_service_window', 'meta_template_not_approved',
    'meta_outbox_acceptance_save_failed',
  ].includes(code);
  const delayMinutes = Math.min(60, 2 ** Math.max(0, attempt - 1));
  await admin.from('messaging_outbox').update({
    status: terminal ? 'dead_letter' : 'failed',
    attempt_count: attempt,
    last_error_code: code,
    run_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
    locked_at: null,
    locked_by: null,
  }).eq('id', job.id).eq('locked_by', workerId);
  if (job.lead_message_id && terminal) {
    await admin.from('lead_messages').update({ type: 'failed', delivery_status: 'failed' })
      .eq('id', job.lead_message_id).eq('organization_id', job.organization_id);
  }
  return { id: job.id, status: terminal ? 'dead_letter' : 'failed', error: code };
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  if (!secureEqual(request.headers.get('x-meta-worker-token'), Deno.env.get('META_WORKER_TOKEN'))) {
    return json({ ok: false, error: 'worker_authentication_failed' }, 401);
  }
  try {
    const body = await request.json().catch(() => ({})) as Row;
    const jobId = asUuid(body.job_id);
    const admin = createAdminClient();
    const workerId = `meta-worker:${crypto.randomUUID()}`;
    let query = admin.from('messaging_outbox').select('*')
      .in('status', ['queued', 'failed']).lte('run_at', new Date().toISOString())
      .order('run_at', { ascending: true }).limit(jobId ? 1 : 10);
    if (jobId) query = query.eq('id', jobId);
    const { data: jobs, error } = await query;
    if (error) throw new Error('meta_outbox_read_failed');
    const results = [];
    for (const job of (jobs ?? []) as Row[]) {
      try {
        results.push(await processJob(admin, job, workerId));
      } catch (cause) {
        results.push(await recordFailure(admin, job, cause, workerId));
      }
    }
    return json({ ok: true, processed: results.length, results }, 200);
  } catch (error) {
    return json({ ok: false, error: safeError(error) }, 500);
  }
});

