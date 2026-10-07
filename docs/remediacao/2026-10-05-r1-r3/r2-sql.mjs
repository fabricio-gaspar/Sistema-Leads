import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Accepts only a caller-created isolated database, never a DSN or remote client.
export async function runR2Sql(db) {
const root = new URL('../../../', import.meta.url);
const migration = await readFile(new URL('supabase/migrations/20261005220138_audit_r2_account_lifecycle.sql', root), 'utf8');
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const seller='11111111-1111-4111-8111-111111111111', manager='22222222-2222-4222-8222-222222222222';
const account='33333333-3333-4333-8333-333333333333', integration='44444444-4444-4444-8444-444444444444';
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema private;
create table public.organizations(id uuid primary key);
create table public.profiles(id uuid primary key, active_organization_id uuid);
create table public.organization_members(organization_id uuid,user_id uuid,role text,status text);
create table public.integrations(id uuid primary key,organization_id uuid,provider text,enabled boolean,paused boolean,connected boolean,
  last_tested_at timestamptz,last_success_at timestamptz,last_error text,last_error_at timestamptz,status_detail text,configuration jsonb default '{}',updated_at timestamptz);
create table public.whatsapp_accounts(id uuid primary key,organization_id uuid,integration_id uuid,provider text,owner_user_id uuid,
  account_type text,enabled boolean,is_default boolean default false,archived_at timestamptz,connection_status text,
  connected_at timestamptz,status_checked_at timestamptz,webhook_registered_at timestamptz,connected_phone_suffix text,last_error_code text,updated_at timestamptz);
create unique index whatsapp_accounts_org_default_uidx on public.whatsapp_accounts(organization_id) where is_default and archived_at is null;
create table public.messaging_provider_controls(organization_id uuid,provider text,inbound_enabled boolean,send_enabled boolean,
  automation_enabled boolean,kill_switch boolean,reason text,changed_by uuid,updated_at timestamptz,primary key(organization_id,provider));
create table public.audit_logs(organization_id uuid,actor_id uuid,actor_name text not null,actor_type text,action text,detail text,entity_table text,entity_id uuid,event_data jsonb);
create function private.has_org_permission(o uuid,u uuid,p text) returns boolean language sql stable as $$
  select exists(select 1 from public.organization_members where organization_id=o and user_id=u and status='active'
    and (role='administrador' or p in ('channels.view_own','channels.connect_own')))
$$;
grant usage on schema private to service_role;
grant all on all tables in schema public to service_role;
insert into public.organizations values('${A}'),('${B}');
insert into public.profiles values('${seller}','${A}'),('${manager}','${A}');
insert into public.organization_members values('${A}','${seller}','vendedor','active'),('${A}','${manager}','administrador','active');
`);
await db.exec(migration);
// Include the actual legacy trigger: integration writes project account flags.
await db.exec(await readFile(new URL('supabase/migrations/20260927160000_preserve_whatsapp_connection_state_when_provider_paused.sql',root),'utf8'));
await db.exec(`create trigger legacy_sync after update on public.integrations for each row execute function private.sync_whatsapp_account_from_integration();
create function private.r2_fault() returns trigger language plpgsql as $$ begin
  if current_setting('r2.fail_table',true)=TG_TABLE_NAME then raise exception 'injected_%',TG_TABLE_NAME; end if;
  return new; end $$;
create trigger fail_integration before update on public.integrations for each row execute function private.r2_fault();
create trigger fail_account before update on public.whatsapp_accounts for each row execute function private.r2_fault();
create trigger fail_audit before insert on public.audit_logs for each row execute function private.r2_fault();
create trigger fail_lifecycle before update on private.whatsapp_account_lifecycle for each row execute function private.r2_fault();`);
const results=[];
let provider='wa_akg';
const lit=v=>v===null?'null':`'${String(v).replaceAll("'","''")}'`;
async function query(sql){return (await db.query(sql)).rows;}
async function rpc(name,args){return (await query(`select public.${name}(${args.map(lit).join(',')}) as result`))[0].result;}
const base=()=>[A,account,provider,seller];
const begin=action=>rpc('begin_whatsapp_account_lifecycle',[...base(),action]);
const finish=(ticket,result)=>rpc('finish_whatsapp_account_lifecycle',[...base(),ticket.operation_id,ticket.revision,JSON.stringify(result)]);
const snapshot=()=>query(`select a.enabled,a.is_default,i.enabled as integration_enabled,i.paused from public.whatsapp_accounts a join public.integrations i on i.id=a.integration_id where a.id='${account}'`);
async function reset(p='wa_akg'){
  provider=p;
  await db.exec(`reset role; set r2.fail_table=''; truncate private.whatsapp_account_lifecycle, public.audit_logs;
    delete from public.whatsapp_accounts; delete from public.integrations; delete from public.messaging_provider_controls;
    update public.profiles set active_organization_id='${A}'; update public.organization_members set status='active';
    insert into public.integrations(id,organization_id,provider,enabled,paused,connected) values('${integration}','${A}','${p=== 'wa_akg'?'WA-AKG':'Evolution GO'}',true,false,true);
    insert into public.whatsapp_accounts(id,organization_id,integration_id,provider,owner_user_id,account_type,enabled,is_default,connection_status)
      values('${account}','${A}','${integration}','${p}','${seller}','seller',true,false,'connected');
    insert into public.messaging_provider_controls values('${A}','${p}',false,false,false,true,'admin_emergency','${manager}',now());
    set role service_role;`);
}
async function test(id,fn){await reset();await fn();results.push({id,status:'APROVADO',mode:'SQL real; schema mínimo e trigger legado real; sem rede externa'});}
await test('R2-SQL-01',async()=>{
  const t=await begin('activate');assert.equal((await snapshot())[0].enabled,false);
  assert.equal((await finish(t,{success:true,connected:true})).state,'completed');
  assert.deepEqual((await snapshot())[0],{enabled:true,is_default:false,integration_enabled:true,paused:false});
  assert.equal((await query('select kill_switch from public.messaging_provider_controls'))[0].kill_switch,true);
});
await test('R2-SQL-02',async()=>{await reset('evolution_go');const t=await begin('activate');await finish(t,{success:true,connected:true});assert.equal((await query('select kill_switch from public.messaging_provider_controls'))[0].kill_switch,true);});
await test('R2-SQL-03',async()=>{
  const t=await begin('disconnect');assert.deepEqual((await snapshot())[0],{enabled:false,is_default:false,integration_enabled:false,paused:true});
  assert.equal((await finish(t,{success:false,uncertain:true,error_code:'network_timeout'})).state,'needs_review');
  assert.equal((await begin('connect')).admitted,false);assert.equal((await begin('deactivate')).state,'needs_review');assert.equal((await snapshot())[0].enabled,false);
});
await test('R2-SQL-04',async()=>{
  const older=await begin('activate');const newer=await begin('deactivate');assert.ok(newer.revision>older.revision);assert.equal(newer.admitted,false);
  assert.equal((await finish(older,{success:true,connected:true})).state,'pending');assert.equal((await snapshot())[0].enabled,false);
  assert.equal((await rpc('get_whatsapp_account_lifecycle',base())).state,'completed');
});
await test('R2-SQL-05',async()=>{
  const older=await begin('refresh_status');await begin('deactivate');await finish(older,{success:true,connected:true});assert.equal((await snapshot())[0].enabled,false);
});
await test('R2-SQL-06',async()=>{
  const older=await begin('connect');const newer=await begin('logout');assert.equal(newer.admitted,false);
  await finish(older,{success:true});const retry=await begin('logout');assert.equal(retry.admitted,true);assert.ok(retry.revision>newer.revision);
});
for(const table of ['integrations','whatsapp_accounts','audit_logs','whatsapp_account_lifecycle']){
  await test(`R2-SQL-BEGIN-${table}`,async()=>{await db.exec(`set r2.fail_table='${table}'`);await assert.rejects(()=>begin('activate'),/injected_/);await db.exec("set r2.fail_table=''");assert.equal((await snapshot())[0].enabled,true);assert.equal((await query('select count(*)::int n from private.whatsapp_account_lifecycle'))[0].n,0);});
  await test(`R2-SQL-FINISH-${table}`,async()=>{const t=await begin('activate');await db.exec(`set r2.fail_table='${table}'`);await assert.rejects(()=>finish(t,{success:true,connected:true}),/injected_/);await db.exec("set r2.fail_table=''");assert.deepEqual((await snapshot())[0],{enabled:false,is_default:false,integration_enabled:false,paused:true});assert.equal((await rpc('get_whatsapp_account_lifecycle',base())).state,'in_flight');});
}
await test('R2-SQL-15',async()=>{await db.exec('reset role; set role authenticated');await assert.rejects(()=>begin('activate'),/permission denied/);await assert.rejects(()=>query('select * from private.whatsapp_account_lifecycle'),/permission denied/);});
await test('R2-SQL-16',async()=>{await assert.rejects(()=>rpc('begin_whatsapp_account_lifecycle',[B,account,provider,seller,'activate']),/access_denied/);await assert.rejects(()=>rpc('begin_whatsapp_account_lifecycle',[A,account,'evolution_go',seller,'activate']),/access_denied/);});
await test('R2-SQL-17',async()=>{const t=await begin('activate');await db.exec(`update public.organization_members set status='disabled' where user_id='${seller}'`);await assert.rejects(()=>finish(t,{success:true,connected:true}),/access_denied/);assert.equal((await snapshot())[0].enabled,false);});
await test('R2-SQL-18',async()=>{const t=await begin('activate');await assert.rejects(()=>rpc('finish_whatsapp_account_lifecycle',[A,account,provider,manager,t.operation_id,t.revision,JSON.stringify({success:true,connected:true})]),/operation_mismatch/);});
await test('R2-SQL-19',async()=>{
  for(const action of ['save','create_instance','provision','configure_gateway']) await assert.rejects(()=>begin(action),/access_denied/);
  const t=await begin('activate');const blocked=await rpc('begin_whatsapp_account_lifecycle',[A,account,provider,manager,'provision']);assert.equal(blocked.admitted,false);await finish(t,{success:true,connected:true});assert.equal((await snapshot())[0].enabled,false);
});
await test('R2-SQL-20',async()=>{
  await assert.rejects(()=>rpc('set_whatsapp_account_provider_controls',[...base(),true,true,true,false]),/access_denied/);
  await rpc('set_whatsapp_account_provider_controls',[A,account,provider,manager,true,true,false,false]);
  assert.deepEqual((await query('select inbound_enabled,send_enabled,automation_enabled,kill_switch from public.messaging_provider_controls'))[0],{inbound_enabled:true,send_enabled:true,automation_enabled:false,kill_switch:false});
  await assert.rejects(()=>rpc('set_whatsapp_account_provider_controls',[A,account,provider,manager,true,true,true,true]),/invalid/);
});
await test('R2-SQL-21',async()=>{await db.exec(`delete from public.integrations where id='${integration}'`);await assert.rejects(()=>begin('activate'),/access_denied/);});
await test('R2-SQL-22',async()=>{await db.exec(`delete from public.whatsapp_accounts where id='${account}'`);await assert.rejects(()=>begin('activate'),/access_denied/);});
await test('R2-SQL-23',async()=>{const t=await begin('activate');await finish(t,{success:false,uncertain:false,error_code:'not_connected'});assert.equal((await rpc('get_whatsapp_account_lifecycle',base())).state,'failed');assert.equal((await begin('activate')).admitted,true);});
await test('R2-SQL-24',async()=>{const t=await begin('activate');await db.exec(`update public.profiles set active_organization_id='${B}' where id='${seller}'`);await assert.rejects(()=>finish(t,{success:true,connected:true}),/access_denied/);assert.equal((await snapshot())[0].enabled,false);});
await test('R2-SQL-25',async()=>{await db.exec("update public.integrations set last_error='previous_error',last_error_at=now()");const t=await begin('connect');await finish(t,{success:true,webhook_registered:true});const rows=await query('select a.webhook_registered_at is not null as registered,i.last_error,i.last_error_at from public.whatsapp_accounts a join public.integrations i on i.id=a.integration_id');assert.deepEqual(rows[0],{registered:true,last_error:null,last_error_at:null});});
await test('R2-SQL-26',async()=>{const t=await rpc('begin_whatsapp_account_lifecycle',[A,account,provider,manager,'save']);await rpc('finish_whatsapp_account_lifecycle',[A,account,provider,manager,t.operation_id,t.revision,JSON.stringify({success:true})]);assert.equal((await query('select connection_status from public.whatsapp_accounts'))[0].connection_status,'configured');});
await test('R2-SQL-27',async()=>{
  await reset('evolution_go');
  await db.exec(`update public.whatsapp_accounts set account_type='corporate',owner_user_id=null;
    insert into public.integrations(id,organization_id,provider,connected,enabled,paused) values('66666666-6666-4666-8666-666666666666','${A}','Evolution GO',true,true,false);
    insert into public.whatsapp_accounts(id,organization_id,integration_id,provider,account_type,enabled,is_default,connection_status)
      values('55555555-5555-4555-8555-555555555555','${A}','66666666-6666-4666-8666-666666666666','evolution_go','corporate',true,true,'connected');`);
  const t=await rpc('begin_whatsapp_account_lifecycle',[A,account,provider,manager,'activate']);
  await rpc('finish_whatsapp_account_lifecycle',[A,account,provider,manager,t.operation_id,t.revision,JSON.stringify({success:true,connected:true})]);
  assert.deepEqual(await query('select id from public.whatsapp_accounts where is_default'),[{id:account}]);
});
await test('R2-SQL-28',async()=>{
  const corporate='55555555-5555-4555-8555-555555555555';
  await db.exec(`insert into public.integrations(id,organization_id,provider,connected,enabled,paused) values('66666666-6666-4666-8666-666666666666','${A}','WA-AKG',false,false,true);
    insert into public.whatsapp_accounts(id,organization_id,integration_id,provider,account_type,enabled,is_default,connection_status)
      values('${corporate}','${A}','66666666-6666-4666-8666-666666666666','wa_akg','corporate',false,false,'configured');`);
  const sellerOperation=await begin('activate');
  assert.equal((await rpc('begin_whatsapp_account_lifecycle',[A,corporate,provider,manager,'configure_gateway'])).admitted,false);
  await finish(sellerOperation,{success:true,connected:true});
  const gateway=await rpc('begin_whatsapp_account_lifecycle',[A,corporate,provider,manager,'configure_gateway']);assert.equal(gateway.admitted,true);
  assert.equal((await begin('activate')).admitted,false);assert.equal((await snapshot())[0].enabled,false);
});
return {migration:'20261005220138_audit_r2_account_lifecycle.sql',passed:results.length,failed:0,limits:'Schema mínimo com trigger legado real. Interleavings sequenciais controlados; erros e rollback SQL reais. Não é o banco remoto completo.',results};
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
  const db = new PGlite();
  try { console.log(JSON.stringify({ engine: 'PGlite 0.3.14', ...await runR2Sql(db) },null,2)); }
  finally { await db.close(); }
}
