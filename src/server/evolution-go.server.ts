import { randomUUID } from "node:crypto";
import { decryptEvolutionSecret, encryptEvolutionSecret } from "@/server/evolution-crypto.server";

/*
 * The Evolution tables are introduced by this branch's migration. Until that
 * migration is applied, generated Supabase types cannot describe them. This
 * is a server-only boundary; regenerate the database types after deployment.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type AdminClient = any;

export type EvolutionConfiguration = {
  organizationId: string;
  channelName: string;
  serverUrl: string;
  active: boolean;
  configuredAt: string | null;
};

export type EvolutionInstance = {
  id: string;
  organization_id: string;
  owner_user_id: string;
  channel_name: string;
  instance_name: string;
  external_instance_id: string | null;
  connection_status: string;
  phone_e164: string | null;
  last_healthcheck_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type Membership = {
  organization_id: string;
  role: "administrador" | "vendedor" | "sdr" | "cx";
  active: boolean;
};

type RequestOptions = {
  serverUrl: string;
  apiKey: string;
  path: string;
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
};

function db(admin: AdminClient) {
  return admin as any;
}

function normalizeServerUrl(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== "https:")
    throw new Error("A URL do servidor Evolution GO precisa usar HTTPS.");
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      "A URL do servidor Evolution GO não pode conter credenciais, query string ou fragmento.",
    );
  }
  return url.toString().replace(/\/$/, "");
}

function compactError(status: number): Error {
  return new Error(
    `A Evolution GO recusou a operação (HTTP ${status}). Verifique a configuração ou o estado da instância.`,
  );
}

async function evolutionRequest<T = any>({
  serverUrl,
  apiKey,
  path,
  method = "GET",
  body,
}: RequestOptions): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${serverUrl}${path}`, {
      method,
      headers: {
        apikey: apiKey,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.error) throw compactError(response.status);
    return payload as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("A Evolution GO demorou demais para responder. Tente novamente.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function instanceNameFor(
  organizationId: string,
  ownerUserId: string,
  name?: string | null,
): string {
  const label =
    (name ?? "usuario")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 20) || "usuario";
  return `crm-${label}-${organizationId.slice(0, 6)}-${ownerUserId.slice(0, 8)}`;
}

function responseData(payload: any): any {
  return payload?.data ?? payload?.instance ?? payload ?? {};
}

function providerMessageId(payload: any): string | undefined {
  const data = responseData(payload);
  return data?.Info?.ID ?? data?.info?.id ?? data?.id ?? payload?.id ?? undefined;
}

function providerInstanceId(payload: any): string | null {
  const data = responseData(payload);
  const value = data?.id ?? data?.instanceId ?? data?.instance_id ?? payload?.id ?? null;
  return typeof value === "string" && value ? value : null;
}

function providerInstanceName(payload: any): string | null {
  const data = responseData(payload);
  const value = data?.name ?? data?.instanceName ?? data?.instance_name ?? null;
  return typeof value === "string" && value ? value : null;
}

export async function getActiveMembership(admin: AdminClient, userId: string): Promise<Membership> {
  const { data, error } = await db(admin)
    .from("organization_members")
    .select("organization_id, role, active")
    .eq("user_id", userId)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Seu usuário não possui uma organização ativa.");
  return data as Membership;
}

export async function assertEvolutionAdmin(
  admin: AdminClient,
  userId: string,
): Promise<Membership> {
  const membership = await getActiveMembership(admin, userId);
  if (membership.role !== "administrador") throw new Error("Acesso restrito a administradores.");
  return membership;
}

export async function getEvolutionConfiguration(
  admin: AdminClient,
  organizationId: string,
): Promise<EvolutionConfiguration | null> {
  const { data, error } = await db(admin)
    .from("evolution_go_configurations")
    .select("organization_id, channel_name, server_url, active, configured_at")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    organizationId: data.organization_id,
    channelName: data.channel_name,
    serverUrl: data.server_url,
    active: data.active,
    configuredAt: data.configured_at,
  };
}

async function getEvolutionCredentials(
  admin: AdminClient,
  organizationId: string,
): Promise<{ configuration: EvolutionConfiguration; globalApiKey: string }> {
  const configuration = await getEvolutionConfiguration(admin, organizationId);
  if (!configuration?.active)
    throw new Error("A Evolution GO ainda não foi configurada para esta organização.");
  const { data, error } = await db(admin)
    .from("evolution_go_credentials")
    .select("global_api_key_encrypted")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.global_api_key_encrypted)
    throw new Error("A chave global da Evolution GO não está disponível.");
  return { configuration, globalApiKey: decryptEvolutionSecret(data.global_api_key_encrypted) };
}

export async function saveEvolutionConfiguration(
  admin: AdminClient,
  input: {
    organizationId: string;
    channelName: string;
    serverUrl: string;
    globalApiKey?: string;
    actorId: string;
  },
): Promise<EvolutionConfiguration> {
  const serverUrl = normalizeServerUrl(input.serverUrl);
  const channelName = input.channelName.trim();
  const globalApiKey = input.globalApiKey?.trim() ?? "";
  if (!channelName) throw new Error("Informe o nome do canal.");

  const now = new Date().toISOString();
  const { error: configError } = await db(admin).from("evolution_go_configurations").upsert(
    {
      organization_id: input.organizationId,
      channel_name: channelName,
      server_url: serverUrl,
      active: true,
      configured_by: input.actorId,
      configured_at: now,
    },
    { onConflict: "organization_id" },
  );
  if (configError) throw new Error(configError.message);

  if (globalApiKey) {
    const { error: credentialError } = await db(admin)
      .from("evolution_go_credentials")
      .upsert(
        {
          organization_id: input.organizationId,
          global_api_key_encrypted: encryptEvolutionSecret(globalApiKey),
          key_version: 1,
        },
        { onConflict: "organization_id" },
      );
    if (credentialError) throw new Error(credentialError.message);
  } else {
    const { data: existingCredential, error: credentialReadError } = await db(admin)
      .from("evolution_go_credentials")
      .select("organization_id")
      .eq("organization_id", input.organizationId)
      .maybeSingle();
    if (credentialReadError) throw new Error(credentialReadError.message);
    if (!existingCredential)
      throw new Error("Informe a chave global da Evolution GO na primeira configuração.");
  }

  const configuration = await getEvolutionConfiguration(admin, input.organizationId);
  if (!configuration) throw new Error("Não foi possível confirmar a configuração da Evolution GO.");
  return configuration;
}

async function getInstanceToken(admin: AdminClient, instanceId: string): Promise<string> {
  const { data, error } = await db(admin)
    .from("evolution_instance_credentials")
    .select("instance_token_encrypted")
    .eq("evolution_instance_id", instanceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.instance_token_encrypted)
    throw new Error("A credencial da instância Evolution GO não está disponível.");
  return decryptEvolutionSecret(data.instance_token_encrypted);
}

export async function loadInstanceForUser(
  admin: AdminClient,
  organizationId: string,
  ownerUserId: string,
): Promise<EvolutionInstance | null> {
  const { data, error } = await db(admin)
    .from("evolution_instances")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EvolutionInstance | null) ?? null;
}

export async function provisionEvolutionInstance(input: {
  admin: AdminClient;
  organizationId: string;
  ownerUserId: string;
  ownerName?: string | null;
}): Promise<EvolutionInstance> {
  const existing = await loadInstanceForUser(input.admin, input.organizationId, input.ownerUserId);
  if (existing?.external_instance_id) return existing;

  const configuration = await getEvolutionConfiguration(input.admin, input.organizationId);
  const instanceName =
    existing?.instance_name ??
    instanceNameFor(input.organizationId, input.ownerUserId, input.ownerName);
  const channelName = configuration?.channelName ?? "WhatsApp Evolution GO";

  if (!configuration?.active) {
    const { data, error } = await db(input.admin)
      .from("evolution_instances")
      .upsert(
        {
          id: existing?.id,
          organization_id: input.organizationId,
          owner_user_id: input.ownerUserId,
          channel_name: channelName,
          instance_name: instanceName,
          connection_status: "pending_configuration",
          last_error: "Aguardando configuração da Evolution GO pela organização.",
        },
        { onConflict: "organization_id,owner_user_id" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as EvolutionInstance;
  }

  const instanceToken = existing ? await getInstanceToken(input.admin, existing.id) : randomUUID();
  const { data: stored, error: storeError } = await db(input.admin)
    .from("evolution_instances")
    .upsert(
      {
        id: existing?.id,
        organization_id: input.organizationId,
        owner_user_id: input.ownerUserId,
        channel_name: configuration.channelName,
        instance_name: instanceName,
        connection_status: "provisioning",
        last_error: null,
      },
      { onConflict: "organization_id,owner_user_id" },
    )
    .select()
    .single();
  if (storeError) throw new Error(storeError.message);

  const { error: tokenError } = await db(input.admin)
    .from("evolution_instance_credentials")
    .upsert(
      {
        evolution_instance_id: stored.id,
        instance_token_encrypted: encryptEvolutionSecret(instanceToken),
        key_version: 1,
      },
      { onConflict: "evolution_instance_id" },
    );
  if (tokenError) throw new Error(tokenError.message);

  try {
    const { globalApiKey } = await getEvolutionCredentials(input.admin, input.organizationId);
    const created = await evolutionRequest({
      serverUrl: configuration.serverUrl,
      apiKey: globalApiKey,
      path: "/instance/create",
      method: "POST",
      body: { name: instanceName, token: instanceToken },
    });
    const { data, error } = await db(input.admin)
      .from("evolution_instances")
      .update({
        external_instance_id: providerInstanceId(created),
        instance_name: providerInstanceName(created) ?? instanceName,
        connection_status: "awaiting_connection",
        last_error: null,
      })
      .eq("id", stored.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as EvolutionInstance;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao provisionar a instância Evolution GO.";
    const { data, error: updateError } = await db(input.admin)
      .from("evolution_instances")
      .update({ connection_status: "error", last_error: message })
      .eq("id", stored.id)
      .select()
      .single();
    if (updateError) throw new Error(updateError.message);
    return data as EvolutionInstance;
  }
}

export async function provisionPendingEvolutionInstances(
  admin: AdminClient,
  organizationId: string,
): Promise<void> {
  const { data: instances, error } = await db(admin)
    .from("evolution_instances")
    .select("owner_user_id")
    .eq("organization_id", organizationId)
    .is("external_instance_id", null)
    .in("connection_status", ["pending_configuration", "error"]);
  if (error) throw new Error(error.message);
  const ownerIds = (instances ?? []).map(
    (instance: { owner_user_id: string }) => instance.owner_user_id,
  );
  const { data: profiles, error: profilesError } = ownerIds.length
    ? await db(admin).from("profiles").select("id, name").in("id", ownerIds)
    : { data: [], error: null };
  if (profilesError) throw new Error(profilesError.message);
  const names = new Map<string, string | null>(
    (profiles ?? []).map(
      (profile: { id: string; name: string | null }) =>
        [profile.id, profile.name] as [string, string | null],
    ),
  );
  for (const instance of instances ?? []) {
    await provisionEvolutionInstance({
      admin,
      organizationId,
      ownerUserId: instance.owner_user_id,
      ownerName: names.get(instance.owner_user_id) ?? null,
    });
  }
}

async function callInstanceApi(
  admin: AdminClient,
  instance: EvolutionInstance,
  path: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: unknown,
): Promise<any> {
  const { configuration } = await getEvolutionCredentials(admin, instance.organization_id);
  const token = await getInstanceToken(admin, instance.id);
  return evolutionRequest({
    serverUrl: configuration.serverUrl,
    apiKey: token,
    path,
    method,
    body,
  });
}

function statusFromProvider(payload: any): {
  status: EvolutionInstance["connection_status"];
  phone: string | null;
} {
  const data = responseData(payload);
  const connected = Boolean(data?.connected);
  const loggedIn = Boolean(data?.loggedIn);
  const rawJid = data?.myJid ?? data?.jid ?? null;
  const phone =
    typeof rawJid === "string" ? rawJid.replace(/@.+$/, "").replace(/\D/g, "") || null : null;
  if (connected && loggedIn) return { status: "connected", phone };
  if (connected) return { status: "awaiting_connection", phone };
  return { status: "disconnected", phone };
}

export async function refreshEvolutionInstance(
  admin: AdminClient,
  instance: EvolutionInstance,
): Promise<EvolutionInstance> {
  try {
    const response = await callInstanceApi(admin, instance, "/instance/status");
    const state = statusFromProvider(response);
    const { data, error } = await db(admin)
      .from("evolution_instances")
      .update({
        connection_status: state.status,
        phone_e164: state.phone,
        last_healthcheck_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", instance.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as EvolutionInstance;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar a Evolution GO.";
    const { data, error: updateError } = await db(admin)
      .from("evolution_instances")
      .update({
        connection_status: "error",
        last_error: message,
        last_healthcheck_at: new Date().toISOString(),
      })
      .eq("id", instance.id)
      .select()
      .single();
    if (updateError) throw new Error(updateError.message);
    return data as EvolutionInstance;
  }
}

export async function connectEvolutionInstance(input: {
  admin: AdminClient;
  instance: EvolutionInstance;
  webhookUrl: string;
}): Promise<EvolutionInstance> {
  await callInstanceApi(input.admin, input.instance, "/instance/connect", "POST", {
    webhookUrl: input.webhookUrl,
    subscribe: ["messages.upsert", "connection.update"],
  });
  const { data, error } = await db(input.admin)
    .from("evolution_instances")
    .update({ connection_status: "awaiting_connection", last_error: null })
    .eq("id", input.instance.id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as EvolutionInstance;
}

export async function getEvolutionQr(
  admin: AdminClient,
  instance: EvolutionInstance,
): Promise<{ qrText: string | null; imageDataUrl: string | null }> {
  const payload = await callInstanceApi(admin, instance, "/instance/qr");
  const data = responseData(payload);
  const code = data?.code ?? data?.qrcode ?? null;
  if (typeof code !== "string" || !code)
    throw new Error(
      "A Evolution GO ainda não disponibilizou um QR Code. Aguarde alguns segundos e tente novamente.",
    );
  return code.startsWith("data:image/")
    ? { qrText: null, imageDataUrl: code }
    : { qrText: code, imageDataUrl: null };
}

export async function disconnectEvolutionInstance(
  admin: AdminClient,
  instance: EvolutionInstance,
): Promise<EvolutionInstance> {
  await callInstanceApi(admin, instance, "/instance/logout", "DELETE", {});
  const { data, error } = await db(admin)
    .from("evolution_instances")
    .update({ connection_status: "disconnected", phone_e164: null, last_error: null })
    .eq("id", instance.id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as EvolutionInstance;
}

export async function sendEvolutionTextForOwner(input: {
  admin: AdminClient;
  organizationId: string;
  ownerUserId: string;
  to: string;
  text: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const phone = input.to.replace(/\D/g, "");
  if (phone.length < 10) return { ok: false, error: "invalid_phone" };
  const instance = await loadInstanceForUser(input.admin, input.organizationId, input.ownerUserId);
  if (!instance) return { ok: false, error: "evolution_instance_missing" };
  if (instance.connection_status !== "connected")
    return { ok: false, error: "evolution_instance_not_connected" };
  try {
    const response = await callInstanceApi(input.admin, instance, "/send/text", "POST", {
      number: phone,
      text: input.text,
      id: randomUUID(),
      formatJid: true,
    });
    return { ok: true, messageId: providerMessageId(response) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "evolution_send_failed" };
  }
}

export async function findEvolutionInstanceByIdentifier(
  admin: AdminClient,
  identifier: string,
): Promise<EvolutionInstance | null> {
  const { data, error } = await db(admin)
    .from("evolution_instances")
    .select("*")
    .or(`external_instance_id.eq.${identifier},instance_name.eq.${identifier}`)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EvolutionInstance | null) ?? null;
}

export async function recordEvolutionWebhookEvent(input: {
  admin: AdminClient;
  instance: EvolutionInstance;
  providerEventId: string | null;
  eventType: string;
  payload: unknown;
}): Promise<{ duplicate: boolean; id?: string }> {
  const { data, error } = await db(input.admin)
    .from("evolution_webhook_events")
    .insert({
      evolution_instance_id: input.instance.id,
      provider_event_id: input.providerEventId,
      event_type: input.eventType,
      payload: input.payload,
    })
    .select("id")
    .maybeSingle();
  if (!error) return { duplicate: false, id: data?.id };
  if ((error as { code?: string }).code === "23505") return { duplicate: true };
  throw new Error(error.message);
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function parseInboundEvolutionMessage(payload: unknown): {
  providerMessageId: string | null;
  senderPhone: string;
  text: string;
} | null {
  const root = asRecord(payload);
  if (!root) return null;
  const data = asRecord(root.data) ?? root;
  const message = asRecord(data.message) ?? asRecord(root.message) ?? {};
  const key = asRecord(data.key) ?? asRecord(message.key) ?? asRecord(root.key) ?? {};
  if (key.fromMe === true || data.fromMe === true || root.fromMe === true) return null;

  const remoteJid = firstText(key.remoteJid, data.remoteJid, root.remoteJid);
  if (!remoteJid || remoteJid.endsWith("@g.us")) return null;
  const senderPhone = remoteJid.replace(/@.+$/, "").replace(/\D/g, "");
  if (senderPhone.length < 10) return null;

  const extended = asRecord(message.extendedTextMessage) ?? {};
  const image = asRecord(message.imageMessage) ?? {};
  const document = asRecord(message.documentMessage) ?? {};
  const text = firstText(
    message.conversation,
    extended.text,
    image.caption,
    document.caption,
    data.text,
    root.text,
  );
  if (!text) return null;

  return {
    providerMessageId: firstText(key.id, data.id, root.id),
    senderPhone,
    text: text.slice(0, 4000),
  };
}

/**
 * Links a received one-to-one WhatsApp message to a lead owned by (or assigned
 * to) the same user as the Evolution instance. Unknown contacts and group or
 * outbound events remain in the private webhook audit trail without creating
 * leads automatically.
 */
