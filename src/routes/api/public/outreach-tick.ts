import { createFileRoute } from '@tanstack/react-router'

// Chamado por um agendador externo a cada 5 minutos. Quando o prazo de um
// canal vence sem resposta, registra o timeout e realmente dispara o próximo.
export const Route = createFileRoute('/api/public/outreach-tick')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.OUTREACH_CRON_SECRET
        if (!expected) {
          return Response.json({ ok: false, error: 'cron_secret_not_configured' }, { status: 503 })
        }
        const authorization = request.headers.get('authorization')
        const provided = authorization?.startsWith('Bearer ')
          ? authorization.slice('Bearer '.length)
          : request.headers.get('x-cron-secret')
        if (provided !== expected) return new Response('unauthorized', { status: 401 })

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { triggerOutreachInternal } = await import('@/lib/outreach.functions')
        const nowIso = new Date().toISOString()

        const { data: due, error: dueError } = await supabaseAdmin
          .from('leads')
          .select('id, owner_id, assigned_to, company, contact_channels, active_channel')
          .lte('next_action_at', nowIso)
          .eq('ai_paused', false)
          .eq('opt_out', false)
          .limit(50)
        if (dueError) {
          return Response.json({ ok: false, error: dueError.message }, { status: 500 })
        }

        const processed: string[] = []
        const failed: Array<{ id: string; error: string }> = []
        for (const lead of due ?? []) {
          try {
            const channels = ((lead.contact_channels as any) ?? {}) as Record<string, any>
            const active = lead.active_channel as 'whatsapp' | 'email' | 'phone' | null
            if (!active || active === 'phone') {
              await supabaseAdmin.from('leads').update({ next_action_at: null } as never).eq('id', lead.id)
              processed.push(lead.id)
              continue
            }

            const current = channels[active]
            if (current && ['sent', 'delivered', 'read', 'pending'].includes(current.last_status)) {
              channels[active] = {
                ...current,
                last_status: 'failed',
                last_attempt_at: nowIso,
              }
              await supabaseAdmin
                .from('leads')
                .update({ contact_channels: channels, next_action_at: null } as never)
                .eq('id', lead.id)
              await supabaseAdmin.from('lead_outreach').insert({
                lead_id: lead.id,
                owner_id: lead.assigned_to || lead.owner_id,
                channel: active,
                status: 'skipped',
                attempt: 999,
                error: 'no_reply_timeout',
                actor_type: 'system',
              } as never)

              const actorId = lead.assigned_to || lead.owner_id
              if (!actorId) throw new Error('Lead sem responsável para executar a cadência')
              await triggerOutreachInternal(
                {
                  supabase: supabaseAdmin,
                  userId: actorId,
                  claims: { email: 'Agendador de prospecção' },
                },
                lead.id,
              )
            } else {
              await supabaseAdmin.from('leads').update({ next_action_at: null } as never).eq('id', lead.id)
            }
            processed.push(lead.id)
          } catch (error) {
            failed.push({ id: lead.id, error: (error as Error).message })
          }
        }

        return Response.json({ ok: failed.length === 0, processed, failed })
      },
    },
  },
})
