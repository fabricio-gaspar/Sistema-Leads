import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
type Row = Record<string, unknown>;
type Query = { table: string; operation: string; value?: Row; filters: Row };
const state = vi.hoisted(() => ({ admin: {} as object }));
vi.mock('../functions/_shared/auth.ts', () => ({
  createAdminClient: () => state.admin,
  requireUser: async () => ({ user: { id: 'synthetic-owner' } }),
  requireOrganizationRole: async () => undefined,
  requireOrganizationPermission: async () => undefined,
}));
const org='a1111111-1111-4111-8111-111111111111';
const runId='b1111111-1111-4111-8111-111111111111';
const filters={cidade:'Campinas',estados:['SP'],atividades:['transportadores']};
let scheduleFilters: Row; let oldFilters: Row; let calls: Query[];
let handler:(request:Request)=>Promise<Response>;
const validSettings={enabled:true,mode:'automatic',city:'Campinas',regions:['SP'],keywords:['transportadores'],segments:[],
  timezone:'America/Sao_Paulo',runTime:'09:00',weekdays:[1,2,3,4,5],digestTime:'18:00',paidProspectingApproved:true,initialAssignmentMode:'ana'};
function execute(query:Query) {
  calls.push(query);
  if(query.operation!=='select') return {data:{id:runId,status:query.value?.status,...query.value},error:null};
  let data:unknown=[];
  switch(query.table){
    case 'profiles':data={active_organization_id:org,name:'Synthetic'};break;
    case 'company_settings':data={active:true,sandbox_mode:false,can_use_ia:true,ai_actions_enabled:true,ana_operation_mode:'automatic'};break;
    case 'integrations':data=['ai','apify','scheduler','whatsapp','zapi_webhook'].map(key=>({key,connected:true,enabled:true,paused:false}));break;
    case 'organization_module_data':data={data:{killSwitchGlobal:false}};break;
    case 'ai_agents':data={active_version_id:'synthetic-version'};break;
    case 'prospecting_schedules':data={id:'latest-schedule',filters:query.filters.id==='old-schedule'?oldFilters:scheduleFilters,paid_prospecting_approved:true,timezone:'America/Sao_Paulo',run_time:'09:00',weekdays:[1],initial_assignment_mode:'ana'};break;
    case 'prospecting_schedule_runs':data=query.filters.id?{id:runId,schedule_id:'old-schedule'}:[];break;
  }
  return {data,error:null};
}
function queryFor(table:string){
  const query:Query={table,operation:'select',filters:{}};const chain:Record<string,unknown>={};
  for(const method of ['eq','in','order','limit']) chain[method]=(key:string,value:unknown)=>{if(method==='eq')query.filters[key]=value;return chain;};
  for(const method of ['insert','update','upsert']) chain[method]=(value:Row)=>{query.operation=method;query.value=value;return chain;};
  chain.select=chain.single=chain.maybeSingle=()=>chain;
  chain.then=(resolve:(value:unknown)=>unknown,reject:(error:unknown)=>unknown)=>Promise.resolve(execute(query)).then(resolve,reject);
  return chain;
}
const request=(action:string,payload:Row={})=>new Request('https://example.invalid/ana-operations',{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
beforeEach(async()=>{
  vi.resetModules();scheduleFilters={...filters};oldFilters={};calls=[];
  state.admin={from:queryFor,rpc:(table:string,value:Row)=>Promise.resolve(execute({table,operation:'rpc',value,filters:{}}))};
  vi.stubGlobal('Deno',{env:{get:()=>undefined},serve:(callback:typeof handler)=>{handler=callback;}});
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('External traffic forbidden in this test');}));
  await import('../functions/ana-operations/index');
});
afterEach(()=>vi.unstubAllGlobals());
describe('R11 real ana-operations handler / synthetic transport',()=>{
  it('includes location readiness on get without writes or external calls',async()=>{
    scheduleFilters={};const response=await handler(request('get'));
    expect(await response.json()).toMatchObject({ok:true,readiness:{automaticReady:false,checks:{prospectingLocation:false}}});
    expect(calls.every(call=>call.operation==='select')).toBe(true);expect(fetch).not.toHaveBeenCalled();
  });
  it('refuses activation before schedule/company writes',async()=>{
    const response=await handler(request('save',{settings:{...validSettings,city:''}}));
    expect(await response.json()).toMatchObject({ok:false,error:'operation_city_required'});
    expect(calls.every(call=>call.operation==='select')).toBe(true);
  });
  it('saves city and a single uppercase UF in the actual schedule payload',async()=>{
    const response=await handler(request('save',{settings:{...validSettings,regions:['sp']}}));
    expect(response.status).toBe(200);
    expect(calls.find(call=>call.table==='prospecting_schedules'&&call.operation==='update')?.value?.filters).toMatchObject(filters);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('allows an incomplete inactive draft without claiming ready',async()=>{
    const response=await handler(request('save',{settings:{...validSettings,enabled:false,city:''}}));
    expect(await response.json()).toMatchObject({ok:true,enabled:false,readiness:{automaticReady:false}});
  });
  it('refuses direct automatic toggle on a legacy schedule',async()=>{
    scheduleFilters={};const response=await handler(request('set_automatic',{enabled:true}));
    expect(await response.json()).toMatchObject({ok:false,error:'operation_city_required'});
    expect(calls.some(call=>call.operation==='rpc')).toBe(false);
  });
  it('refuses run_now before a paid run is queued',async()=>{
    scheduleFilters={};const response=await handler(request('run_now'));
    expect(await response.json()).toMatchObject({ok:false,error:'operation_city_required'});
    expect(calls.some(call=>call.operation==='insert')).toBe(false);expect(fetch).not.toHaveBeenCalled();
  });
  it('approval checks the old run parent, not the newer valid schedule',async()=>{
    const response=await handler(request('approve_run',{runId}));
    expect(await response.json()).toMatchObject({ok:false,error:'operation_city_required'});
    expect(calls.some(call=>call.operation==='update')).toBe(false);
    expect(calls.some(call=>call.table==='prospecting_schedules'&&call.filters.id==='old-schedule')).toBe(true);
  });
  it('queues only a validated synthetic approved run',async()=>{
    oldFilters={...filters};const response=await handler(request('approve_run',{runId}));
    expect(await response.json()).toMatchObject({ok:true,run:{status:'queued'}});
    expect(calls.filter(call=>call.operation==='update')).toHaveLength(1);expect(fetch).not.toHaveBeenCalled();
  });
});
