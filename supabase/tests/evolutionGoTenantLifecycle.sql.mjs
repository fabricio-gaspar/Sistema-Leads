import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// PGlite-only proof. It never reads a Supabase DSN, provider credential or network.
if (!process.argv[2]) throw new Error('Usage: node supabase/tests/evolutionGoTenantLifecycle.sql.mjs /absolute/path/to/pglite/dist/index.js');

const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const migration = await readFile(new URL('../migrations/20261006130000_evolution_go_tenant_lifecycle.sql', import.meta.url), 'utf8');
const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const orgA = id(1);
const orgB = id(2);
const seller = id(11);
const results = [];

async function setup(db) {
  await db.exec(`
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
    create table public.lead_messages(
      id uuid primary key,
      organization_id uuid not null references public.organizations(id) on delete cascade,
      whatsapp_account_id uuid references public.whatsapp_accounts(id) on delete set null,
      text text not null
    );
    insert into public.organizations(id) values ('${orgA}'), ('${orgB}');
  `);
  await db.exec(migration);
}

function record(id, scenario, status = 'PASS', detail = null) {
  results.push({ id, scenario, status, ...(detail ? { detail } : {}) });
}

const db = new PGlite();
try {
  await setup(db);

  // T-EVO-TENANT-001: repeated writes are the same path used by concurrent
  // membership transitions. The migration also uses a transaction advisory lock
  // plus unique keys; PGlite itself runs one in-memory query queue.
  await db.exec(`insert into public.organization_members(organization_id,user_id,role,status)
    values('${orgA}','${seller}','sdr','active');`);
  await Promise.all([
    db.exec(`update public.organization_members set role='vendedor' where organization_id='${orgA}' and user_id='${seller}';`),
    db.exec(`update public.organization_members set status='active' where organization_id='${orgA}' and user_id='${seller}';`),
  ]);
  const created = (await db.query(`
    select
      (select count(*)::int from public.whatsapp_accounts where organization_id='${orgA}' and owner_user_id='${seller}' and provider='evolution_go' and archived_at is null) account_count,
      (select count(*)::int from public.integrations where organization_id='${orgA}' and provider='Evolution GO') integration_count,
      (select count(*)::int from public.evolution_go_seller_provisioning_jobs where organization_id='${orgA}' and user_id='${seller}') job_count,
      (select enabled from public.whatsapp_accounts where organization_id='${orgA}' and owner_user_id='${seller}' and provider='evolution_go') account_enabled,
      (select enabled from public.integrations where organization_id='${orgA}' and provider='Evolution GO') integration_enabled,
      (select paused from public.integrations where organization_id='${orgA}' and provider='Evolution GO') integration_paused,
      (select state from public.evolution_go_seller_provisioning_jobs where organization_id='${orgA}' and user_id='${seller}') job_state
  `)).rows[0];
  assert.deepEqual(created, {
    account_count: 1,
    integration_count: 1,
    job_count: 1,
    account_enabled: false,
    integration_enabled: false,
    integration_paused: true,
    job_state: 'queued',
  });
  const stable = (await db.query(`select instance_name,whatsapp_account_id,integration_id from public.evolution_go_seller_provisioning_jobs where organization_id='${orgA}' and user_id='${seller}'`)).rows[0];
  await db.exec(`update public.organization_members set role='vendedor' where organization_id='${orgA}' and user_id='${seller}';`);
  assert.deepEqual(
    (await db.query(`select instance_name,whatsapp_account_id,integration_id from public.evolution_go_seller_provisioning_jobs where organization_id='${orgA}' and user_id='${seller}'`)).rows[0],
    stable,
  );
  record('T-EVO-TENANT-001', 'idempotência de escritas reentrantes/convergentes cria uma conta, integração e job desabilitados');

  // T-EVO-TENANT-002: the same global person can sell in a second tenant, but
  // each tenant receives a distinct account/job and A changes cannot touch B.
  await db.exec(`insert into public.organization_members(organization_id,user_id,role,status)
    values('${orgB}','${seller}','vendedor','active');
    update public.whatsapp_accounts set connection_status='connected' where organization_id='${orgB}' and owner_user_id='${seller}' and provider='evolution_go';
    update public.integrations set connected=true,status_detail='tenant-b-intacto' where organization_id='${orgB}' and provider='Evolution GO';`);
  const tenants = (await db.query(`
    select organization_id, whatsapp_account_id, integration_id, state
    from public.evolution_go_seller_provisioning_jobs
    where user_id='${seller}'
    order by organization_id
  `)).rows;
  assert.equal(tenants.length, 2);
  assert.notEqual(tenants[0].whatsapp_account_id, tenants[1].whatsapp_account_id);
  assert.notEqual(tenants[0].integration_id, tenants[1].integration_id);
  record('T-EVO-TENANT-002', 'isolamento por tenant mantém conta e job distintos para o mesmo vendedor global');

  // T-EVO-TENANT-003: simulate a disconnected phone plus a stored message,
  // then remove seller capability. The route is fenced locally, no row/history
  // is deleted, and the other tenant stays unchanged.
  await db.exec(`
    update public.whatsapp_accounts
       set connection_status='disconnected'
     where organization_id='${orgA}' and owner_user_id='${seller}' and provider='evolution_go';
    insert into public.lead_messages(id,organization_id,whatsapp_account_id,text)
      select '${id(101)}', organization_id, id, 'histórico preservado após desconexão'
      from public.whatsapp_accounts
      where organization_id='${orgA}' and owner_user_id='${seller}' and provider='evolution_go';
    update public.organization_members
       set role='sdr'
     where organization_id='${orgA}' and user_id='${seller}';
  `);
  const withdrawn = (await db.query(`
    select
      (select state from public.evolution_go_seller_provisioning_jobs where organization_id='${orgA}' and user_id='${seller}') job_state,
      (select enabled from public.whatsapp_accounts where organization_id='${orgA}' and owner_user_id='${seller}' and provider='evolution_go') account_enabled,
      (select connection_status from public.whatsapp_accounts where organization_id='${orgA}' and owner_user_id='${seller}' and provider='evolution_go') connection_status,
      (select enabled from public.integrations where organization_id='${orgA}' and provider='Evolution GO') integration_enabled,
      (select paused from public.integrations where organization_id='${orgA}' and provider='Evolution GO') integration_paused,
      (select count(*)::int from public.lead_messages where id='${id(101)}' and whatsapp_account_id is not null) preserved_history,
      (select connection_status from public.whatsapp_accounts where organization_id='${orgB}' and owner_user_id='${seller}' and provider='evolution_go') tenant_b_connection,
      (select status_detail from public.integrations where organization_id='${orgB}' and provider='Evolution GO') tenant_b_detail
  `)).rows[0];
  assert.deepEqual(withdrawn, {
    job_state: 'cancelled',
    account_enabled: false,
    connection_status: 'disconnected',
    integration_enabled: false,
    integration_paused: true,
    preserved_history: 1,
    tenant_b_connection: 'connected',
    tenant_b_detail: 'tenant-b-intacto',
  });
  record('T-EVO-TENANT-003', 'downgrade desativa somente a rota local do tenant e preserva o histórico após desconexão');

  // T-EVO-TENANT-004: reactivation reuses the canonical account and instance
  // name, requeues only the durable local job and never enables the channel.
  await db.exec(`update public.organization_members
    set role='vendedor', status='active'
    where organization_id='${orgA}' and user_id='${seller}';`);
  const reactivated = (await db.query(`
    select j.state, j.instance_name, a.enabled as account_enabled, i.enabled as integration_enabled, i.paused
    from public.evolution_go_seller_provisioning_jobs j
    join public.whatsapp_accounts a on a.id=j.whatsapp_account_id and a.organization_id=j.organization_id
    join public.integrations i on i.id=j.integration_id and i.organization_id=j.organization_id
    where j.organization_id='${orgA}' and j.user_id='${seller}'
  `)).rows[0];
  assert.equal(reactivated.state, 'queued');
  assert.equal(reactivated.instance_name, stable.instance_name);
  assert.equal(reactivated.account_enabled, false);
  assert.equal(reactivated.integration_enabled, false);
  assert.equal(reactivated.paused, true);
  record('T-EVO-TENANT-004', 'reativação reaproveita o mesmo vínculo e não reabre o canal automaticamente');

  // T-EVO-TENANT-005: disabling the membership cancels pending work, and the
  // backend queue/function remain unavailable to browser roles.
  await db.exec(`update public.organization_members set status='disabled'
    where organization_id='${orgA}' and user_id='${seller}';`);
  assert.equal((await db.query(`select state from public.evolution_go_seller_provisioning_jobs where organization_id='${orgA}' and user_id='${seller}'`)).rows[0].state, 'cancelled');
  assert.equal((await db.query(`select has_table_privilege('authenticated','public.evolution_go_seller_provisioning_jobs','select') allowed`)).rows[0].allowed, false);
  assert.equal((await db.query(`select has_function_privilege('authenticated','private.sync_evolution_go_seller_membership()','execute') allowed`)).rows[0].allowed, false);
  const fn = (await db.query(`select prosecdef, proconfig from pg_proc where oid='private.sync_evolution_go_seller_membership()'::regprocedure`)).rows[0];
  assert.equal(fn.prosecdef, true);
  assert.ok(fn.proconfig.some(value => value.includes('search_path=""')));
  record('T-EVO-TENANT-005', 'desativação cancela trabalho pendente e mantém queue/trigger fora do alcance do navegador');

  // T-EVO-TENANT-006: preflight is explicit and leaves no partial migration
  // behind when the canonical job table is absent.
  const incomplete = new PGlite();
  try {
    await incomplete.exec(`create schema private; create table public.organization_members(organization_id uuid,user_id uuid,role text,status text);`);
    await assert.rejects(() => incomplete.exec(migration), /evolution_go_tenant_lifecycle_prerequisite_missing/);
    record('T-EVO-TENANT-006', 'pré-requisito ausente falha de modo explícito antes de criar trigger ou dados');
  } finally {
    await incomplete.close();
  }

  console.log(JSON.stringify({
    environment: 'PGlite in-memory with synthetic multi-tenant schema; no network, Supabase DSN, credential, QR or provider call',
    migration: '20261006130000_evolution_go_tenant_lifecycle.sql',
    passed: results.filter(result => result.status === 'PASS').length,
    failed: results.filter(result => result.status !== 'PASS').length,
    results,
  }, null, 2));
} finally {
  await db.close();
}