export async function processEvolutionInboundMessage(input: {
  admin: AdminClient;
  instance: EvolutionInstance;
  payload: unknown;
}): Promise<"stored" | "ignored" | "unmatched"> {
  const message = parseInboundEvolutionMessage(input.payload);
  if (!message) return "ignored";

  const { data: leads, error: leadsError } = await db(input.admin)
    .from("leads")
    .select("id, phone, whatsapp")
    .or(
      `owner_id.eq.${input.instance.owner_user_id},assigned_to.eq.${input.instance.owner_user_id}`,
    );
  if (leadsError) throw new Error(leadsError.message);
  const lead = (leads ?? []).find(
    (candidate: { phone?: string | null; whatsapp?: string | null }) => {
      const phone = (candidate.phone ?? candidate.whatsapp ?? "").replace(/\D/g, "");
      return phone === message.senderPhone;
    },
  );
  if (!lead) return "unmatched";

  const { error: messageError } = await db(input.admin).from("lead_messages").insert({
    lead_id: lead.id,
    provider_message_id: message.providerMessageId,
    sender: "client",
    sender_name: "Cliente (Evolution GO)",
    type: "client",
    text: message.text,
    sent_at: new Date().toISOString(),
  });
  // Delivery retries may replay the same provider message. The unique database
  // index intentionally makes this harmless.
  if (messageError && (messageError as { code?: string }).code !== "23505") {
    throw new Error(messageError.message);
  }
  const { error: leadError } = await db(input.admin)
    .from("leads")
    .update({ last_contact: new Date().toISOString() })
    .eq("id", lead.id);
  if (leadError) throw new Error(leadError.message);
  return "stored";
}

export async function completeEvolutionWebhookEvent(
  admin: AdminClient,
  eventId: string,
  error?: string,
): Promise<void> {
  const { error: updateError } = await db(admin)
    .from("evolution_webhook_events")
    .update({
      processing_status: error ? "failed" : "processed",
      error: error ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", eventId);
  if (updateError) throw new Error(updateError.message);
}
