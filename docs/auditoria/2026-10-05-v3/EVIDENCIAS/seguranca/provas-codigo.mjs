import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=new URL('../../../../../',import.meta.url);
const results=[];
function report(id,scenario,expected,observed,ok){results.push({id,scenario,expected,observed,result:ok?'APROVADO':'REPROVADO',modality:'contrato simulado; código de produção real transpilado; sem rede'});}
function compile(source,imports){const out=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exp={};new Function('require','exports',out)((name)=>{if(!(name in imports)) throw Error('unmocked import '+name);return imports[name];},exp);return exp;}
let rpcCalls=0;
let response={organization_id:'synthetic-A',role:'administrador',permissions:{'team.manage':true}};
const access=compile(await readFile(new URL('src/lib/crm/currentAccessRepository.ts',root),'utf8'),{'@/lib/supabase':{supabase:{rpc:async()=>{rpcCalls++;return{data:response,error:null};}}}});
await access.loadCurrentAccess('same-user');
response={organization_id:'synthetic-B',role:'vendedor',permissions:{'team.manage':false}};
const stale=await access.loadCurrentAccess('same-user');
report('T-SEC-012','Alteração de empresa/permissão do mesmo usuário com cache carregado','nova RPC deve retornar empresa B/vendedor sem team.manage',{rpcCalls,access:stale},stale.organizationId==='synthetic-B'&&stale.permissions['team.manage']===false);

let handler;let calls=[];let changedRole;let policy={requireMfa:true,availableRoles:{administrador:true,vendedor:false,sdr:true,cx:true},revokeSessionsOnDisable:true};
const org='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const actor='11111111-1111-4111-8111-111111111111';
const target='22222222-2222-4222-8222-222222222222';
const db={
 auth:{admin:{updateUserById:async(id,value)=>{calls.push({operation:'AUTH_GLOBAL_UPDATE',id,fields:Object.keys(value)});return{error:null};}}},
 rpc:async(name,args)=>{calls.push({operation:'rpc',name,args});return{data:2,error:null};},
 from(table){let operation='select',payload;const filters={}; const query={
 select(){return query;},eq(k,v){filters[k]=v;return query;},neq(k,v){filters['neq:'+k]=v;return query;},
 update(v){operation='update';payload=v;return query;},insert(v){operation='insert';payload=v;return query;},
 maybeSingle(){return query;},then(resolve){calls.push({table,operation,filters,...operation==='update'?{payload}: {}});
  if(table==='profiles')return Promise.resolve({data:{name:'Admin A sintético',email:'synthetic@example.invalid',active_organization_id:org},error:null}).then(resolve);
  if(table==='organization_members'){if(operation==='update')changedRole=payload?.role;return Promise.resolve({data:{role:'vendedor',status:'active'},count:2,error:null}).then(resolve);}
  if(table==='organization_module_data')return Promise.resolve({data:{data:policy},error:null}).then(resolve);
  return Promise.resolve({data:null,error:null}).then(resolve);
 }};return query;
 }
};
globalThis.Deno={env:{get:()=>undefined},serve:fn=>{handler=fn;}};
compile(await readFile(new URL('supabase/functions/team-members/index.ts',root),'utf8'),{
 '../_shared/auth.ts':{createAdminClient:()=>db,requireUser:async()=>({user:{id:actor,email:'admin-a@example.invalid',aal:'aal1'}}),requireOrganizationPermission:async()=>{}},
 '../_shared/http.ts':{preflight:()=>null,hasAllowedOrigin:()=>true,allowedCorsHeaders:()=>({}),json:(v,s,h)=>new Response(JSON.stringify(v),{status:s,headers:h}),safeError:e=>e.message},
 '../_shared/permissions.ts':{defaultPermissionsForRole:()=>({}),organizationPermissions:[]},
 '../_shared/dailyLeadReport.ts':{maskDailyReportPhone:()=>null,normalizeDailyReportPhone:()=>null,validDailyReportTime:()=>null}
});
async function invoke(body){calls=[];const response=await handler(new Request('https://synthetic.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));return{status:response.status,body:await response.json(),calls};}
const reset=await invoke({action:'reset_password',user_id:target,password:'Synthetic-only-123!'});
report('T-SEC-013','Admin A redefine senha Auth de membro que também pertence à empresa B','negar mutação global de identidade compartilhada ou exigir autoridade externa à empresa',{...reset,fixture:'target belongs to A and B; no other-organization lookup was requested'},reset.status>=400&&!reset.calls.some(c=>c.operation==='AUTH_GLOBAL_UPDATE'));
const role=await invoke({action:'update_role',user_id:target,role:'vendedor'});
report('T-SEC-014','API atribui papel marcado indisponível na política','negar atribuição de vendedor com availableRoles.vendedor=false',{...role,changedRole},role.status>=400);
report('T-SEC-015','Operação administrativa com sessão aal1 e política requireMfa=true','recusar operação sensível até segundo fator',{status:reset.status,body:reset.body,policyReads:reset.calls.filter(c=>c.table==='organization_module_data').length},reset.status>=400);
console.log(JSON.stringify({version:'847048429a86294aa10fa54ffdd750c04447d4fb',fixture:'synthetic only',results},null,2));
