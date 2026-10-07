import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { runTests, A, admin, peer } from './rlsRemediation.integration.mjs';

// Requires local postgres/pg_ctl/initdb binaries and node-postgres module. Does NOT accept a DSN.
// Creates a unique temporary cluster, Unix socket mode 0700, no TCP listener, synthetic data only.
// Stops it in finally; retains only the temporary synthetic cluster/log for reproducibility.
if (!process.argv[2] || !process.argv[3]) throw new Error('Pass native/bin and pg/lib/index.js paths.');
const bin = resolve(process.argv[2]);
const { Client } = (await import(pathToFileURL(resolve(process.argv[3])).href)).default;
const directory = await mkdtemp(join(tmpdir(), 'wayflex-r1-pg-'));
const data = join(directory, 'data');
const logfile = join(directory, 'postgres.log');
let started = false;
const clients = [];
const connect = async () => {
  const client = new Client({ host: directory, port: 55439, user: 'audit_r1', database: 'postgres', connectionTimeoutMillis: 5000 });
  await client.connect(); clients.push(client); return client;
};
try {
  execFileSync(join(bin, 'initdb'), ['-D', data, '--username=audit_r1', '--auth=trust', '--encoding=UTF8', '--no-locale'], { stdio: 'pipe' });
  execFileSync(join(bin, 'pg_ctl'), ['-D', data, '-l', logfile, '-o', `-h '' -k '${directory}' -p 55439 -c unix_socket_permissions=0700`, '-w', 'start'], { stdio: 'pipe' });
  started = true;
  const inspector = await connect();
  const sequential = await runTests({ exec: sql => inspector.query(sql), query: sql => inspector.query(sql) });
  sequential.engine = (await inspector.query('select version()')).rows[0].version;
  const first = await connect(); const second = await connect();
  const secondPid = (await second.query('select pg_backend_pid() pid')).rows[0].pid;
  const races = [];
  for (const isolation of ['READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE']) {
    for (const action of ['disable', 'demote', 'delete']) {
      await inspector.query(`insert into public.organization_members(organization_id,user_id,role,status) values ('${A}','${admin}','administrador','active'),('${A}','${peer}','administrador','active') on conflict(organization_id,user_id) do update set role='administrador',status='active'`);
      for (const [client, user] of [[first, admin], [second, peer]]) {
        await client.query(`begin isolation level ${isolation}; set local statement_timeout='5s'; set local role authenticated; set local audit.user_id='${user}';`);
        await client.query(`select count(*) from public.organization_members where organization_id='${A}'`);
      }
      const statement = user => action === 'delete'
        ? `delete from public.organization_members where organization_id='${A}' and user_id='${user}'`
        : `update public.organization_members set ${action === 'disable' ? "status='disabled'" : "role='vendedor'"} where organization_id='${A}' and user_id='${user}'`;
      await first.query(statement(admin));
      let resolved = false;
      const competing = second.query(statement(peer)).then(
        result => { resolved = true; return { committed: true, rowCount: result.rowCount }; },
        error => { resolved = true; return { committed: false, code: error.code, error: error.message }; },
      );
      let blocked = false;
      for (let attempt = 0; attempt < 60 && !resolved; attempt++) {
        const wait = (await inspector.query('select wait_event_type from pg_stat_activity where pid=$1', [secondPid])).rows[0];
        if (wait?.wait_event_type === 'Lock') { blocked = true; break; }
        await delay(10);
      }
      await first.query('commit');
      const outcome = await competing;
      await second.query(outcome.committed ? 'commit' : 'rollback');
      const remaining = Number((await inspector.query(`select count(*) n from public.organization_members where organization_id='${A}' and role='administrador' and status='active'`)).rows[0].n);
      const expectedCode = isolation === 'READ COMMITTED' ? '23514' : '40001';
      races.push({ id: `T-R1-C${String(races.length + 1).padStart(2, '0')}`, isolation, action, secondWaitedForLock: blocked, outcome, remainingAdmins: remaining, result: blocked && !outcome.committed && outcome.code === expectedCode && remaining === 1 ? 'APROVADO' : 'REPROVADO' });
    }
  }
  const passed = sequential.passed + races.filter(r => r.result === 'APROVADO').length;
  const failed = sequential.failed + races.filter(r => r.result !== 'APROVADO').length;
  console.log(JSON.stringify({ engine: sequential.engine, scope: 'Temporary native PostgreSQL, Unix socket only; no production access', directory, sequential, races, passed, failed }, null, 2));
  if (failed) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ message: error.message, code: error.code, stderr: error.stderr?.toString(), postgresLog: await readFile(logfile, 'utf8').catch(() => null) }));
  process.exitCode = 1;
} finally {
  for (const client of clients) await client.end().catch(() => {});
  if (started) execFileSync(join(bin, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], { stdio: 'pipe' });
}
