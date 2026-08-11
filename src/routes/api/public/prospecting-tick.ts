import { createFileRoute } from '@tanstack/react-router'
import { computeNextRun } from '@/lib/prospecting-schedules.functions'

// Chamado por pg_cron a cada 15 min. Executa toda campanha com next_run_at
// vencido, respeitando quiet_hours e pausando após 3 falhas consecutivas.
export const Route = createFileRoute('/api/public/prospecting-tick')({
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
        const { runProspectingCampaignInternal } = await import('@/lib/prospecting.functions')
        const nowIso = new Date().toISOString()

        const { data: due, error } = await supabaseAdmin
          .from('prospecting_schedules')
          .select('*')
          .eq('active', true)
          .lte('next_run_at', nowIso)
          .limit(20)
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })

        const processed: Array<{ id: string; result: unknown }> = []
        const failed: Array<{ id: string; error: string }> = []

        for (const schedule of due ?? []) {
          const s = schedule as any

          // Quiet hours: se estiver na janela silenciosa (fuso do schedule),
          // apenas reagenda para o próximo horário permitido.
          if (isWithinQuietHours(new Date(), s.quiet_hours_start, s.quiet_hours_end, s.timezone)) {
            const next = computeNextRun(new Date(Date.now() + 60 * 60_000), s.days_of_week, s.time_of_day, s.timezone)
            await supabaseAdmin
              .from('prospecting_schedules')
              .update({ next_run_at: next.toISOString() } as never)
              .eq('id', (s as any).id)
            processed.push({ id: s.id, result: { skipped: 'quiet_hours' } })
            continue
          }

          const { data: runRow } = await supabaseAdmin
            .from('prospecting_schedule_runs')
            .insert({ schedule_id: s.id, status: 'running' } as never)
            .select('id')
            .single()

          try {
            const result = await runProspectingCampaignInternal(supabaseAdmin, s)
            const next = computeNextRun(new Date(), s.days_of_week, s.time_of_day, s.timezone)
            await supabaseAdmin
              .from('prospecting_schedule_runs')
              .update({
                status: result.imported === 0 && result.found > 0 ? 'partial' : 'success',
                finished_at: new Date().toISOString(),
                found_count: result.found,
                approved_count: result.approved,
                imported_count: result.imported,
                skipped_count: result.skipped,
                detail: result.reasons as never,
              } as never)
              .eq('id', (runRow as any)?.id ?? '')
            await supabaseAdmin
              .from('prospecting_schedules')
              .update({
                last_run_at: new Date().toISOString(),
                next_run_at: next.toISOString(),
                consecutive_failures: 0,
              } as never)
              .eq('id', s.id)

            if (result.imported > 0) {
              await supabaseAdmin.from('notifications').insert({
                user_id: (s as any).owner_id,
                kind: 'schedule_run',
                title: `Campanha "${s.name}"`,
                description: `${result.imported} leads criados · ${result.approved} aprovados de ${result.found} encontrados`,
                read: false,
              } as never)
            }

            processed.push({ id: (s as any).id, result })
          } catch (err) {
            const msg = (err as Error).message
            const nextFailures = ((s as any).consecutive_failures ?? 0) + 1
            const shouldPause = nextFailures >= 3
            const next = computeNextRun(new Date(), s.days_of_week, s.time_of_day, s.timezone)
            await supabaseAdmin
              .from('prospecting_schedule_runs')
              .update({ status: 'failed', finished_at: new Date().toISOString(), error: msg } as never)
              .eq('id', (runRow as any)?.id ?? '')
            await supabaseAdmin
              .from('prospecting_schedules')
              .update({
                consecutive_failures: nextFailures,
                active: shouldPause ? false : (s as any).active,
                next_run_at: shouldPause ? null : next.toISOString(),
              } as never)
              .eq('id', (s as any).id)
            if (shouldPause) {
              await supabaseAdmin.from('notifications').insert({
                user_id: (s as any).owner_id,
                kind: 'schedule_paused',
                title: `Campanha "${s.name}" pausada`,
                description: `3 falhas consecutivas. Último erro: ${msg}`,
                read: false,
              } as never)
            }
            failed.push({ id: s.id, error: msg })
          }
        }

        return Response.json({ ok: failed.length === 0, processed, failed })
      },
    },
  },
})

function isWithinQuietHours(now: Date, startHm: string, endHm: string, timezone: string): boolean {
  const hm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone }).format(now)
  const [h, m] = hm.split(':').map((n) => parseInt(n, 10))
  const cur = h * 60 + m
  const [sh, sm] = startHm.split(':').map((n) => parseInt(n, 10))
  const [eh, em] = endHm.split(':').map((n) => parseInt(n, 10))
  const start = sh * 60 + sm
  const end = eh * 60 + em
  return start <= end ? cur >= start && cur < end : cur >= start || cur < end
}
