import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

// Native PostgreSQL concurrency proof. It creates an isolated temporary Unix
// socket cluster and never accepts a DSN, network endpoint or provider input.
if (!process.argv[2] || !process.argv[3]) {
  throw new Error('Usage: node supabase/tests/evolutionGoTenantLifecycle.concurrent.mjs <postgres-bin-dir> <pg-lib-index.js>');
}

const postgresBin = resolve(process.argv[2]);
const { Client } = (await import(pathToFileURL(resolve(process.argv[3])).href)).default;
const migration = await readFile(new URL('../migrations/20261006130000_evolution_go_tenant_lifecycle.sql', import.meta.url), 'utf8');
const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const organization = id(1);
const sellerA = id(11);
const sellerB = id(12);
const directory = await mkdtemp(join(tmpdir(), 'wayflex-evolution-tenant-pg-'));
const dataDirectory = join(directory, 'data');
const logFile = join(directory, 'postgres.log');
const port = 55441;
const clients = [];
const results = [];
let started = false;

async function connect() {
  const client = new Client({
    host: directory,
    port,
    user: 'postgres',
    database: 'postgres',
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  clients.push(client);
  return client;
}

async function waitFor(test, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await test()) return true;
    await delay(10);
  }
  return false;
}

async function setup(inspector) {
  await inspector.query(`
    create schema auth;
    create schema private;
    create role anon;
    create role authenticated;
    create role service_role;
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;

    create table public.organizations(id uuid primary key);
    create table public.organization_members(
      organization_id uuid not null references public.organizations(id) on delete cascade,
      user_id uuid not null,
      role text not null,
      status text not null,
      updated_at timestamptz not null default now(),
      primary key (organization_id, user_id)
    );
    create table public.integrations(
      id uuid primary key,
      organization_id uuid not null references public.organizations(id) on delete cascade,
      key text not null,
      label text not null,
      provider text not null,
      category text not null,
      connected boolean not null default false,
      enabled boolean not null default false,
      paused boolean not null default true,
      mode text not null,
      status_detail text,
      configuration jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now(),
      unique (organization_id, key)
    );
    create table public.whatsapp_accounts(
      id uuid primary key,
      organization_id uuid not null references public.organizations(id) on delete cascade,
      integration_id uuid references public.integrations(id) on delete restrict,
      owner_user_id uuid,
      label text not null,
      provider text not null,
      account_type text not null,
      is_default boolean not null default false,
      enabled boolean not null default false,
      connection_status text not null default 'unconfigured',
      created_by uuid,
      provider_metadata jsonb not null default '{}'::jsonb,
      archived_at timestamptz,
      updated_at timestamptz not null default now(),
      constraint whatsapp_accounts_provider_check check (provider in ('zapi', 'evolution_go'))
    );
    create table public.evolution_go_seller_provisioning_jobs(
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      user_id uuid not null,
      created_by uuid not null,
      whatsapp_account_id uuid not null references public.whatsapp_accounts(id) on delete restrict,
      integration_id uuid not null references public.integrations(id) on delete restrict,
      source text not null check (source in ('direct_create', 'invite', 'manual')),
      instance_name text not null,
      state text not null,
      next_attempt_at timestamptz not null default now(),
      last_error_code text,
      completed_at timestamptz,
      updated_at timestamptz not null default now(),
      unique (organization_id, user_id)
    );
    insert into public.organizations(id) values ('${organization}');
  `);
  await inspector.query(migration);
}

async function begin(client) {
  await client.query("begin isolation level read committed; set local statement_timeout = '5000ms';");
}

