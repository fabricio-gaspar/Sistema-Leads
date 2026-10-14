import type { createAdminClient } from './auth.ts';
import { enqueueAnaJob, processNextAnaJob } from './anaQueue.ts';
type Admin = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;
type Provider = 'wa_akg';
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};

const params = (provider: Provider, event: Row) => ({ p_provider: provider, p_event_id: event.id, p_lease_id: event.lease_id });
export async function claimInboundWork(admin: Admin, provider: Provider, event: Row): Promise<Row | null> {
  const { data, error } = await admin.rpc('claim_whatsapp_webhook_event', { p_provider: provider, p_event_id: event.id });
  if (error) throw new Error('whatsapp_event_claim_failed');
  return data ? object(data) : null;
}
export async function finishInboundWork(admin: Admin, provider: Provider, event: Row, state: string, errorCode?: unknown): Promise<void> {
  const { data, error } = await admin.rpc('finish_whatsapp_webhook_event', {
    ...params(provider, event), p_state: state, p_error_code: typeof errorCode === 'string' ? errorCode.slice(0, 120) : null,
  });
  if (error || data !== true) throw new Error('whatsapp_event_finish_failed');
}

/** Local writes are atomic. Ana work is persisted before any model request. */
export async function processInboundWork(admin: Admin, provider: Provider, event: Row): Promise<Row> {
  const { data, error } = await admin.rpc('persist_whatsapp_inbound', params(provider, event));
  if (error || !data) throw new Error('whatsapp_inbound_persistence_failed');
  const saved = object(data);
  if (saved.review === true) return saved.reason === 'whatsapp_inbound_route_disabled' ? { ignored: true } : { review: true };
  const payload = object(event.sanitized_payload);
  const dispatch = await admin.rpc('begin_whatsapp_inbound_dispatch', params(provider, event));
  if (dispatch.error || !dispatch.data) throw new Error('whatsapp_inbound_dispatch_fence_failed');
  const ticket = object(dispatch.data);
  if (ticket.dispatch !== true) {
    await finishInboundWork(admin, provider, event, 'processed');
    // The worker still owns safe post-persistence contact normalization even
    // when Ana is intentionally not dispatched (human mode, approval gate,
    // etc.). Keep the persisted lead identity instead of dropping it here.
    return { processed: true, lead_id: saved.lead_id ?? null };
  }
  const job = await enqueueAnaJob(admin, {
    organizationId: String(event.organization_id ?? ''),
    leadId: String(saved.lead_id ?? ''),
    event: 'message.received',
    mode: ticket.mode === 'humano' ? 'humano' : 'ia',
    // The persisted UUID is the input of Ana. The external provider ID remains
    // only a stable dispatch key and is never used to choose a different message.
    requestId: `${provider}:${String(event.whatsapp_account_id ?? '')}:${String(payload.message_id ?? '')}`,
    sourceMessageId: typeof saved.message_id === 'string' ? saved.message_id : null,
    sourceIntegrationId: typeof event.integration_id === 'string' ? event.integration_id : null,
    context: {
      channel: 'whatsapp',
      inbound_event_id: saved.inbound_id,
      media_requires_review: Boolean(payload.media) || Boolean(payload.media_kind)
        || (typeof payload.message_type === 'string' && payload.message_type !== 'text'),
    },
  });
  // The durable job is now the hand-off point. The webhook can be acknowledged
  // even when the worker needs a later retry/review; a replay would not prove a
  // prior model request was not accepted.
  await finishInboundWork(admin, provider, event, 'processed');
  const execution = await processNextAnaJob(admin, typeof job.id === 'string' ? job.id : null);
  return { processed: true, lead_id: saved.lead_id ?? null, ana_job_id: job.id ?? null, ana: execution };
}
