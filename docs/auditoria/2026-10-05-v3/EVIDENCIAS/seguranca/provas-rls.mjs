import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
// Uso: node provas-rls.mjs /tmp/<instalacao-isolada>/node_modules/@electric-sql/pglite/dist/index.js
// Nenhuma conexão de rede. Definições e políticas são o snapshot real do catálogo;
// tabelas reduzidas e fixtures sintéticas não pretendem replicar todo o schema.
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const base = new URL('./', import.meta.url);
const evidence = JSON.parse(await readFile(new URL('EV-SEC-001-politicas-remotas.json',base),'utf8'));
const triggers = JSON.parse(await readFile(new URL('EV-SEC-002-trigger-remoto.json',base),'utf8'));
const db = new PGlite();
const results=[];
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const admin='11111111-1111-4111-8111-111111111111';
const seller='22222222-2222-4222-8222-222222222222';
const peer='33333333-3333-4333-8333-333333333333';
const outsider='44444444-4444-4444-8444-444444444444';
const leadA='aaaaaaaa-1111-4111-8111-111111111111';
const leadB='bbbbbbbb-1111-4111-8111-111111111111';
await db.exec(`
create role authenticated;
create schema auth; create schema private; create schema storage;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('audit.user_id',true),'')::uuid $$;
create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
create type public.app_role as enum ('administrador','vendedor','sdr','cx','ia');
create table public.profiles(id uuid primary key,active_organization_id uuid,name text);
create table public.organization_members(organization_id uuid,user_id uuid,role public.app_role,status text, primary key(organization_id,user_id));
create table public.team_member_permissions(organization_id uuid,user_id uuid,permission text,allowed boolean);
create table public.leads(id uuid primary key, organization_id uuid,owner_id uuid,assigned_to uuid);
create table public.proposals(id uuid primary key, organization_id uuid,owner_id uuid,lead_id uuid);
create table public.documents(id uuid primary key, organization_id uuid,uploaded_by uuid);
create table public.lead_tasks(id uuid primary key, organization_id uuid,owner_id uuid,lead_id uuid);
create table public.appointments(id uuid primary key, organization_id uuid,owner_id uuid,lead_id uuid);
create table public.contact_suppressions(id uuid primary key,organization_id uuid);
create table storage.objects(id uuid primary key,bucket_id text,name text,owner uuid);
insert into public.organization_members values ('${A}','${admin}','administrador','active'),('${A}','${seller}','vendedor','active'),('${A}','${peer}','vendedor','active'),('${B}','${outsider}','administrador','active');
insert into public.profiles values ('${admin}','${A}','Admin A'),('${seller}','${A}','Seller A'),('${peer}','${A}','Peer A'),('${outsider}','${B}','Admin B');
insert into public.leads values ('${leadA}','${A}','${peer}','${peer}'),('${leadB}','${B}','${outsider}','${outsider}');
insert into public.proposals values ('${leadA}','${A}','${peer}','${leadA}'),('${leadB}','${B}','${outsider}','${leadB}');
insert into public.documents values ('${leadA}','${A}','${peer}'),('${leadB}','${B}','${outsider}');
insert into public.documents values ('aaaaaaaa-2222-4222-8222-222222222222','${A}','${seller}');
insert into public.lead_tasks values ('${leadA}','${A}','${peer}','${leadA}'),('${leadB}','${B}','${outsider}','${leadB}');
insert into public.appointments values ('${leadA}','${A}','${peer}','${leadA}'),('${leadB}','${B}','${outsider}','${leadB}');
insert into public.contact_suppressions values ('${leadA}','${A}'),('${leadB}','${B}');
insert into storage.objects values ('${leadA}','message-media','${A}/peer-private-media.pdf','${peer}'),('${leadB}','message-media','${B}/private.pdf','${outsider}');
`);
const defs=[...evidence.definitions,...triggers.definitions];
for(const name of ['is_org_member','is_active_org_member','is_org_admin','has_org_role','has_org_permission','can_access_lead','can_manage_lead','can_access_owned_record']){
  await db.exec(defs.find(d=>(d.proname??d.name)===name).definition);
}
await db.exec(`create function public.current_org_id() returns uuid language sql stable as $$ select p.active_organization_id from public.profiles p where p.id=auth.uid() and p.active_organization_id is not null and private.is_org_member(p.active_organization_id,auth.uid()) limit 1 $$;`);
const targeted=['leads','proposals','documents','lead_tasks','appointments','contact_suppressions','organization_members','objects'];
for(const table of targeted){await db.exec(`alter table ${table==='objects'?'storage':'public'}.${table} enable row level security;`);}
for(const p of evidence.policies.filter(p=>targeted.includes(p.tablename))){
  await db.exec(`create policy "${p.policyname}" on ${p.schemaname}.${p.tablename} for ${p.cmd} to ${p.roles.slice(1,-1)} ${p.qual?`using (${p.qual})`:''} ${p.with_check?`with check (${p.with_check})`:''};`);
}
await db.exec(`grant usage on schema public,private,auth,storage to authenticated; grant select,insert,update,delete on all tables in schema public,storage to authenticated;`);
async function asUser(id, fn){ await db.exec(`set role authenticated; set audit.user_id='${id}';`); try{return await fn();}finally{await db.exec('reset role;');}}
async function rows(sql){return (await db.query(sql)).rows;}
function report(id,scenario,expected,observed,ok){results.push({id,scenario,modality:'integração PostgreSQL WASM isolada, políticas/corpos remotos exatos e schema mínimo',expected,observed,result:ok?'APROVADO':'REPROVADO'});}
await asUser(seller,async()=>{
 const leadRows=await rows('select id from public.leads');
 report('T-SEC-001','Vendedor sem carteira não lê leads do colega nem de outra empresa','0 registros',leadRows,leadRows.length===0);
 const proposalRows=await rows('select id from public.proposals');
 report('T-SEC-002','Vendedor sem carteira tenta ler proposta do colega','0 registros',proposalRows,proposalRows.length===0);
 await db.exec('begin;');
 const deletedProposal=await rows(`delete from public.proposals where id='${leadA}' returning id`);
 report('T-SEC-003','Vendedor tenta excluir proposta alheia sem permissão administrativa','0 registros excluídos',deletedProposal,deletedProposal.length===0);
 await db.exec('rollback;');
 await db.exec('begin;');
 const deletedDoc=await rows(`delete from public.documents where id='${leadA}' returning id`);
 report('T-SEC-004','Vendedor tenta excluir documento enviado por colega','0 registros excluídos',deletedDoc,deletedDoc.length===0);
 await db.exec('rollback;');
 const media=await rows('select name from storage.objects');
 report('T-SEC-005','Vendedor sem carteira tenta ler mídia de outro responsável','0 arquivos',media,media.length===0);
 await db.exec('begin;');
 const removedSuppression=await rows(`delete from public.contact_suppressions where id='${leadA}' returning id`);
 report('T-SEC-006','Vendedor tenta remover supressão da organização por Data API','0 registros excluídos',removedSuppression,removedSuppression.length===0);
 await db.exec('rollback;');
 const otherOrg=await rows(`select id from public.proposals where organization_id='${B}'`);
 report('T-SEC-007','Vendedor tenta ler proposta de outra empresa','0 registros',otherOrg,otherOrg.length===0);
 await db.exec('begin;');
 try {
  const moved=await db.query(`update public.documents set organization_id='${B}' where id='aaaaaaaa-2222-4222-8222-222222222222'`);
  report('T-SEC-016','Uploader move documento próprio para empresa sem vínculo','0 documentos movidos', {affectedRows:moved.affectedRows},moved.affectedRows===0);
 } catch(e) {
  report('T-SEC-016','Uploader move documento próprio para empresa sem vínculo','operação negada',{error:e.message},true);
 }
 await db.exec('rollback;');
});
await asUser(admin,async()=>{
 await db.exec('begin;');
 const removed=await rows(`delete from public.organization_members where organization_id='${A}' and user_id='${admin}' returning user_id`);
 report('T-SEC-008','Último administrador usa DELETE direto contornando Edge','exclusão negada',removed,removed.length===0);
 await db.exec('rollback;');
});
await db.exec(`update public.organization_members set status='disabled' where user_id='${seller}';`);
await asUser(seller,async()=>{
 const objects=await rows('select id from storage.objects'); const proposals=await rows('select id from public.proposals');
 report('T-SEC-009','JWT sintético antigo com vínculo desativado tenta ler Storage/propostas','0 registros',{objects,proposals},objects.length===0&&proposals.length===0);
});
await db.close();

