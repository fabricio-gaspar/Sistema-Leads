import { createAdminClient, requireUser } from './_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from './_shared/http.ts';
const text=(v:unknown,m=8000)=>typeof v==='string'?v.trim().slice(0,m):'';
const email=(v:unknown)=>text(v,254).toLowerCase();
Deno.serve(async request=>{
  const pf=preflight(request);if(pf)return pf;
  if(!hasAllowedOrigin(request))return json({ok:false,erro:'origin_not_allowed'},403);
  const headers=allowedCorsHeaders(request);
  if(request.method!=='POST')return json({ok:false,erro:'method_not_allowed'},405,headers);
  try{
    const body=await request.json() as Record<string,unknown>;
    const leadId=text(body.leadId,64),recipient=email(body.para),message=text(body.texto,8000),subject=text(body.assunto,300)||'Contato Wayflex';
    if(!leadId||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)||!message)throw new Error('lead_recipient_and_message_required');
    const{user}=await requireUser(request);const admin=createAdminClient();
    const{data:profile,error:profileError}=await admin.from('profiles').select('active_organization_id,name').eq('id',user.id).maybeSingle();
    if(profileError||!profile?.active_organization_id)throw new Error('organization_context_required');
    const org=profile.active_organization_id as string;
    const{data:membership,error:membershipError}=await admin.from('organization_members').select('status,role').eq('organization_id',org).eq('user_id',user.id).maybeSingle();
    if(membershipError||!membership||membership.status!=='active')throw new Error('organization_access_denied');
    const{data:lead,error:leadError}=await admin.from('leads').select('id,email,opt_out,last_contact,owner_id').eq('id',leadId).eq('organization_id',org).maybeSingle();
    if(leadError||!lead)throw new Error('lead_not_found');
    if(lead.opt_out)throw new Error('lead_opted_out');
    const canonicalEmail=String(lead.email||'').trim().toLowerCase();
    if(!canonicalEmail||canonicalEmail!==recipient)throw new Error('recipient_mismatch');
    const{data:integration,error:integrationError}=await admin.from('integrations').select('id,provider,connected,enabled,paused').eq('organization_id',org).eq('key','email').maybeSingle();
    if(integrationError||!integration?.connected||!integration.enabled||integration.paused)throw new Error('email_integration_not_ready');
    const now=new Date().toISOString();
    const{data:msg,error:msgError}=await admin.from('lead_messages').insert({organization_id:org,lead_id:lead.id,sender:'human',sender_name:profile.name||user.email||'Equipe',type:'queued',text:message,sent_at:now}).select('id').single();
    if(msgError||!msg)throw msgError??new Error('message_not_created');
    const idempotency=`manual-email:${lead.id}:${msg.id}`;
    const{data:job,error:jobError}=await admin.from('outreach_jobs').insert({organization_id:org,lead_id:lead.id,channel:'email',attempt:0,run_at:now,status:'queued',payload:{recipient,message,subject,manual:true,requested_by:user.id,integration_id:integration.id,message_id:msg.id,context_last_contact:lead.last_contact},idempotency_key:idempotency}).select('id').single();
    if(jobError||!job){await admin.from('lead_messages').delete().eq('id',msg.id).eq('organization_id',org).eq('type','queued');throw jobError??new Error('outreach_job_not_created')}
    await admin.from('audit_logs').insert({organization_id:org,actor_id:user.id,actor_name:profile.name,actor_type:'user',action:'outreach.email_queued',detail:'E-mail manual colocado na fila segura.',entity_table:'outreach_jobs',entity_id:job.id,event_data:{lead_id:lead.id,integration_id:integration.id,message_id:msg.id,idempotency_key:idempotency}});
    return json({ok:true,enviado:false,id:job.id,message_id:msg.id,detalhe:'queued_for_authorized_worker',provedor:integration.provider},202,headers);
  }catch(error){return json({ok:false,enviado:false,erro:safeError(error)},400,headers)}
});
