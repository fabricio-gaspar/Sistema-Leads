import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = dirname(fileURLToPath(import.meta.url));
const root = resolve(output, '../../../..');
const node = process.execPath;
const commands = [
  ['T-BASE-001', ['node_modules/typescript/bin/tsc', '--noEmit', '--project', 'tsconfig.app.json']],
  ['T-BASE-002', ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.edge.json']],
  ['T-BASE-003', ['node_modules/eslint/bin/eslint.js', 'src', '--ext', 'ts,tsx', '--report-unused-disable-directives', '--max-warnings', '0']],
  ['T-BASE-004', ['node_modules/vitest/vitest.mjs', 'run', '--configLoader', 'runner', '--reporter=default', '--reporter=json', `--outputFile.json=${resolve(output, 'vitest-baseline.json')}`]],
  ['T-BASE-005', ['node_modules/vite/bin/vite.js', 'build', '--configLoader', 'runner']],
  ['T-BASE-006', ['scripts/build-sites-artifact.mjs']],
  ['T-BASE-007', ['scripts/check-commercial-analytics.mjs']],
];
await mkdir(output, { recursive: true });
const results = [];
for (const [id, args] of commands) {
  const startedAt = new Date().toISOString();
  const started = performance.now();
  let stdout = '', stderr = '';
  const code = await new Promise((done) => {
    const child = spawn(node, args, { cwd: root, env: { ...process.env, CI: 'true' } });
    child.stdout.on('data', chunk => stdout += chunk.toString());
    child.stderr.on('data', chunk => stderr += chunk.toString());
    child.on('error', error => { stderr += String(error); done(-1); });
    child.on('close', done);
  });
  await writeFile(resolve(output, `${id}.log`), `${stdout}\nSTDERR\n${stderr}`, 'utf8');
  results.push({ id, command: ['node', ...args], startedAt, elapsedMs: Math.round(performance.now() - started), exitCode: code, status: code === 0 ? 'APROVADO' : 'REPROVADO', evidence: `${id}.log` });
  await writeFile(resolve(output, 'baseline-results.json'), JSON.stringify({ version: '847048429a86294aa10fa54ffdd750c04447d4fb', mode: 'local; tests may use mocks; no production homology claimed', results }, null, 2) + '\n');
  console.log(`${id}: ${code === 0 ? 'APROVADO' : 'REPROVADO'} (${results.at(-1).elapsedMs} ms)`);
}
process.exitCode = results.some(result => result.exitCode !== 0) ? 1 : 0;
