import { createFileRoute } from '@tanstack/react-router'

type ResendEvent = {
  type?: string
  data?: {
    email_id?: string
    from?: string
    subject?: string
  }
}

function base64Bytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
}

function toBase64(value: Uint8Array): string {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function verifyResendWebhook(request: Request, rawBody: string): Promise<boolean> {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  const id = request.headers.get('svix-id')
  const timestamp = request.headers.get('svix-timestamp')
  const signatures = request.headers.get('svix-signature')
  if (!secret || !id || !timestamp || !signatures) return false
  const timestampSeconds = Number(timestamp)
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false
  try {
    const keyBytes = base64Bytes(secret.replace(/^whsec_/, ''))
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const signature = new Uint8Array(
      await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`)),
    )
    const expected = toBase64(signature)
    return signatures.split(' ').some((candidate) => {
      const [version, value] = candidate.split(',')
      return version === 'v1' && Boolean(value) && safeEqual(value, expected)
    })
  } catch {
    return false
  }
}

function normalizeEmail(value: string): string {
  const match = value.match(/<([^>]+)>/)
  return (match?.[1] || value).trim().toLowerCase()
}

function plainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+\n/g, '\n')
    .trim()
}

export const Route = createFileRoute('/api/public/resend-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env.RESEND_WEBHOOK_SECRET) {
          return Response.json({ ok: false, error: 'webhook_secret_not_configured' }, { status: 503 })
        }
        const rawBody = await request.text()
        if (!(await verifyResendWebhook(request, rawBody))) return new Response('unauthorized', { status: 401 })
        let event: ResendEvent
        try {
          event = JSON.parse(rawBody) as ResendEvent
        } catch {
          return new Response('bad json', { status: 400 })
        }
        const emailId = event.data?.email_id
        if (!emailId) return Response.json({ ok: true, ignored: true })
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

        if (event.type !== 'email.received') {
          const now = new Date().toISOString()
          const status = event.type === 'email.delivered'
            ? 'delivered'
            : event.type === 'email.opened'
              ? 'read'
              : ['email.bounced', 'email.complained', 'email.failed'].includes(event.type || '')
                ? 'failed'
                : null
          if (status) {
            const patch: Record<string, unknown> = { status }
            if (status === 'delivered') patch.delivered_at = now
            if (status === 'read') patch.read_at = now
            if (status === 'failed') patch.failed_at = now
            const { data: outreachRow } = await supabaseAdmin
              .from('lead_outreach')
              .update(patch as never)
              .eq('provider_message_id', emailId)
              .select('lead_id, owner_id')
              .maybeSingle()
            if (outreachRow?.lead_id) {
              const { data: lead } = await supabaseAdmin
                .from('leads')
                .select('owner_id, assigned_to, contact_channels')
                .eq('id', outreachRow.lead_id)
                .maybeSingle()
              const channels = ((lead?.contact_channels as any) ?? {}) as Record<string, any>
              channels.email = {
                ...(channels.email ?? { available: true }),
                last_status: status,
                last_attempt_at: now,
              }
              await supabaseAdmin.from('leads').update({
                contact_channels: channels,
                ...(status === 'failed' ? { next_action_at: null } : {}),
                ...(event.type === 'email.complained' ? { opt_out: true, ai_paused: true } : {}),
              } as never).eq('id', outreachRow.lead_id)
              if (event.type === 'email.complained') {
                const actorId = lead?.assigned_to || lead?.owner_id || outreachRow.owner_id
                if (actorId) {
                  const { suppressLeadContactsInternal } = await import('@/lib/outreach.functions')
                  await suppressLeadContactsInternal(
                    { supabase: supabaseAdmin, userId: actorId, claims: { email: 'Resend' } },
                    outreachRow.lead_id,
                  )
                }
              } else if (status === 'failed') {
                const actorId = lead?.assigned_to || lead?.owner_id || outreachRow.owner_id
                if (actorId) {
                  const { triggerOutreachInternal } = await import('@/lib/outreach.functions')
                  await triggerOutreachInternal(
                    { supabase: supabaseAdmin, userId: actorId, claims: { email: 'Resend' } },
                    outreachRow.lead_id,
                  )
                }
              }
            }
          }
          return Response.json({ ok: true })
        }

        const apiKey = process.env.RESEND_API_KEY
        if (!apiKey) return Response.json({ ok: false, error: 'resend_not_configured' }, { status: 503 })
        const receivedResponse = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
          headers: { authorization: `Bearer ${apiKey}` },
        })
        if (!receivedResponse.ok) {
          return Response.json({ ok: false, error: `resend_${receivedResponse.status}` }, { status: 502 })
        }
        const received = (await receivedResponse.json()) as {
          from?: string
          subject?: string
          text?: string | null
          html?: string | null
        }
        const from = normalizeEmail(received.from || event.data?.from || '')
        if (!from) return Response.json({ ok: true, matched: false })
        const { data: leads } = await supabaseAdmin
          .from('leads')
          .select('id, owner_id, assigned_to, company, email, contact_channels, ai_paused')
          .ilike('email', from)
          .order('updated_at', { ascending: false })
          .limit(5)
        const lead = leads?.[0]
        if (!lead) return Response.json({ ok: true, matched: false })

        const providerMessageId = `resend-in-${emailId}`
        const text = (received.text || (received.html ? plainText(received.html) : '') || '[e-mail sem texto]').slice(0, 10_000)
        const now = new Date().toISOString()
        const { error: messageError } = await supabaseAdmin.from('lead_messages').insert({
          lead_id: lead.id,
          sender: 'client',
          sender_name: 'Cliente',
          type: 'client',
          text,
          sent_at: now,
          provider_message_id: providerMessageId,
        } as never)
        if (messageError?.code === '23505') return Response.json({ ok: true, dedup: true })
        if (messageError) return Response.json({ ok: false, error: messageError.message }, { status: 500 })

        const { data: lastOut } = await supabaseAdmin
          .from('lead_outreach')
          .select('id')
          .eq('lead_id', lead.id)
          .eq('channel', 'email')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (lastOut?.id) {
          await supabaseAdmin.from('lead_outreach').update({ status: 'replied', replied_at: now } as never).eq('id', lastOut.id)
        }
        const channels = ((lead.contact_channels as any) ?? {}) as Record<string, any>
        channels.email = { ...(channels.email ?? { available: true }), last_status: 'replied', last_attempt_at: now }
        const lower = text.toLowerCase()
        const optOut = ['parar', 'sair', 'não quero', 'nao quero', 'descadastrar', 'remover'].some((keyword) => lower.includes(keyword))
        const interest = ['humano', 'atendente', 'vendedor', 'orçamento', 'orcamento', 'proposta', 'reunião', 'reuniao', 'comprar', 'preço', 'preco', 'contrato'].some((keyword) => lower.includes(keyword))
        await supabaseAdmin.from('leads').update({
          contact_channels: channels,
          last_contact: now,
          next_action_at: null,
          ...(optOut ? { opt_out: true, ai_paused: true } : {}),
        } as never).eq('id', lead.id)

        const actorId = lead.assigned_to || lead.owner_id
        if (!actorId) return Response.json({ ok: true, matched: true, automation: 'no_owner' })
        const outreach = await import('@/lib/outreach.functions')
        const ctx = { supabase: supabaseAdmin, userId: actorId, claims: { email: 'Ana (IA)' } }
        if (optOut) {
          await outreach.suppressLeadContactsInternal(ctx, lead.id)
          return Response.json({ ok: true, matched: true, opt_out: true })
        }
        const delivery = { channel: 'email' as const, subject: received.subject || event.data?.subject, eventId: emailId }
        const automation = interest
          ? await outreach.handoffLeadInternal(ctx, lead.id, text, 'Interesse comercial detectado', false, delivery)
          : lead.ai_paused
            ? { ok: false, action: 'ignored', reason: 'ai_paused' }
            : await outreach.handleInboundWithAiInternal(ctx, lead.id, text, delivery)
        return Response.json({ ok: true, matched: true, automation })
      },
    },
  },
})
