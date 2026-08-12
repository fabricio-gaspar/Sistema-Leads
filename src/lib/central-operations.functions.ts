/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const leadIdSchema = z.object({ lead_id: z.string().uuid() });
const database = (context: { supabase: unknown }): any => context.supabase;

export const getCentralOperations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => leadIdSchema.parse(value))
  .handler(async ({ data, context }) => {
    const db = database(context);
    const { data: ticket, error: ticketError } = await db
      .from("tickets")
      .select("*")
      .eq("lead_id", data.lead_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ticketError) throw new Error(ticketError.message);

    const [departments, queues, tags, replies, notes, selectedTags, calls] = await Promise.all([
      db.from("departments").select("*").eq("active", true).order("name"),
      db.from("service_queues").select("*").eq("active", true).order("name"),
      db.from("tags").select("*").order("name"),
      db.from("quick_replies").select("*").eq("active", true).order("shortcut"),
      ticket
        ? db
            .from("ticket_notes")
            .select("*")
            .eq("ticket_id", ticket.id)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null }),
      ticket
        ? db.from("ticket_tags").select("tag_id").eq("ticket_id", ticket.id)
        : Promise.resolve({ data: [], error: null }),
      db
        .from("call_records")
        .select("*")
        .eq("lead_id", data.lead_id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    for (const result of [departments, queues, tags, replies, notes, selectedTags, calls]) {
      if (result.error) throw new Error(result.error.message);
    }
    return {
      ticket,
      departments: departments.data ?? [],
      queues: queues.data ?? [],
      tags: tags.data ?? [],
      quickReplies: replies.data ?? [],
      notes: notes.data ?? [],
      selectedTagIds: (selectedTags.data ?? []).map((row: any) => row.tag_id as string),
      calls: calls.data ?? [],
    };
  });

export const listLeadAttachments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => leadIdSchema.parse(value))
  .handler(async ({ data, context }) => {
    const db = database(context);
    const { data: rows, error } = await db
      .from("message_attachments")
      .select(
        "id, message_id, media_type, mime_type, file_name, storage_path, transcript, extracted_text, created_at",
      )
      .eq("lead_id", data.lead_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return await Promise.all(
      (rows ?? []).map(async (row: any) => {
        if (!row.storage_path) return { ...row, signed_url: null };
        const { data: signed, error: signedError } = await context.supabase.storage
          .from("message-media")
          .createSignedUrl(row.storage_path, 900);
        return { ...row, signed_url: signedError ? null : (signed?.signedUrl ?? null) };
      }),
    );
  });

const ticketUpdateSchema = z.object({
  ticket_id: z.string().uuid(),
  status: z.enum(["open", "waiting_customer", "waiting_agent", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  department_id: z.string().uuid().nullable().optional(),
  queue_id: z.string().uuid().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
});

export const updateCentralTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => ticketUpdateSchema.parse(value))
  .handler(async ({ data, context }) => {
    const { ticket_id, ...values } = data;
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { ...values };
    if (values.status === "resolved") patch.resolved_at = now;
    if (values.status === "closed") patch.closed_at = now;
    if (values.assigned_to) patch.first_response_at = now;
    const db = database(context);
    const { data: ticket, error } = await db
      .from("tickets")
      .update(patch as never)
      .eq("id", ticket_id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (values.assigned_to) {
      await db.from("leads").update({ assigned_to: values.assigned_to }).eq("id", ticket.lead_id);
    }
    await audit(context, "ticket_updated", `${ticket.protocol}: ${Object.keys(values).join(", ")}`);
    return ticket;
  });

export const addInternalNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z
      .object({
        ticket_id: z.string().uuid(),
        body: z.string().trim().min(1).max(5000),
      })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    const { data: note, error } = await database(context)
      .from("ticket_notes")
      .insert({
        ticket_id: data.ticket_id,
        author_id: context.userId,
        body: data.body,
      } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await audit(context, "ticket_note_created", `Nota interna no ticket ${data.ticket_id}`);
    return note;
  });

export const toggleCentralTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z
      .object({
        ticket_id: z.string().uuid(),
        tag_id: z.string().uuid(),
        active: z.boolean(),
      })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    if (data.active) {
      const { error } = await database(context)
        .from("ticket_tags")
        .upsert(
          {
            ticket_id: data.ticket_id,
            tag_id: data.tag_id,
          } as never,
          { onConflict: "ticket_id,tag_id" },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await database(context)
        .from("ticket_tags")
        .delete()
        .eq("ticket_id", data.ticket_id)
        .eq("tag_id", data.tag_id);
      if (error) throw new Error(error.message);
    }
    await audit(
      context,
      data.active ? "ticket_tag_added" : "ticket_tag_removed",
      `Ticket ${data.ticket_id}`,
    );
    return { ok: true };
  });

export const startVoipCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z
      .object({
        lead_id: z.string().uuid(),
        ticket_id: z.string().uuid().nullable().optional(),
        record: z.boolean().default(false),
        recording_consent: z.boolean().default(false),
      })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    if (data.record && !data.recording_consent) {
      throw new Error("Confirme o consentimento antes de gravar a chamada.");
    }
    const db = database(context);
    const { data: settings } = await db
      .from("company_settings")
      .select("sandbox_mode")
      .limit(1)
      .maybeSingle();
    const sandbox = settings?.sandbox_mode === true;
    const { data: lead, error: leadError } = await db
      .from("leads")
      .select("id, company, phone")
      .eq("id", data.lead_id)
      .maybeSingle();
    if (leadError) throw new Error(leadError.message);
    if (!lead?.phone) throw new Error("O lead não possui telefone cadastrado.");

    const { data: call, error } = await db
      .from("call_records")
      .insert({
        lead_id: lead.id,
        ticket_id: data.ticket_id ?? null,
        provider: sandbox ? "sandbox" : process.env.VOIP_PROVIDER || "generic",
        direction: "outbound",
        status: sandbox ? "completed" : process.env.VOIP_API_URL && process.env.VOIP_API_TOKEN ? "queued" : "failed",
        recording_consent: data.recording_consent,
        created_by: context.userId,
      } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (sandbox) {
      const externalId = `sandbox-call-${call.id}`;
      await db
        .from("call_records")
        .update({ external_id: externalId, status: "completed", ended_at: new Date().toISOString() })
        .eq("id", call.id);
      await audit(context, "voip_call_simulated", `${lead.company} · chamada de teste`);
      return { ok: true, call_id: call.id, external_id: externalId, sandbox: true };
    }

    if (!process.env.VOIP_API_URL || !process.env.VOIP_API_TOKEN) {
      throw new Error(
        "Provedor VoIP ainda não configurado. A tentativa foi registrada no histórico.",
      );
    }
    const response = await fetch(process.env.VOIP_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.VOIP_API_TOKEN}`,
      },
      body: JSON.stringify({
        to: lead.phone,
        lead_id: lead.id,
        call_id: call.id,
        record: data.record,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      call_id?: string;
      error?: string;
    };
    if (!response.ok) {
      await db.from("call_records").update({ status: "failed" }).eq("id", call.id);
      throw new Error(payload.error || `VoIP HTTP ${response.status}`);
    }
    const externalId = payload.id || payload.call_id || null;
    await db
      .from("call_records")
      .update({ external_id: externalId, status: "ringing" })
      .eq("id", call.id);
    await audit(context, "voip_call_started", `${lead.company} · ${lead.phone}`);
    return { ok: true, call_id: call.id, external_id: externalId };
  });

async function audit(
  context: { supabase: any; userId: string; claims?: any },
  action: string,
  detail: string,
) {
  const { error } = await database(context)
    .from("audit_logs")
    .insert({
      actor_id: context.userId,
      actor_name: context.claims?.email ?? "Usuário",
      actor_type: "human",
      action,
      detail,
    } as never);
  if (error) console.error("[central_audit]", error.message);
}
