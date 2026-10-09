import type { createAdminClient } from './auth.ts';
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

/** Local writes are atomic. The one external dispatch has its own durable fence. */
export async function processInboundWork(admin: Admin, provider: Provider, event: Row): Promise<Row> {
  const { data, error } = await admin.rpc('persist_whatsapp_inbound', params(provider, event));
  if (error || !data) throw new Error('whatsapp_inbound_persistence_failed');
  const saved = object(data);
  if (saved.review === true) return saved.reason === 'whatsapp_inbound_route_disabled' ? { ignored: true } : { review: true };
  const payload = object(event.sanitized_payload);
  // Credentials are read before the irreversible dispatch marker, so a missing
  // secret does not falsely claim a request may have been sent.
  const { data: secret, error: secretError } = await admin.rpc('read_integration_secret', { p_integration: event.integration_id });
  const webhookSecret = object(secret).webhook_secret;
  if (secretError || typeof webhookSecret !== 'string' || !webhookSecret) throw new Error('whatsapp_inbound_credential_missing');
  const dispatch = await admin.rpc('begin_whatsapp_inbound_dispatch', params(provider, event));
  if (dispatch.error || !dispatch.data) throw new Error('whatsapp_inbound_dispatch_fence_failed');
  const ticket = object(dispatch.data);
  if (ticket.dispatch !== true) {
    await finishInboundWork(admin, provider, event, 'processed');
    return { processed: true };
  }
  try {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ana-run`, {
      method: 'POST', signal: AbortSignal.timeout(45_000),
      headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
        'Content-Type': 'application/json', 'x-internal-worker-secret': webhookSecret },
      body: JSON.stringify({ event: 'message.received', message_id: payload.message_id,
        // Account scope prevents idempotency collisions between seller sessions.
        request_id: `${provider}:${event.whatsapp_account_id}:${payload.message_id}`,
        lead_id: saved.lead_id, modo: ticket.mode, organization_id: event.organization_id,
        source_integration_id: event.integration_id,
        contexto: { channel: 'whatsapp', inbound_event_id: saved.inbound_id,
          media_requires_review: Boolean(payload.media) || Boolean(payload.media_kind)
            || (typeof payload.message_type === 'string' && payload.message_type !== 'text') },
      }),
    });
    const result = object(await response.json().catch(() => null));
    // A generic duplicate can mean an in-flight request, not completion.
    if (!response.ok || result.ok !== true || result.pending === true || result.processing === true) {
      await finishInboundWork(admin, provider, event, 'needs_review', 'ana_result_not_confirmed');
      return { review: true };
    }
    await finishInboundWork(admin, provider, event, 'processed');
    return { processed: true };
  } catch {
    // No automatic repeat after a possibly accepted model/tool request.
    await finishInboundWork(admin, provider, event, 'needs_review', 'ana_dispatch_result_unknown');
    return { review: true };
  }
}
