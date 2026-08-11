/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { verifyMetaSignature } from "@/lib/instagram.functions";
import type { InboundMediaInput } from "@/lib/inbound-media.server";

type MetaEvent = {
  id: string;
  type: "message" | "comment" | "story" | "unknown";
  senderId: string;
  senderName?: string | null;
  text?: string | null;
  media: InboundMediaInput[];
  raw: unknown;
};

export const Route = createFileRoute("/api/public/meta-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        if (mode === "subscribe" && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
          return new Response(challenge || "", { status: 200 });
        }
        return new Response("forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const raw = await request.text();
        if (!(await verifyMetaSignature(request, raw)))
          return new Response("invalid signature", { status: 401 });
        const payload = JSON.parse(raw) as any;
        const events = parseMetaEvents(payload);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const organizationId = await resolveOrganization(supabaseAdmin);
        if (!organizationId)
          return Response.json(
            { ok: false, error: "meta_organization_not_configured" },
            { status: 503 },
          );

        const processed: string[] = [];
        const ignored: string[] = [];
        const failed: Array<{ id: string; error: string }> = [];
        for (const event of events) {
          try {
            const { data: stored, error: storeError } = await (supabaseAdmin as any)
              .from("channel_inbound_events")
              .insert({
                organization_id: organizationId,
                provider: "meta_instagram",
                event_type: event.type,
                external_id: event.id,
                payload: event.raw,
              } as never)
              .select("id")
              .maybeSingle();
            if (storeError?.code === "23505") {
              ignored.push(event.id);
              continue;
            }
            if (storeError) throw new Error(storeError.message);

            let { data: lead } = await supabaseAdmin
              .from("leads")
              .select("*")
              .eq("organization_id", organizationId)
              .eq("instagram_user_id", event.senderId)
              .maybeSingle();
            if (!lead) {
              const { data: created, error: createError } = await supabaseAdmin
                .from("leads")
                .insert({
                  organization_id: organizationId,
                  company: event.senderName || `Instagram ${event.senderId.slice(-8)}`,
                  contact: event.senderName || null,
                  instagram_user_id: event.senderId,
                  origin: `instagram:${event.type}`,
                  prospect_identity: `instagram:${event.senderId}`,
                  stage: "Prospecção",
                  owner: "ia",
                  contact_approval_status: "inbound",
                  contact_approved_at: new Date().toISOString(),
                  contact_approval_reason: "Contato iniciado pelo próprio cliente no Instagram.",
                  automation_status: "running",
                  automation_updated_at: new Date().toISOString(),
                  contact_channels: {
                    instagram: {
                      available: true,
                      last_status: "replied",
                      last_attempt_at: new Date().toISOString(),
                    },
                  },
                } as never)
                .select("*")
                .single();
              if (createError) throw new Error(createError.message);
              lead = created;
            }

            const mediaResults = [] as Array<{
              attachmentId: string | null;
              contextText: string;
              requiresHandoff: boolean;
              error?: string;
            }>;
            if (event.media.length) {
              const { processInboundMedia } = await import("@/lib/inbound-media.server");
              for (const media of event.media.slice(0, 3)) {
                mediaResults.push(
                  await processInboundMedia(
                    {
                      supabase: supabaseAdmin,
                      organizationId,
                      leadId: lead.id,
                      provider: "meta_instagram",
                      externalId: event.id,
                    },
                    media,
                  ),
                );
              }
            }
            const inboundText =
              [event.text?.trim(), ...mediaResults.map((result) => result.contextText)]
                .filter(Boolean)
                .join("\n") || `[${event.type} recebido pelo Instagram]`;
            const { data: messageRow, error: messageError } = await supabaseAdmin
              .from("lead_messages")
              .insert({
                organization_id: organizationId,
                lead_id: lead.id,
                sender: "client",
                sender_name: event.senderName || "Instagram",
                type: `instagram-${event.type}`,
                text: inboundText,
                provider_message_id: event.id,
                sent_at: new Date().toISOString(),
              } as never)
              .select("id")
              .single();
            if (messageError) throw new Error(messageError.message);
            const attachmentIds = mediaResults
              .map((result) => result.attachmentId)
              .filter((id): id is string => Boolean(id));
            if (attachmentIds.length && messageRow?.id) {
              const { linkAttachmentsToMessage } = await import("@/lib/inbound-media.server");
              await linkAttachmentsToMessage(supabaseAdmin, attachmentIds, messageRow.id);
            }
            const isConversation = event.type === "message" || event.type === "story";
            const normalizedInbound = inboundText.toLocaleLowerCase("pt-BR");
            const optOut =
              isConversation &&
              ["parar", "sair", "não quero", "nao quero", "descadastrar", "remover"].some(
                (keyword) => normalizedInbound.includes(keyword),
              );
            const actorId =
              lead.assigned_to ||
              lead.owner_id ||
              (await firstOrganizationUser(supabaseAdmin, organizationId));

            if (isConversation) {
              const channels = (lead.contact_channels as Record<string, unknown> | null) ?? {};
              await supabaseAdmin
                .from("leads")
                .update({
                  contact_channels: {
                    ...channels,
                    instagram: {
                      available: true,
                      last_status: "replied",
                      last_attempt_at: new Date().toISOString(),
                    },
                  },
                  last_contact: new Date().toISOString(),
                  next_action_at: null,
                  ...(optOut
                    ? { opt_out: true, ai_paused: true, automation_status: "paused" }
                    : {}),
                } as never)
                .eq("id", lead.id);
              const sequence = await import("@/lib/outreach-sequences.functions");
              if (optOut)
                await sequence.cancelEnrollmentInternal(supabaseAdmin, lead.id, "opt_out");
              else await sequence.pauseEnrollmentInternal(supabaseAdmin, lead.id, "client_reply");

              if (optOut && actorId) {
                const { suppressLeadContactsInternal } = await import("@/lib/outreach.functions");
                await suppressLeadContactsInternal(
                  { supabase: supabaseAdmin, userId: actorId, claims: { email: "Instagram" } },
                  lead.id,
                );
              }
            }
            await (supabaseAdmin as any)
              .from("channel_inbound_events")
              .update({
                lead_id: lead.id,
                status: "processed",
                processed_at: new Date().toISOString(),
              } as never)
              .eq("id", stored?.id ?? "");

            if (isConversation && !optOut) {
              const { handleInboundWithAiInternal, handoffLeadInternal } =
                await import("@/lib/outreach.functions");
              if (actorId) {
                const aiContext = {
                  supabase: supabaseAdmin,
                  userId: actorId,
                  claims: { email: "Instagram" },
                } as never;
                const unsafeMedia = mediaResults.find((result) => result.requiresHandoff);
                if (unsafeMedia) {
                  await handoffLeadInternal(
                    aiContext,
                    lead.id,
                    inboundText,
                    `Mídia do Instagram requer análise humana${unsafeMedia.error ? `: ${unsafeMedia.error}` : ""}`,
                    true,
                    { channel: "instagram", eventId: event.id },
                  );
                } else {
                  await handleInboundWithAiInternal(aiContext, lead.id, inboundText, {
                    channel: "instagram",
                    eventId: event.id,
                  });
                }
              }
            }
            processed.push(event.id);
          } catch (error) {
            failed.push({ id: event.id, error: (error as Error).message });
          }
        }
        return Response.json({ ok: failed.length === 0, processed, ignored, failed });
      },
    },
  },
});

