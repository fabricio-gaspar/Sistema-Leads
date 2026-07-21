// Server-only helpers for webhook idempotency via `webhook_events`.
// Import dynamically from route handlers: `await import('@/lib/webhook-dedup.server')`.

type AnyAdmin = any

export type WebhookDedupResult = {
  isDuplicate: boolean
  eventRowId: string | null
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Registers an incoming webhook event and returns whether it was already seen.
 * Uses the unique `(provider, external_id)` constraint on `webhook_events`.
 * When `external_id` is falsy we skip dedup and just log the event.
 */
export async function registerWebhookEvent(
  supabaseAdmin: AnyAdmin,
  args: {
    provider: 'zapi' | 'resend' | 'apify' | string
    external_id: string | null | undefined
    event_type?: string | null
    payload?: unknown
  },
): Promise<WebhookDedupResult> {
  const payloadSha = args.payload
    ? await sha256Hex(typeof args.payload === 'string' ? args.payload : JSON.stringify(args.payload))
    : null

  const row = {
    provider: args.provider,
    external_id: args.external_id || null,
    event_type: args.event_type ?? null,
    payload_sha: payloadSha,
    status: 'received',
  }

  const { data, error } = await supabaseAdmin
    .from('webhook_events')
    .insert(row as never)
    .select('id')
    .maybeSingle()

  if (error) {
    // 23505 = unique_violation → same (provider, external_id) already recorded
    if ((error as any).code === '23505') return { isDuplicate: true, eventRowId: null }
    // Non-fatal: don't block webhook processing just because logging failed
    console.error('[webhook-dedup] insert failed', error.message)
    return { isDuplicate: false, eventRowId: null }
  }
  return { isDuplicate: false, eventRowId: data?.id ?? null }
}

export async function markWebhookEventProcessed(
  supabaseAdmin: AnyAdmin,
  eventRowId: string | null,
  patch: {
    status: 'processed' | 'failed' | 'ignored'
    error?: string | null
    lead_id?: string | null
    outreach_id?: string | null
  },
): Promise<void> {
  if (!eventRowId) return
  const { error } = await supabaseAdmin
    .from('webhook_events')
    .update({
      status: patch.status,
      error: patch.error ?? null,
      lead_id: patch.lead_id ?? null,
      outreach_id: patch.outreach_id ?? null,
      processed_at: new Date().toISOString(),
    } as never)
    .eq('id', eventRowId)
  if (error) console.error('[webhook-dedup] update failed', error.message)
}
