import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { runTests, A, admin, seller, id } from './teamAccessR4.integration.mjs';
if(!process.argv[2]||!process.argv[3])throw new Error('Pass native/bin and local pg/lib/index.js; no DSN accepted.');
const bin=resolve(process.argv[2]);const {Client}=(await import(pathToFileURL(resolve(process.argv[3])).href)).default;
const directory=await mkdtemp(join(tmpdir(),'wayflex-r4-pg-'));const data=join(directory,'data');const log=join(directory,'postgres.log');
let started=false;const clients=[];
async function connect(){const c=new Client({host:directory,port:55439,user:'audit_r4',database:'postgres',connectionTimeoutMillis:5000});await c.connect();clients.push(c);return c;}
try{
  execFileSync(join(bin,'initdb'),['-D',data,'--username=audit_r4','--auth=trust','--encoding=UTF8','--no-locale'],{stdio:'pipe'});
  execFileSync(join(bin,'pg_ctl'),['-D',data,'-l',log,'-o',`-h '' -k '${directory}' -p 55439 -c unix_socket_permissions=0700`,'-w','start'],{stdio:'pipe'});started=true;
  const inspector=await connect();const sequential=await runTests({exec:s=>inspector.query(s),query:s=>inspector.query(s)});
  const first=await connect(),second=await connect();const pid=(await second.query('select pg_backend_pid() pid')).rows[0].pid;const races=[];
  for(const isolation of ['READ COMMITTED','REPEATABLE READ','SERIALIZABLE'])for(const action of ['cancel_first','accept_first','role_disabled_first','actor_disabled_first']){
    await inspector.query(`update public.organization_invites set accepted_at=null,accepted_by=null,cancelled_at=null,revision=1,expires_at=now()+interval '15 minutes';
      delete from public.organization_members where user_id='${id(91)}'; delete from public.organization_module_data;
      update public.organization_members set status='active' where user_id='${seller}';
      delete from public.team_member_permissions where user_id='${seller}';insert into public.team_member_permissions values('${A}','${seller}','team.manage',true);`);
    const cancel=`select public.team_invite_cancel('${id(90)}')`;const accept=`select public.team_invite_accept('${id(90)}',1)`;
    const firstUser=action==='accept_first'?id(91):admin;
    const secondUser=action==='accept_first'?admin:action==='actor_disabled_first'?seller:id(91);
    const firstSql=action==='cancel_first'?cancel:action==='accept_first'?accept:action==='role_disabled_first'
      ?`insert into public.organization_module_data values('${A}','access_security_policy','{"availableRoles":{"vendedor":false}}')`
      :`select public.team_member_change('${A}','${seller}','set_status',null,false)`;
    const secondSql=action==='accept_first'?cancel:action==='actor_disabled_first'
      ?`select public.team_invite_prepare('${A}','race@synthetic.test','cx')`:accept;
    for(const [c,u]of[[first,firstUser],[second,secondUser]]){await c.query(`begin isolation level ${isolation};set local statement_timeout='5s';set local role authenticated;set local audit.user_id='${u}';`);await c.query('select count(*) from public.organization_members');}
    await first.query(firstSql);let resolved=false;const waiting=second.query(secondSql).then(r=>{resolved=true;return{committed:true,rows:r.rows};},e=>{resolved=true;return{committed:false,code:e.code,message:e.message};});
    let blocked=false;for(let attempt=0;attempt<100&&!resolved;attempt++){if((await inspector.query('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0]?.wait_event_type==='Lock'){blocked=true;break;}await delay(10);}
    await first.query('commit');const outcome=await waiting;await second.query(outcome.committed?'commit':'rollback');
    const row=(await inspector.query(`select accepted_at is not null accepted,cancelled_at is not null cancelled,(select count(*)::int from public.organization_members where user_id='${id(91)}') members from public.organization_invites where id='${id(90)}'`)).rows[0];
    const expected=isolation!=='READ COMMITTED'?'40001':['role_disabled_first','actor_disabled_first'].includes(action)?'42501':'P0001';
    const invariant=action==='accept_first'?row.accepted&&!row.cancelled&&row.members===1:!row.accepted&&row.members===0;
    races.push({id:`T-R4-RACE-${String(races.length+1).padStart(2,'0')}`,isolation,action,blocked,outcome,state:row,result:blocked&&!outcome.committed&&outcome.code===expected&&invariant?'APROVADO':'REPROVADO'});
  }
  const failed=sequential.failed+races.filter(x=>x.result!=='APROVADO').length;
  console.log(JSON.stringify({engine:(await inspector.query('select version()')).rows[0].version,scope:'Local temporary Unix socket 0700, no TCP or production',directory,sequential,races,passed:sequential.passed+races.length-(failed-sequential.failed),failed},null,2));if(failed)process.exitCode=1;
}catch(e){console.error(JSON.stringify({message:e.message,code:e.code,stderr:e.stderr?.toString(),log:await readFile(log,'utf8').catch(()=>null)}));process.exitCode=1;}
finally{for(const c of clients)await c.end().catch(()=>{});if(started)execFileSync(join(bin,'pg_ctl'),['-D',data,'-m','fast','-w','stop'],{stdio:'pipe'});}
