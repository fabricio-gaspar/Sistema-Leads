import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Pass the installed PGlite module path; no remote DSN is accepted.');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const migration = await readFile(new URL('../migrations/20261007195000_team_member_identity_erasure.sql', import.meta.url), 'utf8');
const sharedDataMigration = await readFile(new URL('../migrations/20261007205000_preserve_company_data_on_user_erasure.sql', import.meta.url), 'utf8');
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const org = id(1), otherOrg = id(2), admin = id(10), target = id(11), otherAdmin = id(12);
const db = new PGlite();
const checks = [];

try {
  await db.exec(`
    create schema auth;
    create schema storage;
    create schema private;
    create role anon;
    create role service_role;
    create role authenticated;
    create function auth.role() returns text language sql stable as $$
      select current_setting('request.jwt.claim.role', true)
    $$;
    create type public.app_role as enum ('administrador','vendedor');
    create table auth.users(id uuid primary key, email text not null);
    create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, name text);
    create table public.organization_members(
      organization_id uuid, user_id uuid, role public.app_role, status text,
      primary key(organization_id,user_id)
    );
    create table public.organization_invites(
      organization_id uuid, email text, accepted_at timestamptz,
      cancelled_at timestamptz, expires_at timestamptz
    );
    create table public.team_member_evolution_removal_claims(
      organization_id uuid, user_id uuid references auth.users(id) on delete cascade, state text
    );
    create table public.whatsapp_accounts(owner_user_id uuid);
    create table public.evolution_go_seller_provisioning_jobs(user_id uuid);
    create table public.appointments(user_id uuid);
    create table public.lead_handoff_policies(assignee_user_id uuid);
    create table public.handoff_whatsapp_deliveries(recipient_user_id uuid);
    create table public.daily_lead_report_deliveries(user_id uuid);
    create table public.prospecting_cache(user_id uuid);
    create table storage.objects(owner_id text);
    create table public.audit_logs(
      id uuid primary key default gen_random_uuid(), organization_id uuid,
      actor_id uuid references auth.users(id) on delete set null,
      actor_name text not null, actor_type text not null, action text not null,
      detail text, rule text, occurred_at timestamptz, created_at timestamptz,
      entity_table text, entity_id uuid, event_data jsonb not null default '{}'::jsonb
    );
    create function public.prevent_audit_mutation() returns trigger language plpgsql as $$
      begin raise exception 'Logs de auditoria são imutáveis'; end
    $$;
    create trigger audit_logs_immutable before update or delete on public.audit_logs
      for each row execute function public.prevent_audit_mutation();
    create function public.audit_invite_delete() returns trigger language plpgsql as $$
      begin
        insert into public.audit_logs(organization_id,actor_id,actor_name,actor_type,action,detail,event_data)
          values(old.organization_id,null,'Sistema','system','invite.deleted',old.email,
            jsonb_build_object('email',old.email));
        return old;
      end
    $$;
    create trigger audit_organization_invites after delete on public.organization_invites
      for each row execute function public.audit_invite_delete();
    insert into auth.users values('${admin}','admin@example.test'),('${target}','seller@example.test'),('${otherAdmin}','other@example.test');
    insert into public.profiles values('${target}','Seller');
    insert into public.organization_members values
      ('${org}','${admin}','administrador','active'),
      ('${org}','${target}','vendedor','active'),
      ('${otherOrg}','${otherAdmin}','administrador','active');
    insert into public.organization_invites values('${org}','seller@example.test',now(),null,now()-interval '1 day');
    insert into public.audit_logs(id,organization_id,actor_id,actor_name,actor_type,action,detail,event_data)
      values('${id(20)}','${org}','${target}','Seller','user','test.action',
        'Account seller@example.test',jsonb_build_object('user_id','${target}'));
    grant usage on schema public,auth to service_role,authenticated;
    grant select on all tables in schema public,auth to service_role;
  `);
  await db.exec(migration);
  await db.exec(sharedDataMigration);
  const read = async (sql) => (await db.query(sql)).rows;
  const service = async (sql) => {
    await db.exec("set request.jwt.claim.role = 'service_role'; set role service_role;");
    try { return await read(sql); }
    finally { await db.exec('reset role; reset request.jwt.claim.role;'); }
  };
  const preflight = (actor = admin, orgId = org) =>
    `select public.team_member_identity_erasure_preflight('${orgId}','${actor}','${target}') result`;
  assert.equal((await service(preflight()))[0].result.ready, true);
  checks.push('administrator preflight');
  await assert.rejects(() => service(preflight(admin, otherOrg)), /member_removal_admin_required/);
  checks.push('cross-tenant administrator denied');
  await db.exec(`insert into public.organization_members values('${otherOrg}','${target}','vendedor','active')`);
  await assert.rejects(() => service(preflight()), /member_linked_to_another_organization/);
  await db.exec(`delete from public.organization_members where organization_id='${otherOrg}' and user_id='${target}'`);
  checks.push('other-tenant membership blocks global erasure');
  await db.exec(`insert into public.appointments values('${target}')`);
  await assert.rejects(() => service(`select public.team_member_shared_data_preflight('${target}')`), /member_shared_company_data_requires_reassignment/);
  await assert.rejects(() => db.exec(`delete from auth.users where id='${target}'`), /member_shared_company_data_requires_reassignment/);
  assert.equal((await read(`select count(*)::int n from auth.users where id='${target}'`))[0].n, 1);
  await db.exec(`delete from public.appointments where user_id='${target}'`);
  checks.push('shared company records block both preflight and Auth cascade');
  await assert.rejects(() => service(`select public.team_member_identity_erasure_finalize('${org}','${admin}','${target}')`), /member_remote_removal_unconfirmed/);
  checks.push('remote confirmation required');
  await db.exec(`delete from public.organization_members where organization_id='${org}' and user_id='${target}';
    insert into public.team_member_evolution_removal_claims values('${org}','${target}','finalized');`);
  await assert.rejects(() => db.exec(`update public.audit_logs set actor_name='changed' where id='${id(20)}'`), /Logs de auditoria são imutáveis/);
  checks.push('audit immutable outside erasure transaction');
  const finalized = (await service(`select public.team_member_identity_erasure_finalize('${org}','${admin}','${target}') result`))[0].result;
  assert.equal(finalized.identity_deleted, true);
  assert.equal(finalized.audit_rows_anonymized, 2);
  assert.equal(finalized.invites_deleted, 1);
  assert.equal((await read(`select count(*)::int n from auth.users where id='${target}'`))[0].n, 0);
  assert.equal((await read(`select count(*)::int n from public.profiles where id='${target}'`))[0].n, 0);
  assert.equal((await read(`select count(*)::int n from public.team_member_evolution_removal_claims where user_id='${target}'`))[0].n, 0);
  const scrubbed = (await read(`select actor_id,actor_name,detail,event_data from public.audit_logs where id='${id(20)}'`))[0];
  assert.equal(scrubbed.actor_id, null);
  assert.equal(scrubbed.actor_name, 'Usuário excluído');
  assert.deepEqual(scrubbed.event_data, {});
  assert.equal((await read(`select count(*)::int n from public.audit_logs where action='invite.deleted' and detail='seller@example.test'`))[0].n, 0);
  checks.push('Auth and personal data erased, company audit anonymized');
  await assert.rejects(() => db.exec(`update public.audit_logs set actor_name='changed' where id='${id(20)}'`), /Logs de auditoria são imutáveis/);
  checks.push('audit trigger restored after erasure');
  assert.equal((await read(`select count(*)::int n from public.audit_logs where action='team.identity_erased'`))[0].n, 1);
  checks.push('anonymized erasure receipt');
  console.log(JSON.stringify({ test: 'identity erasure PGlite', passed: checks.length, checks }, null, 2));
} finally {
  await db.close();
}
