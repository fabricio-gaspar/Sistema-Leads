import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');

await mkdir(resolve(dist, 'server'), { recursive: true });
await mkdir(resolve(dist, '.openai'), { recursive: true });
await cp(resolve(root, 'worker/sites-preview.js'), resolve(dist, 'server/index.js'));
await cp(resolve(root, '.openai/hosting.json'), resolve(dist, '.openai/hosting.json'));

console.log('Artefato Sites pronto em dist/.');
