import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fixtureSql, A, B, admin, seller, outsider, id, root } from './rlsRemediation.integration.mjs';
export { A, B, admin, seller, outsider, id };
export const migration = 'supabase/migrations/20261005223638_audit_r4_team_access.sql';
export async function setup(db) {
  await db.exec(await fixtureSql());
  await db.exec(await readFile(new URL('supabase/migrations/20261005220137_audit_r1_access_hardening.sql',root),'utf8'));
  await db.exec(`
alter table public.organizations alter column id set default gen_random_uuid();
alter table public.organizations add column name text default 'Synthetic company',add column slug text;
alter table public.organization_members add column updated_at timestamptz default now();
alter table public.profiles add column name text,add column email text,add column phone text,add column active boolean default true,add column can_use_ia boolean,add column updated_at timestamptz default now();
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,invited_at timestamptz,raw_user_meta_data jsonb default '{}');
insert into auth.users(id,email,email_confirmed_at) values('${admin}','admin@synthetic.test',now()),('${seller}','seller@synthetic.test',now()),('${outsider}','other@synthetic.test',now()),('${id(91)}','invite@synthetic.test',now()),('${id(92)}','unverified@synthetic.test',null);
insert into public.profiles(id,name,email) values('${id(91)}','Invited','invite@synthetic.test'),('${id(92)}','Unverified','unverified@synthetic.test');
update public.profiles set name='Synthetic',email=id::text||'@synthetic.test' where name is null;
alter table public.profiles alter column name set not null,alter column email set not null,add unique(email);
create table public.organization_invites(id uuid primary key default gen_random_uuid(),organization_id uuid references public.organizations(id),email text,role public.app_role,invited_by uuid,expires_at timestamptz,accepted_at timestamptz,cancelled_at timestamptz,created_at timestamptz default now(),unique(organization_id,email));
create table public.user_roles(organization_id uuid,user_id uuid,role public.app_role,unique(organization_id,user_id,role));
create table public.organization_module_data(organization_id uuid,module_key text,data jsonb,unique(organization_id,module_key));
create table public.audit_logs(organization_id uuid,actor_id uuid,actor_name text not null,actor_type text,action text,detail text,entity_table text,entity_id uuid,event_data jsonb);
create table public.company_settings(organization_id uuid,name text,cnpj text,segment text,address text,phone text,email text,website text,sandbox_mode boolean,lead_flow jsonb,ui_settings jsonb);
create table public.pipelines(id uuid default gen_random_uuid(),organization_id uuid,name text,description text,active boolean,is_default boolean,created_by uuid);
create table public.pipeline_stages(organization_id uuid,pipeline_id uuid,name text,position int,color text,probability int,legacy_stage text,is_won boolean,is_lost boolean,active boolean);
create table public.whatsapp_accounts(id uuid primary key,organization_id uuid,owner_user_id uuid,integration_id uuid,enabled boolean default true,is_default boolean default false,connection_status text,updated_at timestamptz);
create table public.integrations(id uuid primary key,organization_id uuid,enabled boolean default true,connected boolean default true,updated_at timestamptz);
create table private.whatsapp_account_lifecycle(account_id uuid primary key,organization_id uuid,revision bigint default 1,desired_action text,state text,operation_id uuid,error_code text);
create table public.wa_akg_seller_provisioning_jobs(organization_id uuid,owner_user_id uuid,state text,completed_at timestamptz,error_code text,updated_at timestamptz);
create table public.evolution_go_seller_provisioning_jobs(organization_id uuid,whatsapp_account_id uuid,state text,completed_at timestamptz,last_error_code text,updated_at timestamptz);
insert into public.organization_invites(id,organization_id,email,role,invited_by,expires_at) values('${id(90)}','${A}','invite@synthetic.test','vendedor','${admin}',now()+interval '15 minutes');
insert into public.integrations(id,organization_id) values('${id(1)}','${A}'),('${id(2)}','${B}');
insert into public.whatsapp_accounts(id,organization_id,owner_user_id,integration_id) values('${id(1)}','${A}','${seller}','${id(1)}'),('${id(2)}','${B}','${seller}','${id(2)}');
insert into private.whatsapp_account_lifecycle(account_id,organization_id,operation_id,state) values('${id(1)}','${A}','${id(80)}','running');
insert into public.wa_akg_seller_provisioning_jobs(organization_id,owner_user_id,state) values('${A}','${seller}','processing');
insert into public.evolution_go_seller_provisioning_jobs(organization_id,whatsapp_account_id,state) values('${A}','${id(1)}','queued');
alter table public.organization_invites enable row level security;
create policy invite_read on public.organization_invites for select to authenticated using(private.has_org_permission(organization_id,auth.uid(),'team.manage'));
alter table public.organization_module_data enable row level security;
create policy module_access on public.organization_module_data for all to authenticated using(organization_id=public.current_org_id()) with check(organization_id=public.current_org_id());
grant select,insert,update,delete on all tables in schema public to authenticated;
`);
  await db.exec(await readFile(new URL(migration,root),'utf8'));
  await db.exec('create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_auth_user();');
}
export async function runTests(db) {
  await setup(db); const results=[];
  async function test(name,user,sql,check,{before='',error,role='authenticated',verify}={}) {
    await db.exec('begin');
    try {
      if(before)await db.exec(before);
      await db.exec(`set local role ${role};set local audit.user_id='${user}';`);
      let rows; for(const stmt of Array.isArray(sql)?sql:[sql]) rows=(await db.query(stmt)).rows;
      if(verify){await db.exec('reset role');rows=(await db.query(verify)).rows;}
      results.push({id:`T-R4-SQL-${String(results.length+1).padStart(3,'0')}`,name,result:!error&&check(rows)?'APROVADO':'REPROVADO',observed:rows});
    }catch(e){results.push({id:`T-R4-SQL-${String(results.length+1).padStart(3,'0')}`,name,result:error===e.code?'APROVADO':'REPROVADO',observed:{code:e.code,message:e.message}});}
    finally{await db.exec('rollback');}
  }
  const one=r=>r.length===1;const n=x=>r=>Number(r[0].n)===x;
  const accept=`select public.team_invite_accept('${id(90)}',1) result`;
  const prepare=(email,role='vendedor',org=A)=>`select public.team_invite_prepare('${org}','${email}','${role}') result`;
  const change=(user,action,role='null',enabled='null')=>`select public.team_member_change('${A}','${user}','${action}',${role},${enabled}) result`;
  await test('Prepare new canonical invite; no membership or identity created',admin,prepare('new@synthetic.test'),n(0),{verify:"select count(*) n from auth.users where email='new@synthetic.test'"});
  await test('Prepare existing identity in another org',admin,prepare('other@synthetic.test'),one);
  await test('Active existing member cannot be silently demoted through invite',admin,prepare('seller@synthetic.test'),one,{error:'P0001'});
  await test('Seller cannot invite',seller,prepare('new@synthetic.test'),one,{error:'42501'});
  await test('Manager cannot target other org context',admin,prepare('new@synthetic.test','vendedor',B),one,{error:'42501'});
  await test('Stale token after disabled membership cannot invite',seller,prepare('new@synthetic.test'),one,{before:`update public.organization_members set status='disabled' where user_id='${seller}';`,error:'42501'});
  await test('Anon cannot execute privileged RPC', '',prepare('new@synthetic.test'),one,{role:'anon',error:'42501'});
  await test('Direct invite/membership writes denied even to admin',admin,`insert into public.organization_members(organization_id,user_id,role,status) values('${A}','${id(91)}','administrador','active')`,one,{error:'42501'});
  await test('Direct invite self-accept cannot bypass RPC',admin,`update public.organization_invites set accepted_at=now() where id='${id(90)}'`,one,{error:'42501'});
  await test('Pending list only verified intended email',id(91),'select jsonb_array_length(public.team_pending_invites()) n',n(1));
  await test('Other email sees no pending invite',seller,'select jsonb_array_length(public.team_pending_invites()) n',n(0));
  await test('Verified explicit acceptance activates correct org',id(91),accept,n(1),{verify:`select count(*) n from public.organization_members where organization_id='${A}' and user_id='${id(91)}' and status='active'`});
  await test('Repeated same acceptance is idempotent',id(91),[accept,accept],r=>r[0].result.already_accepted===true);
  await test('Wrong verified identity cannot accept',seller,accept,one,{error:'42501'});
  await test('Unverified identity cannot accept',id(91),accept,one,{before:`update auth.users set email_confirmed_at=null where id='${id(91)}'`,error:'42501'});
  await test('Expired invite fails',id(91),accept,one,{before:`update public.organization_invites set expires_at=now()-interval '1 second'`,error:'P0001'});
  await test('Cancelled invite fails',id(91),accept,one,{before:'update public.organization_invites set cancelled_at=now()',error:'P0001'});
  await test('Prior revision fails after resend',id(91),accept,one,{before:'update public.organization_invites set revision=revision+1',error:'P0001'});
  await test('Role disabled after invite prevents accept',id(91),accept,one,{before:`insert into public.organization_module_data values('${A}','access_security_policy','{"availableRoles":{"vendedor":false}}')`,error:'42501'});
  await test('Disabled role blocks prepare',admin,prepare('new@synthetic.test'),one,{before:`insert into public.organization_module_data values('${A}','access_security_policy','{"availableRoles":{"vendedor":false}}')`,error:'42501'});
  await test('Admin cancel is atomic and revisioned',admin,`select public.team_invite_cancel('${id(90)}')`,n(1),{verify:`select count(*) n from public.organization_invites where cancelled_at is not null and revision=2`});
  await test('Cancel accepted invite cannot report false success',admin,`select public.team_invite_cancel('${id(90)}')`,one,{before:'update public.organization_invites set accepted_at=now()',error:'P0001'});
  await test('Cross-org administrator cannot cancel',outsider,`select public.team_invite_cancel('${id(90)}')`,one,{error:'42501'});
  await test('Renew cancelled record rotates revision',admin,prepare('invite@synthetic.test'),r=>r[0].result.revision===2,{before:'update public.organization_invites set cancelled_at=now()'});
  await test('Remove multiorg link preserves global Auth and other link',admin,change(seller,'remove'),n(3),{before:`insert into public.organization_members(organization_id,user_id,role,status) values('${B}','${seller}','vendedor','active')`,verify:`select (select count(*) from auth.users where id='${seller}')+(select count(*) from public.profiles where id='${seller}')+(select count(*) from public.organization_members where user_id='${seller}') n`});
  await test('Remove fences local channel, leaves other org channel',admin,change(seller,'remove'),n(1),{verify:'select count(*) n from public.whatsapp_accounts where enabled'});
  await test('Remove fences in-flight lifecycle revision',admin,change(seller,'remove'),r=>r[0].revision===2&&r[0].state==='needs_review',{verify:'select revision::int,state from private.whatsapp_account_lifecycle'});
  await test('Disable cancels local pending provisioning',admin,change(seller,'set_status','null','false'),n(2),{verify:"select (select count(*) from public.wa_akg_seller_provisioning_jobs where state='cancelled')+(select count(*) from public.evolution_go_seller_provisioning_jobs where state='cancelled') n"});
  await test('Last administrator remains protected by R1',admin,change(admin,'set_status','null','false'),one,{error:'23514'});
  await test('Cannot remove own link',admin,change(admin,'remove'),one,{error:'P0001'});
  await test('Invited membership cannot bypass acceptance with enable',admin,change(seller,'set_status','null','true'),one,{before:`update public.organization_members set status='invited' where user_id='${seller}'`,error:'P0001'});
  await test('Unavailable role blocks role change',admin,change(seller,'update_role',"'cx'"),one,{before:`insert into public.organization_module_data values('${A}','access_security_policy','{"availableRoles":{"cx":false}}')`,error:'42501'});
  await test('Valid role change preserved',admin,change(seller,'update_role',"'cx'"),n(1),{verify:`select count(*) n from public.organization_members where user_id='${seller}' and role='cx'`});
  await test('Seller cannot weaken access policy through generic module store',seller,`insert into public.organization_module_data values('${A}','access_security_policy','{}')`,one,{error:'42501'});
  await test('Generic unrelated module remains writable',seller,`insert into public.organization_module_data values('${A}','synthetic_preference','{}') returning module_key`,one);
  await test('Delegated team.manage remains valid',seller,prepare('delegate@synthetic.test'),one,{before:`insert into public.team_member_permissions values('${A}','${seller}','team.manage',true)`});
  await test('New invited Auth creates profile, never target membership or autoaccept', '',`insert into auth.users(id,email,invited_at) values('${id(93)}','invite@synthetic.test',now())`,n(0),{role:'service_role',before:`delete from public.profiles where id='${id(91)}';delete from auth.users where id='${id(91)}';grant insert on auth.users to service_role`,verify:`select (select count(*) from public.organization_members where user_id='${id(93)}')+(select count(*) from public.organization_invites where accepted_at is not null) n`});
  await test('Cancelled invitation cannot activate through Auth trigger', '',`insert into auth.users(id,email,invited_at) values('${id(93)}','invite@synthetic.test',now())`,n(0),{role:'service_role',before:`delete from public.profiles where id='${id(91)}';delete from auth.users where id='${id(91)}';grant insert on auth.users to service_role;update public.organization_invites set cancelled_at=now()`,verify:`select count(*) n from public.organization_members where user_id='${id(93)}'`});
  await test('Normal independent signup preserves org/pipeline onboarding','',`insert into auth.users(id,email,raw_user_meta_data) values('${id(94)}','signup@synthetic.test','{"name":"Synthetic person","company":"Synthetic company"}')`,n(8),{role:'service_role',before:`delete from public.profiles where id='${id(91)}';delete from auth.users where id='${id(91)}';grant insert on auth.users to service_role`,verify:'select count(*) n from public.pipeline_stages'});
  await test('GoTrue INSERT before invited_at after concurrent cancellation grants nothing and creates no company','',`insert into auth.users(id,email,raw_user_meta_data) values('${id(93)}','invite@synthetic.test','{"wayflex_invitation":true,"organization_id":"${B}","role":"administrador"}')`,n(0),{role:'service_role',before:`delete from public.profiles where id='${id(91)}';delete from auth.users where id='${id(91)}';grant insert on auth.users to service_role;update public.organization_invites set cancelled_at=now()`,verify:`select (select count(*) from public.organization_members where user_id='${id(93)}')+(select count(*) from public.pipelines) n`});
  await test('Inviter loses delegated authority before acceptance',id(91),accept,one,{before:`update public.organization_invites set invited_by='${seller}'`,error:'42501'});
  await test('Existing accepted token cannot restore disabled membership',id(91),accept,one,{before:`update public.organization_invites set accepted_at=now(),accepted_by='${id(91)}';insert into public.organization_members(organization_id,user_id,role,status) values('${A}','${id(91)}','vendedor','disabled')`,error:'P0001'});
  await test('Global inactive profile cannot accept',id(91),accept,one,{before:`update public.profiles set active=false where id='${id(91)}'`,error:'42501'});
  await test('MFA not silently enabled or falsely advertised by policy',admin,`insert into public.organization_module_data values('${A}','access_security_policy','{"availableRoles":{},"requireMfa":true}')`,one,{error:'P0001'});
  await test('Policy rejects malformed availability booleans',admin,`insert into public.organization_module_data values('${A}','access_security_policy','{"availableRoles":{"cx":"false"}}')`,one,{error:'P0001'});
  await test('Policy admin can save explicit availability',admin,`insert into public.organization_module_data values('${A}','access_security_policy','{"availableRoles":{"cx":false},"requireMfa":false}') returning module_key`,one);
  await test('Descriptive signup company metadata seeds only new company settings','',`insert into auth.users(id,email,raw_user_meta_data) values('${id(94)}','signup@synthetic.test','{"name":"Person","company":"Company","empresa":{"nome":"Factory","cnpj":"synthetic","segmento":"Synthetic","telefone":"test","site":"https://example.test"}}')`,r=>r[0].name==='Factory'&&r[0].cnpj==='synthetic'&&r[0].ui_settings.organizacao.nome==='Factory'&&r[0].sandbox_mode===true,{role:'service_role',before:`delete from public.profiles where id='${id(91)}';delete from auth.users where id='${id(91)}';grant insert on auth.users to service_role`,verify:'select name,cnpj,ui_settings,sandbox_mode from public.company_settings'});
  return {scope:'Synthetic local SQL; actual R1 and R4 migrations; no remote Auth/email/Storage',migration,results,passed:results.filter(r=>r.result==='APROVADO').length,failed:results.filter(r=>r.result!=='APROVADO').length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(!process.argv[2])throw new Error('Pass local PGlite module; no DSN accepted');
  const {PGlite}=await import(pathToFileURL(resolve(process.argv[2])).href);const db=new PGlite();
  try{const result=await runTests(db);console.log(JSON.stringify(result,null,2));if(result.failed)process.exitCode=1;}
  catch(e){console.error(JSON.stringify({message:e.message,code:e.code,where:e.where}));process.exitCode=1;}finally{await db.close();}
}
