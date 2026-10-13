import { allowedCorsHeaders, hasAllowedOrigin, json, preflight } from '../_shared/http.ts';

/**
 * The direct-provider test endpoint is retired. WA-AKG owns channel health and
 * controlled tests now; keeping this route explicit and fail-closed prevents an
 * old browser bundle from sending through a removed provider.
 */
Deno.serve((request) => {
  const options = preflight(request);
  if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  return json({
    ok: false,
    erro: 'channel_not_supported',
    detalhe: 'O teste direto foi removido. Use o canal WA-AKG em Configurações → Canais.',
  }, 410, allowedCorsHeaders(request));
});
