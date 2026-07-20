import { createFileRoute } from '@tanstack/react-router'

// Endpoint mantido temporariamente para instalações antigas receberem uma
// resposta explícita. O único provedor WhatsApp suportado é a Z-API.
export const Route = createFileRoute('/api/public/evolution-webhook')({
  server: {
    handlers: {
      POST: async () =>
        Response.json(
          {
            ok: false,
            error: 'provider_disabled',
            message: 'Evolution foi desativada. Configure o webhook da Z-API.',
          },
          { status: 410 },
        ),
    },
  },
})
