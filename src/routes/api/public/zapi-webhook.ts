import { createFileRoute } from '@tanstack/react-router'

// Z-API webhook receiver. Configure in Z-API panel to POST here.
// URL: https://<projeto>.lovable.app/api/public/zapi-webhook
// We accept several Z-API event shapes (message-status, on-message-received, etc.).

type ZapiEvent = {
  type?: string
  phone?: string
  messageId?: string
  zaapId?: string
  ids?: string[]
  status?: string
  text?: { message?: string } | string
  fromMe?: boolean
  instanceId?: string
}

export const Route = createFileRoute('/api/public/zapi-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ZAPI_WEBHOOK_SECRET
        if (!expected) {
          return Response.json({ ok: false, error: 'webhook_secret_not_configured' }, { status: 503 })
        }
        const got = request.headers.get('x-webhook-secret') || new URL(request.url).searchParams.get('secret')
        if (got !== expected) return new Response('unauthorized', { status: 401 })

        const bodyText = await request.text()
        let event: ZapiEvent
        try {
          event = JSON.parse(bodyText) as ZapiEvent
        } catch {
          return new Response('bad json', { status: 400 })
        }
        const expectedInstance = process.env.ZAPI_INSTANCE_ID
        if (expectedInstance && event.instanceId && event.instanceId !== expectedInstance) {
          return new Response('unauthorized instance', { status: 401 })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

        const ids = event.ids ?? [event.messageId, event.zaapId].filter((id): id is string => Boolean(id))
        const phone = (event.phone || '').replace(/\D/g, '')
        const status = (event.status || event.type || '').toString().toLowerCase()
        const hasText = typeof event.text === 'string' || Boolean(event.text?.message)
        const isStatusCallback =
          status.includes('status') || status.includes('delivery') || status.includes('sent') || status.includes('read')
        const isIncoming = event.fromMe === false || (event.fromMe == null && hasText && !isStatusCallback)

        // --- Status updates on outbound messages (sent/delivered/read) ---
        if (!isIncoming && ids.length > 0 && ['sent', 'delivery', 'delivered', 'read', 'received', 'played'].some((s) => status.includes(s))) {
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
        if (isIncoming && phone) {
          // Find lead by whatsapp/phone match (last 10 digits to handle country codes)
          const tail = phone.slice(-10)
          const { data: leads } = await supabaseAdmin
            .from('leads')
            .select('id, owner_id, assigned_to, whatsapp, phone, contact_channels, ai_paused')
            .or(`whatsapp.ilike.%${tail},phone.ilike.%${tail}`)
            .limit(5)
          const lead = leads?.[0]
          if (!lead) return Response.json({ ok: true, matched: false })

          const text =
            typeof event.text === 'string' ? event.text : event.text?.message ?? '[mensagem]'
          const now = new Date().toISOString()
          const inboundId = event.messageId || event.zaapId

          // Dedup: same provider_message_id already stored?
          if (inboundId) {
            const { data: dup } = await supabaseAdmin
              .from('lead_messages')
              .select('id')
              .eq('provider_message_id', inboundId)
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
          const { error: messageError } = await supabaseAdmin.from('lead_messages').insert({
            lead_id: lead.id,
            sender: 'client',
            sender_name: 'Cliente',
            type: 'client',
            text,
            sent_at: now,
            provider_message_id: inboundId ?? null,
          } as never)
          if (messageError?.code === '23505') return Response.json({ ok: true, dedup: true })
          if (messageError) {
            return Response.json({ ok: false, error: messageError.message }, { status: 500 })
          }

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
          }
          await supabaseAdmin.from('leads').update(patch as never).eq('id', lead.id)

          if (optOut) {
            const { suppressLeadContactsInternal } = await import('@/lib/outreach.functions')
            const actorId = lead.assigned_to || lead.owner_id
            if (actorId) {
              await suppressLeadContactsInternal(
                { supabase: supabaseAdmin, userId: actorId, claims: { email: 'Z-API' } },
                lead.id,
              )
            }
          }

          await supabaseAdmin.from('audit_logs').insert({
            actor_id: lead.assigned_to || lead.owner_id,
            actor_name: 'Z-API',
            actor_type: 'system',
            action: optOut ? 'lead_opt_out' : 'lead_reply',
            detail: `Resposta recebida via WhatsApp de lead ${lead.id}`,
          } as never)

          let automation: unknown = null
          if (!optOut) {
            const outreach = await import('@/lib/outreach.functions')
            const actorId = lead.assigned_to || lead.owner_id
            if (actorId) {
              const ctx = {
                supabase: supabaseAdmin,
                userId: actorId,
                claims: { email: 'Ana (IA)' },
              }
              automation = interest
                ? await outreach.handoffLeadInternal(ctx, lead.id, text, 'Interesse comercial detectado')
                : lead.ai_paused
                  ? { ok: false, action: 'ignored', reason: 'ai_paused' }
                  : await outreach.handleInboundWithAiInternal(ctx, lead.id, text)
            }
          }

          return Response.json({ ok: true, matched: true, escalated: interest, opt_out: optOut, automation })
        }

        return Response.json({ ok: true, ignored: true })
      },
    },
  },
})
