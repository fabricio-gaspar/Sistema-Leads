import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runR2Sql } from '../../docs/remediacao/2026-10-05-r1-r3/r2-sql.mjs';

export const ids={org:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',seller:'11111111-1111-4111-8111-111111111111',manager:'22222222-2222-4222-8222-222222222222',account:'33333333-3333-4333-8333-333333333333',integration:'44444444-4444-4444-8444-444444444444',event:'77777777-7777-4777-8777-777777777777',lead:'88888888-8888-4888-8888-888888888888',job:'99999999-9999-4999-8999-999999999999'};
export async function setupR6(db) {
  await runR2Sql(db); // Includes real legacy integration→account trigger.
  await db.exec(`reset role; set r2.fail_table=''; truncate private.whatsapp_account_lifecycle,public.audit_logs;
    delete from public.whatsapp_accounts; delete from public.integrations; delete from public.messaging_provider_controls;
    alter table public.profiles add column name text;
    alter table public.integrations add column key text,add column label text,add column category text,add column mode text;
    alter table public.whatsapp_accounts add column label text,add column provider_metadata jsonb default '{}',add column created_by uuid;
    create table public.leads(id uuid primary key,organization_id uuid,whatsapp_account_id uuid,phone text,modo_atendimento text default 'ia',
      ai_paused boolean default false,opt_out boolean default false,automation_status text default 'running',first_inbound_at timestamptz,last_contact timestamptz,
      no_reply_deadline_at timestamptz,no_reply_processed_at timestamptz,contact_approval_status text,contact_approval_reason text,contact_approved_at timestamptz);
    create table public.channel_inbound_events(id uuid primary key default gen_random_uuid(),organization_id uuid not null,whatsapp_account_id uuid,
      provider text not null,event_type text not null,external_id text not null,lead_id uuid,payload jsonb not null default '{}',
      status text not null check(status in ('received','processed','ignored','failed')),error text,processed_at timestamptz,unique(organization_id,provider,external_id));
    create table public.lead_messages(id uuid primary key default gen_random_uuid(),organization_id uuid not null,lead_id uuid not null,whatsapp_account_id uuid,
      sender text not null,sender_name text not null,type text not null,text text not null,sent_at timestamptz,provider text,message_origin text,provider_message_id text,provider_occurred_at timestamptz);
    create table public.message_attachments(id uuid primary key default gen_random_uuid(),organization_id uuid not null,lead_id uuid not null,message_id uuid,
      media_type text not null check(media_type in ('image','audio','video','document')),mime_type text,file_name text,external_url text);
    create unique index message_attachments_message_external_url_unique on public.message_attachments(organization_id,message_id,external_url) where external_url is not null;
    create table public.outreach_jobs(id uuid primary key default gen_random_uuid(),organization_id uuid,lead_id uuid,status text,payload jsonb,processed_at timestamptz,error text);
    create function public.resolve_whatsapp_lead_for_account(p_organization_id uuid,p_account_id uuid,p_phone text)
      returns table(lead_id uuid,reason text) language sql as $$ select id,'account_identity'::text from public.leads where organization_id=p_organization_id and whatsapp_account_id=p_account_id and phone=p_phone $$;
    create table public.wa_akg_webhook_events(id uuid primary key,organization_id uuid,whatsapp_account_id uuid,integration_id uuid,event_kind text,
      sanitized_payload jsonb,processing_status text,attempt_count integer default 0,next_retry_at timestamptz default now(),occurred_at timestamptz,processed_at timestamptz,error_code text);
    create table public.evolution_go_webhook_events(like public.wa_akg_webhook_events including all);
    create table public.organization_feature_flags(organization_id uuid,flag_key text,enabled boolean);
    create table public.messaging_outbox(id uuid primary key,organization_id uuid,whatsapp_account_id uuid,lead_id uuid,origin text,status text,
      run_at timestamptz default now(),locked_at timestamptz,locked_by text,last_error_code text,
      constraint messaging_outbox_status_check check(status in ('queued','processing','sent','failed','dead_letter','cancelled')));
    create table public.wa_akg_seller_provisioning_jobs(id uuid primary key default gen_random_uuid(),organization_id uuid,owner_user_id uuid,requested_by uuid,account_id uuid,integration_id uuid,invite_id uuid,source text,
      session_name text,state text,attempt_count integer default 0,next_attempt_at timestamptz default now(),error_code text,completed_at timestamptz,updated_at timestamptz,unique(organization_id,owner_user_id));
    -- user_id/created_by are the actual Evolution GO catalog names (metadata-only verification).
    create table public.evolution_go_seller_provisioning_jobs(id uuid primary key default gen_random_uuid(),organization_id uuid,user_id uuid,created_by uuid,whatsapp_account_id uuid,integration_id uuid,
      invite_id uuid,source text,instance_name text,instance_id uuid,state text,attempt_count integer default 0,next_attempt_at timestamptz default now(),last_error_code text,completed_at timestamptz,updated_at timestamptz);
    create table private.test_secrets(integration_id uuid primary key,secret jsonb);
    create function public.store_integration_secret(p_integration uuid,p_secret jsonb) returns void language sql as $$
      insert into private.test_secrets values(p_integration,p_secret) on conflict(integration_id) do update set secret=excluded.secret $$;
    grant all on all tables in schema public to service_role; grant all on private.test_secrets to service_role;
    create trigger r6_message_fault before insert on public.lead_messages for each row execute function private.r2_fault();
    create trigger r6_inbound_fault before insert on public.channel_inbound_events for each row execute function private.r2_fault();
    create trigger r6_attachment_fault before insert on public.message_attachments for each row execute function private.r2_fault();
  `);
  await db.exec(await readFile(new URL('../migrations/20261005223517_audit_r6_r7_messaging_recovery.sql',import.meta.url),'utf8'));
}
export function r6Harness(db) {
  const {org,other,seller,manager,account,integration,event,lead,job}=ids;
  const lit=v=>v===null?'null':`'${String(v).replaceAll("'","''")}'`;
  const query=async sql=>(await db.query(sql)).rows;
  const rpc=async(name,args)=>(await query(`select public.${name}(${args.map(lit).join(',')}) result`))[0].result;
  const base=(actor=seller,provider='wa_akg')=>[org,account,provider,actor];
  const eventPayload=()=>JSON.stringify({message_id:'message-one',phone:'5511999999999',remote_jid:'5511999999999@s.whatsapp.net',text:'Mensagem sintética',occurred_at:'2026-10-05T16:00:00Z',media:{kind:'audio',url:'https://media.example.test/audio.ogg',mimeType:'audio/ogg'}});
  async function reset(provider='wa_akg') {
    await db.exec(`reset role; set r2.fail_table=''; truncate private.whatsapp_inbound_work,private.whatsapp_account_lifecycle,public.audit_logs,
      public.wa_akg_webhook_events,public.evolution_go_webhook_events,public.channel_inbound_events,public.lead_messages,public.message_attachments,
      public.outreach_jobs,public.messaging_outbox,public.leads,public.organization_feature_flags,private.test_secrets,
      public.wa_akg_seller_provisioning_jobs,public.evolution_go_seller_provisioning_jobs;
      delete from public.whatsapp_accounts; delete from public.integrations; delete from public.messaging_provider_controls;
      update public.profiles set active_organization_id='${org}'; update public.organization_members set status='active';
      insert into public.integrations(id,organization_id,provider,enabled,paused,connected) values('${integration}','${org}','${provider==='wa_akg'?'WA-AKG':provider==='meta_cloud'?'Meta Cloud':'Evolution GO'}',true,false,true);
      insert into public.whatsapp_accounts(id,organization_id,integration_id,provider,owner_user_id,account_type,enabled,is_default,connection_status) values('${account}','${org}','${integration}','${provider}','${seller}','seller',true,false,'connected');
      insert into public.messaging_provider_controls values('${org}','${provider}',true,true,true,false,'fixture','${manager}',now());
      insert into public.leads(id,organization_id,whatsapp_account_id,phone) values('${lead}','${org}','${account}','5511999999999');
      insert into public.organization_feature_flags values('${org}','meta_coexistence',true);
      set role service_role;`);
  }
  async function seedEvent(provider='wa_akg',state='queued') {await db.exec(`insert into public.${provider}_webhook_events(id,organization_id,whatsapp_account_id,integration_id,event_kind,sanitized_payload,processing_status) values('${event}','${org}','${account}','${integration}','inbound',${lit(eventPayload())},'${state}')`);}
  async function seedJob(provider='wa_akg') {
    const columns=provider==='wa_akg'?'owner_user_id,account_id,session_name':'user_id,whatsapp_account_id,instance_name';
    await db.exec(`insert into public.${provider}_seller_provisioning_jobs(id,organization_id,integration_id,${columns},state) values('${job}','${org}','${integration}','${seller}','${account}','wf_aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa_33333333333343338333333333333333','queued')`);
  }
  return {query,rpc,base,reset,seedEvent,seedJob,eventPayload,lit};
}
export async function runR6(db) {
  await setupR6(db);const h=r6Harness(db),{rpc,query,reset,seedEvent,seedJob,base}=h;const {org,seller,manager,account,integration,event,lead,job}=ids;
  const results=[];const test=async(id,fn)=>{await reset();await fn();results.push({id,status:'APROVADO'});};
  const claim=provider=>rpc('claim_whatsapp_webhook_event',[provider,event]);
  const persist=(provider,t)=>rpc('persist_whatsapp_inbound',[provider,event,t.lease_id]);
  for(const provider of ['wa_akg','evolution_go']) {
    await test(`R6-IN-${provider}-atomic`,async()=>{await reset(provider);await seedEvent(provider);const t=await claim(provider);await persist(provider,t);await persist(provider,t);assert.equal((await query('select count(*)::int n from public.lead_messages'))[0].n,1);assert.equal((await query('select count(*)::int n from public.message_attachments'))[0].n,1);assert.equal((await query('select phase from private.whatsapp_inbound_work'))[0].phase,'persisted');});
    await test(`R6-IN-${provider}-lease`,async()=>{await reset(provider);await seedEvent(provider);const old=await claim(provider);assert.equal(await claim(provider),null);await db.exec("update private.whatsapp_inbound_work set lease_expires_at=now()-interval '1 second'");const fresh=await claim(provider);assert.notEqual(old.lease_id,fresh.lease_id);await assert.rejects(()=>persist(provider,old),/lease_lost/);await persist(provider,fresh);});
    await test(`R6-IN-${provider}-unknown`,async()=>{await reset(provider);await seedEvent(provider);const t=await claim(provider);await persist(provider,t);assert.equal((await rpc('begin_whatsapp_inbound_dispatch',[provider,event,t.lease_id])).dispatch,true);await db.exec("update private.whatsapp_inbound_work set lease_expires_at=now()-interval '1 second'");assert.equal(await claim(provider),null);assert.equal((await query(`select processing_status from public.${provider}_webhook_events`))[0].processing_status,'needs_review');});
    await test(`R6-IN-${provider}-orphan`,async()=>{await reset(provider);await seedEvent(provider,'processing');assert.equal(await claim(provider),null);assert.equal((await query(`select processing_status from public.${provider}_webhook_events`))[0].processing_status,'needs_review');});
  }
  for(const table of ['channel_inbound_events','lead_messages','message_attachments']) await test(`R6-IN-rollback-${table}`,async()=>{await seedEvent();const t=await claim('wa_akg');await db.exec(`set r2.fail_table='${table}'`);await assert.rejects(()=>persist('wa_akg',t),/injected_/);await db.exec("set r2.fail_table=''");assert.equal((await query('select count(*)::int n from public.channel_inbound_events'))[0].n,0);assert.equal((await query('select count(*)::int n from public.lead_messages'))[0].n,0);await persist('wa_akg',t);});
  await test('R6-IN-LID',async()=>{await seedEvent();await db.exec(`update public.wa_akg_webhook_events set sanitized_payload=jsonb_set(sanitized_payload,'{remote_jid}','"1234567890123@lid"')`);const t=await claim('wa_akg');assert.equal((await persist('wa_akg',t)).review,true);assert.equal((await query('select count(*)::int n from public.lead_messages'))[0].n,0);});
  await test('R6-IN-human-cutoff',async()=>{await seedEvent();const t=await claim('wa_akg');await persist('wa_akg',t);await db.exec('update public.leads set ai_paused=true');assert.equal((await rpc('begin_whatsapp_inbound_dispatch',['wa_akg',event,t.lease_id])).dispatch,false);});
  await test('R6-IN-direct-denied',async()=>{await db.exec('reset role;set role authenticated');await assert.rejects(()=>claim('wa_akg'),/permission denied/);await assert.rejects(()=>query('select * from private.whatsapp_inbound_work'),/permission denied/);});
  for(const provider of ['wa_akg','evolution_go']) {
    await test(`R6-REC-${provider}`,async()=>{await reset(provider);const t=await rpc('begin_whatsapp_account_lifecycle',[...base(seller,provider),'activate']);const d=await rpc('diagnose_whatsapp_account_lifecycle',base(manager,provider));assert.equal(d.can_reconcile_read_only,true);const result=await rpc('reconcile_whatsapp_account_lifecycle',[...base(manager,provider),t.revision,'Confirmação administrativa sintética',JSON.stringify({confirmed:true,connected:true,observed_at:new Date().toISOString()})]);assert.equal(result.state,'completed');assert.equal((await query('select enabled from public.whatsapp_accounts'))[0].enabled,false);await assert.rejects(()=>rpc('finish_whatsapp_account_lifecycle',[...base(seller,provider),t.operation_id,t.revision,'{"success":true,"connected":true}']),/operation_mismatch/);});
    await test(`R6-REC-${provider}-mutation`,async()=>{await reset(provider);const t=await rpc('begin_whatsapp_account_lifecycle',[...base(seller,provider),'connect']);assert.equal((await rpc('diagnose_whatsapp_account_lifecycle',base(manager,provider))).can_reconcile_read_only,false);await assert.rejects(()=>rpc('reconcile_whatsapp_account_lifecycle',[...base(manager,provider),t.revision,'Não deve liberar mutação incerta',JSON.stringify({confirmed:true,connected:true,observed_at:new Date().toISOString()})]),/terminality_unproven/);});
    await test(`R6-PROV-${provider}-serialized`,async()=>{await reset(provider);await seedJob(provider);const t=await rpc('claim_whatsapp_provisioning',[provider,job]);assert.ok(t.operation_id);assert.equal(await rpc('claim_whatsapp_provisioning',[provider,job]),null);assert.equal((await rpc('begin_whatsapp_account_lifecycle',[...base(seller,provider),'activate'])).admitted,false);await assert.rejects(()=>rpc('check_whatsapp_provisioning',[provider,job,t.operation_id,t.revision,'create',true]),/superseded/);});
    await test(`R6-PROV-${provider}-success`,async()=>{await reset(provider);await seedJob(provider);const t=await rpc('claim_whatsapp_provisioning',[provider,job]);await rpc('check_whatsapp_provisioning',[provider,job,t.operation_id,t.revision,'create',true]);await rpc('save_whatsapp_provisioning_secret',[provider,job,t.operation_id,t.revision,'{"synthetic":true}']);assert.equal((await rpc('finish_whatsapp_provisioning',[provider,job,t.operation_id,t.revision,'{"success":true,"configuration":{"configured":true}}'])).state,'completed');assert.equal((await query('select enabled from public.whatsapp_accounts'))[0].enabled,false);assert.equal((await query(`select state from public.${provider}_seller_provisioning_jobs`))[0].state,provider==='wa_akg'?'completed':'awaiting_qr');});
    await test(`R6-PROV-${provider}-uncertain`,async()=>{await reset(provider);await seedJob(provider);const t=await rpc('claim_whatsapp_provisioning',[provider,job]);await rpc('check_whatsapp_provisioning',[provider,job,t.operation_id,t.revision,'create',true]);await rpc('finish_whatsapp_provisioning',[provider,job,t.operation_id,t.revision,'{"success":false}']);assert.equal((await query('select state from private.whatsapp_account_lifecycle'))[0].state,'needs_review');assert.equal(await rpc('claim_whatsapp_provisioning',[provider,job]),null);});
    await test(`R6-PROV-${provider}-member-revoked`,async()=>{await reset(provider);await seedJob(provider);const t=await rpc('claim_whatsapp_provisioning',[provider,job]);await db.exec(`update public.organization_members set status='disabled' where user_id='${seller}'`);await assert.rejects(()=>rpc('check_whatsapp_provisioning',[provider,job,t.operation_id,t.revision,'create',true]),/superseded/);});
  }
  await test('R6-REC-revision',async()=>{const t=await rpc('begin_whatsapp_account_lifecycle',[...base(),'activate']);await rpc('begin_whatsapp_account_lifecycle',[...base(),'deactivate']);await assert.rejects(()=>rpc('reconcile_whatsapp_account_lifecycle',[...base(manager),t.revision,'Revisão concorrente inválida',JSON.stringify({confirmed:true,connected:true,observed_at:new Date().toISOString()})]),/revision_changed/);});
  await test('R6-REC-owner-denied',async()=>{await assert.rejects(()=>rpc('diagnose_whatsapp_account_lifecycle',base()),/access_denied/);});
  for(const attempted of [false,true]) await test(`R6-META-orphan-${attempted}`,async()=>{await reset('meta_cloud');await db.exec(`insert into public.messaging_outbox(id,organization_id,whatsapp_account_id,lead_id,origin,status) values('${job}','${org}','${account}','${lead}','panel','queued')`);await rpc('claim_meta_outbox',[job,'worker-one']);if(attempted) await rpc('begin_meta_outbox_dispatch',[job,'worker-one']);await db.exec("update public.messaging_outbox set locked_at=now()-interval '3 minutes'");const recovered=await rpc('claim_meta_outbox',[job,'worker-two']);assert.equal(Boolean(recovered),!attempted);assert.equal((await query('select status from public.messaging_outbox'))[0].status,attempted?'reconciliation_required':'processing');});
  await test('R7-enqueue-preserves-review',async()=>{await seedJob();await db.exec("update public.wa_akg_seller_provisioning_jobs set state='needs_review'");await rpc('enqueue_wa_akg_seller_provisioning',[org,seller,manager,'manual',null]);assert.equal((await query('select state from public.wa_akg_seller_provisioning_jobs'))[0].state,'needs_review');});
  await test('R6-PROV-cutoff-before-dispatch-never-rearms',async()=>{
    await seedJob();const t=await rpc('claim_whatsapp_provisioning',['wa_akg',job]);
    await rpc('begin_whatsapp_account_lifecycle',[...base(),'deactivate']);
    await db.exec(`update public.wa_akg_seller_provisioning_jobs set state='cancelled'; update public.organization_members set status='disabled' where user_id='${seller}'`);
    assert.equal((await rpc('finish_whatsapp_provisioning',['wa_akg',job,t.operation_id,t.revision,'{"success":false}'])).state,'cancelled');
    await db.exec(`update public.organization_members set status='active' where user_id='${seller}'`);
    assert.equal(await rpc('claim_whatsapp_provisioning',['wa_akg',job]),null);
    assert.equal((await query('select desired_action from private.whatsapp_account_lifecycle'))[0].desired_action,'deactivate');
    assert.equal((await query('select enabled from public.whatsapp_accounts'))[0].enabled,false);
  });
  await test('R6-IN-wrong-scope',async()=>{await seedEvent();await db.exec(`update public.wa_akg_webhook_events set organization_id='${ids.other}'`);await assert.rejects(()=>claim('wa_akg'),/scope_invalid/);});
  await test('R6-IN-null-lease',async()=>{await seedEvent();await assert.rejects(()=>rpc('finish_whatsapp_webhook_event',['wa_akg',event,null,'processed',null]),/lease_lost/);});
  await test('R6-REC-audit-rollback',async()=>{const t=await rpc('begin_whatsapp_account_lifecycle',[...base(),'activate']);await db.exec("set r2.fail_table='audit_logs'");await assert.rejects(()=>rpc('reconcile_whatsapp_account_lifecycle',[...base(manager),t.revision,'Motivo sintético para rollback',JSON.stringify({confirmed:true,connected:true,observed_at:new Date().toISOString()})]),/injected/);await db.exec("set r2.fail_table=''");assert.equal((await query('select operation_id from private.whatsapp_account_lifecycle'))[0].operation_id,t.operation_id);});
  await test('R6-REC-missing-evidence',async()=>{const t=await rpc('begin_whatsapp_account_lifecycle',[...base(),'activate']);await assert.rejects(()=>rpc('reconcile_whatsapp_account_lifecycle',[...base(manager),t.revision,'Sem observação válida','{"confirmed":true,"connected":true}']),/evidence_invalid/);});
  await test('R6-PROV-orphan-quarantine-keeps-token',async()=>{await seedJob();const t=await rpc('claim_whatsapp_provisioning',['wa_akg',job]);await db.exec("update private.whatsapp_account_lifecycle set operation_started_at=now()-interval '6 minutes'");assert.equal(await rpc('claim_whatsapp_provisioning',['wa_akg',job]),null);assert.deepEqual((await query('select state,operation_id from private.whatsapp_account_lifecycle'))[0],{state:'needs_review',operation_id:t.operation_id});});
  await test('R6-PROV-audit-rollback',async()=>{await seedJob();const t=await rpc('claim_whatsapp_provisioning',['wa_akg',job]);await rpc('check_whatsapp_provisioning',['wa_akg',job,t.operation_id,t.revision,'create',true]);await db.exec("set r2.fail_table='audit_logs'");await assert.rejects(()=>rpc('finish_whatsapp_provisioning',['wa_akg',job,t.operation_id,t.revision,'{"success":true}']),/injected/);await db.exec("set r2.fail_table=''");assert.equal((await query('select operation_id from private.whatsapp_account_lifecycle'))[0].operation_id,t.operation_id);});
  for (const change of ['owner','integration']) await test(`R6-PROV-finish-rechecks-${change}`,async()=>{
    await seedJob();const t=await rpc('claim_whatsapp_provisioning',['wa_akg',job]);
    await rpc('check_whatsapp_provisioning',['wa_akg',job,t.operation_id,t.revision,'create',true]);
    if(change==='owner')await db.exec(`update public.whatsapp_accounts set owner_user_id='${manager}' where id='${account}'`);
    else await db.exec(`update public.wa_akg_seller_provisioning_jobs set integration_id=null where id='${job}'`);
    assert.equal((await rpc('finish_whatsapp_provisioning',['wa_akg',job,t.operation_id,t.revision,'{"success":true,"configuration":{"unsafe_stale_write":true}}'])).state,'needs_review');
    assert.equal((await query('select operation_id from private.whatsapp_account_lifecycle'))[0].operation_id,t.operation_id);
    assert.equal((await query('select configuration from public.integrations'))[0].configuration.unsafe_stale_write,undefined);
    assert.equal((await query('select enabled from public.whatsapp_accounts'))[0].enabled,false);
  });
  return {passed:results.length,failed:0,limits:'SQL real com schema mínimo, constraints de metadata e trigger legado real. Nenhum banco remoto operacional ou provedor.',results};
}
if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const {PGlite}=await import(pathToFileURL(resolve(process.argv[2])).href);const db=new PGlite();
 try{console.log(JSON.stringify({engine:'PGlite 0.3.14',...await runR6(db)},null,2));}finally{await db.close();}
}
