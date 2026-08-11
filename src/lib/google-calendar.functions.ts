import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'


import type { Database } from '@/integrations/supabase/types'
import { getRequest } from '@tanstack/react-start/server'


const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_calendar";
const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.events.freebusy",
];

function clientKey(): string {
  const key = process.env.GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY;
  if (!key) {
    throw new Error(
      "Google Calendar não está configurado no workspace. Peça a um admin para conectar o cliente App User em Workspace Settings → App User Connectors.",
    );
  }
  return key;
}

export const startGoogleCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context;
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const request = getRequest();
    if (!request) throw new Error("Contexto de requisição indisponível.");
    const returnUrl = new URL("/oauth/google-calendar/return", request.url).toString();
    const existing = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey: clientKey(),
      returnUrl,
      connectionAPIKey: existing ?? undefined,
      credentialsConfiguration: { scopes: SCOPES },
    });
    return { authorizationUrl };
  });

export const completeGoogleCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => z.object({ code: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context;
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector");
    const { saveConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY_BASE_URL, data.code);
    if (connectorId !== CONNECTOR_ID) throw new Error("Conector inesperado na troca de código");
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey);
    return { ok: true };
  });

export const getGoogleCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context;
    const configured = Boolean(process.env.GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY);
    if (!configured) return { configured: false, connected: false, email: null as string | null };
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!key) return { configured: true, connected: false, email: null as string | null };
    // Fetch profile for display
    try {
      const { callAsAppUser } = await import("@/integrations/lovable/appUserConnector");
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: CONNECTOR_ID,
        path: "/oauth2/v2/userinfo",
      });
      if (res.ok) {
        const info = (await res.json()) as { email?: string };
        return { configured: true, connected: true, email: info.email ?? null };
      }
    } catch (err) {
      console.error("[google_calendar] userinfo failed", err);
    }
    return { configured: true, connected: true, email: null as string | null };
  });

export const disconnectGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context;
    const { getConnectionKeyForUser, deleteConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (key) {
      try {
        await disconnectAppUser({ gatewayBaseUrl: GATEWAY_BASE_URL, connectionAPIKey: key, connectorId: CONNECTOR_ID });
      } catch (err) {
        console.error("[google_calendar] disconnect gateway failed", err);
      }
    }
    await deleteConnectionKeyForUser(context.userId, CONNECTOR_ID);
    return { ok: true };
  });

const syncInput = z.object({ appointment_id: z.string().uuid() });

export const checkGoogleAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime(),
    timezone: z.string().min(1).max(100).default("America/Sao_Paulo"),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!key) return { connected: false, available: null as boolean | null, busy: [] as Array<{ start: string; end: string }> };
    const { callAsAppUser } = await import("@/integrations/lovable/appUserConnector");
    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey: key,
      connectorId: CONNECTOR_ID,
      path: "/calendar/v3/freeBusy",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          timeMin: data.starts_at,
          timeMax: data.ends_at,
          timeZone: data.timezone,
          items: [{ id: "primary" }],
        }),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google Calendar indisponível (${res.status}): ${body.slice(0, 200)}`);
    }
    const payload = await res.json() as { calendars?: { primary?: { busy?: Array<{ start: string; end: string }> } } };
    const busy = payload.calendars?.primary?.busy ?? [];
    return { connected: true, available: busy.length === 0, busy };
  });

export const syncAppointmentToGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => syncInput.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context;
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!key) throw new Error("Conecte seu Google Calendar antes de sincronizar.");

    const { supabase } = context;
    const { data: appt, error } = await supabase
      .from("appointments")
      .select("id, title, starts_at, ends_at, notes, provider, external_id, lead_id")
      .eq("id", data.appointment_id)
      .maybeSingle();
    if (error) throw error;
    if (!appt) throw new Error("Reunião não encontrada");

    const { data: lead } = await supabase
      .from("leads")
      .select("company, email, contact")
      .eq("id", appt.lead_id)
      .maybeSingle();

    const startISO = new Date(appt.starts_at).toISOString();
    const endISO = new Date(appt.ends_at ?? new Date(new Date(appt.starts_at).getTime() + 30 * 60 * 1000)).toISOString();
    const attendees: Array<{ email: string }> = [];
    if (lead?.email) attendees.push({ email: lead.email });

    const body = {
      summary: appt.title,
      description: appt.notes ?? (lead?.company ? `Reunião com ${lead.company}` : undefined),
      start: { dateTime: startISO },
      end: { dateTime: endISO },
      attendees,
    };

    const { callAsAppUser } = await import("@/integrations/lovable/appUserConnector");
    const isUpdate = appt.provider === "google_calendar" && appt.external_id;
    const path = isUpdate
      ? `/calendar/v3/calendars/primary/events/${encodeURIComponent(appt.external_id as string)}`
      : `/calendar/v3/calendars/primary/events`;

    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey: key,
      connectorId: CONNECTOR_ID,
      path,
      init: {
        method: isUpdate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Calendar error (${res.status}): ${text.slice(0, 300)}`);
    }
    const created = (await res.json()) as { id?: string; htmlLink?: string };

    await supabase
      .from("appointments")
      .update({
        provider: "google_calendar",
        external_id: created.id ?? appt.external_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appt.id);

    return { ok: true, event_id: created.id, html_link: created.htmlLink ?? null };
  });
