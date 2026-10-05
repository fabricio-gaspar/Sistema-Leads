-- R6/R7: bounded local transactions; no network and no operational backfill.
-- The event rows remain the queue, this private ledger owns only stage/lease.
create table private.whatsapp_inbound_work (
  provider text not null check(provider in ('wa_akg','evolution_go')),
  event_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.whatsapp_accounts(id) on delete cascade,
  phase text not null default 'received' check(phase in ('received','persisted','dispatching','completed','needs_review')),
  lease_id uuid,
  lease_expires_at timestamptz,
  inbound_id uuid,
  lead_id uuid,
  message_id uuid,
  updated_at timestamptz not null default now(),
  primary key(provider,event_id)
);
alter table private.whatsapp_inbound_work enable row level security;
revoke all on private.whatsapp_inbound_work from public,anon,authenticated;
grant select,insert,update on private.whatsapp_inbound_work to service_role;
create index whatsapp_inbound_work_account_idx on private.whatsapp_inbound_work(account_id);
create index whatsapp_inbound_work_expired_idx on private.whatsapp_inbound_work(lease_expires_at) where lease_id is not null;

create function private.whatsapp_event_table(p_provider text) returns text
language plpgsql security invoker set search_path='' as $$ begin
  if current_user not in ('postgres','service_role') or p_provider is null or p_provider not in ('wa_akg','evolution_go') then
    raise exception 'whatsapp_event_access_denied'; end if;
  return p_provider || '_webhook_events';
end $$;
revoke all on function private.whatsapp_event_table(text) from public,anon,authenticated;
grant execute on function private.whatsapp_event_table(text) to service_role;

create function public.claim_whatsapp_webhook_event(p_provider text,p_event_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t text:=private.whatsapp_event_table(p_provider); e record; w private.whatsapp_inbound_work%rowtype; token uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('whatsapp-event:'||p_provider||':'||p_event_id::text,0));
  execute pg_catalog.format('select * from public.%I where id=$1 for update',t) into e using p_event_id;
  if e.id is null or e.processing_status not in ('queued','failed','processing') or (e.processing_status<>'processing' and e.next_retry_at>pg_catalog.now()) then return null; end if;
  if not exists(select 1 from public.whatsapp_accounts a join public.integrations i on i.id=a.integration_id and i.organization_id=a.organization_id
    where a.id=e.whatsapp_account_id and a.organization_id=e.organization_id and a.integration_id=e.integration_id
      and a.provider=p_provider and a.archived_at is null) then raise exception 'whatsapp_event_scope_invalid'; end if;
  select * into w from private.whatsapp_inbound_work where provider=p_provider and event_id=p_event_id for update;
  -- Pre-migration processing has no stage proof. Never blindly replay it.
  if (w.event_id is null and e.processing_status='processing') or (w.phase='dispatching' and w.lease_expires_at<=pg_catalog.now()) then
    execute pg_catalog.format('update public.%I set processing_status=''needs_review'',error_code=''inbound_effect_unknown'',processed_at=now() where id=$1',t) using p_event_id;
    update private.whatsapp_inbound_work set phase='needs_review',updated_at=pg_catalog.now() where provider=p_provider and event_id=p_event_id;
    return null;
  end if;
  if w.phase in ('dispatching','completed','needs_review') or w.lease_expires_at>pg_catalog.now() then return null; end if;
  token:=pg_catalog.gen_random_uuid();
  insert into private.whatsapp_inbound_work(provider,event_id,organization_id,account_id,lease_id,lease_expires_at)
    values(p_provider,p_event_id,e.organization_id,e.whatsapp_account_id,token,pg_catalog.now()+interval '2 minutes')
    on conflict(provider,event_id) do update set lease_id=excluded.lease_id,lease_expires_at=excluded.lease_expires_at,updated_at=pg_catalog.now()
    returning * into w;
  if w.organization_id<>e.organization_id or w.account_id<>e.whatsapp_account_id then raise exception 'whatsapp_event_scope_invalid'; end if;
  execute pg_catalog.format('update public.%I set processing_status=''processing'',attempt_count=least(attempt_count+1,20),next_retry_at=now()+interval ''2 minutes'',error_code=null where id=$1 returning *',t) into e using p_event_id;
  return pg_catalog.to_jsonb(e)||pg_catalog.jsonb_build_object('lease_id',token,'phase',w.phase);
end $$;

