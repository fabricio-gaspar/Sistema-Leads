import { createFileRoute } from '@tanstack/react-router'

// Z-API webhook receiver. Configure in Z-API panel to POST here.
// URL: https://<projeto>.lovable.app/api/public/zapi-webhook
// We accept several Z-API event shapes (message-status, on-message-received, etc.).

type ZapiEvent = {
  type?: string
  phone?: string
  messageId?: string
  ids?: string[]
  status?: string
  text?: { message?: string } | string
  fromMe?: boolean
}

export const Route = createFileRoute('/api/public/zapi-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const bodyText = await request.text()
        let event: ZapiEvent
        try {
          event = JSON.parse(bodyText) as ZapiEvent
        } catch {
          return new Response('bad json', { status: 400 })
        }

        // Optional shared-secret protection: Z-API allows sending a custom
        // header via the webhook config. We accept a secret via header if set.
        const expected = process.env.ZAPI_WEBHOOK_SECRET
        if (expected) {
          const got = request.headers.get('x-webhook-secret')
          if (got !== expected) return new Response('unauthorized', { status: 401 })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

        const ids = event.ids ?? (event.messageId ? [event.messageId] : [])
        const phone = (event.phone || '').replace(/\D/g, '')
        const status = (event.status || event.type || '').toString().toLowerCase()

        // --- Status updates on outbound messages (sent/delivered/read) ---
        if (ids.length > 0 && ['sent', 'delivered', 'read', 'received', 'played'].some((s) => status.includes(s))) {
          const patch: Record<string, unknown> = {}
          const now = new Date().toISOString()
          if (status.includes('deliver') || status.includes('received')) {
            patch.status = 'delivered'
            patch.delivered_at = now
          } else if (status.includes('read') || status.includes('played')) {
            patch.status = 'read'
            patch.read_at = now
          }
          if (Object.keys(patch).length > 0) {
            for (const mid of ids) {
              const { data: row } = await supabaseAdmin
                .from('lead_outreach')
                .update(patch as never)
                .eq('provider_message_id', mid)
                .select('lead_id')
                .maybeSingle()
              if (row?.lead_id) {
                const { data: lead } = await supabaseAdmin
                  .from('leads')
                  .select('contact_channels')
                  .eq('id', row.lead_id)
                  .maybeSingle()
                const channels = ((lead?.contact_channels as any) ?? {}) as Record<string, any>
                channels.whatsapp = {
                  ...(channels.whatsapp ?? { available: true }),
                  last_status: patch.status,
                  last_attempt_at: now,
                }
                await supabaseAdmin
                  .from('leads')
                  .update({ contact_channels: channels } as never)
                  .eq('id', row.lead_id)
              }
            }
          }
          return Response.json({ ok: true })
        }

        // --- Incoming reply from the lead ---
        const isIncoming =
          (event.type || '').toLowerCase().includes('received') ||
          (event.type || '').toLowerCase().includes('message') ||
          event.fromMe === false
        if (isIncoming && phone) {
          // Find lead by whatsapp/phone match (last 10 digits to handle country codes)
          const tail = phone.slice(-10)
          const { data: leads } = await supabaseAdmin
            .from('leads')
            .select('id, owner_id, whatsapp, phone, contact_channels, ai_paused')
            .or(`whatsapp.ilike.%${tail},phone.ilike.%${tail}`)
            .limit(5)
          const lead = leads?.[0]
          if (!lead) return Response.json({ ok: true, matched: false })

          const text =
            typeof event.text === 'string' ? event.text : event.text?.message ?? '[mensagem]'
          const now = new Date().toISOString()

          // Dedup: same provider_message_id already stored?
          if (event.messageId) {
            const { data: dup } = await supabaseAdmin
              .from('lead_outreach')
              .select('id')
              .eq('provider_message_id', event.messageId)
              .maybeSingle()
            if (dup) return Response.json({ ok: true, dedup: true })
          }

          // Register reply on the latest outbound outreach row for this lead+whatsapp
          const { data: lastOut } = await supabaseAdmin
            .from('lead_outreach')
            .select('id')
            .eq('lead_id', lead.id)
            .eq('channel', 'whatsapp')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (lastOut?.id) {
            await supabaseAdmin
              .from('lead_outreach')
              .update({ status: 'replied', replied_at: now } as never)
              .eq('id', lastOut.id)
          }

          // Insert message in chat
          await supabaseAdmin.from('lead_messages').insert({
            lead_id: lead.id,
            sender: 'client',
            sender_name: 'Cliente',
            type: 'client',
            text,
            sent_at: now,
          } as never)

          // Update channel snapshot & handoff hints
          const channels = ((lead.contact_channels as any) ?? {}) as Record<string, any>
          channels.whatsapp = {
            ...(channels.whatsapp ?? { available: true }),
            last_status: 'replied',
            last_attempt_at: now,
          }

          // Heuristic: interest signals → escalate to human
          const lower = text.toLowerCase()
          const interest = [
            'humano',
            'pessoa',
            'atendente',
            'vendedor',
            'orçamento',
            'orcamento',
            'proposta',
            'reunião',
            'reuniao',
            'comprar',
            'preço',
            'preco',
            'contrato',
          ].some((k) => lower.includes(k))
          const optOut = ['parar', 'sair', 'não quero', 'nao quero', 'descadastrar', 'remover'].some((k) =>
            lower.includes(k),
          )

          const patch: Record<string, unknown> = {
            contact_channels: channels,
            last_contact: now,
            next_action_at: null,
          }
          if (optOut) {
            patch.opt_out = true
            patch.ai_paused = true
          } else if (interest) {
            patch.ai_paused = true
            patch.escalated = true
            patch.escalation_reason = 'interesse_detectado'
          }
          await supabaseAdmin.from('leads').update(patch as never).eq('id', lead.id)

          await supabaseAdmin.from('audit_logs').insert({
            actor_id: lead.owner_id,
            actor_name: 'Z-API',
            actor_type: 'system',
            action: optOut ? 'lead_opt_out' : interest ? 'handoff_interesse' : 'lead_reply',
            detail: `Resposta recebida via WhatsApp de lead ${lead.id}`,
          } as never)

          return Response.json({ ok: true, matched: true, escalated: interest, opt_out: optOut })
        }

        return Response.json({ ok: true, ignored: true })
      },
    },
  },
})
