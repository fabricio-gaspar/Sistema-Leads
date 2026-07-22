import { createFileRoute } from '@tanstack/react-router'
import { captureInboundLeadInternal, type InboundLeadInput } from '@/lib/commercial.functions'

type CapturePayload = InboundLeadInput & {
  honeypot?: string
  turnstile_token?: string
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function sign(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return false
  const configured = (process.env.CAPTURE_FORM_ALLOWED_ORIGINS || '')
    .split(',').map((value) => value.trim()).filter(Boolean)
  if (configured.includes(origin)) return true
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

async function verifyTurnstile(token: string, request: Request) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret || !token) return false
  const form = new FormData()
  form.set('secret', secret)
  form.set('response', token)
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]
  if (ip) form.set('remoteip', ip)
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: form,
  })
  if (!response.ok) return false
  const result = await response.json() as { success?: boolean }
  return Boolean(result.success)
}

export const Route = createFileRoute('/api/public/lead-capture')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text()
        let payload: CapturePayload
        try {
          payload = JSON.parse(rawBody) as CapturePayload
        } catch {
          return Response.json({ ok: false, error: 'bad_json' }, { status: 400 })
        }
        if (payload.honeypot) return Response.json({ ok: true, ignored: true })
        const sharedSecret = process.env.LEAD_CAPTURE_WEBHOOK_SECRET
        const signature = request.headers.get('x-lead-capture-signature')
        const signedWebhook = Boolean(sharedSecret && signature && safeEqual(signature, await sign(sharedSecret, rawBody)))
        const publicForm = payload.source === 'public_form'
        if (!signedWebhook) {
          if (!publicForm || !allowedOrigin(request) || !(await verifyTurnstile(payload.turnstile_token || '', request))) {
            return Response.json({ ok: false, error: 'capture_not_authorized' }, { status: 401 })
          }
        }
        if (!payload.company?.trim()) return Response.json({ ok: false, error: 'company_required' }, { status: 422 })
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        try {
          const result = await captureInboundLeadInternal(supabaseAdmin, payload)
          return Response.json({ ok: true, ...result }, { status: result.duplicate ? 200 : 201 })
        } catch (error) {
          console.error('[lead-capture]', (error as Error).message)
          return Response.json({ ok: false, error: 'capture_failed' }, { status: 500 })
        }
      },
    },
  },
})