create function public.finish_whatsapp_webhook_event(p_provider text,p_event_id uuid,p_lease_id uuid,p_state text,p_error_code text default null) returns boolean
language plpgsql security invoker set search_path='' as $$
declare t text:=private.whatsapp_event_table(p_provider); w private.whatsapp_inbound_work%rowtype; changed integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('whatsapp-event:'||p_provider||':'||p_event_id::text,0));
  if p_state is null or p_state not in ('processed','ignored','needs_review','failed','dead_letter') then raise exception 'whatsapp_event_state_invalid'; end if;
  select * into w from private.whatsapp_inbound_work where provider=p_provider and event_id=p_event_id for update;
  if w.event_id is null or p_lease_id is null or w.lease_id is distinct from p_lease_id or w.lease_expires_at<=pg_catalog.now() then raise exception 'whatsapp_event_lease_lost'; end if;
  if w.phase='dispatching' and p_state='failed' then p_state:='needs_review'; p_error_code:='inbound_effect_unknown'; end if;
  execute pg_catalog.format('update public.%I set processing_status=$2,error_code=$3,processed_at=case when $2=''failed'' then null else now() end,next_retry_at=now()+interval ''1 minute'' where id=$1 and organization_id=$4',t)
    using p_event_id,p_state,pg_catalog.left(p_error_code,120),w.organization_id;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'whatsapp_event_missing'; end if;
  if w.inbound_id is not null then update public.channel_inbound_events set
    status=case when p_state in ('processed','ignored') then 'processed' else 'failed' end,
    error=p_error_code,processed_at=case when p_state='failed' then null else pg_catalog.now() end
    where id=w.inbound_id and organization_id=w.organization_id; end if;
  update private.whatsapp_inbound_work set phase=case when p_state='failed' then phase when p_state='needs_review' then 'needs_review' else 'completed' end,
    lease_id=null,lease_expires_at=null,updated_at=pg_catalog.now() where provider=p_provider and event_id=p_event_id;
  return true;
end $$;

create function public.persist_whatsapp_inbound(p_provider text,p_event_id uuid,p_lease_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t text:=private.whatsapp_event_table(p_provider); e record; w private.whatsapp_inbound_work%rowtype; r record; l public.leads%rowtype;
  p jsonb; phone text; mid text; body text; at timestamptz; ext text; inbound uuid; message uuid; media jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('whatsapp-event:'||p_provider||':'||p_event_id::text,0));
  select * into w from private.whatsapp_inbound_work where provider=p_provider and event_id=p_event_id for update;
  if w.event_id is null or p_lease_id is null or w.lease_id is distinct from p_lease_id or w.lease_expires_at<=pg_catalog.now() or w.phase not in ('received','persisted') then raise exception 'whatsapp_event_lease_lost'; end if;
  execute pg_catalog.format('select * from public.%I where id=$1 and organization_id=$2 and processing_status=''processing''',t) into e using p_event_id,w.organization_id;
  if e.id is null or e.event_kind<>'inbound' or e.whatsapp_account_id<>w.account_id then raise exception 'whatsapp_inbound_scope_invalid'; end if;
  p:=e.sanitized_payload; phone:=p->>'phone'; mid:=p->>'message_id'; body:=p->>'text'; media:=p->'media';
  if coalesce(phone,'')!~'^[1-9][0-9]{7,14}$' or coalesce(p->>'remote_jid','')!~'^[1-9][0-9]{7,14}(:[0-9]{1,5})?@(s\.whatsapp\.net|c\.us)$'
    or pg_catalog.split_part(pg_catalog.split_part(p->>'remote_jid','@',1),':',1)<>phone then
    perform public.finish_whatsapp_webhook_event(p_provider,p_event_id,p_lease_id,'needs_review','sender_identity_unresolved');
    return pg_catalog.jsonb_build_object('review',true,'reason','sender_identity_unresolved');
  end if;
  if coalesce(mid,'')='' or pg_catalog.length(mid)>300 or coalesce(body,'')='' then raise exception 'whatsapp_inbound_payload_invalid'; end if;
  -- Revalidate the canonical route in the same transaction as persistence.
  if not exists(select 1 from public.whatsapp_accounts a join public.integrations i on i.id=a.integration_id and i.organization_id=a.organization_id
    join public.messaging_provider_controls c on c.organization_id=a.organization_id and c.provider=a.provider
    where a.id=w.account_id and a.organization_id=w.organization_id and a.provider=p_provider and a.enabled and a.archived_at is null
      and a.connection_status='connected' and i.enabled and i.connected and not i.paused and c.inbound_enabled and not c.kill_switch) then
    perform public.finish_whatsapp_webhook_event(p_provider,p_event_id,p_lease_id,'ignored','whatsapp_inbound_route_disabled');
    return pg_catalog.jsonb_build_object('review',true,'reason','whatsapp_inbound_route_disabled'); end if;
  if w.phase='persisted' then return pg_catalog.jsonb_build_object('lead_id',w.lead_id,'inbound_id',w.inbound_id,'message_id',w.message_id,'persisted',true); end if;
  select * into r from public.resolve_whatsapp_lead_for_account(w.organization_id,w.account_id,phone) limit 1;
  if r.lead_id is null then
    perform public.finish_whatsapp_webhook_event(p_provider,p_event_id,p_lease_id,'needs_review',case when r.reason='ambiguous_identity' then 'lead_identity_ambiguous' else 'lead_not_matched' end);
    return pg_catalog.jsonb_build_object('review',true,'reason','lead_not_matched');
  end if;
  select * into strict l from public.leads where id=r.lead_id and organization_id=w.organization_id for update;
  at:=coalesce(nullif(p->>'occurred_at','')::timestamptz,nullif(p->>'timestamp','')::timestamptz,e.occurred_at,pg_catalog.now());
  ext:='message:'||w.account_id::text||':'||mid;
  insert into public.channel_inbound_events(organization_id,whatsapp_account_id,provider,event_type,external_id,lead_id,payload,status,error,processed_at)
    values(w.organization_id,w.account_id,p_provider,'message',ext,l.id,p,'received',null,null) on conflict do nothing returning id into inbound;
  if inbound is null then select id into strict inbound from public.channel_inbound_events where organization_id=w.organization_id and whatsapp_account_id=w.account_id and provider=p_provider and external_id=ext and lead_id=l.id; end if;
  insert into public.lead_messages(organization_id,lead_id,whatsapp_account_id,sender,sender_name,type,text,sent_at,provider,message_origin,provider_message_id,provider_occurred_at)
    values(w.organization_id,l.id,w.account_id,'lead','Lead','received',body,at,p_provider,'customer',mid,at) on conflict do nothing returning id into message;
  if message is null then select id into strict message from public.lead_messages where organization_id=w.organization_id and whatsapp_account_id=w.account_id and lead_id=l.id and provider=p_provider and provider_message_id=mid and sender='lead'; end if;
  if media->>'kind' in ('image','audio','video','document') and media->>'url' like 'https://%' then
    insert into public.message_attachments(organization_id,lead_id,message_id,media_type,mime_type,file_name,external_url)
      values(w.organization_id,l.id,message,media->>'kind',media->>'mimeType',media->>'fileName',media->>'url') on conflict do nothing;
  end if;
  update public.leads set first_inbound_at=coalesce(first_inbound_at,at),last_contact=greatest(last_contact,at),no_reply_deadline_at=null,no_reply_processed_at=null,
    contact_approval_status='approved',contact_approval_reason='Contato iniciou uma conversa individual pelo WhatsApp.',contact_approved_at=at,
    whatsapp_account_id=case when r.reason='account_history_identity' then whatsapp_account_id else w.account_id end
    where id=l.id and organization_id=w.organization_id;
  update public.outreach_jobs set status='cancelled',processed_at=at,error='cancelled_by_inbound_reply'
    where organization_id=w.organization_id and lead_id=l.id and status in ('queued','retry') and coalesce(payload->>'manual','false')<>'true';
  update private.whatsapp_inbound_work set phase='persisted',inbound_id=inbound,lead_id=l.id,message_id=message,updated_at=pg_catalog.now() where provider=p_provider and event_id=p_event_id;
  return pg_catalog.jsonb_build_object('lead_id',l.id,'inbound_id',inbound,'message_id',message,'persisted',true);
