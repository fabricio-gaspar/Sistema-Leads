import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { processInboundWork } from '../functions/_shared/inboundWork.ts';
import { runProvisioningWork } from '../functions/_shared/provisioningWork.ts';
import { recoverAccountLifecycle } from '../functions/_shared/accountLifecycle.ts';
import { WaAkgProvider,waAkgSessionName } from '../functions/_shared/messaging/WaAkgProvider.ts';
import { parseWaAkgEvent,sanitizeWaAkgPayload } from '../functions/_shared/waAkgInbound.ts';
type Row=Record<string,any>;
const state=vi.hoisted(()=>({admin:{} as Row}));
vi.mock('../functions/_shared/auth.ts',()=>({createAdminClient:()=>state.admin}));
const org='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',account='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const event={id:'event',organization_id:org,whatsapp_account_id:account,integration_id:'integration',lease_id:'lease',sanitized_payload:{message_id:'same-message',text:'texto sintético'}};
const context={organizationId:org,accountId:account,provider:'wa_akg' as const,actorId:'admin'};
let calls:Row[],rpcOverride:((name:string,p:Row)=>Row|undefined)|undefined,handler:(r:Request)=>Promise<Response>,fetchMock:ReturnType<typeof vi.fn>;
beforeEach(()=>{
 vi.resetModules();calls=[];rpcOverride=undefined;
 state.admin={rpc:vi.fn(async(name:string,p:Row)=>{
  calls.push({name,p});const overridden=rpcOverride?.(name,p);if(overridden)return overridden;
  const values:Row={persist_whatsapp_inbound:{persisted:true,lead_id:'lead',inbound_id:'inbound'},read_integration_secret:{webhook_secret:'synthetic-secret'},
   begin_whatsapp_inbound_dispatch:{dispatch:true,mode:'ia'},finish_whatsapp_webhook_event:true,
   claim_whatsapp_provisioning:{id:'job',operation_id:'operation',revision:1},check_whatsapp_provisioning:{current:true},
   save_whatsapp_provisioning_secret:true,finish_whatsapp_provisioning:{state:'completed'},
   diagnose_whatsapp_account_lifecycle:{state:'in_flight',revision:1,can_reconcile_read_only:true,reason:'read_only_operation'},
   reconcile_whatsapp_account_lifecycle:{state:'completed',revision:2,desired_action:'reconciled_disabled'}};
  if(!(name in values))throw Error('unexpected_rpc');return {data:values[name],error:null};
 })};
 vi.stubGlobal('Deno',{env:{get:(n:string)=>({SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic',META_WORKER_TOKEN:'worker'} as Row)[n]},serve:(h:typeof handler)=>{handler=h;}});
 fetchMock=vi.fn(async()=>new Response('{"ok":true}',{status:200}));vi.stubGlobal('fetch',fetchMock);
});
afterEach(()=>vi.unstubAllGlobals());
describe('R6 durable stage orchestration — mocked transport',()=>{
 it('T-R6-HTTP-11 a superseded local provisioning reports cancelled, not failed or completed',async()=>{
  rpcOverride=n=>n==='finish_whatsapp_provisioning'?{data:{state:'cancelled'},error:null}:undefined;
  const result=await runProvisioningWork(state.admin as never,'wa_akg',{id:'job'},async()=>{throw Error('whatsapp_provisioning_superseded');});
  expect(result).toEqual({cancelled:true});expect(fetchMock).not.toHaveBeenCalled();
 });
 it('T-R6-HTTP-01 local failure never dispatches Ana',async()=>{rpcOverride=n=>n==='persist_whatsapp_inbound'?{data:null,error:{message:'injected'}}:undefined;await expect(processInboundWork(state.admin as never,'wa_akg',event)).rejects.toThrow('persistence_failed');expect(fetchMock).not.toHaveBeenCalled();});
 it('T-R6-HTTP-02 reviewed identity preserves no dispatch',async()=>{rpcOverride=n=>n==='persist_whatsapp_inbound'?{data:{review:true,reason:'sender_identity_unresolved'},error:null}:undefined;expect(await processInboundWork(state.admin as never,'wa_akg',event)).toEqual({review:true});expect(fetchMock).not.toHaveBeenCalled();});
 it('T-R6-HTTP-03 missing secret does not persist dispatch intent',async()=>{rpcOverride=n=>n==='read_integration_secret'?{data:{},error:null}:undefined;await expect(processInboundWork(state.admin as never,'wa_akg',event)).rejects.toThrow('credential_missing');expect(calls.some(c=>c.name==='begin_whatsapp_inbound_dispatch')).toBe(false);expect(fetchMock).not.toHaveBeenCalled();});
 it('T-R6-HTTP-04 latest human/gate fence prevents dispatch',async()=>{rpcOverride=n=>n==='begin_whatsapp_inbound_dispatch'?{data:{dispatch:false},error:null}:undefined;await processInboundWork(state.admin as never,'wa_akg',event);expect(fetchMock).not.toHaveBeenCalled();expect(calls.at(-1)?.p.p_state).toBe('processed');});
 it('T-R6-HTTP-05 WA-AKG timeout after persisted dispatch becomes review',async()=>{fetchMock.mockRejectedValue(Error('synthetic transport timeout'));await processInboundWork(state.admin as never,'wa_akg',event);expect(fetchMock).toHaveBeenCalledTimes(1);expect(calls.at(-1)?.p.p_state).toBe('needs_review');const body=JSON.parse(String(fetchMock.mock.calls[0][1].body));expect(body.request_id).toBe(`wa_akg:${account}:same-message`);expect(body).not.toHaveProperty('retry_failed');});
 it('T-R6-HTTP-06 an in-flight duplicate is not successful completion',async()=>{fetchMock.mockResolvedValue(new Response('{"duplicate":true,"processing":true}',{status:200}));await processInboundWork(state.admin as never,'wa_akg',event);expect(calls.at(-1)?.p.p_state).toBe('needs_review');});
 it('T-R6-HTTP-07 provisioning fences every subsequent effect after cutoff',async()=>{let checked=0;rpcOverride=(n)=>n==='check_whatsapp_provisioning'&&++checked===2?{data:null,error:{message:'superseded'}}:n==='finish_whatsapp_provisioning'?{data:{state:'needs_review'},error:null}:undefined;
  const effect=vi.fn(async()=>undefined);const result=await runProvisioningWork(state.admin as never,'wa_akg',{id:'job'},async(_job,step)=>{await step('create',effect,true);await step('start',effect,true);return {};});expect(effect).toHaveBeenCalledTimes(1);expect(result).toEqual({failed:true,review:true});});
 it('T-R6-HTTP-08 pending ledger admits no automatic provisioning effect',async()=>{rpcOverride=n=>n==='claim_whatsapp_provisioning'?{data:null,error:null}:undefined;const work=vi.fn();expect(await runProvisioningWork(state.admin as never,'wa_akg',{id:'job'},work)).toEqual({skipped:true});expect(work).not.toHaveBeenCalled();});
 it('T-R6-HTTP-09 recovery sends server observation, reason and expected revision to CAS',async()=>{const observe=vi.fn(async()=>({confirmed:true,connected:true}));const result=await recoverAccountLifecycle(state.admin as never,context,{action:'lifecycle_reconcile',expected_revision:1,reason:'Motivo sintético validado'},observe);expect(result.lifecycle.state).toBe('completed');expect(result.recovery.retainsLocalCutoff).toBe(true);expect(calls.at(-1)?.p).toMatchObject({p_expected_revision:1,p_observation:{confirmed:true,connected:true}});expect(fetchMock).not.toHaveBeenCalled();});
 it('T-R6-HTTP-10 observed connected never releases an uncertain mutation',async()=>{rpcOverride=n=>n==='diagnose_whatsapp_account_lifecycle'?{data:{revision:2,state:'needs_review',can_reconcile_read_only:false,reason:'external_mutation_terminality_unproven'},error:null}:undefined;const result=await recoverAccountLifecycle(state.admin as never,context,{action:'lifecycle_reconcile',expected_revision:2,reason:'Sem prova de terminalidade'},async()=>({confirmed:true,connected:true}));expect(result.status).toBe(409);expect(calls.some(c=>c.name==='reconcile_whatsapp_account_lifecycle')).toBe(false);});
});

describe('R7 pinned WA-AKG upstream contract',()=>{
 const session=waAkgSessionName(org,account),url='https://api.example.test/callback',secret='synthetic-signing-secret-with-32-characters';
 const options={baseUrl:'https://gateway.example.test',apiKey:'synthetic',sessionId:session,allowedOrigins:['https://gateway.example.test']};
 const safety={enabled:false,botMode:'SPECIFIC',autoReplyMode:'SPECIFIC',botAllowedJids:[],autoReplyAllowedJids:[],autoRead:false,alwaysOnline:false};
 const hook={isActive:true,url,secret,session:{sessionId:session},events:['message.received','message.sent','message.status','connection.update']};
 it('T-R7-01 tenant and account define distinct stable namespace',()=>{expect(session).not.toBe(waAkgSessionName(account,account));expect(session).not.toBe(waAkgSessionName(org,org));expect(session.length).toBeLessThanOrEqual(120);});
 it('T-R7-02 uses valid enums and verifies returned safety',async()=>{fetchMock.mockResolvedValue(new Response(JSON.stringify({status:true,data:safety}),{status:200}));fetchMock.mockImplementation(async()=>new Response(JSON.stringify({status:true,data:safety}),{status:200}));await new WaAkgProvider(options).configureSafety();expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({autoReplyMode:'SPECIFIC',botMode:'SPECIFIC',enabled:false});expect(fetchMock.mock.calls[1][1].method).toBe('GET');});
 it('T-R7-03 upstream update ignoring enabled cannot be called safe',async()=>{fetchMock.mockImplementation(async()=>new Response(JSON.stringify({status:true,data:{...safety,enabled:true}}),{status:200}));await expect(new WaAkgProvider(options).configureSafety()).rejects.toThrow('safety_not_confirmed');});
 it('T-R7-04 reuses only an exact active webhook without POST',async()=>{fetchMock.mockImplementation(async()=>new Response(JSON.stringify({status:true,data:[hook]}),{status:200}));await new WaAkgProvider(options).registerWebhook(url,secret);expect(fetchMock).toHaveBeenCalledTimes(1);expect(fetchMock.mock.calls[0][1].method).toBe('GET');});
 it.each([{...hook,secret:'foreign'}, {...hook,session:null}, hook])('T-R7-05 mismatched/global/duplicate webhook requires review %#',async(candidate)=>{fetchMock.mockImplementation(async()=>new Response(JSON.stringify({status:true,data:candidate===hook?[hook,hook]:[candidate]}),{status:200}));await expect(new WaAkgProvider(options).registerWebhook(url,secret)).rejects.toThrow('ownership_requires_review');expect(fetchMock).toHaveBeenCalledTimes(1);});
 it('T-R7-06 cutoff between GET and creation stops webhook POST',async()=>{fetchMock.mockResolvedValue(new Response('{"status":true,"data":[]}',{status:200}));await expect(new WaAkgProvider(options).registerWebhook(url,secret,async()=>{throw Error('cutoff');})).rejects.toThrow('cutoff');expect(fetchMock).toHaveBeenCalledTimes(1);});
 it('T-R7-07 session ownership needs both scoped identity and matching webhook',async()=>{fetchMock.mockImplementation(async(path)=>new Response(JSON.stringify({status:true,data:String(path).includes('/webhooks/')?[hook]:{sessionId:'foreign-session'}}),{status:200}));await expect(new WaAkgProvider(options).verifyOwnedSession(url,secret)).rejects.toThrow('ownership_requires_review');});
 it('T-R7-08 status=false at HTTP200 is a rejection',async()=>{fetchMock.mockResolvedValue(new Response('{"status":false}',{status:200}));await expect(new WaAkgProvider(options).status()).rejects.toThrow('request_rejected_200');});
 it('T-R6-MEDIA audio without caption retains reference and LID never becomes phone',()=>{const input={event:'message.received',data:{key:{id:'id',remoteJid:'1234567890123@lid',fromMe:false},type:'AUDIO',fileUrl:'https://media.example.test/audio.ogg',mimeType:'audio/ogg'}};expect(parseWaAkgEvent(input)).toMatchObject({kind:'inbound',phone:'',media:{kind:'audio',url:'https://media.example.test/audio.ogg'}});expect(sanitizeWaAkgPayload(input)).toMatchObject({identity_requires_review:true,remote_jid:'1234567890123@lid',media:{kind:'audio'}});});
});

describe('R6 Meta uncertain send — complete worker with mocked database/HTTP',()=>{
 it('T-R6-META-HTTP uncertain accepted transport cannot POST a second time',async()=>{
  const job:Row={id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',organization_id:org,whatsapp_account_id:account,lead_id:'lead',origin:'panel',status:'queued',message_kind:'text',recipient_identity:'5511999999999',idempotency_key:'synthetic-key',content:{text:'Synthetic only'},attempt_count:0};
  const tables:Row={messaging_outbox:[job],organization_feature_flags:[{organization_id:org,flag_key:'meta_coexistence',enabled:true}],messaging_provider_controls:[{organization_id:org,provider:'meta_cloud',send_enabled:true,automation_enabled:true,kill_switch:false}],
   whatsapp_accounts:[{id:account,organization_id:org,integration_id:'integration',provider:'meta_cloud',enabled:true,connection_status:'connected',archived_at:null}],
   leads:[{id:'lead',organization_id:org,opt_out:false,whatsapp_account_id:account}],whatsapp_conversations:[{organization_id:org,whatsapp_account_id:account,lead_id:'lead',last_inbound_at:new Date().toISOString()}]};
  state.admin.from=(table:string)=>{const filters:((r:Row)=>boolean)[]=[];let values:Row|undefined,single=false;const q:Row={};
   q.eq=(k:string,v:unknown)=>{filters.push(r=>r[k]===v);return q;};q.in=(k:string,v:unknown[])=>{filters.push(r=>v.includes(r[k]));return q;};q.is=q.eq;q.lte=q.order=q.limit=q.select=()=>q;q.maybeSingle=()=>{single=true;return q;};q.update=(v:Row)=>{values=v;return q;};q.insert=()=>q;
   q.then=(resolve:(v:Row)=>unknown)=>{const rows=(tables[table]??[]).filter((r:Row)=>filters.every(f=>f(r)));if(values)rows.forEach((r:Row)=>Object.assign(r,values));return Promise.resolve({data:single?rows[0]??null:rows,error:null}).then(resolve);};return q;};
  state.admin.rpc=async(name:string,p:Row)=>{
   if(name==='claim_meta_outbox'){if(!['queued','failed'].includes(job.status))return{data:null,error:null};Object.assign(job,{status:'processing',locked_by:p.p_worker_id});return{data:{...job},error:null};}
   if(name==='read_integration_secret')return{data:{access_token:'synthetic',phone_number_id:'123456789',graph_api_version:'v23.0'},error:null};
   if(name==='begin_meta_outbox_dispatch'){job.dispatch_started_at=new Date().toISOString();return{data:true,error:null};}throw Error('unexpected_rpc');};
  fetchMock.mockRejectedValue(Error('simulated timeout after possible remote acceptance'));
  await import('../functions/meta-whatsapp-worker/index.ts');
  const request=()=>new Request('https://example.invalid/worker',{method:'POST',headers:{'x-meta-worker-token':'worker'},body:'{}'});
  expect((await handler(request())).status).toBe(200);expect(job.status).toBe('reconciliation_required');
  expect((await handler(request())).status).toBe(200);expect(fetchMock).toHaveBeenCalledTimes(1);expect(job.dispatch_started_at).toBeTruthy();
 });
});
