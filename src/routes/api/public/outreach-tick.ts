import { createFileRoute } from '@tanstack/react-router'

// Chamado por um agendador externo a cada 5 minutos.
// Fase 2: consome primeiro a fila `outreach_jobs` com lock atômico e
// idempotência, e depois faz um sweep de segurança em `leads.next_action_at`
// para capturar leads que ainda não passaram pela fila.
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
        // O schema do Supabase é evoluído por migrations. Mantemos o worker
        // desacoplado da cópia gerada de tipos para que uma nova coluna de
        // recuperação não impeça o cron de operar durante o deploy.
        const admin: any = supabaseAdmin
        const { triggerOutreachInternal } = await import('@/lib/outreach.functions')
        const nowIso = new Date().toISOString()
        const workerId = `tick-${crypto.randomUUID().slice(0, 8)}`

        const queueProcessed: string[] = []
        const queueFailed: Array<{ id: string; error: string }> = []
        const sweepProcessed: string[] = []
        const sweepFailed: Array<{ id: string; error: string }> = []

        // ------------------------------------------------------------
        // 1) Drena a fila outreach_jobs (com lock atômico)
        // ------------------------------------------------------------
        // Recupera locks abandonados por uma execução interrompida antes de
        // buscar a fila. Isso evita que uma cadência fique presa para sempre.
        await admin
          .from('outreach_jobs')
          .update({ status: 'queued', locked_at: null, locked_by: null } as never)
          .eq('status', 'locked')
          .lt('locked_at', new Date(Date.now() - 15 * 60_000).toISOString())

        const { data: candidates, error: candErr } = await admin
          .from('outreach_jobs')
          .select('id')
          .eq('status', 'queued')
          .lte('run_at', nowIso)
          .order('run_at', { ascending: true })
          .limit(50)
        if (candErr) {
          return Response.json({ ok: false, error: candErr.message }, { status: 500 })
        }

        for (const cand of candidates ?? []) {
          // Atomic claim: só ganha quem consegue transicionar queued → locked
          const { data: claimed } = await admin
            .from('outreach_jobs')
            .update({ status: 'locked', locked_at: nowIso, locked_by: workerId } as never)
            .eq('id', cand.id)
            .eq('status', 'queued')
            .select('id, lead_id, channel, attempt, payload, retry_count')
            .maybeSingle()
          if (!claimed) continue // outro worker levou

          try {
            const kind = (claimed as any).payload?.kind
            if (kind === 'start') {
              const { data: lead } = await admin
                .from('leads')
                .select('owner_id, assigned_to')
                .eq('id', (claimed as any).lead_id)
                .maybeSingle()
              const actorId = lead?.assigned_to || lead?.owner_id
              if (!actorId) throw new Error('Lead sem responsável para iniciar cadência')
              await triggerOutreachInternal(
                { supabase: admin, userId: actorId, claims: { email: 'Agendador de prospecção' } } as any,
                (claimed as any).lead_id,
              )
            } else {
              await processTimeout(admin, triggerOutreachInternal, claimed as any, nowIso)
            }
            await admin
              .from('outreach_jobs')
              .update({ status: 'done', processed_at: new Date().toISOString() } as never)
              .eq('id', claimed.id)
            queueProcessed.push(claimed.id)
          } catch (err) {
            const message = (err as Error).message
            const retryCount = Number((claimed as any).retry_count ?? 0) + 1
            const retryable = retryCount <= 5
            await admin
              .from('outreach_jobs')
              .update(retryable ? {
                status: 'queued',
                retry_count: retryCount,
                last_error_at: new Date().toISOString(),
                error: message,
                run_at: new Date(Date.now() + Math.min(60, 2 ** retryCount) * 60_000).toISOString(),
              } as never : {
                status: 'failed',
                retry_count: retryCount,
                last_error_at: new Date().toISOString(),
                processed_at: new Date().toISOString(),
                error: message,
              } as never)
              .eq('id', claimed.id)
            if (!retryable) {
              try {
                await admin.from('operational_alerts').insert({
                  severity: 'critical', category: 'queue', title: 'Falha definitiva na cadência',
                  detail: `Job ${claimed.id}: ${message}`, reference_id: claimed.lead_id,
                } as never)
              } catch { /* alertas não podem parar o worker */ }
            }
            queueFailed.push({ id: claimed.id, error: message })
          }
        }

        // ------------------------------------------------------------
        // 2) Sweep de segurança: leads com next_action_at vencido que
        // ainda não têm job na fila (compatibilidade com estado antigo).
        // ------------------------------------------------------------
        const { data: due, error: dueError } = await admin
          .from('leads')
          .select('id, owner_id, assigned_to, company, contact_channels, active_channel')
          .lte('next_action_at', nowIso)
          .eq('ai_paused', false)
          .eq('opt_out', false)
          .limit(50)
        if (dueError) {
          return Response.json({ ok: false, error: dueError.message }, { status: 500 })
        }

        for (const lead of due ?? []) {
          try {
            await runTimeoutForLead(admin, triggerOutreachInternal, lead, nowIso)
            sweepProcessed.push(lead.id)
          } catch (err) {
            sweepFailed.push({ id: lead.id, error: (err as Error).message })
          }
        }

        return Response.json({
          ok: queueFailed.length === 0 && sweepFailed.length === 0,
          queue: { processed: queueProcessed, failed: queueFailed },
          sweep: { processed: sweepProcessed, failed: sweepFailed },
        })
      },
    },
  },
})

// ---- helpers ----------------------------------------------------------------

type TriggerFn = (
  ctx: { supabase: any; userId: string; claims?: any },
  leadId: string,
) => Promise<void>

async function processTimeout(
  supabaseAdmin: any,
  trigger: TriggerFn,
  job: { id: string; lead_id: string; channel: string; attempt: number; payload?: { kind?: string } },
  nowIso: string,
) {
  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('id, owner_id, assigned_to, company, contact_channels, active_channel, ai_paused, opt_out')
    .eq('id', job.lead_id)
    .maybeSingle()
  if (!lead) return
  if (lead.opt_out || lead.ai_paused) return
  // Se o canal já mudou (resposta veio antes), não avança
  if (lead.active_channel && lead.active_channel !== job.channel) return
  await runTimeoutForLead(supabaseAdmin, trigger, lead, nowIso)
}

async function runTimeoutForLead(
  supabaseAdmin: any,
  trigger: TriggerFn,
  lead: any,
  nowIso: string,
) {
  const channels = ((lead.contact_channels as any) ?? {}) as Record<string, any>
  const active = lead.active_channel as 'whatsapp' | 'email' | 'phone' | null
  if (!active || active === 'phone') {
    await supabaseAdmin.from('leads').update({ next_action_at: null } as never).eq('id', lead.id)
    return
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
    await trigger(
      { supabase: supabaseAdmin, userId: actorId, claims: { email: 'Agendador de prospecção' } },
      lead.id,
    )
  } else {
    await supabaseAdmin.from('leads').update({ next_action_at: null } as never).eq('id', lead.id)
  }
}
