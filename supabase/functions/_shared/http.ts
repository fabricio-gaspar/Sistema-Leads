const DEFAULT_ALLOWED_ORIGINS = [
  'https://leadai-crm-preview.fabricio926564.chatgpt.site',
  // The local preview is used by the same authenticated application during
  // homologation. It is an exact origin, never a wildcard.
  'http://127.0.0.1:4173',
] as const;

function parseOrigins(value: string): string[] {
  return [...new Set(value.split(',').map((origin) => origin.trim()).filter(Boolean))];
}

function configuredAllowedOrigins(): string[] {
  // ALLOWED_ORIGINS supersedes the previous singular variable and supports an
  // explicit comma-separated allow-list. While only ALLOWED_ORIGIN exists,
  // retain it in addition to the two known application origins so that a
  // production configuration cannot accidentally disable local homologation.
  const configuredList = Deno.env.get('ALLOWED_ORIGINS');
  if (configuredList) return parseOrigins(configuredList);

  const legacyOrigin = Deno.env.get('ALLOWED_ORIGIN');
  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...(legacyOrigin ? parseOrigins(legacyOrigin) : [])])];
}

function requestOriginIsAllowed(request: Request): boolean {
  const requestOrigin = request.headers.get('origin');
  return !requestOrigin || configuredAllowedOrigins().includes(requestOrigin);
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export function allowedCorsHeaders(request: Request): HeadersInit {
  const requestOrigin = request.headers.get('origin');

  if (!requestOrigin || !requestOriginIsAllowed(request)) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': requestOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function hasAllowedOrigin(request: Request): boolean {
  return requestOriginIsAllowed(request);
}

export function preflight(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;
  if (!hasAllowedOrigin(request)) return json({ error: 'origin_not_allowed' }, 403);
  return new Response(null, { status: 204, headers: allowedCorsHeaders(request) });
}

export function safeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  // PostgREST e algumas APIs do Supabase retornam erros estruturados que não
  // herdam de Error. Preservar somente a mensagem permite à função converter o
  // erro em um código seguro e evita reduzir uma falha tratável a
  // "internal_error".
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return 'internal_error';
}
