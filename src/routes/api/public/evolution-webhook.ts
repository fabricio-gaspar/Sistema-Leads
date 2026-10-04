import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

/* Evolution payloads are provider-defined JSON and intentionally normalized at runtime. */
/* eslint-disable @typescript-eslint/no-explicit-any */
function equalSecrets(expected: string, received: string | null): boolean {
  if (!received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

function eventIdentifier(payload: any): string | null {
  const value =
    payload?.eventId ??
    payload?.event_id ??
    payload?.id ??
    payload?.data?.id ??
    payload?.data?.Info?.ID ??
    null;
  return typeof value === "string" && value ? value : null;
}

function instanceIdentifier(payload: any): string | null {
  const value =
    payload?.instanceId ??
    payload?.instance_id ??
    payload?.instanceName ??
    payload?.instance_name ??
    payload?.instance?.id ??
    payload?.instance?.name ??
    payload?.data?.instanceId ??
    payload?.data?.instanceName ??
    null;
  return typeof value === "string" && value ? value : null;
}

function connectionState(
  payload: any,
): "connected" | "awaiting_connection" | "disconnected" | null {
  const data = payload?.data ?? payload;
  if (data?.connected === true && data?.loggedIn === true) return "connected";
  if (data?.connected === true) return "awaiting_connection";
  if (data?.connected === false) return "disconnected";
  return null;
}

export const Route = createFileRoute("/api/public/evolution-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.EVOLUTION_WEBHOOK_SECRET;
        const received = new URL(request.url).searchParams.get("token");
        if (!expected || !equalSecrets(expected, received)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const identifier = instanceIdentifier(payload);
        if (!identifier) {
          return new Response(JSON.stringify({ error: "instance_identifier_missing" }), {
            status: 422,
            headers: { "content-type": "application/json" },
          });
        }

        try {
          const [{ supabaseAdmin }, evolution] = await Promise.all([
            import("@/integrations/supabase/client.server"),
            import("@/server/evolution-go.server"),
          ]);
          const instance = await evolution.findEvolutionInstanceByIdentifier(
            supabaseAdmin,
            identifier,
          );
          if (!instance) {
            return new Response(JSON.stringify({ error: "instance_not_registered" }), {
              status: 404,
              headers: { "content-type": "application/json" },
            });
          }

          const eventPayload = payload as Record<string, unknown>;
          const eventType = String(
            eventPayload.event ?? eventPayload.eventType ?? eventPayload.type ?? "unknown",
          );
          const event = await evolution.recordEvolutionWebhookEvent({
            admin: supabaseAdmin,
            instance,
            providerEventId: eventIdentifier(payload),
            eventType,
            payload,
          });
          if (event.duplicate) {
            return new Response(JSON.stringify({ ok: true, duplicate: true }), {
              headers: { "content-type": "application/json" },
            });
          }

          const state = connectionState(payload);
          if (state) {
            await (supabaseAdmin as any)
              .from("evolution_instances")
              .update({
                connection_status: state,
                last_error: null,
                last_healthcheck_at: new Date().toISOString(),
              })
              .eq("id", instance.id);
          }
          await evolution.processEvolutionInboundMessage({
            admin: supabaseAdmin,
            instance,
            payload,
          });
          if (event.id) await evolution.completeEvolutionWebhookEvent(supabaseAdmin, event.id);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { "content-type": "application/json" },
          });
        } catch (error) {
          console.error(
            "[evolution-webhook] processing failure",
            error instanceof Error ? error.message : "unknown",
          );
          return new Response(JSON.stringify({ error: "processing_failed" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
