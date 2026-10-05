import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { runR2Sql } from './r2-sql.mjs';

// Fresh local PostgreSQL cluster, private Unix socket only, no TCP and no DSN.
if (!process.argv[2] || !process.argv[3]) throw new Error('Pass native/bin and pg/lib/index.js paths.');
const bin=resolve(process.argv[2]);
const { Client }=(await import(pathToFileURL(resolve(process.argv[3])).href)).default;
const directory=await mkdtemp(join(tmpdir(),'wayflex-r2-pg-'));
const data=join(directory,'data'), logfile=join(directory,'postgres.log');
const clients=[];let started=false;
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', seller='11111111-1111-4111-8111-111111111111';
const account='33333333-3333-4333-8333-333333333333';
const call=action=>`select public.begin_whatsapp_account_lifecycle('${A}','${account}','wa_akg','${seller}','${action}') result`;
const connect=async()=>{const client=new Client({host:directory,port:55439,user:'postgres',database:'postgres',connectionTimeoutMillis:5000});await client.connect();clients.push(client);return client;};
try {
  execFileSync(join(bin,'initdb'),['-D',data,'--username=postgres','--auth=trust','--encoding=UTF8','--no-locale'],{stdio:'pipe'});
  execFileSync(join(bin,'pg_ctl'),['-D',data,'-l',logfile,'-o',`-h '' -k '${directory}' -p 55439 -c unix_socket_permissions=0700`,'-w','start'],{stdio:'pipe'});
  started=true;
  const inspector=await connect();
  const sequential=await runR2Sql({exec:sql=>inspector.query(sql),query:sql=>inspector.query(sql)});
  await inspector.query('reset role');
  const engine=(await inspector.query('select version()')).rows[0].version;
  const first=await connect(),second=await connect();
  const secondPid=(await second.query('select pg_backend_pid() pid')).rows[0].pid;
  const races=[];
  for(const isolation of ['READ COMMITTED','REPEATABLE READ','SERIALIZABLE']) {
    for(const action of ['activate','refresh_status']) {
      await inspector.query(`truncate private.whatsapp_account_lifecycle; update public.integrations set connected=true,enabled=true,paused=false; update public.whatsapp_accounts set provider='wa_akg',enabled=true,connection_status='connected';`);
      await first.query(`begin isolation level ${isolation}; set local role service_role; set local statement_timeout='5s'`);
      await second.query(`begin isolation level ${isolation}; set local role service_role; set local statement_timeout='5s'`);
      const older=(await first.query(call(action))).rows[0].result;
      let resolved=false;
      const competing=second.query(call('deactivate')).then(result=>{resolved=true;return {success:true,result:result.rows[0].result};},error=>{resolved=true;return {success:false,code:error.code,error:error.message};});
      let blocked=false;
      for(let attempt=0;attempt<60&&!resolved;attempt++) {
        const row=(await inspector.query('select wait_event_type from pg_stat_activity where pid=$1',[secondPid])).rows[0];
        if(row?.wait_event_type==='Lock'){blocked=true;break;}await delay(10);
      }
      await first.query('commit');
      const outcome=await competing;
      await second.query(outcome.success?'commit':'rollback');
      // Snapshot isolation may abort the loser. Its explicit retry is a fresh
      // local intent, not a retry of a remote side effect.
      if(!outcome.success){assert.equal(outcome.code,'40001');await second.query('set role service_role');await second.query(call('deactivate'));}
      const finished=(await first.query(`select public.finish_whatsapp_account_lifecycle('${A}','${account}','wa_akg','${seller}','${older.operation_id}',${older.revision},'{"success":true,"connected":true}') result`)).rows[0].result;
      const flags=(await inspector.query(`select a.enabled,i.enabled as integration_enabled,i.paused from public.whatsapp_accounts a join public.integrations i on i.id=a.integration_id where a.id='${account}'`)).rows[0];
      assert.equal(blocked,true);assert.equal(finished.state,'pending');assert.deepEqual(flags,{enabled:false,integration_enabled:false,paused:true});
      races.push({id:`R2-PG-C${races.length+1}`,isolation,olderAction:action,secondWaitedForLock:blocked,outcome,flags,status:'APROVADO'});
    }
  }
  console.log(JSON.stringify({engine,scope:'Fresh synthetic PostgreSQL cluster; private Unix socket; no TCP; no production',directory,sequential,races,passed:sequential.passed+races.length,failed:0},null,2));
} catch(error) {
  console.error(JSON.stringify({message:error.message,code:error.code,postgresLog:await readFile(logfile,'utf8').catch(()=>null)}));
  process.exitCode=1;
} finally {
  for(const client of clients) await client.end().catch(()=>{});
  if(started) execFileSync(join(bin,'pg_ctl'),['-D',data,'-m','fast','-w','stop'],{stdio:'pipe'});
}
