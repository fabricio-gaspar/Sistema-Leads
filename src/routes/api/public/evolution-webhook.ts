import { createFileRoute } from '@tanstack/react-router'

// Evolution Go / Evolution API webhook receiver.
// Configure in your Evolution panel to POST here:
//   https://<projeto>.lovable.app/api/public/evolution-webhook
// Auth: the sender must include `apikey: <your evolution api key>` header;
// we compare against the value stored in company_settings.evolution_api_key.
//
// Handles two families of events:
//   - message-status updates (sent/delivered/read) → patch lead_outreach
//   - inbound messages (fromMe=false) → insert lead_messages + handoff hints

type EvolutionEvent = {
  event?: string
  instance?: string
  data?: any
  // Also accept flat shape from some Evolution Go versions
  key?: { remoteJid?: string; fromMe?: boolean; id?: string }
  message?: any
  status?: string
  messageStatus?: string
}

function extractText(msg: any): string {
  if (!msg) return ''
  if (typeof msg === 'string') return msg
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.text ||
    '[mensagem]'
  )
}

function extractPhone(jid?: string): string {
  if (!jid) return ''
  return jid.split('@')[0].replace(/\D/g, '')
}

export const Route = createFileRoute('/api/public/evolution-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text()
        let evt: EvolutionEvent
        try {
          evt = JSON.parse(raw) as EvolutionEvent
        } catch {
          return new Response('bad json', { status: 400 })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

        // Validate caller: apikey header must match a company's evolution_api_key
        const apiKey = request.headers.get('apikey') || request.headers.get('x-api-key') || ''
        if (!apiKey) return new Response('unauthorized', { status: 401 })
        const { data: settings } = await supabaseAdmin
          .from('company_settings')
          .select('id, user_id, evolution_api_key')
          .eq('evolution_api_key', apiKey)
          .maybeSingle()
        if (!settings) return new Response('unauthorized', { status: 401 })
        const ownerId = (settings as any).user_id as string

        const evName = (evt.event || '').toString().toLowerCase()
        const payload = evt.data ?? evt

        // -------- Status update on outbound message --------
        const status = (payload?.status || evt.status || evt.messageStatus || '').toString().toLowerCase()
        const messageId = payload?.key?.id || payload?.id || evt.key?.id
        if (messageId && ['sent', 'delivered', 'read', 'played', 'server_ack', 'delivery_ack', 'read_receipt'].some((s) => status.includes(s))) {
          const patch: Record<string, unknown> = {}
          const now = new Date().toISOString()
          if (status.includes('deliver')) {
            patch.status = 'delivered'
            patch.delivered_at = now
          } else if (status.includes('read') || status.includes('played')) {
            patch.status = 'read'
            patch.read_at = now
          } else {
            patch.status = 'sent'
            patch.sent_at = now
          }
          const { data: row } = await supabaseAdmin
            .from('lead_outreach')
            .update(patch as never)
            .eq('provider_message_id', messageId)
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
          return Response.json({ ok: true, kind: 'status' })
        }

        // -------- Inbound message --------
        const key = payload?.key ?? evt.key
        const isIncoming =
          evName.includes('messages.upsert') ||
          evName.includes('message') ||
          key?.fromMe === false
        const phone = extractPhone(key?.remoteJid || payload?.remoteJid)
        if (isIncoming && phone && key?.fromMe !== true) {
          const tail = phone.slice(-10)
          const { data: leads } = await supabaseAdmin
            .from('leads')
            .select('id, owner_id, contact_channels')
            .eq('owner_id', ownerId)
            .or(`whatsapp.ilike.%${tail},phone.ilike.%${tail}`)
            .limit(1)
          const lead = leads?.[0]
          if (!lead) return Response.json({ ok: true, matched: false })

          // Dedup on provider_message_id
          if (messageId) {
            const { data: dup } = await supabaseAdmin
              .from('lead_outreach')
              .select('id')
              .eq('provider_message_id', messageId)
              .maybeSingle()
            if (dup) return Response.json({ ok: true, dedup: true })
          }

          const text = extractText(payload?.message ?? evt.message)
          const now = new Date().toISOString()

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

          await supabaseAdmin.from('lead_messages').insert({
            lead_id: lead.id,
            sender: 'client',
            sender_name: 'Cliente',
            type: 'client',
            text,
            sent_at: now,
          } as never)

          const channels = ((lead.contact_channels as any) ?? {}) as Record<string, any>
          channels.whatsapp = {
            ...(channels.whatsapp ?? { available: true }),
            last_status: 'replied',
            last_attempt_at: now,
          }

          const lower = text.toLowerCase()
          const interest = [
            'humano', 'pessoa', 'atendente', 'vendedor',
            'orçamento', 'orcamento', 'proposta', 'reunião', 'reuniao',
            'comprar', 'preço', 'preco', 'contrato',
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
          }
          await supabaseAdmin.from('leads').update(patch as never).eq('id', lead.id)

          await supabaseAdmin.from('audit_logs').insert({
            actor_id: ownerId,
            actor_name: 'Evolution Go',
            actor_type: 'system',
            action: optOut ? 'lead_opt_out' : interest ? 'handoff_interesse' : 'lead_reply',
            detail: `Resposta recebida via WhatsApp (Evolution) do lead ${lead.id}`,
          } as never)

          return Response.json({ ok: true, matched: true, escalated: interest, opt_out: optOut })
        }

        return Response.json({ ok: true, ignored: true })
      },
    },
  },
})