const triggerDb=new PGlite();
await triggerDb.exec(`
create schema auth; create schema private;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
create table public.organization_invites(id uuid primary key, organization_id uuid,email text,role text,expires_at timestamptz,accepted_at timestamptz,cancelled_at timestamptz,created_at timestamptz default now());
create table public.organization_members(organization_id uuid,user_id uuid,role text,status text,updated_at timestamptz,unique(organization_id,user_id));
create table public.profiles(id uuid primary key,name text,email text,phone text,active boolean,can_use_ia boolean,active_organization_id uuid,updated_at timestamptz);
create table public.user_roles(organization_id uuid,user_id uuid,role text,unique(organization_id,user_id,role));
create table public.organizations(id uuid default gen_random_uuid() primary key,name text,slug text);
create table public.company_settings(organization_id uuid,name text,cnpj text,segment text,address text,phone text,email text,website text,sandbox_mode boolean,lead_flow jsonb);
create table public.pipelines(id uuid default gen_random_uuid() primary key,organization_id uuid,name text,description text,active boolean,is_default boolean,created_by uuid);
create table public.pipeline_stages(organization_id uuid,pipeline_id uuid,name text,position int,color text,probability int,legacy_stage text,is_won boolean,is_lost boolean,active boolean);
`);
await triggerDb.exec(triggers.definitions.find(d=>d.proname==='handle_new_auth_user').definition);
await triggerDb.exec(`create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_auth_user();`);
await triggerDb.exec(`insert into public.organization_invites(id,organization_id,email,role,expires_at,cancelled_at) values ('${leadA}','${A}','cancelled@example.invalid','vendedor',now()+interval '1 hour',now()); insert into auth.users(id,email) values ('${seller}','cancelled@example.invalid');`);
const cancelled=(await triggerDb.query(`select m.status,i.accepted_at is not null accepted,i.cancelled_at is not null cancelled from public.organization_members m join public.organization_invites i using(organization_id) where m.user_id='${seller}';`)).rows;
report('T-SEC-010','Cadastro Auth depois de convite cancelado','convite cancelado não concede vínculo ativo',cancelled,cancelled.every(r=>r.status!=='active'));
await triggerDb.exec(`insert into public.organization_invites(id,organization_id,email,role,expires_at) values ('${leadB}','${A}','new-invite@example.invalid','vendedor',now()+interval '1 hour'); insert into auth.users(id,email) values ('${peer}','new-invite@example.invalid');
insert into public.organization_members(organization_id,user_id,role,status,updated_at) values ('${A}','${peer}','vendedor','invited',now()) on conflict(organization_id,user_id) do update set status=excluded.status;
`);
const stuck=(await triggerDb.query(`select m.status,(select count(*) from public.organization_invites i where lower(i.email)='new-invite@example.invalid' and i.accepted_at is null and i.cancelled_at is null and i.expires_at>now()) as activation_candidates from public.organization_members m where user_id='${peer}';`)).rows;
report('T-SEC-011','Trigger Auth + upsert invited do handler + busca activate_invite','1 convite elegível para ativação no login',stuck,Number(stuck[0].activation_candidates)===1);
await triggerDb.close();
console.log(JSON.stringify({environment:'PGlite 0.3.14; PostgreSQL in memory; no network',snapshotDate:'2026-10-05',results},null,2));
