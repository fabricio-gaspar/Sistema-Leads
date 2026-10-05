import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

// No remote DSN. New local cluster, Unix socket only; existing product/tests stay untouched.
if (!process.argv[2] || !process.argv[3]) throw new Error('Pass native/bin and pg/lib/index.js paths.');
const bin = resolve(process.argv[2]);
const { Client } = (await import(pathToFileURL(resolve(process.argv[3])).href)).default;
const directory = await mkdtemp(join(tmpdir(), 'wayflex-r3-pg-'));
const data = join(directory, 'data'), logfile = join(directory, 'postgres.log');
let started = false;
const clients = [];
const connect = async () => {
  const client = new Client({ host:directory, port:55439, user:'audit_r3', database:'postgres', connectionTimeoutMillis:5000 });
  await client.connect(); clients.push(client); return client;
};
try {
  execFileSync(join(bin,'initdb'), ['-D',data,'--username=audit_r3','--auth=trust','--encoding=UTF8','--no-locale'], { stdio:'pipe' });
  execFileSync(join(bin,'pg_ctl'), ['-D',data,'-l',logfile,'-o',`-h '' -k '${directory}' -p 55439 -c unix_socket_permissions=0700`,'-w','start'], { stdio:'pipe' });
  started = true;
  const inspector = await connect();
  const sourceUrl = new URL('../../../supabase/tests/receiptReconciliationR3.pglite.mjs', import.meta.url).href;
  const source = await readFile(new URL(sourceUrl), 'utf8');
  // Adapt ONLY the runner imports/construction/teardown. Every SQL statement,
  // expected error and assertion comes from the existing, unchanged R3 suite.
  const nativeSource = source.replace(/^import .*;\n/gm, '')
    .replace(/^const \{ PGlite \} = .*;\n/m, '')
    .replace(/^const db = new PGlite\(\);\n/m, '')
    .replaceAll('import.meta.url', 'sourceUrl')
    .replace('await db.close();', '');
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  let sequential;
  const runnerProcess = {};
  await new AsyncFunction('db','assert','readFile','sourceUrl','console','process',nativeSource)(
    { exec:sql=>inspector.query(sql), query:(sql,args)=>inspector.query(sql,args) }, assert, readFile, sourceUrl,
    { log:text=>{ sequential=JSON.parse(text); } }, runnerProcess,
  );
  assert.equal(sequential.failed,0);
  sequential.environment = 'Native PostgreSQL; unchanged R3 assertions adapted only at runner boundaries';
  await inspector.query('reset role');

  const first=await connect(), second=await connect();
  const secondPid=(await second.query('select pg_backend_pid() pid')).rows[0].pid;
  const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const args=status=>[id(1),id(11),['same-provider-id'],1,status,'2026-10-05T12:00:00Z'];
  const call='select * from public.reconcile_whatsapp_receipt_for_account($1,$2,$3,$4,$5,$6)';
  const races=[];
  for (const isolation of ['READ COMMITTED','REPEATABLE READ','SERIALIZABLE']) {
    for (const [firstStatus,secondStatus] of [['read','delivered'],['delivered','read'],['read','failed']]) {
      await inspector.query("update public.lead_outreach set status='sent',sent_at=null,delivered_at=null,read_at=null,failed_at=null,error=null; update public.lead_messages set type='sent'");
      for (const client of [first,second]) {
        await client.query(`begin isolation level ${isolation}; set local role service_role; set local statement_timeout='5s'`);
        await client.query('select count(*) from public.lead_outreach');
      }
      await first.query(call,args(firstStatus));
      let resolved=false;
      const competing=second.query(call,args(secondStatus)).then(
        result=>{ resolved=true;return { success:true, rows:result.rows }; },
        error=>{ resolved=true;return { success:false, code:error.code }; },
      );
      let blocked=false;
      for(let attempt=0;attempt<60&&!resolved;attempt++) {
        const row=(await inspector.query('select wait_event_type from pg_stat_activity where pid=$1',[secondPid])).rows[0];
        if(row?.wait_event_type==='Lock'){blocked=true;break;} await delay(10);
      }
      await first.query('commit');
      const outcome=await competing;
      await second.query(outcome.success?'commit':'rollback');
      if(!outcome.success) {
        assert.equal(outcome.code,'40001');
        await second.query('set role service_role');
        await second.query(call,args(secondStatus)); // retry receipt only; never an outgoing provider operation
      }
      const final=(await inspector.query('select status from public.lead_outreach where id=$1',[id(21)])).rows[0].status;
      const other=(await inspector.query('select status from public.lead_outreach where id in ($1,$2) order by id',[id(22),id(23)])).rows;
      assert.equal(blocked,true); assert.equal(final,'read'); assert.deepEqual(other,[{status:'sent'},{status:'sent'}]);
      races.push({id:`T-R3-PG-C${races.length+1}`,isolation,firstStatus,secondStatus,secondWaitedForLock:blocked,outcome,final,result:'PASS'});
    }
  }
  console.log(JSON.stringify({engine:sequential.version,directory,sourceSha256:createHash('sha256').update(source).digest('hex'),
    scope:'Synthetic local PostgreSQL; private Unix socket, no TCP, no production',sequential,races,passed:sequential.passed+races.length,failed:0},null,2));
} catch(error) {
  console.error(JSON.stringify({error:error.message,code:error.code,postgresLog:await readFile(logfile,'utf8').catch(()=>null)}));
  process.exitCode=1;
} finally {
  for(const client of clients) await client.end().catch(()=>{});
  if(started) execFileSync(join(bin,'pg_ctl'), ['-D',data,'-m','fast','-w','stop'], {stdio:'pipe'});
}
