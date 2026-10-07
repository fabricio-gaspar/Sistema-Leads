import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fixtureSql, A, B, admin, seller, peer, outsider, id, root } from './rlsRemediation.integration.mjs';
export { A, B, admin, seller, peer, outsider, id };
export const stamp = '2026-10-05T10:00:00Z';
export const call = (request = 101, parent = 11, overrides = {}) => {
  const values = { title: "'Próxima ação'", start: "'2026-10-06T13:00Z'", duration: '30', expected: `'${stamp}'`, allow: 'false', ...overrides };
  return `select public.create_agenda_next_action('${id(parent)}','${id(request)}',${values.expected},${values.title},${values.start},${values.duration},${values.allow}) result`;
};

export async function setup(db) {
  await db.exec(await fixtureSql());
  const envelope = JSON.parse(await readFile(new URL('docs/remediacao/2026-10-05-r4-r14/R9_SCHEMA_READONLY.json', root), 'utf8'));
  const wrapped = JSON.parse(envelope.result.content[0].text).result;
  const metadata = JSON.parse(wrapped.match(/<untrusted-data-[^>]+>\n([\s\S]*?)\n<\/untrusted-data-/)[1])[0].metadata;
  await db.exec(`${metadata.helper};
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${admin}'),('${seller}'),('${peer}'),('${outsider}');
    create table public.appointments (
      id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
      lead_id uuid not null references public.leads(id), user_id uuid not null references auth.users(id),
      title text not null, starts_at timestamptz not null, ends_at timestamptz not null,
      status text default 'scheduled' check(status in ('scheduled','confirmed','completed','cancelled','no_show','rescheduled','pending')),
      meeting_url text, created_at timestamptz default now(), notes text, provider text, external_id text,
      updated_at timestamptz not null default now(), metadata jsonb not null default '{}', check(ends_at > starts_at));
    alter table public.appointments enable row level security;
    create policy org_active_access on public.appointments for all to authenticated
      using(private.is_active_org_member(organization_id,auth.uid())) with check(private.is_active_org_member(organization_id,auth.uid()));
    grant select,insert,update,delete on public.appointments to authenticated,service_role;
    create function private.r9_test_touch() returns trigger language plpgsql as $$ begin new.updated_at=clock_timestamp(); return new; end $$;
    create trigger touch before update on public.appointments for each row execute function private.r9_test_touch();
    create table public.r9_test_audit(id uuid);
    create function private.r9_test_audit() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$ begin insert into public.r9_test_audit values(new.id); return new; end $$;
    create trigger audit after insert or update on public.appointments for each row execute function private.r9_test_audit();
    insert into public.appointments(id,organization_id,lead_id,user_id,title,starts_at,ends_at,updated_at,metadata) values
    ('${id(11)}','${A}','${id(1)}','${seller}','Original','2026-10-05T13:00Z','2026-10-05T14:00Z','${stamp}','{"responsible_user_id":"${seller}","timezone":"America/Sao_Paulo","reminder_status":"sent"}'),
    ('${id(12)}','${A}','${id(2)}','${peer}','Outra carteira','2026-10-05T13:00Z','2026-10-05T14:00Z','${stamp}','{}'),
    ('${id(13)}','${B}','${id(3)}','${outsider}','Outra empresa','2026-10-05T13:00Z','2026-10-05T14:00Z','${stamp}','{}');
    truncate public.r9_test_audit;
  `);
  await db.exec(`begin;set local role authenticated;set local audit.user_id='${seller}'`);
  const before = (await db.query('select count(*)::int n from public.appointments')).rows[0].n;
  await db.exec('rollback');
  await db.exec(await readFile(new URL('supabase/migrations/20261005223557_audit_r9_agenda_next_action_atomic.sql', root), 'utf8'));
  return { deployedLegacyPolicyVisibleAppointments: before, expectedBefore: 2 };
}

