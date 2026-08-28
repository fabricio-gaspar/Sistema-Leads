export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export function allowedCorsHeaders(request: Request): HeadersInit {
  // The published panel is the only browser origin allowed when an explicit
  // environment override has not been configured yet. This keeps Functions
  // callable from the panel without falling back to a wildcard CORS policy.
  const configuredOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://leadai-crm-preview.fabricio926564.chatgpt.site';
  const requestOrigin = request.headers.get('origin');

  if (!configuredOrigin || !requestOrigin || requestOrigin !== configuredOrigin) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': configuredOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function hasAllowedOrigin(request: Request): boolean {
  const requestOrigin = request.headers.get('origin');
  const configuredOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://leadai-crm-preview.fabricio926564.chatgpt.site';
  return !requestOrigin || requestOrigin === configuredOrigin;
}

export function preflight(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;
  if (!hasAllowedOrigin(request)) return json({ error: 'origin_not_allowed' }, 403);
  return new Response(null, { status: 204, headers: allowedCorsHeaders(request) });
}

export function safeError(error: unknown): string {
  return error instanceof Error ? error.message : 'internal_error';
}
