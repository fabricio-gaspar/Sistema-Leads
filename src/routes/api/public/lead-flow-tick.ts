import { createFileRoute } from '@tanstack/react-router'

// Worker idempotente do Fluxo de Leads: move para "Contatos Perdidos" os leads
// que receberam o primeiro contato de saída e não responderam dentro do prazo.
// Agendado via pg_cron (a cada 15 minutos).
export const Route = createFileRoute('/api/public/lead-flow-tick')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.OUTREACH_CRON_SECRET
        const authorization = request.headers.get('authorization')
        const provided = authorization?.startsWith('Bearer ')
          ? authorization.slice('Bearer '.length)
          : request.headers.get('x-cron-secret') ?? request.headers.get('apikey')

        const anon = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY
        const accepted = [expected, anon].filter(Boolean) as string[]
        if (!accepted.length || !provided || !accepted.includes(provided)) {
          return new Response('unauthorized', { status: 401 })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { processNoReplyTimeouts } = await import('@/lib/lead-flow.functions')
        try {
          const result = await processNoReplyTimeouts(supabaseAdmin as any)
          return Response.json({ ok: true, ...result })
        } catch (error) {
          return Response.json({ ok: false, error: (error as Error).message }, { status: 500 })
        }
      },
    },
  },
})