try {
  execFileSync(join(postgresBin, 'initdb'), [
    '-D', dataDirectory,
    '--username=postgres',
    '--auth=trust',
    '--encoding=UTF8',
    '--no-locale',
  ], { stdio: 'pipe' });
  execFileSync(join(postgresBin, 'pg_ctl'), [
    '-D', dataDirectory,
    '-l', logFile,
    '-o', `-h '' -k '${directory}' -p ${port} -c unix_socket_permissions=0700`,
    '-w',
    'start',
  ], { stdio: 'pipe' });
  started = true;

  const inspector = await connect();
  const first = await connect();
  const second = await connect();
  await setup(inspector);
  const secondPid = (await second.query('select pg_backend_pid() as pid')).rows[0].pid;

  // The production trigger is invoked by two sessions that update the same
  // membership. PostgreSQL must serialize the writes and leave one local route.
  await inspector.query(`insert into public.organization_members(organization_id,user_id,role,status)
    values ('${organization}','${sellerA}','sdr','active');`);
  await begin(first);
  await begin(second);
  await first.query(`update public.organization_members
    set role='vendedor'
    where organization_id='${organization}' and user_id='${sellerA}';`);
  let membershipSettled = false;
  const membershipRival = second.query(`update public.organization_members
    set status='active'
    where organization_id='${organization}' and user_id='${sellerA}';`)
    .then(result => { membershipSettled = true; return result; }, error => { membershipSettled = true; throw error; });
  const membershipWaited = await waitFor(async () => {
    const row = (await inspector.query(
      'select wait_event_type from pg_stat_activity where pid=$1',
      [secondPid],
    )).rows[0];
    return !membershipSettled && row?.wait_event_type === 'Lock';
  });
  assert.equal(membershipWaited, true, 'the second membership mutation must wait for the first transaction');
  await first.query('commit');
  await membershipRival;
  await second.query('commit');
  const membershipState = (await inspector.query(`
    select
      (select count(*)::int from public.whatsapp_accounts where organization_id='${organization}' and owner_user_id='${sellerA}' and provider='evolution_go' and archived_at is null) as accounts,
      (select count(*)::int from public.integrations where organization_id='${organization}' and provider='Evolution GO') as integrations,
      (select count(*)::int from public.evolution_go_seller_provisioning_jobs where organization_id='${organization}' and user_id='${sellerA}') as jobs,
      (select enabled from public.whatsapp_accounts where organization_id='${organization}' and owner_user_id='${sellerA}' and provider='evolution_go') as account_enabled,
      (select enabled from public.integrations where organization_id='${organization}' and provider='Evolution GO') as integration_enabled
  `)).rows[0];
  assert.deepEqual(membershipState, {
    accounts: 1,
    integrations: 1,
    jobs: 1,
    account_enabled: false,
    integration_enabled: false,
  });
  results.push({
    id: 'T-EVO-TENANT-NATIVE-001',
    scenario: 'duas sessões alteram o mesmo membership vendedor; a trigger canônica permanece idempotente',
    waitedForDatabaseLock: membershipWaited,
    status: 'PASS',
  });

  // A test-only relay uses the production trigger function with distinct event
  // rows. This isolates its advisory key from the normal membership row lock,
  // proving the org+user advisory lock itself is observable across sessions.
  await inspector.query(`
    create table public.evolution_go_lifecycle_concurrency_events(
      id integer primary key,
      organization_id uuid not null,
      user_id uuid not null,
      role text not null,
      status text not null
    );
    create trigger evolution_go_lifecycle_concurrency_events_trigger
      after insert on public.evolution_go_lifecycle_concurrency_events
      for each row execute function private.sync_evolution_go_seller_membership();
    insert into public.organization_members(organization_id,user_id,role,status)
      values ('${organization}','${sellerB}','vendedor','active');
  `);
  const before = (await inspector.query(`select whatsapp_account_id, integration_id, instance_name
    from public.evolution_go_seller_provisioning_jobs
    where organization_id='${organization}' and user_id='${sellerB}'`)).rows[0];
  await begin(first);
  await begin(second);
  await first.query(`insert into public.evolution_go_lifecycle_concurrency_events(id,organization_id,user_id,role,status)
    values (1,'${organization}','${sellerB}','vendedor','active');`);
  let advisorySettled = false;
  const advisoryRival = second.query(`insert into public.evolution_go_lifecycle_concurrency_events(id,organization_id,user_id,role,status)
    values (2,'${organization}','${sellerB}','vendedor','active');`)
    .then(result => { advisorySettled = true; return result; }, error => { advisorySettled = true; throw error; });
  const advisoryWaited = await waitFor(async () => {
    const row = (await inspector.query(`
      select exists(
        select 1 from pg_locks
        where pid=$1 and locktype='advisory' and not granted
      ) as waiting
    `, [secondPid])).rows[0];
    return !advisorySettled && row.waiting;
  });
  assert.equal(advisoryWaited, true, 'the second reentrant trigger must wait on the advisory org/user lock');
  await first.query('commit');
  await advisoryRival;
  await second.query('commit');
  const after = (await inspector.query(`select whatsapp_account_id, integration_id, instance_name, state
    from public.evolution_go_seller_provisioning_jobs
    where organization_id='${organization}' and user_id='${sellerB}'`)).rows[0];
  assert.deepEqual(
    { whatsapp_account_id: after.whatsapp_account_id, integration_id: after.integration_id, instance_name: after.instance_name },
    before,
  );
  assert.equal(after.state, 'queued');
  assert.equal((await inspector.query(`select count(*)::int as count from public.whatsapp_accounts
    where organization_id='${organization}' and owner_user_id='${sellerB}' and provider='evolution_go' and archived_at is null`)).rows[0].count, 1);
  results.push({
    id: 'T-EVO-TENANT-NATIVE-002',
    scenario: 'duas sessões entram no mesmo ciclo reentrante e a advisory lock por organização/vendedor é observada',
    waitedForAdvisoryLock: advisoryWaited,
    status: 'PASS',
  });

  console.log(JSON.stringify({
    engine: (await inspector.query('select version() as version')).rows[0].version,
    scope: 'Temporary native PostgreSQL cluster via Unix socket 0700; synthetic schema only; no remote DB, network, provider, QR or credential.',
    migration: '20261006130000_evolution_go_tenant_lifecycle.sql',
    passed: results.length,
    failed: 0,
    results,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    message: error.message,
    code: error.code,
    log: await readFile(logFile, 'utf8').catch(() => null),
  }, null, 2));
  process.exitCode = 1;
} finally {
  for (const client of clients) await client.end().catch(() => {});
  if (started) {
    try {
      execFileSync(join(postgresBin, 'pg_ctl'), ['-D', dataDirectory, '-m', 'fast', '-w', 'stop'], { stdio: 'pipe' });
    } catch {
      // Preserve the original test failure; best-effort shutdown avoids leaving
      // a local fixture process behind when a later assertion fails.
    }
  }
  await rm(directory, { recursive: true, force: true }).catch(() => {});
}
