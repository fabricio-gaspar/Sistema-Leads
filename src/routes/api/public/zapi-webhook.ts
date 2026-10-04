import { createFileRoute } from "@tanstack/react-router";

// Kept only to make a previously configured public URL fail closed. This branch
// deliberately has no Z-API operational path.
export const Route = createFileRoute("/api/public/zapi-webhook")({
  server: {
    handlers: {
      POST: async () =>
        new Response(JSON.stringify({ error: "provider_disabled", provider: "zapi" }), {
          status: 410,
          headers: { "content-type": "application/json" },
        }),
    },
  },
});