end $$;

create function public.begin_whatsapp_inbound_dispatch(p_provider text,p_event_id uuid,p_lease_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare w private.whatsapp_inbound_work%rowtype; l public.leads%rowtype;
begin
  perform private.whatsapp_event_table(p_provider);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('whatsapp-event:'||p_provider||':'||p_event_id::text,0));
  select * into w from private.whatsapp_inbound_work where provider=p_provider and event_id=p_event_id for update;
  if w.event_id is null or p_lease_id is null or w.lease_id is distinct from p_lease_id or w.lease_expires_at<=pg_catalog.now() or w.phase<>'persisted' then raise exception 'whatsapp_event_lease_lost'; end if;
  select * into strict l from public.leads where id=w.lead_id and organization_id=w.organization_id;
  if l.opt_out or l.ai_paused or l.modo_atendimento='humano' or l.automation_status='human' or not exists(
    select 1 from public.whatsapp_accounts a join public.integrations i on i.id=a.integration_id and i.organization_id=a.organization_id
      join public.messaging_provider_controls c on c.organization_id=a.organization_id and c.provider=a.provider
      where a.id=w.account_id and a.organization_id=w.organization_id and a.provider=p_provider and a.archived_at is null and a.enabled
      and a.connection_status='connected' and i.enabled and i.connected and not i.paused and not c.kill_switch
      and c.inbound_enabled and c.send_enabled and c.automation_enabled) then return pg_catalog.jsonb_build_object('dispatch',false); end if;
  -- Persist BEFORE the external effect. An expired dispatch is review, not retry.
  update private.whatsapp_inbound_work set phase='dispatching',updated_at=pg_catalog.now() where provider=p_provider and event_id=p_event_id;
  return pg_catalog.jsonb_build_object('dispatch',true,'lead_id',l.id,'mode',l.modo_atendimento);
end $$;

