-- Contacts who start an individual WhatsApp conversation must reach the
-- Central even when they were not previously imported as leads.  This stays
-- deliberately human-owned: receiving a message is not authorization to
-- start automation or an outbound campaign.
create or replace function public.resolve_or_create_whatsapp_inbound_lead(
  p_organization_id uuid,
  p_account_id uuid,
  p_phone text,
  p_message text,
  p_occurred_at timestamptz
)
returns table (lead_id uuid, reason text, created boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resolved record;
  created_lead public.leads%rowtype;
  account_owner uuid;
  site_entry_id uuid;
  site_source_label text;
  identity text;
  site_entry_code text;
  occurred_at timestamptz := coalesce(p_occurred_at, pg_catalog.now());
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'whatsapp_inbound_contact_access_denied';
  end if;

  if coalesce(p_phone, '') !~ '^[1-9][0-9]{7,14}$' then
    return query select null::uuid, 'invalid_phone'::text, false;
    return;
  end if;

  select * into resolved
    from public.resolve_whatsapp_lead_for_account(p_organization_id, p_account_id, p_phone)
    limit 1;
  if resolved.lead_id is not null then
    return query select resolved.lead_id, resolved.reason::text, false;
    return;
  end if;
  if coalesce(resolved.reason, 'not_found') <> 'not_found' then
    return query select null::uuid, coalesce(resolved.reason, 'not_found')::text, false;
    return;
  end if;

  -- A sender can deliver several messages at once.  Serialize the first
  -- contact creation by organization, receiving account and canonical phone.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'whatsapp-inbound-contact:' || p_organization_id::text || ':' || p_account_id::text || ':' || p_phone,
    0
  ));
  select * into resolved
    from public.resolve_whatsapp_lead_for_account(p_organization_id, p_account_id, p_phone)
    limit 1;
  if resolved.lead_id is not null then
    return query select resolved.lead_id, resolved.reason::text, false;
    return;
  end if;
  if coalesce(resolved.reason, 'not_found') <> 'not_found' then
    return query select null::uuid, coalesce(resolved.reason, 'not_found')::text, false;
    return;
  end if;

  select owner_user_id into account_owner
    from public.whatsapp_accounts
   where id = p_account_id
     and organization_id = p_organization_id
     and archived_at is null;
  if not found then
    return query select null::uuid, 'account_not_found'::text, false;
    return;
  end if;

  site_entry_code := pg_catalog.upper((pg_catalog.regexp_match(
    coalesce(p_message, ''), '\[WF:([a-z0-9]{8,32})\]', 'i'
  ))[1]);
  if site_entry_code is not null then
    select entry.id, entry.source_label into site_entry_id, site_source_label
      from public.whatsapp_site_entries as entry
     where entry.organization_id = p_organization_id
       and entry.entry_code = site_entry_code
       and entry.active = true
     limit 1;
  end if;

  identity := 'whatsapp:' || p_phone;
  insert into public.leads (
    organization_id, company, contact, phone, whatsapp, segment, score, temp,
    owner, owner_id, assigned_to, origin, active_channel, whatsapp_account_id,
    contact_approval_status, contact_approval_reason, contact_approved_at,
    first_inbound_at, last_contact, modo_atendimento, ai_paused,
    automation_status, source_record_id, source_metadata,
    deduplication_key, prospect_identity
  ) values (
    p_organization_id,
    case when site_entry_id is not null then 'Contato do site' else 'Contato WhatsApp' end,
    'Contato não identificado', p_phone, p_phone, 'WhatsApp', 0, 'warm',
    'humano', account_owner, account_owner,
    coalesce(site_source_label, 'WhatsApp recebido'), 'whatsapp', p_account_id,
    'approved', 'Contato iniciou uma conversa individual pelo WhatsApp.', occurred_at,
    occurred_at, occurred_at, 'humano', true,
    'human',
    case when site_entry_id is not null then 'website-whatsapp:' || site_entry_id::text
         else 'whatsapp-inbound:' || p_account_id::text || ':' || p_phone end,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'source', case when site_entry_id is not null then 'website_whatsapp' else 'whatsapp_inbound' end,
      'website_entry_id', site_entry_id,
      'receiving_whatsapp_account_id', p_account_id
    )),
    'whatsapp-inbound:' || p_account_id::text || ':' || p_phone,
    identity
  ) returning * into created_lead;

  insert into public.lead_whatsapp_account_bindings (
    organization_id, lead_id, whatsapp_account_id, reason
  ) values (
    p_organization_id, created_lead.id, p_account_id,
    case when site_entry_id is not null then 'website_inbound_first_binding' else 'inbound_contact_first_binding' end
  ) on conflict do nothing;

  return query select created_lead.id,
    case when site_entry_id is not null then 'site_entry_created' else 'inbound_contact_created' end,
    true;
