import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  }));
  return nested.flat();
}

const staticFiles = (await filesIn(dist)).filter((file) => {
  const path = relative(dist, file).replaceAll('\\', '/');
  return !path.startsWith('server/') && !path.startsWith('.openai/');
});

const assets = Object.fromEntries(await Promise.all(staticFiles.map(async (file) => {
  const path = `/${relative(dist, file).replaceAll('\\', '/')}`;
  const body = await readFile(file);
  return [path, {
    body: body.toString('base64'),
    type: contentTypes[extname(file)] ?? 'application/octet-stream',
    immutable: path.startsWith('/assets/'),
  }];
})));

const worker = `
const assets = ${JSON.stringify(assets)};

function runtimeConfigScript(env) {
  const config = {};
  for (const key of [
    'VITE_PUBLIC_SUPABASE_URL',
    'VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'VITE_PUBLIC_SUPABASE_ANON_KEY',
  ]) {
    config[key] = typeof env[key] === 'string' ? env[key] : '';
  }
  return 'window.__WAYFLEX_RUNTIME_CONFIG__ = ' + JSON.stringify(config) + ';';
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function isNavigationRequest(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const url = new URL(request.url);
  return request.headers.get('accept')?.includes('text/html') && !url.pathname.includes('.');
}

export default {
  async fetch(request, env) {
    let path = decodeURIComponent(new URL(request.url).pathname);
    if (path === '/runtime-config.js') {
      return new Response(runtimeConfigScript(env), {
        headers: {
          'content-type': 'application/javascript; charset=utf-8',
          'cache-control': 'no-store',
        },
      });
    }
    if (path === '/' || (!assets[path] && isNavigationRequest(request))) path = '/index.html';
    const asset = assets[path];
    if (!asset) return new Response('Not found', { status: 404 });

    return new Response(request.method === 'HEAD' ? null : decodeBase64(asset.body), {
      headers: {
        'content-type': asset.type,
        'cache-control': asset.immutable ? 'public, max-age=31536000, immutable' : 'no-store',
      },
    });
  },
};
`;

await mkdir(resolve(dist, 'server'), { recursive: true });
await mkdir(resolve(dist, '.openai'), { recursive: true });
await writeFile(resolve(dist, 'server/index.js'), worker);
await cp(resolve(root, '.openai/hosting.json'), resolve(dist, '.openai/hosting.json'));

console.log('Artefato Sites pronto em dist/.');
