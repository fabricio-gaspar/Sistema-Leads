/**
 * App User Connector helpers — server-only.
 * NEVER import from client bundles: reads LOVABLE_API_KEY from process.env.
 */

function requireApiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not set");
  return key;
}

export interface AuthorizeParams {
  gatewayBaseUrl: string;
  connectorId: string;
  appUserId: string;
  clientAPIKey: string;
  returnUrl: string;
  connectionAPIKey?: string;
  credentialsConfiguration?: Record<string, unknown>;
}

export async function authorizeAppUserOAuth(params: AuthorizeParams) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${requireApiKey()}`,
    "Content-Type": "application/json",
    "X-Client-Api-Key": params.clientAPIKey,
  };
  if (params.connectionAPIKey) headers["X-Connection-Api-Key"] = params.connectionAPIKey;
  const res = await fetch(`${params.gatewayBaseUrl}/api/v1/app-users/oauth2/authorize`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      connector_id: params.connectorId,
      app_user_id: params.appUserId,
      return_url: params.returnUrl,
      credentials_configuration: params.credentialsConfiguration,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OAuth start failed (${res.status}): ${text || res.statusText}`);
  const body = text ? JSON.parse(text) : {};
  if (!body.authorization_url) throw new Error("Missing authorization_url");
  return { authorizationUrl: body.authorization_url as string, sessionId: (body.session_id ?? "") as string };
}

export async function exchangeAppUserOAuthCode(gatewayBaseUrl: string, code: string) {
  const res = await fetch(`${gatewayBaseUrl}/api/v1/app-users/oauth2/exchange`, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireApiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OAuth exchange failed (${res.status}): ${text || res.statusText}`);
  const body = text ? JSON.parse(text) : {};
  if (!body.api_key || !body.connector_id) throw new Error("Malformed exchange response");
  return { connectionAPIKey: body.api_key as string, connectorId: body.connector_id as string };
}

export interface CallParams {
  gatewayBaseUrl: string;
  connectionAPIKey: string;
  connectorId: string;
  path: string;
  init?: RequestInit;
}

export async function callAsAppUser({ gatewayBaseUrl, connectionAPIKey, connectorId, path, init }: CallParams) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${requireApiKey()}`);
  headers.set("X-Connection-Api-Key", connectionAPIKey);
  return fetch(`${gatewayBaseUrl}/${connectorId}${normalized}`, { ...init, headers });
}

export async function disconnectAppUser({ gatewayBaseUrl, connectionAPIKey, connectorId }: {
  gatewayBaseUrl: string; connectionAPIKey: string; connectorId: string;
}) {
  const res = await fetch(`${gatewayBaseUrl}/api/v1/app-users/connection`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "X-Connection-Api-Key": connectionAPIKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ connector_id: connectorId }),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Disconnect failed (${res.status}): ${text}`);
  }
}