end;
$$;

revoke all on function public.resolve_or_create_whatsapp_inbound_lead(uuid, uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.resolve_or_create_whatsapp_inbound_lead(uuid, uuid, text, text, timestamptz)
  to service_role;

create or replace function public.persist_whatsapp_inbound(p_provider text,p_event_id uuid,p_lease_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t text:=private.whatsapp_event_table(p_provider); e record; w private.whatsapp_inbound_work%rowtype; r record; l public.leads%rowtype;
  p jsonb; phone text; mid text; raw_body text; body text; at timestamptz; ext text; inbound uuid; message uuid; media jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('whatsapp-event:'||p_provider||':'||p_event_id::text,0));
  select * into w from private.whatsapp_inbound_work where provider=p_provider and event_id=p_event_id for update;
  if w.event_id is null or p_lease_id is null or w.lease_id is distinct from p_lease_id or w.lease_expires_at<=pg_catalog.now() or w.phase not in ('received','persisted') then raise exception 'whatsapp_event_lease_lost'; end if;
  execute pg_catalog.format('select * from public.%I where id=$1 and organization_id=$2 and processing_status=''processing''',t) into e using p_event_id,w.organization_id;
  if e.id is null or e.event_kind<>'inbound' or e.whatsapp_account_id<>w.account_id then raise exception 'whatsapp_inbound_scope_invalid'; end if;
  p:=e.sanitized_payload; phone:=p->>'phone'; mid:=p->>'message_id'; raw_body:=p->>'text'; media:=p->'media';
  if coalesce(phone,'')!~'^[1-9][0-9]{7,14}$' or coalesce(p->>'remote_jid','')!~'^[1-9][0-9]{7,14}(:[0-9]{1,5})?@(s\.whatsapp\.net|c\.us)$'
    or pg_catalog.split_part(pg_catalog.split_part(p->>'remote_jid','@',1),':',1)<>phone then
    perform public.finish_whatsapp_webhook_event(p_provider,p_event_id,p_lease_id,'needs_review','sender_identity_unresolved');
    return pg_catalog.jsonb_build_object('review',true,'reason','sender_identity_unresolved');
  end if;
  if coalesce(mid,'')='' or pg_catalog.length(mid)>300 or coalesce(raw_body,'')='' then raise exception 'whatsapp_inbound_payload_invalid'; end if;
  if not exists(select 1 from public.whatsapp_accounts a join public.integrations i on i.id=a.integration_id and i.organization_id=a.organization_id
    join public.messaging_provider_controls c on c.organization_id=a.organization_id and c.provider=a.provider
    where a.id=w.account_id and a.organization_id=w.organization_id and a.provider=p_provider and a.enabled and a.archived_at is null
      and a.connection_status='connected' and i.enabled and i.connected and not i.paused and c.inbound_enabled and not c.kill_switch) then
    perform public.finish_whatsapp_webhook_event(p_provider,p_event_id,p_lease_id,'ignored','whatsapp_inbound_route_disabled');
    return pg_catalog.jsonb_build_object('review',true,'reason','whatsapp_inbound_route_disabled'); end if;
  if w.phase='persisted' then return pg_catalog.jsonb_build_object('lead_id',w.lead_id,'inbound_id',w.inbound_id,'message_id',w.message_id,'persisted',true); end if;
  at:=coalesce(nullif(p->>'occurred_at','')::timestamptz,nullif(p->>'timestamp','')::timestamptz,e.occurred_at,pg_catalog.now());
  select * into r from public.resolve_or_create_whatsapp_inbound_lead(w.organization_id,w.account_id,phone,raw_body,at) limit 1;
  if r.lead_id is null then
    perform public.finish_whatsapp_webhook_event(p_provider,p_event_id,p_lease_id,'needs_review',case when r.reason='ambiguous_identity' then 'lead_identity_ambiguous' else 'lead_not_matched' end);
    return pg_catalog.jsonb_build_object('review',true,'reason',coalesce(r.reason,'lead_not_matched'));
  end if;
  select * into strict l from public.leads where id=r.lead_id and organization_id=w.organization_id for update;
  body:=pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.regexp_replace(raw_body, '\s*\[WF:[a-z0-9]{8,32}\]\s*', ' ', 'gi'), '\s{2,}', ' ', 'g'));
  if body='' then body:=raw_body; end if;
  p:=pg_catalog.jsonb_set(p,'{text}',pg_catalog.to_jsonb(body),true);
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

revoke all on function public.persist_whatsapp_inbound(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.persist_whatsapp_inbound(text,uuid,uuid) to service_role;
