import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* Evolution-specific tables are typed after the deployment migration runs. */
/* eslint-disable @typescript-eslint/no-explicit-any */
const configurationSchema = z.object({
  channelName: z.string().trim().min(2).max(120),
  serverUrl: z.string().trim().url(),
  globalApiKey: z.string().trim().min(12).max(2048).optional().or(z.literal("")),
});

const memberIdSchema = z.object({ userId: z.string().uuid() });

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function modules() {
  return import("@/server/evolution-go.server");
}

async function webhookUrl(): Promise<string> {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("EVOLUTION_WEBHOOK_SECRET não está configurado com segurança no servidor.");
  }
  const configured = process.env.PUBLIC_SITE_URL ?? process.env.SITE_URL;
  let origin: string | null = null;
  if (configured) {
    const url = new URL(configured);
    if (url.protocol === "https:") origin = url.origin;
  }
  if (!origin) {
    const request = getRequest();
    const url = new URL(request.url);
    if (url.protocol !== "https:")
      throw new Error("A URL pública do sistema precisa usar HTTPS para receber webhooks.");
    origin = url.origin;
  }
  return `${origin}/api/public/evolution-webhook?token=${encodeURIComponent(secret)}`;
}

export const getEvolutionGoConfiguration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await adminClient();
    const evolution = await modules();
    const membership = await evolution.assertEvolutionAdmin(admin, context.userId);
    return evolution.getEvolutionConfiguration(admin, membership.organization_id);
  });

export const saveEvolutionGoConfiguration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => configurationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    const evolution = await modules();
    const membership = await evolution.assertEvolutionAdmin(admin, context.userId);
    const configuration = await evolution.saveEvolutionConfiguration(admin, {
      organizationId: membership.organization_id,
      channelName: data.channelName,
      serverUrl: data.serverUrl,
      globalApiKey: data.globalApiKey,
      actorId: context.userId,
    });
    await evolution.provisionPendingEvolutionInstances(admin, membership.organization_id);
    return configuration;
  });

export const listEvolutionInstances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await adminClient();
    const evolution = await modules();
    const membership = await evolution.assertEvolutionAdmin(admin, context.userId);
    const { data: instances, error } = await (admin as any)
      .from("evolution_instances")
      .select(
        "id, owner_user_id, channel_name, instance_name, external_instance_id, connection_status, phone_e164, last_healthcheck_at, last_error, created_at",
      )
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const ownerIds = (instances ?? []).map(
      (instance: { owner_user_id: string }) => instance.owner_user_id,
    );
    const { data: profiles, error: profilesError } = ownerIds.length
      ? await (admin as any).from("profiles").select("id, name, email").in("id", ownerIds)
      : { data: [], error: null };
    if (profilesError) throw new Error(profilesError.message);
    const people = new Map(
      (profiles ?? []).map((profile: { id: string; name: string | null; email: string | null }) => [
        profile.id,
        profile,
      ]),
    );
    return (instances ?? []).map((instance: { owner_user_id: string }) => ({
      ...instance,
      owner: people.get(instance.owner_user_id) ?? null,
    }));
  });

export const provisionEvolutionInstanceForMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => memberIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    const evolution = await modules();
    const membership = await evolution.assertEvolutionAdmin(admin, context.userId);
    const { data: target, error } = await (admin as any)
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", membership.organization_id)
      .eq("user_id", data.userId)
      .eq("active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!target) throw new Error("Usuário não pertence à organização ativa.");
    const { data: profile, error: profileError } = await (admin as any)
      .from("profiles")
      .select("name")
      .eq("id", target.user_id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    return evolution.provisionEvolutionInstance({
      admin,
      organizationId: membership.organization_id,
      ownerUserId: target.user_id,
      ownerName: profile?.name ?? null,
    });
  });

export const getMyEvolutionInstance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await adminClient();
    const evolution = await modules();
    const membership = await evolution.getActiveMembership(admin, context.userId);
    return evolution.loadInstanceForUser(admin, membership.organization_id, context.userId);
  });

async function myInstance(context: { userId: string }) {
  const admin = await adminClient();
  const evolution = await modules();
  const membership = await evolution.getActiveMembership(admin, context.userId);
  const instance = await evolution.loadInstanceForUser(
    admin,
    membership.organization_id,
    context.userId,
  );
  if (!instance) throw new Error("Sua instância Evolution GO ainda não foi provisionada.");
  return { admin, evolution, instance };
}

export const refreshMyEvolutionInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const current = await myInstance(context);
    return current.evolution.refreshEvolutionInstance(current.admin, current.instance);
  });

export const connectMyEvolutionInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const current = await myInstance(context);
    return current.evolution.connectEvolutionInstance({
      admin: current.admin,
      instance: current.instance,
      webhookUrl: await webhookUrl(),
    });
  });

export const getMyEvolutionQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const current = await myInstance(context);
    return current.evolution.getEvolutionQr(current.admin, current.instance);
  });

export const disconnectMyEvolutionInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const current = await myInstance(context);
    return current.evolution.disconnectEvolutionInstance(current.admin, current.instance);
  });
