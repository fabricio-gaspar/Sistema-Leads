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
import { validateApifyConfiguration } from "../_shared/apifyClient.ts";
import { leadSourceRuntimeMode } from "../_shared/integrationRuntimeMode.ts";
import { linkedInErrorCode } from "../_shared/linkedinCompanySearch.ts";
import { freeLlmEndpoint } from "../_shared/freellm.ts";

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
    linkedin_credentials_required:
      "Configure o token Apify e o Actor/Task do LinkedIn antes de validar.",
    linkedin_token_rejected: "O token da Apify foi recusado para o conector LinkedIn.",
    linkedin_actor_not_found: "O Actor/Task do LinkedIn não foi encontrado.",
    linkedin_resource_forbidden: "A conta Apify não tem acesso ao Actor do LinkedIn.",
    linkedin_rate_limited: "A Apify limitou temporariamente o conector LinkedIn.",
    linkedin_provider_error: "O conector LinkedIn devolveu um erro incompatível.",
    apify_rate_limited: "A Apify limitou temporariamente as chamadas.",
    apify_provider_error: "A Apify devolveu um erro transitório ou incompatível; tente validar novamente.",
    email_credentials_incomplete:
      "Configure a chave Resend e um remetente válido da Wayflex.",
    email_key_rejected: "A Resend recusou a chave desta empresa.",
    calendar_credentials_incomplete:
      "O Google Calendar ainda não possui token OAuth válido para esta empresa.",
    calendar_token_rejected:
      "O Google Calendar recusou ou expirou a autorização.",
    freellm_credentials_missing:
      "O FreeLLMAPI ainda não está disponível no gateway isolado da VPS.",
    ai_provider_401: "O provedor da Ana recusou a chave configurada.",
    ai_provider_403: "O provedor da Ana bloqueou esta chave.",
    ai_provider_404: "O endpoint do provedor da Ana não expôs uma rota compatível.",
    ai_provider_429: "O provedor da Ana limitou temporariamente a validação.",
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
        "ai",
        "apify",
        "linkedin",
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
    source = ["apify", "linkedin", "cnpj_ws"].includes(canal)
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
    if (canal === "ai") {
      if (secretError || !secret)
        throw new Error("integration_credentials_missing");
      const preferred = txt(credentials.provedor_principal, 30).toLowerCase() || "freellm";
      if (preferred === "claude") {
        const key = txt(credentials.claude_key, 1000);
        if (!key) throw new Error("integration_credentials_missing");
        response = await fetch("https://api.anthropic.com/v1/models?limit=1", {
          headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
          signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
        });
      } else if (preferred === "freellm" || preferred === "freellmapi") {
        const key = txt(Deno.env.get("FREELLM_API_KEY"), 1_000);
        const base = txt(Deno.env.get("FREELLM_API_URL"), 1_000);
        if (!key || !base) throw new Error("freellm_credentials_missing");
        const root = base.replace(/\/+$/, "").replace(/\/v1$/i, "");
        response = await fetch(`${root}/v1/models`, {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
        });
        // Some self-hosted gateways expose only chat completions. A one-token
        // dry-run still proves the configured model route without sending any
        // WhatsApp message or mutating CRM data.
        if (response.status === 404) {
          response = await fetch(freeLlmEndpoint(base), {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: txt(credentials.freellm_model, 100) || txt(Deno.env.get("FREELLM_MODEL"), 100) || "free-router",
              messages: [{ role: "user", content: "Responda apenas OK." }],
              max_tokens: 1,
              temperature: 0,
            }),
            signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
          });
        }
      } else {
        const key = txt(credentials.openai_key, 1000);
        if (!key) throw new Error("integration_credentials_missing");
        response = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
        });
      }
      if (!response.ok) throw new Error(`ai_provider_${response.status}`);
    } else if (canal === "apify" || canal === "linkedin") {
      try {
        await validateApifyConfiguration(credentials);
      } catch (error) {
        if (canal === "linkedin") throw new Error(linkedInErrorCode(error));
        throw error;
      }
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
    const ambienteRealMensagem = null;
    const detail =
      canal === "ai"
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
        enabled: i.enabled,
        paused: i.paused,
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
          mode: leadSourceRuntimeMode,
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
        canalPronto: true,
        bloqueioOperacional: null,
        ambienteRealAtivo,
        ambienteRealMensagem,
      },
      200,
      headers,
    );
  } catch (error) {
    const code = externalRequestFailed(error) ? "provider_timeout" : safeError(error),
      detail = providerDetail(code, provider);
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
