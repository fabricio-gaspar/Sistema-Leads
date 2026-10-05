import assert from 'node:assert/strict';
import { mkdtemp,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { runR6,r6Harness,ids } from './messagingRecoveryR6.sql.mjs';
if(!process.argv[2]||!process.argv[3])throw Error('Pass native/bin and pg/lib/index.js paths; no DSN accepted');
const bin=resolve(process.argv[2]),{Client}=(await import(pathToFileURL(resolve(process.argv[3])).href)).default;
const directory=await mkdtemp(join(tmpdir(),'wayflex-r6-pg-')),data=join(directory,'data'),logfile=join(directory,'postgres.log');
const clients=[];let started=false;
const connect=async()=>{const c=new Client({host:directory,port:55439,user:'postgres',database:'postgres',connectionTimeoutMillis:5000});await c.connect();clients.push(c);return c;};
try {
 execFileSync(join(bin,'initdb'),['-D',data,'--username=postgres','--auth=trust','--encoding=UTF8','--no-locale'],{stdio:'pipe'});
 execFileSync(join(bin,'pg_ctl'),['-D',data,'-l',logfile,'-o',`-h '' -k '${directory}' -p 55439 -c unix_socket_permissions=0700`,'-w','start'],{stdio:'pipe'});started=true;
 const inspector=await connect(),db={exec:s=>inspector.query(s),query:s=>inspector.query(s)};
 const sequential=await runR6(db),h=r6Harness(db),first=await connect(),second=await connect();
 const pid=(await second.query('select pg_backend_pid() pid')).rows[0].pid;
 const {org,seller,manager,account,event,job}=ids;const races=[];
 for(const isolation of ['READ COMMITTED','REPEATABLE READ','SERIALIZABLE'])for(const scenario of ['event_claim','provision_vs_cutoff','recovery_vs_cutoff']) {
  await h.reset();let sqlA,sqlB,ticket;
  if(scenario==='event_claim'){await h.seedEvent();sqlA=sqlB=`select public.claim_whatsapp_webhook_event('wa_akg','${event}') result`;}
  else if(scenario==='provision_vs_cutoff'){await h.seedJob();sqlA=`select public.claim_whatsapp_provisioning('wa_akg','${job}') result`;sqlB=`select public.begin_whatsapp_account_lifecycle('${org}','${account}','wa_akg','${seller}','deactivate') result`;}
  else {ticket=await h.rpc('begin_whatsapp_account_lifecycle',[org,account,'wa_akg',seller,'activate']);sqlA=`select public.reconcile_whatsapp_account_lifecycle('${org}','${account}','wa_akg','${manager}',${ticket.revision},'Reconciliação sintética concorrente',jsonb_build_object('confirmed',true,'connected',true,'observed_at',now())) result`;sqlB=`select public.begin_whatsapp_account_lifecycle('${org}','${account}','wa_akg','${seller}','deactivate') result`;}
  await first.query(`begin isolation level ${isolation};set local role service_role;set local statement_timeout='5s'`);
  await second.query(`begin isolation level ${isolation};set local role service_role;set local statement_timeout='5s'`);
  const older=(await first.query(sqlA)).rows[0].result;
  let settled=false;
  const rival=second.query(sqlB).then(r=>{settled=true;return {ok:true,result:r.rows[0].result};},e=>{settled=true;return {ok:false,code:e.code};});
  let waited=false;
  // Separate observer role can see actual lock state; not a timing-only assertion.
  await inspector.query('reset role');
  for(let n=0;n<80&&!settled;n++){const row=(await inspector.query('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0];if(row?.wait_event_type==='Lock'){waited=true;break;}await delay(10);}
  await first.query('commit');const outcome=await rival;await second.query(outcome.ok?'commit':'rollback');
  if(!outcome.ok){assert.equal(outcome.code,'40001');await second.query('set role service_role');await second.query(sqlB);}
  assert.equal(waited,true);
  if(scenario==='event_claim'){assert.equal((await h.query('select count(*)::int n from private.whatsapp_inbound_work'))[0].n,1);assert.equal((await h.query('select lease_id from private.whatsapp_inbound_work'))[0].lease_id,older.lease_id);await h.rpc('persist_whatsapp_inbound',['wa_akg',event,older.lease_id]);assert.equal((await h.query('select count(*)::int n from public.lead_messages'))[0].n,1);}
  else {assert.equal((await h.query(`select enabled from public.whatsapp_accounts where id='${account}'`))[0].enabled,false);if(scenario==='provision_vs_cutoff')await assert.rejects(()=>h.rpc('check_whatsapp_provisioning',['wa_akg',job,older.operation_id,older.revision,'create',true]),/superseded/);}
  races.push({scenario,isolation,waitedForDatabaseLock:waited,outcome,status:'APROVADO'});
 }
 console.log(JSON.stringify({engine:(await inspector.query('select version()')).rows[0].version,scope:'Synthetic cluster, Unix socket0700, no TCP/provider/production',directory,sequential,races,passed:sequential.passed+races.length,failed:0},null,2));
}catch(e){console.error(JSON.stringify({message:e.message,code:e.code,log:await readFile(logfile,'utf8').catch(()=>null)}));process.exitCode=1;}
finally{for(const c of clients)await c.end().catch(()=>{});if(started)execFileSync(join(bin,'pg_ctl'),['-D',data,'-m','fast','-w','stop'],{stdio:'pipe'});}
