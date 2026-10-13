import { allowedCorsHeaders, hasAllowedOrigin, json, preflight } from '../_shared/http.ts';

/**
 * Legacy provider callbacks are retired. WA-AKG receives and reconciles its
 * events through the dedicated gateway worker; this route must never parse or
 * persist callbacks from a removed provider.
 */
Deno.serve((request) => {
  const options = preflight(request);
  if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, error: 'origin_not_allowed' }, 403);
  return json({
    error: 'channel_not_supported',
    detail: 'O webhook legado foi removido. Use o transporte WA-AKG.',
  }, 410, allowedCorsHeaders(request));
});
