import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Synthetic, isolated PGlite proof. Never connects to Supabase or Evolution GO.
if (!process.argv[2]) throw new Error('Usage: node supabase/tests/teamDirectCreate.sql.mjs /absolute/path/to/pglite/dist/index.js');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const migration = await readFile(new URL('../migrations/20261007160000_team_direct_create.sql', import.meta.url), 'utf8');
const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const org = id(1), otherOrg = id(2), admin = id(10), seller = id(11), cx = id(12), outsider = id(13), delegated = id(14), fail = id(99);
const db = new PGlite();
const checks = [];

try {
  await db.exec(`
    create schema auth; create schema private;
    create role anon; create role authenticated; create role service_role;
    create type public.app_role as enum ('administrador','vendedor','sdr','cx');
    create table public.organizations(id uuid primary key, updated_at timestamptz default now());
    create table auth.users(
      id uuid primary key, email text not null, email_confirmed_at timestamptz,
      created_at timestamptz not null default now(), raw_user_meta_data jsonb not null default '{}'::jsonb
    );
    create table public.profiles(
      id uuid primary key, name text, email text, active boolean default true,
      active_organization_id uuid, updated_at timestamptz default now()
    );
    create table public.organization_members(
      organization_id uuid, user_id uuid, role public.app_role, status text,
      primary key(organization_id,user_id)
    );
    create table public.audit_logs(
      organization_id uuid, actor_id uuid, actor_name text, actor_type text,
      action text, detail text, entity_table text, event_data jsonb
    );
    create table public.evolution_go_seller_provisioning_jobs(
      organization_id uuid, user_id uuid, state text,
      primary key(organization_id,user_id)
    );
    create function private.has_org_permission(p_org uuid,p_user uuid,p_permission text)
      returns boolean language sql stable as $$
        select p_org='${org}'::uuid and p_user in ('${admin}'::uuid,'${delegated}'::uuid) and p_permission='team.manage'
      $$;
    create function private.r4_assert_available_role(p_org uuid,p_role text)
      returns void language plpgsql as $$ begin
        if p_role not in ('administrador','vendedor','sdr','cx') then
          raise exception 'invalid_member_role';
        end if;
      end $$;
    create function private.synthetic_seller_job() returns trigger language plpgsql as $$ begin
      if new.role='vendedor' and new.status='active' then
        if new.user_id='${fail}'::uuid then raise exception 'synthetic_job_failure'; end if;
        insert into public.evolution_go_seller_provisioning_jobs values(new.organization_id,new.user_id,'queued');
      end if;
      return new;
    end $$;
    create trigger evolution_go_seller_membership_lifecycle
      after insert on public.organization_members for each row
      execute function private.synthetic_seller_job();
    create function private.synthetic_auth_bootstrap() returns trigger language plpgsql as $$ begin
      if new.raw_user_meta_data->>'wayflex_invitation' = 'true' then return new; end if;
      return new;
    end $$;
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function private.synthetic_auth_bootstrap();
    insert into public.organizations(id) values('${org}'),('${otherOrg}');
    insert into auth.users(id,email,email_confirmed_at) values('${admin}','admin@example.test',now()),('${delegated}','delegated@example.test',now());
    insert into public.profiles(id,name,email,active,active_organization_id)
      values('${admin}','Admin','admin@example.test',true,'${org}'),('${delegated}','Delegated','delegated@example.test',true,'${org}');
    insert into public.organization_members values('${org}','${admin}','administrador','active'),('${org}','${delegated}','vendedor','active');
    grant usage on schema public,private,auth to service_role;
    grant select,insert,update on all tables in schema public,auth to service_role;
  `);
  await db.exec(migration);

  const read = async sql => (await db.query(sql)).rows;
  const service = async sql => { await db.exec('set role service_role'); try { return await read(sql); } finally { await db.exec('reset role'); } };
  const expectError = async (name, operation, pattern) => {
    await assert.rejects(operation, pattern);
    checks.push(name);
  };
  assert.equal((await read("select has_function_privilege('authenticated','public.team_direct_create_attach(uuid,uuid,uuid,text,text,text)','EXECUTE') allowed"))[0].allowed, false);
  checks.push('authenticated cannot attach');

  assert.deepEqual((await service(`select public.team_direct_create_preflight('${org}','${admin}','vendedor') result`))[0].result, { ready: true });
  checks.push('authorized seller preflight');
  await expectError('cross-tenant actor denied', () => service(`select public.team_direct_create_preflight('${otherOrg}','${admin}','vendedor')`), /organization_access_denied/);
  await expectError('delegated team manager cannot create global identity', () => service(`select public.team_direct_create_preflight('${org}','${delegated}','cx')`), /organization_access_denied/);

  await db.exec(`
    insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
      values('${seller}','seller@example.test',now(),' {"wayflex_direct_create":true,"wayflex_invitation":true}'::jsonb),
            ('${cx}','cx@example.test',now(),' {"wayflex_direct_create":true,"wayflex_invitation":true}'::jsonb),
            ('${fail}','fail@example.test',now(),' {"wayflex_direct_create":true,"wayflex_invitation":true}'::jsonb),
            ('${outsider}','outsider@example.test',now(),'{}'::jsonb);
    insert into public.profiles(id,name,email) values
      ('${seller}','Pending','seller@example.test'),
      ('${cx}','Pending','cx@example.test'),
      ('${fail}','Pending','fail@example.test'),
      ('${outsider}','Pending','outsider@example.test');
  `);
  const attach = (user, email, role, name = 'Novo usuário') => `select public.team_direct_create_attach('${org}','${admin}','${user}','${email}','${name}','${role}') result`;
  assert.equal((await service(attach(seller, 'seller@example.test', 'vendedor')))[0].result.user_id, seller);
  assert.equal((await read(`select count(*)::int n from public.evolution_go_seller_provisioning_jobs where user_id='${seller}' and state='queued'`))[0].n, 1);
  assert.equal((await read(`select count(*)::int n from public.organization_members where user_id='${seller}' and organization_id='${org}' and role='vendedor'`))[0].n, 1);
  checks.push('seller membership and local Evolution GO job committed together');

  await expectError('existing identity not reattached', () => service(attach(seller, 'seller@example.test', 'administrador')), /member_identity_not_attachable/);
  await expectError('unmarked identity not adopted', () => service(attach(outsider, 'outsider@example.test', 'cx')), /member_identity_not_attachable/);
  assert.equal((await service(attach(cx, 'cx@example.test', 'cx')))[0].result.role, 'cx');
  assert.equal((await read(`select count(*)::int n from public.evolution_go_seller_provisioning_jobs where user_id='${cx}'`))[0].n, 0);
  checks.push('non-seller role has no Evolution GO job');

  await expectError('failed seller trigger rolls back profile and membership', () => service(attach(fail, 'fail@example.test', 'vendedor')), /synthetic_job_failure/);
  assert.equal((await read(`select active_organization_id from public.profiles where id='${fail}'`))[0].active_organization_id, null);
  assert.equal((await read(`select count(*)::int n from public.organization_members where user_id='${fail}'`))[0].n, 0);

  await db.exec('alter table public.organization_members disable trigger evolution_go_seller_membership_lifecycle');
  await expectError('missing seller lifecycle blocks preflight', () => service(`select public.team_direct_create_preflight('${org}','${admin}','vendedor')`), /evolution_go_lifecycle_unavailable/);
  await db.exec('alter table auth.users disable trigger on_auth_user_created');
  await expectError('missing safe Auth bootstrap blocks preflight', () => service(`select public.team_direct_create_preflight('${org}','${admin}','cx')`), /member_auth_bootstrap_incompatible/);
  console.log(JSON.stringify({ test: 'team direct create PGlite', passed: checks.length, checks }, null, 2));
} finally {
  await db.close();
}
