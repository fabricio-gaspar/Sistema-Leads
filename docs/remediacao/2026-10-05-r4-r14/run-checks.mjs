import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Local-only checks. Inputs are modules/binaries, never a database or provider URL.
const output = resolve(dirname(fileURLToPath(import.meta.url)), 'checks');
const root = resolve(output, '../../../..');
const node = process.execPath;
if (process.argv.length < 6) throw new Error('Usage: node run-checks.mjs <PGlite module> <PG binaries> <pg module> <Playwright module>');
const [pglite, bin, pg, playwright] = process.argv.slice(2).map(value => resolve(value));
const base = 'http://127.0.0.1:4183';
const commands = [
  ['T-CONT-001', ['node_modules/typescript/bin/tsc', '--noEmit', '--project', 'tsconfig.app.json']],
  ['T-CONT-002', ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.edge.json']],
  ['T-CONT-003', ['node_modules/eslint/bin/eslint.js', 'src', '--ext', 'ts,tsx', '--report-unused-disable-directives', '--max-warnings', '0']],
  ['T-CONT-004', ['node_modules/vitest/vitest.mjs', 'run', '--configLoader', 'runner', '--reporter=default', '--reporter=json', `--outputFile.json=${resolve(output, 'vitest.json')}`]],
  ['T-CONT-005', ['node_modules/vite/bin/vite.js', 'build', '--configLoader', 'runner']],
  ['T-CONT-006', ['scripts/build-sites-artifact.mjs']],
  ['T-CONT-007', ['scripts/check-commercial-analytics.mjs']],
  ['T-CONT-008', ['supabase/tests/rlsRemediation.integration.mjs', pglite]],
  ['T-CONT-009', ['docs/remediacao/2026-10-05-r1-r3/r2-sql.mjs', pglite]],
  ['T-CONT-010', ['supabase/tests/receiptReconciliationR3.pglite.mjs', pglite]],
  ['T-CONT-011', ['supabase/tests/rlsRemediation.concurrent.mjs', bin, pg]],
  ['T-CONT-012', ['docs/remediacao/2026-10-05-r1-r3/r2-concurrent.mjs', bin, pg]],
  ['T-CONT-013', ['docs/remediacao/2026-10-05-r1-r3/r3-native.mjs', bin, pg]],
  ['T-CONT-014', ['supabase/tests/teamAccessR4.integration.mjs', pglite]],
  ['T-CONT-015', ['supabase/tests/teamAccessR4.concurrent.mjs', bin, pg]],
  ['T-CONT-016', ['supabase/tests/messagingRecoveryR6.sql.mjs', pglite]],
  ['T-CONT-017', ['supabase/tests/messagingRecoveryR6.concurrent.mjs', bin, pg]],
  ['T-CONT-018', ['supabase/tests/agendaR9.integration.mjs', pglite]],
  ['T-CONT-019', ['supabase/tests/agendaR9.concurrent.mjs', bin, pg]],
  ['T-CONT-020', ['supabase/tests/anaLocationR11.integration.mjs', pglite]],
  ['T-CONT-021', ['docs/remediacao/2026-10-05-r4-r14/ui-browser.mjs', playwright, base]],
];
await mkdir(output, { recursive: true });
const files = [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).trim().split('\n'))]
  .filter(file => /^(src\/|supabase\/(functions|migrations|tests)\/|tsconfig.*\.json$|package(-lock)?\.json$|docs\/remediacao\/(2026-10-05-r1-r3|2026-10-05-r4-r14)\/[^/]+\.(mjs|html)$)/.test(file)).sort();
const sources = {};
for (const file of files) sources[file] = createHash('sha256').update(await readFile(resolve(root, file))).digest('hex');
const results = [];
let preview = null; let previewOutput = '';
try {
  for (const [id, args] of commands) {
    if (id === 'T-CONT-021') {
      preview = spawn(node, ['node_modules/vite/bin/vite.js','--configLoader','runner','--host','127.0.0.1','--port','4183','--strictPort'], { cwd:root });
      preview.stdout.on('data',chunk=>previewOutput+=chunk.toString());
      preview.stderr.on('data',chunk=>previewOutput+=chunk.toString());
      let ready = false;
      for(let attempt=0;attempt<30;attempt++) {
        if(preview.exitCode !== null) throw new Error('Isolated preview exited: '+previewOutput);
        try { ready = (await fetch(base)).ok; } catch { /* Wait for local Vite only. */ }
        if(ready)break;
        await new Promise(done=>setTimeout(done,300));
      }
      if(!ready)throw new Error('Local preview did not become ready');
    }
    const startedAt = new Date().toISOString(); const started = performance.now();
    let stdout = '', stderr = '';
    const exitCode = await new Promise(done => {
      const child = spawn(node, args, { cwd: root, env: { ...process.env, CI: 'true' } });
      child.stdout.on('data', chunk => stdout += chunk.toString());
      child.stderr.on('data', chunk => stderr += chunk.toString());
      child.on('error', error => { stderr += String(error); done(-1); });
      child.on('close', done);
    });
    await writeFile(resolve(output, `${id}.txt`), `${stdout}\nSTDERR\n${stderr}`);
    results.push({ id, command: ['node', ...args], startedAt, elapsedMs: Math.round(performance.now()-started), exitCode,
      status: exitCode === 0 ? 'APROVADO' : 'REPROVADO', evidence: `${id}.txt` });
    console.log(`${id}: ${results.at(-1).status}`);
  }
} finally {
  if (preview && preview.exitCode === null) {
    await new Promise(done=>{preview.once('close',done);preview.kill('SIGTERM');});
    await writeFile(resolve(output,'local-preview.txt'),previewOutput);
  }
  const changedDuringRun = [];
  for (const [file, hash] of Object.entries(sources)) {
    if (createHash('sha256').update(await readFile(resolve(root,file))).digest('hex') !== hash) changedDuringRun.push(file);
  }
  await writeFile(resolve(output,'results.json'),JSON.stringify({
    auditedBase:'aeeb24b2f9970b7b36b32b661c4534a368357662',
    headAtRun:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    scope:'R4-R12 local delta + R1/R2/R3 regressions; synthetic databases and HTTP; not production E2E',
    sources,changedDuringRun,results,
  },null,2)+'\n');
  process.exitCode = results.length !== commands.length || results.some(result=>result.exitCode!==0) || changedDuringRun.length ? 1 : 0;
}
