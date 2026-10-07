import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { runTests, call, A, seller, id, stamp } from './agendaR9.integration.mjs';

if (!process.argv[2] || !process.argv[3]) throw new Error('Pass local postgres binaries and pg module, never a DSN.');
const bin=resolve(process.argv[2]);
const {Client}=(await import(pathToFileURL(resolve(process.argv[3])).href)).default;
const directory=await mkdtemp(join(tmpdir(),'wayflex-r9-pg-')); const data=join(directory,'data'); const log=join(directory,'postgres.log');
const clients=[]; let started=false;
async function connect() { const client=new Client({host:directory,port:55439,user:'audit_r9',database:'postgres',connectionTimeoutMillis:5000}); await client.connect();clients.push(client);return client; }
try {
  execFileSync(join(bin,'initdb'),['-D',data,'--username=audit_r9','--auth=trust','--encoding=UTF8','--no-locale'],{stdio:'pipe'});
  execFileSync(join(bin,'pg_ctl'),['-D',data,'-l',log,'-o',`-h '' -k '${directory}' -p 55439 -c unix_socket_permissions=0700`,'-w','start'],{stdio:'pipe'});started=true;
  const inspector=await connect(); const sequential=await runTests({exec:sql=>inspector.query(sql),query:sql=>inspector.query(sql)});
  const first=await connect(); const second=await connect(); const pid=(await second.query('select pg_backend_pid() pid')).rows[0].pid; const races=[];
  for(const isolation of ['READ COMMITTED','REPEATABLE READ','SERIALIZABLE']) for(const sameId of [true,false]) {
    await inspector.query(`delete from public.appointments where id in ('${id(101)}','${id(102)}');alter table public.appointments disable trigger touch;update public.appointments set updated_at='${stamp}',metadata=metadata-'next_action_id'-'next_action_at'-'next_action_title' where id='${id(11)}';alter table public.appointments enable trigger touch;`);
    for(const client of [first,second]) { await client.query(`begin isolation level ${isolation};set local statement_timeout='5s';set local role authenticated;set local audit.user_id='${seller}';`);await client.query('select count(*) from public.appointments'); }
    await first.query(call()); let resolved=false;
    const attempt=second.query(call(sameId?101:102)).then(value=>{resolved=true;return {success:true,id:value.rows[0].result.id};},error=>{resolved=true;return {success:false,code:error.code,message:error.message};});
    let waited=false;
    for(let i=0;i<100&&!resolved;i++){ if((await inspector.query('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0]?.wait_event_type==='Lock'){waited=true;break;}await delay(10); }
    await first.query('commit');const result=await attempt;await second.query(result.success?'commit':'rollback');
    const count=Number((await inspector.query(`select count(*) n from public.appointments where id in ('${id(101)}','${id(102)}')`)).rows[0].n);
    const expectedReplay=sameId&&isolation==='READ COMMITTED';
    const passed=waited&&count===1&&(expectedReplay?result.success&&result.id===id(101):!result.success&&result.code==='40001');
    races.push({isolation,sameId,waited,result,count,passed});
  }
  for(const isolation of ['READ COMMITTED','REPEATABLE READ','SERIALIZABLE']) {
    await inspector.query(`delete from public.appointments where id in ('${id(101)}','${id(102)}','${id(14)}');
      alter table public.appointments disable trigger touch;
      update public.appointments set updated_at='${stamp}',metadata=metadata-'next_action_id'-'next_action_at'-'next_action_title' where id='${id(11)}';
      alter table public.appointments enable trigger touch;
      insert into public.appointments(id,organization_id,lead_id,user_id,title,starts_at,ends_at,updated_at,metadata)
        values('${id(14)}','${A}','${id(1)}','${seller}','Second authorized parent','2026-10-05T15:00Z','2026-10-05T16:00Z','${stamp}',
          '{"responsible_user_id":"${seller}","timezone":"America/Sao_Paulo"}');`);
    for(const client of [first,second]) { await client.query(`begin isolation level ${isolation};set local statement_timeout='5s';set local role authenticated;set local audit.user_id='${seller}';`);await client.query('select count(*) from public.appointments'); }
    await first.query(call(101,11));let resolved=false;
    const attempt=second.query(call(102,14)).then(value=>{resolved=true;return {success:true,id:value.rows[0].result.id};},error=>{resolved=true;return {success:false,code:error.code,message:error.message};});
    let waited=false;
    for(let i=0;i<100&&!resolved;i++){if((await inspector.query('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0]?.wait_event_type==='Lock'){waited=true;break;}await delay(10);}
    await first.query('commit');const result=await attempt;await second.query(result.success?'commit':'rollback');
    const count=Number((await inspector.query(`select count(*) n from public.appointments where id in ('${id(101)}','${id(102)}')`)).rows[0].n);
    const expected=isolation==='READ COMMITTED'?'23P01':'40001';
    races.push({isolation,differentParents:true,sameResponsible:true,waited,result,count,passed:waited&&count===1&&!result.success&&result.code===expected});
  }
  const failed=sequential.failed+races.filter(r=>!r.passed).length;
  console.log(JSON.stringify({scope:'Isolated synthetic PostgreSQL, Unix socket only, no production connection',directory,sequential,races,passed:sequential.passed+races.filter(r=>r.passed).length,failed},null,2));
  if(failed)process.exitCode=1;
}catch(error){console.error(JSON.stringify({error:error.message,code:error.code,log:await readFile(log,'utf8').catch(()=>null)}));process.exitCode=1;}
finally{for(const c of clients)await c.end().catch(()=>{});if(started)execFileSync(join(bin,'pg_ctl'),['-D',data,'-m','fast','-w','stop'],{stdio:'pipe'});}
