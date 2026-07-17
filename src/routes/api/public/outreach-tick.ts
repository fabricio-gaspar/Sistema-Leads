import { createFileRoute } from '@tanstack/react-router'

// Cron endpoint called by pg_cron every 5 minutes.
// Advances the outreach cadence for leads whose next_action_at is due.
export const Route = createFileRoute('/api/public/outreach-tick')({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const nowIso = new Date().toISOString()

        const { data: due } = await supabaseAdmin
          .from('leads')
          .select('id, owner_id, contact_channels, active_channel')
          .lte('next_action_at', nowIso)
          .eq('ai_paused', false)
          .eq('opt_out', false)
          .limit(50)

        const processed: string[] = []
        for (const lead of due ?? []) {
          try {
            // Impersonate the owner via service role by scoping updates on owner_id.
            // We reuse the outreach logic by inlining a minimal fallback: mark
            // as failed on current channel and let advance decide the next.
            const channels = ((lead.contact_channels as any) ?? {}) as Record<string, any>
            const active = (lead.active_channel as string | null) ?? 'whatsapp'
            const cur = channels[active]
            // If current still 'sent'/'delivered' waiting for reply and window elapsed,
            // treat as failed to advance to next channel.
            if (cur && ['sent', 'delivered', 'read'].includes(cur.last_status)) {
              cur.last_status = 'failed'
              cur.last_attempt_at = nowIso
              channels[active] = cur
              await supabaseAdmin
                .from('leads')
                .update({ contact_channels: channels, next_action_at: null } as never)
                .eq('id', lead.id)
              await supabaseAdmin.from('lead_outreach').insert({
                lead_id: lead.id,
                owner_id: lead.owner_id,
                channel: active,
                status: 'skipped',
                attempt: 999,
                error: 'no_reply_timeout',
                actor_type: 'system',
              } as never)
              // Try next channel
              const order = ['whatsapp', 'email', 'phone']
              const startIdx = order.indexOf(active) + 1
              let advanced = false
              for (let i = startIdx; i < order.length; i++) {
                const next = order[i]
                const s = channels[next]
                if (s?.available && !['failed', 'skipped'].includes(s.last_status)) {
                  await supabaseAdmin
                    .from('leads')
                    .update({ active_channel: next, next_action_at: nowIso } as never)
                    .eq('id', lead.id)
                  advanced = true
                  break
                }
              }
              if (!advanced) {
                await supabaseAdmin
                  .from('leads')
                  .update({ next_action_at: null, active_channel: null } as never)
                  .eq('id', lead.id)
              }
            } else {
              await supabaseAdmin
                .from('leads')
                .update({ next_action_at: null } as never)
                .eq('id', lead.id)
            }
            processed.push(lead.id as string)
          } catch (err) {
            console.error('outreach-tick error', lead.id, err)
          }
        }

        return Response.json({ ok: true, processed })
      },
    },
  },
})