function parseMetaEvents(payload: any): MetaEvent[] {
  const events: MetaEvent[] = [];
  for (const entry of payload?.entry ?? []) {
    for (const message of entry.messaging ?? []) {
      const senderId = String(message.sender?.id || "");
      const messageId = String(
        message.message?.mid || `${entry.id}:${message.timestamp || Date.now()}:${senderId}`,
      );
      if (!senderId || message.message?.is_echo) continue;
      const story = Boolean(
        message.message?.reply_to?.story ||
        message.message?.attachments?.some((item: any) => item.type === "story_mention"),
      );
      events.push({
        id: messageId,
        type: story ? "story" : "message",
        senderId,
        text: message.message?.text || null,
        media: parseMetaAttachments(message.message?.attachments),
        raw: message,
      });
    }
    for (const change of entry.changes ?? []) {
      const value = change.value || {};
      const senderId = String(value.from?.id || value.sender_id || "");
      const id = String(
        value.id ||
          value.comment_id ||
          `${entry.id}:${change.field}:${senderId}:${value.created_time || Date.now()}`,
      );
      if (!senderId) continue;
      events.push({
        id,
        type:
          change.field === "comments" || change.field === "feed"
            ? "comment"
            : change.field === "story_insights"
              ? "story"
              : "unknown",
        senderId,
        senderName: value.from?.username || value.from?.name || null,
        text: value.text || value.message || null,
        media: [],
        raw: change,
      });
    }
  }
  return events;
}

function parseMetaAttachments(attachments: any[] | undefined): InboundMediaInput[] {
  return (attachments ?? []).flatMap((attachment) => {
    const url = attachment?.payload?.url || attachment?.url;
    if (!url) return [];
    const rawType = String(attachment?.type || "document").toLowerCase();
    const mediaType: InboundMediaInput["mediaType"] =
      rawType.includes("image") || rawType.includes("photo")
        ? "image"
        : rawType.includes("audio")
          ? "audio"
          : rawType.includes("video")
            ? "video"
            : "document";
    return [
      {
        mediaType,
        url,
        mimeType: attachment?.payload?.mime_type || null,
        fileName: attachment?.payload?.name || `${mediaType}-instagram`,
      },
    ];
  });
}

async function resolveOrganization(supabase: any): Promise<string | null> {
  if (process.env.META_ORGANIZATION_ID) return process.env.META_ORGANIZATION_ID;
  const { data } = await supabase.from("organizations").select("id").limit(2);
  return data?.length === 1 ? data[0].id : null;
}

async function firstOrganizationUser(
  supabase: any,
  organizationId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data?.user_id ?? null;
}