export async function runTests(db) {
  const baseline = await setup(db); const tests = [];
  async function test(name, sql, expected, options = {}) {
    await db.exec('begin');
    try {
      if(options.setup) await db.exec(options.setup);
      await db.exec(`set local role ${options.role ?? 'authenticated'};set local audit.user_id='${options.user ?? seller}'`);
      let rows;
      for (const statement of Array.isArray(sql) ? sql : [sql]) rows=(await db.query(statement)).rows;
      const passed = !options.error && expected(rows);
      tests.push({name, passed, observed:rows});
    } catch(error) { tests.push({name, passed:error.code===options.error, code:error.code, message:error.message}); }
    finally { await db.exec('rollback'); }
  }
  const count = n => rows => rows[0].n === n;
  await test('Own portfolio only', 'select count(*)::int n from public.appointments', count(1));
  await test('Admin can see both portfolios, not other org', 'select count(*)::int n from public.appointments', count(2), {user:admin});
  await test('Cross-portfolio update touches no row', `update public.appointments set title='forged' where id='${id(12)}' returning id`, rows=>rows.length===0);
  await test('Cross-org update touches no row', `update public.appointments set title='forged' where id='${id(13)}' returning id`, rows=>rows.length===0);
  await test('Private MVCC barrier cannot be written directly', `insert into private.agenda_responsible_revision values('${A}','${seller}',100)`, ()=>false, {error:'42501'});
  await test('Private barrier helper denies cross-portfolio scope', `select private.r9_lock_agenda_responsible('${A}','${id(2)}','${seller}')`, ()=>false, {error:'42501'});
  await test('Private barrier helper denies cross-organization scope', `select private.r9_lock_agenda_responsible('${B}','${id(3)}','${outsider}')`, ()=>false, {error:'42501'});
  await test('Anonymous caller cannot invoke barrier', `select private.r9_lock_agenda_responsible('${A}','${id(1)}','${seller}')`, ()=>false, {error:'42501',role:'anon'});
  await test('Creates child and parent link atomically', [call(), `select (metadata->>'next_action_id'='${id(101)}') ok from public.appointments where id='${id(11)}'`], rows=>rows[0].ok);
  await test('Child duration and no external identity/reminder claim', [call(), `select (ends_at-starts_at=interval '30 minutes' and provider is null and external_id is null and metadata->>'reminder_status'='not_scheduled') ok from public.appointments where id='${id(101)}'`], rows=>rows[0].ok);
  await test('Same request replays once despite stale expected timestamp', [call(), call(), 'select count(*)::int n from public.appointments'], count(2));
  await test('Same id with changed payload rejected', [call(), call(101,11,{title:"'changed'"})], ()=>false, {error:'22023'});
  await test('Other portfolio rejected', call(101,12), ()=>false, {error:'42501'});
  await test('Other organization rejected', call(101,13), ()=>false, {error:'42501'});
  await test('Stale parent version rejected', call(101,11,{expected:"'2020-01-01Z'"}), ()=>false, {error:'40001'});
  await test('Same parent/request id rejected', call(11,11), ()=>false, {error:'22023'});
  for (const duration of ['0','-1','1441','null']) await test(`Invalid duration ${duration}`, call(101,11,{duration}), ()=>false, {error:'22023'});
  await test('Invalid infinite datetime rejected', call(101,11,{start:"'infinity'"}), ()=>false, {error:'22023'});
  await test('Blank title rejected', call(101,11,{title:"' '"}), ()=>false, {error:'22023'});
  await test('Revoked reply permission blocked', call(), ()=>false, {error:'42501',setup:`insert into public.team_member_permissions values('${A}','${seller}','conversations.reply_assigned',false)`});
  await test('Inactive membership blocked', call(), ()=>false, {error:'42501',setup:`update public.organization_members set status='disabled' where user_id='${seller}'`});
  await test('Anonymous execution revoked', call(), ()=>false, {role:'anon',error:'42501'});
  await test('Overlap rejected', call(101,11,{start:"'2026-10-05T13:15Z'"}), ()=>false, {error:'23P01'});
  await test('Explicit overlap consent recorded', [call(101,11,{start:"'2026-10-05T13:15Z'",allow:'true'}),`select (metadata->'next_action_request'->>'allow_conflict'='true') ok from public.appointments where id='${id(101)}'`], rows=>rows[0].ok);
  await test('Failure linking parent rolls back child and audit', [
    `do $$ begin perform public.create_agenda_next_action('${id(11)}','${id(101)}','${stamp}','Próxima ação','2026-10-06T13:00Z',30,false); raise exception 'unexpected_success'; exception when check_violation then null; end $$`,
    'select count(*)::int n from public.appointments'], count(1), {setup:`create function private.r9_test_fail() returns trigger language plpgsql as $$ begin raise exception 'injected_parent_update_failure' using errcode='23514'; end $$;create trigger fail before update on public.appointments for each row execute function private.r9_test_fail();`});
  await test('Audit persistence failure rolls back child and link', [
    `do $$ begin perform public.create_agenda_next_action('${id(11)}','${id(101)}','${stamp}','Próxima ação','2026-10-06T13:00Z',30,false); raise exception 'unexpected_success'; exception when check_violation then null; end $$`,
    `select (count(*)=1 and bool_and(metadata->>'next_action_id' is null)) ok from public.appointments`], rows=>rows[0].ok, {setup:`alter table public.r9_test_audit add constraint injected check(false)`});
  await test('Direct insert in another portfolio denied', `insert into public.appointments(organization_id,lead_id,user_id,title,starts_at,ends_at) values('${A}','${id(2)}','${seller}','forged','2026-10-06T13:00Z','2026-10-06T14:00Z')`, ()=>false, {error:'42501'});
  await test('Direct insert with forged actor denied', `insert into public.appointments(organization_id,lead_id,user_id,title,starts_at,ends_at) values('${A}','${id(1)}','${peer}','forged','2026-10-06T13:00Z','2026-10-06T14:00Z')`, ()=>false, {error:'42501'});
  return {scope:'Synthetic local SQL, real helper and schema metadata captured read-only; audit trigger simulated; no production writes',baseline,tests,passed:tests.filter(t=>t.passed).length,failed:tests.filter(t=>!t.passed).length};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const {PGlite}=await import(pathToFileURL(resolve(process.argv[2])).href); const db=new PGlite();
  try { const result=await runTests(db); console.log(JSON.stringify(result,null,2)); if(result.failed)process.exitCode=1; } finally { await db.close(); }
}
