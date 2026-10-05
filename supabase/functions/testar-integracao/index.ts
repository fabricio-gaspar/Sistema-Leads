import {
  createAdminClient,
  requireOrganizationRole,
  requireUser,
} from "../_shared/auth.ts";
import {
  allowedCorsHeaders,
  hasAllowedOrigin,
  json,
  preflight,
  safeError,
} from "../_shared/http.ts";

const PROVIDER_REQUEST_TIMEOUT_MS = 5_000;

function externalRequestFailed(error: unknown) {
  const message = safeError(error).toLowerCase();
  return message.includes("timeout") || message.includes("timed out") || message.includes("aborted");
}
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const txt = (v: unknown, m = 1000) =>
  typeof v === "string" ? v.trim().slice(0, m) : "";
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
function zapiDetail(code: string) {
  const d: Record<string, string> = {
    zapi_credentials_incomplete:
      "Informe ID da instância, Token da Instância e Client Token.",
    zapi_client_token_rejected: "A Z-API recusou o Client Token.",
    zapi_instance_token_rejected: "A Z-API recusou o Token da Instância.",
    zapi_instance_id_rejected: "A Z-API não reconheceu o ID da instância.",
    zapi_instance_not_connected:
      "A instância existe, mas o WhatsApp ainda não está conectado.",
    zapi_phone_offline: "O celular vinculado à instância está offline.",
    zapi_http_429: "A Z-API limitou temporariamente os testes.",
  };
  return d[code] ?? "A Z-API recusou a validação.";
}
async function payload(r: Response) {
  const raw = await r.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
function zapiCode(status: number, p: unknown) {
  if (status !== 400) return `zapi_http_${status}`;
  const m = JSON.stringify(p ?? "").toLowerCase();
  if (/client.?token|security.?token|seguran/.test(m))
    return "zapi_client_token_rejected";
  if (/instance.?id|inst.ncia.*not found|inst.ncia.*invalid/.test(m))
    return "zapi_instance_id_rejected";
  if (/instance.?token|token.*inst.ncia|token.*invalid/.test(m))
    return "zapi_instance_token_rejected";
  return "zapi_http_400";
}
function providerDetail(code: string, provider: string) {
  const map: Record<string, string> = {
    integration_credentials_missing:
      "A integração ainda não possui credencial salva para esta empresa.",
    source_credentials_missing: "A fonte ainda não possui credencial completa.",
    apify_token_rejected: "O token da Apify foi recusado.",
    apify_actor_not_found:
      "O Actor/Task configurado na Apify não foi encontrado.",
    apify_resource_forbidden:
      "A conta Apify não tem acesso ao Actor/Task configurado.",
    apify_rate_limited: "A Apify limitou temporariamente as chamadas.",
    google_places_key_rejected:
      "A chave do Google Places foi recusada ou a API não está habilitada.",
    email_credentials_incomplete:
      "Configure a chave Resend e um remetente válido da Wayflex.",
    email_key_rejected: "A Resend recusou a chave desta empresa.",
    calendar_credentials_incomplete:
      "O Google Calendar ainda não possui token OAuth válido para esta empresa.",
    calendar_token_rejected:
      "O Google Calendar recusou ou expirou a autorização.",
    cnpj_provider_unavailable:
      "A consulta pública CNPJ.ws não respondeu corretamente.",
    provider_timeout:
      "O provedor não respondeu dentro do prazo seguro de validação. Tente novamente em alguns instantes.",
  };
  return (
    map[code] ?? `Falha ao validar ${provider}. Consulte o código ${code}.`
  );
}
Deno.serve(async (request) => {
  const pf = preflight(request);
  if (pf) return pf;
  if (!hasAllowedOrigin(request))
    return json({ ok: false, erro: "origin_not_allowed" }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== "POST")
    return json({ ok: false, erro: "method_not_allowed" }, 405, headers);
  let admin: ReturnType<typeof createAdminClient> | null = null,
    org: string | null = null,
    id: string | null = null,
    source: string | null = null,
    authorized = false,
    provider = "Integração";
  try {
    const body = (await request.json()) as { canal?: string };
    const canal = String(body.canal ?? "").trim();
    if (
      ![
        "whatsapp",
        "ai",
        "apify",
        "google_places",
        "email",
        "google_calendar",
        "cnpj_ws",
      ].includes(canal)
    )
      throw new Error("unsupported_channel");
    const { user } = await requireUser(request);
    admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("active_organization_id,name")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.active_organization_id)
      throw new Error("organization_context_required");
    org = profile.active_organization_id as string;
    await requireOrganizationRole(admin, user.id, org, [
      "owner",
      "admin",
      "manager",
    ]);
    authorized = true;
    const { data: i, error } = await admin
      .from("integrations")
      .select("id,provider,enabled,connected,paused,configuration")
      .eq("organization_id", org)
      .eq("key", canal)
      .maybeSingle();
    if (error || !i) throw new Error("integration_not_found");
    id = i.id;
    provider = i.provider || canal;
    source = ["apify", "google_places", "cnpj_ws"].includes(canal)
      ? canal
      : null;
    let sourceEnabled: boolean | null = null;
    if (source) {
      const { data: sourceConfig, error: sourceConfigError } = await admin
        .from("lead_source_configs")
        .select("enabled")
        .eq("organization_id", org)
        .eq("source_key", source)
        .maybeSingle();
      if (sourceConfigError) throw new Error("source_config_read_failed");
      sourceEnabled = typeof sourceConfig?.enabled === "boolean"
        ? sourceConfig.enabled
        : Boolean(i.enabled);
    }
    const { data: secret, error: secretError } = await admin.rpc(
      "read_integration_secret",
      { p_integration: i.id },
    );
    const credentials = obj(secret);
    let response: Response | null = null;
    let whatsappOperational = true;
    if (canal === "whatsapp") {
      const { data: providerControl, error: providerControlError } = await admin
        .from("messaging_provider_controls")
        .select("inbound_enabled,send_enabled,automation_enabled,kill_switch")
        .eq("organization_id", org)
        .eq("provider", "zapi")
        .maybeSingle();
      if (providerControlError) throw new Error("provider_control_read_failed");
      const hasExplicitProviderControl = providerControl
        && typeof providerControl.inbound_enabled === "boolean"
        && typeof providerControl.send_enabled === "boolean"
        && typeof providerControl.automation_enabled === "boolean"
        && typeof providerControl.kill_switch === "boolean";
      whatsappOperational = !hasExplicitProviderControl || (providerControl.inbound_enabled === true
        && providerControl.send_enabled === true
        && providerControl.automation_enabled === true
        && providerControl.kill_switch !== true);
      const instance = txt(credentials.instancia_id, 300),
        token = txt(credentials.token, 500),
        client = txt(credentials.client_token, 500),
        base = (
          txt(credentials.url_base, 500) || "https://api.z-api.io"
        ).replace(/\/$/, "");
      if (!instance || !token || !client)
        throw new Error("zapi_credentials_incomplete");
      response = await fetch(
        `${base}/instances/${encodeURIComponent(instance)}/token/${encodeURIComponent(token)}/status`,
        {
          headers: {
            "Content-Type": "application/json",
            "Client-Token": client,
          },
          signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
        },
      );
      const p = (await payload(response)) as {
        connected?: boolean;
        smartphoneConnected?: boolean;
      } | null;
      if (!response.ok) throw new Error(zapiCode(response.status, p));
      if (!p || typeof p !== "object") throw new Error("zapi_http_400");
      if (!p.connected) throw new Error("zapi_instance_not_connected");
      if (!p.smartphoneConnected) throw new Error("zapi_phone_offline");
    } else if (canal === "ai") {
      if (secretError || !secret)
        throw new Error("integration_credentials_missing");
      const preferred = txt(credentials.provedor_principal, 30).toLowerCase();
      if (preferred === "claude") {
        const key = txt(credentials.claude_key, 1000);
        if (!key) throw new Error("integration_credentials_missing");
        response = await fetch("https://api.anthropic.com/v1/models?limit=1", {
          headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
          signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
        });
      } else {
        const key = txt(credentials.openai_key, 1000);
        if (!key) throw new Error("integration_credentials_missing");
        response = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
        });
      }
      if (!response.ok) throw new Error(`ai_provider_${response.status}`);
    } else if (canal === "apify") {
      const token = txt(credentials.api_token || credentials.token, 500),
        actor = txt(credentials.actor_id, 300),
        task = txt(credentials.task_id, 300);
      if (!token || (!actor && !task))
        throw new Error("source_credentials_missing");
      let r = await fetch(
        `https://api.apify.com/v2/users/me?token=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS) },
      );
      if (r.status === 401 || r.status === 403)
        throw new Error("apify_token_rejected");
      if (r.status === 429) throw new Error("apify_rate_limited");
      if (!r.ok) throw new Error(`apify_http_${r.status}`);
      const path = task
        ? `/v2/actor-tasks/${encodeURIComponent(task)}`
        : `/v2/acts/${encodeURIComponent(actor)}`;
      r = await fetch(
        `https://api.apify.com${path}?token=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS) },
      );
      if (r.status === 404) throw new Error("apify_actor_not_found");
      if (r.status === 401 || r.status === 403)
        throw new Error("apify_resource_forbidden");
      if (r.status === 429) throw new Error("apify_rate_limited");
      if (!r.ok) throw new Error(`apify_http_${r.status}`);
      response = r;
    } else if (canal === "google_places") {
      const key = txt(credentials.api_key, 1000);
      if (!key) throw new Error("source_credentials_missing");
      response = await fetch(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "places.id",
          },
          body: JSON.stringify({
            textQuery: "Wayflex Brasil",
            languageCode: "pt-BR",
            regionCode: "BR",
            pageSize: 1,
          }),
          signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
        },
      );
      if (
        response.status === 400 ||
        response.status === 401 ||
        response.status === 403
      )
        throw new Error("google_places_key_rejected");
      if (!response.ok)
        throw new Error(`google_places_http_${response.status}`);
    } else if (canal === "email") {
      const key = txt(credentials.resend_api_key || credentials.api_key, 1000),
        from = txt(
          credentials.from_email || obj(i.configuration).from_email,
          254,
        );
      if (!key || !validEmail(from))
        throw new Error("email_credentials_incomplete");
      response = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
      });
      if (response.status === 401 || response.status === 403)
        throw new Error("email_key_rejected");
      if (!response.ok) throw new Error(`email_provider_${response.status}`);
    } else if (canal === "google_calendar") {
      const access = txt(credentials.access_token, 4000);
      if (!access) throw new Error("calendar_credentials_incomplete");
      response = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1",
        {
          headers: { Authorization: `Bearer ${access}` },
          signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
        },
      );
      if (response.status === 401 || response.status === 403)
        throw new Error("calendar_token_rejected");
      if (!response.ok) throw new Error(`calendar_provider_${response.status}`);
    } else {
      response = await fetch("https://publica.cnpj.ws/cnpj/19131243000197", {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error("cnpj_provider_unavailable");
    }
    const now = new Date().toISOString();
    const ambienteRealAtivo = false;
    const ambienteRealMensagem = canal === "whatsapp"
      ? "A validação do canal não altera o Ambiente Real. Use o assistente de ativação para uma mudança de operação auditada."
      : null;
    const detail =
      canal === "whatsapp"
        ? whatsappOperational
          ? "Conexão Z-API validada. O canal está conectado; esta verificação não envia mensagens nem ativa o Ambiente Real."
          : "Conexão Z-API validada, mas o provedor permanece desativado no WayFlex. Esta verificação não enviou mensagens."
        : canal === "ai"
          ? "Credencial do provedor principal da Ana validada sem gerar mensagem."
          : canal === "email"
            ? "Resend validado para envio real da Wayflex."
            : canal === "google_calendar"
              ? "Google Calendar autorizado para a Wayflex."
              : `Conexão ${provider} validada para Prospecção.`;
    await admin
      .from("integrations")
      .update({
        connected: true,
        // A connection test proves technical health; it must not silently
        // turn a provider on for production use. The operational switch is
        // changed only by configurar-integracao#set_usage.
        enabled: canal === "whatsapp" ? whatsappOperational : i.enabled,
        paused: canal === "whatsapp" ? !whatsappOperational : i.paused,
        status_detail: detail,
        last_tested_at: now,
        last_success_at: now,
        last_error: null,
        last_error_at: null,
        updated_at: now,
      })
      .eq("id", i.id)
      .eq("organization_id", org);
    if (source)
      await admin
        .from("lead_source_configs")
        .update({
          enabled: sourceEnabled ?? Boolean(i.enabled),
          mode: "production",
          connection_status: "connected",
          last_success_at: now,
          last_error: null,
          last_error_at: null,
          updated_at: now,
        })
        .eq("organization_id", org)
        .eq("source_key", source);
    await admin
      .from("audit_logs")
      .insert({
        organization_id: org,
        actor_id: user.id,
        actor_name: profile.name,
        actor_type: "user",
        action: `integration.${canal}_checked`,
        detail: "Integração validada contra o provedor real sem alterar o modo operacional.",
        entity_table: "integrations",
        entity_id: i.id,
        event_data: {
          ready: true,
          provider,
          ambiente_real_ativo: ambienteRealAtivo,
        },
      });
    return json(
      {
        ok: true,
        pronto: true,
        provedor: provider,
        detalhe: detail,
        canalPronto: canal === "whatsapp" ? whatsappOperational : true,
        bloqueioOperacional: canal === "whatsapp" && !whatsappOperational
          ? "whatsapp_provider_disabled"
          : null,
        ambienteRealAtivo,
        ambienteRealMensagem,
      },
      200,
      headers,
    );
  } catch (error) {
    const code = externalRequestFailed(error) ? "provider_timeout" : safeError(error),
      detail = code.startsWith("zapi_")
        ? zapiDetail(code)
        : providerDetail(code, provider);
    if (admin && authorized && org && id)
      await admin
        .from("integrations")
        .update({
          connected: false,
          status_detail: detail,
          last_error: code,
          last_error_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("organization_id", org);
    if (admin && authorized && org && source)
      await admin
        .from("lead_source_configs")
        .update({
          connection_status: "error",
          last_error: code,
          last_error_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", org)
        .eq("source_key", source);
    return json({ ok: false, erro: code, detalhe: detail }, 400, headers);
  }
});
