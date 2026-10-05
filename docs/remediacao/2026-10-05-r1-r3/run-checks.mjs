import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Local verification only. No deploy, remote SQL or business endpoint is invoked.
const output = resolve(dirname(fileURLToPath(import.meta.url)), 'checks');
const root = resolve(output, '../../../..');
const node = process.execPath;
const commands = [
  ['T-REM-001', ['node_modules/typescript/bin/tsc', '--noEmit', '--project', 'tsconfig.app.json']],
  ['T-REM-002', ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.edge.json']],
  ['T-REM-003', ['node_modules/eslint/bin/eslint.js', 'src', '--ext', 'ts,tsx', '--report-unused-disable-directives', '--max-warnings', '0']],
  ['T-REM-004', ['node_modules/vitest/vitest.mjs', 'run', '--configLoader', 'runner', '--reporter=default', '--reporter=json', `--outputFile.json=${resolve(output, 'vitest.json')}`]],
  ['T-REM-005', ['node_modules/vite/bin/vite.js', 'build', '--configLoader', 'runner']],
  ['T-REM-006', ['scripts/build-sites-artifact.mjs']],
  ['T-REM-007', ['scripts/check-commercial-analytics.mjs']],
];
if (process.argv[2]) {
  commands.push(
    ['T-REM-008', ['supabase/tests/rlsRemediation.integration.mjs', resolve(process.argv[2])]],
    ['T-REM-009', ['docs/remediacao/2026-10-05-r1-r3/r2-sql.mjs', resolve(process.argv[2])]],
    ['T-REM-010', ['supabase/tests/receiptReconciliationR3.pglite.mjs', resolve(process.argv[2])]],
  );
}
if (process.argv[3] && process.argv[4]) {
  commands.push(
    ['T-REM-011', ['supabase/tests/rlsRemediation.concurrent.mjs', resolve(process.argv[3]), resolve(process.argv[4])]],
    ['T-REM-012', ['docs/remediacao/2026-10-05-r1-r3/r2-concurrent.mjs', resolve(process.argv[3]), resolve(process.argv[4])]],
    ['T-REM-013', ['docs/remediacao/2026-10-05-r1-r3/r3-native.mjs', resolve(process.argv[3]), resolve(process.argv[4])]],
  );
}
await mkdir(output, { recursive: true });
const files = [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).trim().split('\n'))]
  .filter(file => /^(src\/|supabase\/(functions|migrations|tests)\/|tsconfig.*\.json$|docs\/remediacao\/2026-10-05-r1-r3\/[^/]+\.mjs$)/.test(file)).sort();
const sources = {};
for (const file of files) sources[file] = createHash('sha256').update(await readFile(resolve(root, file))).digest('hex');
const results = [];
for (const [id, args] of commands) {
  const startedAt = new Date().toISOString();
  const started = performance.now();
  let stdout = '', stderr = '';
  const exitCode = await new Promise(done => {
    const child = spawn(node, args, { cwd: root, env: { ...process.env, CI: 'true' } });
    child.stdout.on('data', chunk => stdout += chunk.toString());
    child.stderr.on('data', chunk => stderr += chunk.toString());
    child.on('error', error => { stderr += String(error); done(-1); });
    child.on('close', done);
  });
  await writeFile(resolve(output, `${id}.txt`), `${stdout}\nSTDERR\n${stderr}`);
  results.push({ id, command: ['node', ...args], startedAt, elapsedMs: Math.round(performance.now() - started), exitCode,
    status: exitCode === 0 ? 'APROVADO' : 'REPROVADO', evidence: `${id}.txt` });
  console.log(`${id}: ${results.at(-1).status}`);
}
const changedDuringRun = [];
for (const [file, hash] of Object.entries(sources)) {
  if (createHash('sha256').update(await readFile(resolve(root, file))).digest('hex') !== hash) changedDuringRun.push(file);
}
await writeFile(resolve(output, 'results.json'), JSON.stringify({
  auditedBase: '847048429a86294aa10fa54ffdd750c04447d4fb',
  headAtRun: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  scope: 'working tree R1/R2/R3; local synthetic tests, not production E2E',
  sources, changedDuringRun, results,
}, null, 2) + '\n');
process.exitCode = results.some(result => result.exitCode !== 0) || changedDuringRun.length ? 1 : 0;