revoke all on function public.claim_whatsapp_webhook_event(text,uuid),public.finish_whatsapp_webhook_event(text,uuid,uuid,text,text),
  public.persist_whatsapp_inbound(text,uuid,uuid),public.begin_whatsapp_inbound_dispatch(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_whatsapp_webhook_event(text,uuid),public.finish_whatsapp_webhook_event(text,uuid,uuid,text,text),
  public.persist_whatsapp_inbound(text,uuid,uuid),public.begin_whatsapp_inbound_dispatch(text,uuid,uuid) to service_role;

-- Message IDs are unique within a sender session, not an entire organization.
drop index if exists public.lead_messages_wa_akg_provider_message_uidx;
drop index if exists public.lead_messages_evolution_go_provider_message_uidx;
create unique index lead_messages_wa_akg_provider_message_uidx on public.lead_messages(organization_id,whatsapp_account_id,provider_message_id)
  where provider='wa_akg' and provider_message_id is not null;
create unique index lead_messages_evolution_go_provider_message_uidx on public.lead_messages(organization_id,whatsapp_account_id,provider_message_id)
  where provider='evolution_go' and provider_message_id is not null;

-- The Meta API does not provide a demonstrated exactly-once guarantee for our
-- local key. Persist dispatch intent and quarantine every uncertain outcome.
alter table public.messaging_outbox add column dispatch_started_at timestamptz,
  add column worker_contract_version integer not null default 0;
alter table public.messaging_outbox drop constraint messaging_outbox_status_check;
alter table public.messaging_outbox add constraint messaging_outbox_status_check
  check(status in ('queued','processing','sent','failed','dead_letter','cancelled','reconciliation_required'));
create function public.claim_meta_outbox(p_job_id uuid,p_worker_id text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.messaging_outbox%rowtype;
begin
  if current_user not in ('postgres','service_role') or coalesce(p_worker_id,'')='' then raise exception 'meta_worker_access_denied'; end if;
  select * into j from public.messaging_outbox where id=p_job_id for update;
  if not found or j.status not in ('queued','failed','processing') or j.run_at>pg_catalog.now() then return null; end if;
  if j.status='processing' and j.locked_at>pg_catalog.now()-interval '2 minutes' then return null; end if;
  if j.dispatch_started_at is not null or (j.status='processing' and j.worker_contract_version=0) then
    update public.messaging_outbox set status='reconciliation_required',last_error_code='meta_delivery_unknown',locked_at=null,locked_by=null where id=p_job_id;
    return null;
  end if;
  update public.messaging_outbox set status='processing',locked_at=pg_catalog.now(),locked_by=p_worker_id,worker_contract_version=1
    where id=p_job_id returning * into j;
  return pg_catalog.to_jsonb(j);
end $$;
create function public.begin_meta_outbox_dispatch(p_job_id uuid,p_worker_id text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare j public.messaging_outbox%rowtype;
begin
  if current_user not in ('postgres','service_role') then raise exception 'meta_worker_access_denied'; end if;
  select * into strict j from public.messaging_outbox where id=p_job_id for update;
  if j.status<>'processing' or j.locked_by is distinct from p_worker_id or j.dispatch_started_at is not null
    or j.locked_at<=pg_catalog.now()-interval '2 minutes' then raise exception 'meta_outbox_lease_lost'; end if;
  if not exists(select 1 from public.whatsapp_accounts a join public.leads l on l.id=j.lead_id and l.organization_id=a.organization_id
    join public.messaging_provider_controls c on c.organization_id=a.organization_id and c.provider=a.provider
    join public.organization_feature_flags f on f.organization_id=a.organization_id and f.flag_key='meta_coexistence'
    where a.id=j.whatsapp_account_id and a.organization_id=j.organization_id and a.provider='meta_cloud' and a.archived_at is null
      and a.enabled and a.connection_status='connected' and l.whatsapp_account_id=a.id and not coalesce(l.opt_out,false)
      and f.enabled and c.send_enabled and not c.kill_switch
      and (j.origin<>'ana' or (c.automation_enabled and not coalesce(l.ai_paused,false) and l.modo_atendimento<>'humano' and l.automation_status<>'human'))) then
    raise exception 'meta_dispatch_route_disabled'; end if;
  update public.messaging_outbox set dispatch_started_at=pg_catalog.now() where id=p_job_id;
  return true;
end $$;
revoke all on function public.claim_meta_outbox(uuid,text),public.begin_meta_outbox_dispatch(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_meta_outbox(uuid,text),public.begin_meta_outbox_dispatch(uuid,text) to service_role;

-- Recovery is intentionally limited to operations whose entire external
-- contract is GET. A status snapshot is not proof that an old POST finished.
create function public.diagnose_whatsapp_account_lifecycle(p_organization_id uuid,p_account_id uuid,p_provider text,p_actor_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare l private.whatsapp_account_lifecycle%rowtype;
begin
  perform private.assert_whatsapp_lifecycle_access(p_organization_id,p_account_id,p_provider,p_actor_id,'manage');
  select * into l from private.whatsapp_account_lifecycle where account_id=p_account_id;
  return pg_catalog.jsonb_build_object('state',coalesce(l.state,'idle'),'revision',coalesce(l.revision,0),
    'desired_action',l.desired_action,'error_code',l.error_code,
    'can_reconcile_read_only',coalesce(l.operation_id is not null and l.operation_action in ('activate','refresh_status'),false),
    'reason',case when l.operation_id is null then 'no_pending_operation' when l.operation_action in ('activate','refresh_status') then 'read_only_operation'
      else 'external_mutation_terminality_unproven' end);
end $$;
create function public.reconcile_whatsapp_account_lifecycle(p_organization_id uuid,p_account_id uuid,p_provider text,p_actor_id uuid,
  p_expected_revision bigint,p_reason text,p_observation jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare l private.whatsapp_account_lifecycle%rowtype; a public.whatsapp_accounts%rowtype; v_connected boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('whatsapp-lifecycle:'||p_organization_id::text,0));
  perform private.assert_whatsapp_lifecycle_access(p_organization_id,p_account_id,p_provider,p_actor_id,'manage');
  select * into strict a from public.whatsapp_accounts where id=p_account_id for update;
  perform 1 from public.integrations where id=a.integration_id and organization_id=p_organization_id for update;
  select * into strict l from private.whatsapp_account_lifecycle where account_id=p_account_id for update;
  if l.revision is distinct from p_expected_revision then raise exception 'account_lifecycle_revision_changed'; end if;
  if l.operation_id is null or l.operation_action is null or l.operation_action not in ('activate','refresh_status') then raise exception 'account_lifecycle_terminality_unproven'; end if;
  if p_reason is null or pg_catalog.length(pg_catalog.btrim(p_reason)) not between 8 and 500
    or p_observation->>'confirmed' is distinct from 'true' or pg_catalog.jsonb_typeof(p_observation->'connected') is distinct from 'boolean'
    or nullif(p_observation->>'observed_at','') is null
    or (p_observation->>'observed_at')::timestamptz < pg_catalog.now()-interval '1 minute'
    or (p_observation->>'observed_at')::timestamptz > pg_catalog.now()+interval '5 seconds' then
    raise exception 'account_lifecycle_recovery_evidence_invalid'; end if;
  v_connected:=(p_observation->>'connected')::boolean;
  update public.integrations set enabled=false,paused=true,connected=v_connected,last_tested_at=pg_catalog.now(),
    status_detail='Operação de leitura reconciliada por administrador; uso local permanece desativado.',updated_at=pg_catalog.now()
    where id=a.integration_id and organization_id=p_organization_id;
  update public.whatsapp_accounts set enabled=false,is_default=false,connection_status=case when v_connected then 'connected' else 'disconnected' end,
    status_checked_at=pg_catalog.now(),updated_at=pg_catalog.now() where id=p_account_id;
  update private.whatsapp_account_lifecycle set revision=revision+1,state='completed',desired_action='reconciled_disabled',requested_by=p_actor_id,
    operation_id=null,operation_revision=null,operation_action=null,operation_actor_id=null,operation_started_at=null,error_code=null,updated_at=pg_catalog.now()
    where account_id=p_account_id returning * into l;
  insert into public.audit_logs(organization_id,actor_id,actor_name,actor_type,action,detail,entity_table,entity_id,event_data)
    values(p_organization_id,p_actor_id,'Administrador','user','whatsapp.account_read_only_reconciled',pg_catalog.btrim(p_reason),
      'whatsapp_accounts',p_account_id,pg_catalog.jsonb_build_object('provider',p_provider,'previous_revision',p_expected_revision,'revision',l.revision,
      'connected_observed',v_connected,'observed_at',p_observation->>'observed_at','enabled',false));
  return pg_catalog.jsonb_build_object('state',l.state,'revision',l.revision,'desired_action',l.desired_action,'error_code',null);
end $$;
revoke all on function public.diagnose_whatsapp_account_lifecycle(uuid,uuid,text,uuid),
  public.reconcile_whatsapp_account_lifecycle(uuid,uuid,text,uuid,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.diagnose_whatsapp_account_lifecycle(uuid,uuid,text,uuid),
  public.reconcile_whatsapp_account_lifecycle(uuid,uuid,text,uuid,bigint,text,jsonb) to service_role;

-- Automatic provisioning shares the exact account ledger used by user actions.
alter table private.whatsapp_account_lifecycle add column provisioning_job_id uuid,
  add column provisioning_step text, add column provisioning_remote_started boolean not null default false;
create function private.provisioning_table(p_provider text) returns text language plpgsql security invoker set search_path='' as $$ begin
  perform private.whatsapp_event_table(p_provider); return p_provider||'_seller_provisioning_jobs';
end $$;
revoke all on function private.provisioning_table(text) from public,anon,authenticated;
grant execute on function private.provisioning_table(text) to service_role;

create function public.claim_whatsapp_provisioning(p_provider text,p_job_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t text:=private.provisioning_table(p_provider); j jsonb; a public.whatsapp_accounts%rowtype; l private.whatsapp_account_lifecycle%rowtype; aid uuid; org uuid; token uuid;
begin
  execute pg_catalog.format('select to_jsonb(j) from public.%I j where id=$1',t) into j using p_job_id;
  if j is null then return null; end if;
  org:=(j->>'organization_id')::uuid;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('whatsapp-lifecycle:'||org::text,0));
  execute pg_catalog.format('select to_jsonb(j) from public.%I j where id=$1 for update',t) into j using p_job_id;
  if j->>'state' not in ('queued','failed','processing') then return null; end if;
  if coalesce((j->>'attempt_count')::integer,0)>=10 and j->>'state'<>'processing' then
    execute pg_catalog.format('update public.%I set state=''needs_review'',completed_at=now() where id=$1',t) using p_job_id;
    return null;
  end if;
  aid:=coalesce(j->>'account_id',j->>'whatsapp_account_id')::uuid;
  select * into a from public.whatsapp_accounts where id=aid and organization_id=org and provider=p_provider and archived_at is null for update;
  if not found or a.account_type<>'seller' or a.integration_id is distinct from (j->>'integration_id')::uuid
    or a.owner_user_id is distinct from coalesce(j->>'owner_user_id',j->>'user_id')::uuid
    or not exists(select 1 from public.organization_members where organization_id=org and user_id=a.owner_user_id and status='active') then
    raise exception 'whatsapp_provisioning_scope_invalid'; end if;
  perform 1 from public.integrations where id=a.integration_id and organization_id=org for update;
  if not found then raise exception 'whatsapp_provisioning_scope_invalid'; end if;
  insert into private.whatsapp_account_lifecycle(account_id,organization_id,provider) values(aid,org,p_provider) on conflict do nothing;
  select * into strict l from private.whatsapp_account_lifecycle where account_id=aid for update;
  -- Legacy orphan jobs have no stage evidence; mark review rather than create again.
  if j->>'state'='processing' and l.provisioning_job_id is distinct from p_job_id then
    execute pg_catalog.format('update public.%I set state=''needs_review'',completed_at=now() where id=$1',t) using p_job_id;
    return null;
  end if;
  if j->>'state'='processing' and l.provisioning_job_id=p_job_id and l.operation_id is not null
    and l.operation_started_at<pg_catalog.now()-interval '5 minutes' then
    -- A timeout changes observability, never ownership or retry permission.
    update private.whatsapp_account_lifecycle set state='needs_review',error_code='provisioning_worker_orphaned',updated_at=pg_catalog.now() where account_id=aid;
    execute pg_catalog.format('update public.%I set state=''needs_review'',completed_at=now() where id=$1',t) using p_job_id;
    return null;
  end if;
  if l.operation_id is not null or exists(select 1 from private.whatsapp_account_lifecycle x where x.organization_id=org and x.provider=p_provider
    and x.operation_id is not null and x.operation_action='configure_gateway') then return null; end if;
  -- Automatic provisioning cannot supersede a user's later intent or retry a
  -- completed/uncertain remote effect. Only a retry before dispatch is eligible.
  if l.revision>0 and not (l.provisioning_job_id=p_job_id and l.desired_action='provision' and l.state='failed' and not l.provisioning_remote_started) then
    execute pg_catalog.format('update public.%I set state=''needs_review'',completed_at=now() where id=$1',t) using p_job_id;
    return null;
  end if;
  update public.integrations set enabled=false,paused=true,updated_at=pg_catalog.now() where id=a.integration_id;
  update public.whatsapp_accounts set enabled=false,is_default=false,updated_at=pg_catalog.now() where id=aid;
  token:=pg_catalog.gen_random_uuid();
  update private.whatsapp_account_lifecycle set revision=revision+1,desired_action='provision',requested_by=null,state='in_flight',
    operation_id=token,operation_revision=revision+1,operation_action='provision',operation_actor_id=null,operation_started_at=pg_catalog.now(),
    provisioning_job_id=p_job_id,provisioning_step='prepared',provisioning_remote_started=false,error_code=null,updated_at=pg_catalog.now()
    where account_id=aid returning * into l;
  execute pg_catalog.format('update public.%I set state=''processing'',attempt_count=least(attempt_count+1,10),updated_at=now() where id=$1 returning to_jsonb(%I.*)',t,t) into j using p_job_id;
  return j||pg_catalog.jsonb_build_object('operation_id',token,'revision',l.revision,'account_id',aid,'provider',p_provider);
end $$;

create function public.check_whatsapp_provisioning(p_provider text,p_job_id uuid,p_operation_id uuid,p_revision bigint,p_step text,p_mutating boolean default false) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t text:=private.provisioning_table(p_provider); l private.whatsapp_account_lifecycle%rowtype; j jsonb;
begin
  select * into l from private.whatsapp_account_lifecycle where operation_id=p_operation_id;
  if not found then raise exception 'whatsapp_provisioning_superseded'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('whatsapp-lifecycle:'||l.organization_id::text,0));
  perform 1 from public.whatsapp_accounts where id=l.account_id for update;
  perform 1 from public.integrations where id=(select integration_id from public.whatsapp_accounts where id=l.account_id) for update;
  select * into strict l from private.whatsapp_account_lifecycle where account_id=l.account_id for update;
  execute pg_catalog.format('select to_jsonb(j) from public.%I j where id=$1',t) into j using p_job_id;
  if l.provider<>p_provider or l.provisioning_job_id is distinct from p_job_id or l.operation_id is distinct from p_operation_id
    or l.revision<>p_revision or l.operation_revision<>p_revision or l.state<>'in_flight' or j is null or j->>'state'<>'processing'
    or (j->>'organization_id')::uuid is distinct from l.organization_id
    or coalesce(j->>'account_id',j->>'whatsapp_account_id')::uuid is distinct from l.account_id
    or not exists(select 1 from public.whatsapp_accounts a join public.organization_members m on m.user_id=a.owner_user_id and m.organization_id=a.organization_id and m.status='active'
      where a.id=l.account_id and a.organization_id=l.organization_id and a.provider=p_provider and a.archived_at is null
      and a.integration_id=(j->>'integration_id')::uuid and a.owner_user_id=coalesce(j->>'owner_user_id',j->>'user_id')::uuid) then
    raise exception 'whatsapp_provisioning_superseded'; end if;
  if p_step !~ '^[a-z_]{1,50}$' or p_step is null or p_mutating is null then raise exception 'whatsapp_provisioning_step_invalid'; end if;
  update private.whatsapp_account_lifecycle set provisioning_step=p_step,provisioning_remote_started=provisioning_remote_started or p_mutating,updated_at=pg_catalog.now()
    where account_id=l.account_id;
  return pg_catalog.jsonb_build_object('current',true,'account_id',l.account_id,'integration_id',j->>'integration_id');
end $$;

create function public.save_whatsapp_provisioning_secret(p_provider text,p_job_id uuid,p_operation_id uuid,p_revision bigint,p_secret jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$ declare c jsonb; begin
  c:=public.check_whatsapp_provisioning(p_provider,p_job_id,p_operation_id,p_revision,'save_secret',false);
  perform public.store_integration_secret((c->>'integration_id')::uuid,p_secret);
  return true;
end $$;

create function public.finish_whatsapp_provisioning(p_provider text,p_job_id uuid,p_operation_id uuid,p_revision bigint,p_result jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t text:=private.provisioning_table(p_provider); l private.whatsapp_account_lifecycle%rowtype; j jsonb; a public.whatsapp_accounts%rowtype;
  good boolean:=coalesce((p_result->>'success')::boolean,false); review boolean; superseded boolean; v_state text; err text;
begin
  select * into l from private.whatsapp_account_lifecycle where operation_id=p_operation_id;
  if not found then raise exception 'whatsapp_provisioning_operation_missing'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('whatsapp-lifecycle:'||l.organization_id::text,0));
  select * into strict a from public.whatsapp_accounts where id=l.account_id for update;
  perform 1 from public.integrations where id=a.integration_id and organization_id=a.organization_id for update;
  select * into strict l from private.whatsapp_account_lifecycle where account_id=a.id for update;
  if l.operation_id is distinct from p_operation_id or l.operation_revision is distinct from p_revision or l.provisioning_job_id is distinct from p_job_id or l.provider<>p_provider then raise exception 'whatsapp_provisioning_operation_mismatch'; end if;
  execute pg_catalog.format('select to_jsonb(j) from public.%I j where id=$1 for update',t) into j using p_job_id;
  superseded:=l.revision<>p_revision or j is null or j->>'state'<>'processing' or a.archived_at is not null
    or a.organization_id is distinct from l.organization_id or a.provider is distinct from p_provider
    or (j->>'organization_id')::uuid is distinct from l.organization_id
    or coalesce(j->>'account_id',j->>'whatsapp_account_id')::uuid is distinct from a.id
    or (j->>'integration_id')::uuid is distinct from a.integration_id
    or coalesce(j->>'owner_user_id',j->>'user_id')::uuid is distinct from a.owner_user_id
    or not exists(select 1 from public.integrations where id=a.integration_id and organization_id=l.organization_id)
    or not exists(
    select 1 from public.organization_members where organization_id=l.organization_id and user_id=a.owner_user_id and status='active');
  if superseded then good:=false; end if;
  review:=not good and l.provisioning_remote_started;
  v_state:=case when review then 'needs_review' when good or superseded then 'completed' else 'failed' end;
  err:=case when good then null else pg_catalog.left(pg_catalog.regexp_replace(coalesce(p_result->>'error_code','whatsapp_provisioning_superseded'),'[^a-z0-9_]','','g'),120) end;
  if good then
    update public.integrations set enabled=false,paused=true,connected=false,
      configuration=coalesce(configuration,'{}')||coalesce(p_result->'configuration','{}'),updated_at=pg_catalog.now(),
      status_detail='Provisionamento confirmado; uso local permanece desativado.',last_error=null,last_error_at=null where id=a.integration_id and organization_id=a.organization_id;
    update public.whatsapp_accounts set enabled=false,is_default=false,connection_status=case when p_result->>'connection_status'='qr' then 'qr' else 'configured' end,
      webhook_registered_at=case when p_result->>'webhook_registered'='true' then pg_catalog.now() else webhook_registered_at end,
      provider_metadata=coalesce(provider_metadata,'{}')||coalesce(p_result->'configuration','{}'),last_error_code=null,updated_at=pg_catalog.now() where id=a.id;
  end if;
  update private.whatsapp_account_lifecycle set state=v_state,error_code=err,provisioning_step=case when good then 'completed' else provisioning_step end,
    operation_id=case when review then operation_id else null end,operation_revision=case when review then operation_revision else null end,
    operation_action=case when review then operation_action else null end,operation_started_at=case when review then operation_started_at else null end,updated_at=pg_catalog.now()
    where account_id=a.id;
  execute pg_catalog.format('update public.%I set state=$2,completed_at=case when $2=''failed'' then null else now() end,next_attempt_at=now()+interval ''1 minute'',%I=$3,updated_at=now() where id=$1',t,
    case when p_provider='wa_akg' then 'error_code' else 'last_error_code' end)
    using p_job_id,case when superseded and not review then 'cancelled' when good and p_provider='evolution_go' then 'awaiting_qr' else v_state end,err;
  insert into public.audit_logs(organization_id,actor_name,actor_type,action,detail,entity_table,entity_id,event_data)
    values(l.organization_id,'Sistema','system','whatsapp.provisioning_transition','Resultado de provisionamento registrado sem liberar uso local.',
      'whatsapp_accounts',a.id,pg_catalog.jsonb_build_object('provider',p_provider,'job_id',p_job_id,'state',v_state,'revision',l.revision));
  return pg_catalog.jsonb_build_object('state',case when superseded and not review then 'cancelled' else v_state end);
end $$;
revoke all on function public.claim_whatsapp_provisioning(text,uuid),public.check_whatsapp_provisioning(text,uuid,uuid,bigint,text,boolean),
  public.save_whatsapp_provisioning_secret(text,uuid,uuid,bigint,jsonb),public.finish_whatsapp_provisioning(text,uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.claim_whatsapp_provisioning(text,uuid),public.check_whatsapp_provisioning(text,uuid,uuid,bigint,text,boolean),
  public.save_whatsapp_provisioning_secret(text,uuid,uuid,bigint,jsonb),public.finish_whatsapp_provisioning(text,uuid,uuid,bigint,jsonb) to service_role;
create or replace function public.enqueue_wa_akg_seller_provisioning(
  p_organization_id uuid,
  p_user_id uuid,
  p_created_by uuid,
  p_source text,
  p_invite_id uuid default null
)
returns table(
  job_id uuid,
  whatsapp_account_id uuid,
  integration_id uuid,
  instance_name text,
  state text
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_job_id uuid;
  v_account_id uuid;
  v_integration_id uuid;
  v_session_name text;
  v_label text;
  v_state text;
begin
  if current_user not in ('service_role','postgres') then raise exception 'wa_akg_provisioning_access_denied'; end if;
  if p_organization_id is null or p_user_id is null or p_created_by is null
     or p_source not in ('direct_create', 'invite', 'manual') then
    raise exception 'wa_akg_provisioning_input_invalid';
  end if;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = p_user_id
      and m.status = 'active'
  ) then
    raise exception 'wa_akg_owner_inactive';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text || ':' || p_user_id::text || ':wa_akg', 0)
  );

  select a.id, a.integration_id into v_account_id, v_integration_id
  from public.whatsapp_accounts a
  where a.organization_id = p_organization_id
    and a.owner_user_id = p_user_id
    and a.provider = 'wa_akg'
    and a.account_type = 'seller'
    and a.archived_at is null
  limit 1;

  v_account_id := coalesce(v_account_id, pg_catalog.gen_random_uuid());
  v_session_name := 'wf_' || replace(p_organization_id::text, '-', '') || '_' || replace(v_account_id::text, '-', '');
  select coalesce(nullif(btrim(p.name), ''), 'WhatsApp do vendedor') into v_label
  from public.profiles p where p.id = p_user_id;
  v_label := coalesce(v_label, 'WhatsApp do vendedor');

  if v_integration_id is null then
    v_integration_id := gen_random_uuid();
    insert into public.integrations (
      id, organization_id, key, label, provider, category, connected, enabled, paused, mode,
      status_detail, configuration
    ) values (
      v_integration_id, p_organization_id, 'whatsapp_wa_akg:' || v_account_id::text,
      v_label, 'WA-AKG', 'communication', false, false, true, 'real',
      'Canal individual criado; aguardando provisionamento seguro do WA-AKG.',
      jsonb_build_object('configured', false, 'session_name', v_session_name, 'provider_version', '1.7.0-beta.1')
    );
    insert into public.whatsapp_accounts (
      id, organization_id, integration_id, owner_user_id, label, provider, account_type,
      is_default, enabled, connection_status, created_by, provider_metadata
    ) values (
      v_account_id, p_organization_id, v_integration_id, p_user_id, v_label, 'wa_akg', 'seller',
      false, false, 'unconfigured', p_created_by,
      jsonb_build_object('session_name', v_session_name, 'provider_version', '1.7.0-beta.1')
    );
  end if;

  insert into public.wa_akg_seller_provisioning_jobs (
    organization_id, owner_user_id, requested_by, account_id, integration_id, invite_id,
    source, session_name, state, next_attempt_at, error_code
  ) values (
    p_organization_id, p_user_id, p_created_by, v_account_id, v_integration_id, p_invite_id,
    p_source, v_session_name, 'queued', now(), null
  )
  on conflict (organization_id, owner_user_id) do update
    set requested_by = excluded.requested_by,
        account_id = excluded.account_id,
        integration_id = excluded.integration_id,
        invite_id = excluded.invite_id,
        source = excluded.source,
        session_name = wa_akg_seller_provisioning_jobs.session_name,
        state = case when wa_akg_seller_provisioning_jobs.state in ('completed','processing','needs_review','cancelled')
          then wa_akg_seller_provisioning_jobs.state else 'queued' end,
        next_attempt_at = case when wa_akg_seller_provisioning_jobs.state in ('completed','processing','needs_review','cancelled')
          then wa_akg_seller_provisioning_jobs.next_attempt_at else now() end,
        error_code = case when wa_akg_seller_provisioning_jobs.state in ('completed','processing','needs_review','cancelled')
          then wa_akg_seller_provisioning_jobs.error_code else null end,
        updated_at = now()
  returning id, wa_akg_seller_provisioning_jobs.state into v_job_id, v_state;

  return query select v_job_id, v_account_id, v_integration_id, v_session_name, v_state;
end;
$function$;

revoke all on function public.enqueue_wa_akg_seller_provisioning(uuid, uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_wa_akg_seller_provisioning(uuid, uuid, uuid, text, uuid)
  to service_role;
