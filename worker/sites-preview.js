/**
 * Worker de hospedagem da prévia. A aplicação continua sendo uma SPA Vite;
 * este adaptador apenas entrega os arquivos compilados e resolve as rotas
 * internas do React pelo index.html.
 */
const isNavigationRequest = (request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;

  const url = new URL(request.url);
  return request.headers.get('accept')?.includes('text/html') && !url.pathname.includes('.');
};

export default {
  async fetch(request, env) {
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404 || !isNavigationRequest(request)) return asset;

    // O binding de arquivos estáticos expõe o documento inicial pelo caminho
    // explícito. Usar /index.html evita um 404 na raiz em produção.
    const indexRequest = new Request(new URL('/index.html', request.url), request);
    return env.ASSETS.fetch(indexRequest);
  },
};
