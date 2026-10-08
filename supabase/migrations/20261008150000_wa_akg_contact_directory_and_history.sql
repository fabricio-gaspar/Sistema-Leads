-- A seller's address book is private operational context.  It is not a lead
-- list and is only used to label a real conversation after a number match.
create table if not exists public.whatsapp_contact_directory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  whatsapp_account_id uuid not null references public.whatsapp_accounts(id) on delete cascade,
  remote_jid text not null check (remote_jid ~ '^[1-9][0-9]{7,14}(:[0-9]{1,5})?@(s\.whatsapp\.net|c\.us)$'),
  phone text not null check (phone ~ '^[1-9][0-9]{7,14}$'),
  agenda_name text,
  whatsapp_name text,
  public_name text,
  first_synced_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, whatsapp_account_id, remote_jid)
);
create index if not exists whatsapp_contact_directory_phone_idx
  on public.whatsapp_contact_directory (organization_id, whatsapp_account_id, phone);
alter table public.whatsapp_contact_directory enable row level security;
revoke all on table public.whatsapp_contact_directory from public, anon, authenticated;
grant all on table public.whatsapp_contact_directory to service_role;

drop trigger if exists whatsapp_contact_directory_set_updated_at on public.whatsapp_contact_directory;
create trigger whatsapp_contact_directory_set_updated_at before update on public.whatsapp_contact_directory
  for each row execute procedure public.set_updated_at();

alter table public.wa_akg_webhook_events
  drop constraint if exists wa_akg_webhook_events_event_kind_check;
alter table public.wa_akg_webhook_events
  add constraint wa_akg_webhook_events_event_kind_check
  check (event_kind in ('inbound', 'outbound', 'receipt', 'connection', 'ignored'));

create or replace function public.apply_whatsapp_directory_name(
  p_organization_id uuid, p_account_id uuid, p_lead_id uuid
) returns boolean
language plpgsql security invoker set search_path='' as $$
declare preferred text;
begin
  if current_user not in ('postgres', 'service_role') then raise exception 'whatsapp_directory_access_denied'; end if;
  select coalesce(nullif(btrim(d.agenda_name),''), nullif(btrim(d.whatsapp_name),''), nullif(btrim(d.public_name),'')) into preferred
    from public.whatsapp_contact_directory d join public.leads l on l.id=p_lead_id and l.organization_id=p_organization_id
   where d.organization_id=p_organization_id and d.whatsapp_account_id=p_account_id
     and d.phone=regexp_replace(coalesce(l.whatsapp,l.phone,''),'\D','','g')
   order by d.last_synced_at desc limit 1;
  if coalesce(preferred,'')='' then return false; end if;
  update public.leads set contact=preferred, updated_at=pg_catalog.now()
   where id=p_lead_id and organization_id=p_organization_id
     and coalesce(contact,'') in ('', 'Contato não identificado');
  return found;
end $$;
revoke all on function public.apply_whatsapp_directory_name(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.apply_whatsapp_directory_name(uuid,uuid,uuid) to service_role;

-- Imports and phone-originated messages use this same idempotent persistence
-- path.  It has no Ana dispatch and no outbound side effect.
create or replace function public.persist_wa_akg_synced_message(
  p_organization_id uuid, p_account_id uuid, p_message_id text, p_remote_jid text,
  p_from_me boolean, p_text text, p_occurred_at timestamptz
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare phone text; resolved record; message_id uuid; direction text; at timestamptz:=coalesce(p_occurred_at,pg_catalog.now()); body text;
begin
  if current_user not in ('postgres','service_role') then raise exception 'wa_akg_sync_access_denied'; end if;
  phone:=split_part(split_part(coalesce(p_remote_jid,''),'@',1),':',1);
  if phone !~ '^[1-9][0-9]{7,14}$' or coalesce(p_remote_jid,'') !~ '^[1-9][0-9]{7,14}(:[0-9]{1,5})?@(s\.whatsapp\.net|c\.us)$'
    or coalesce(p_message_id,'')='' or char_length(p_message_id)>300 then
    raise exception 'wa_akg_sync_payload_invalid';
  end if;
  select * into resolved from public.resolve_or_create_whatsapp_inbound_lead(p_organization_id,p_account_id,phone,coalesce(p_text,''),at) limit 1;
  if resolved.lead_id is null then return jsonb_build_object('review',true,'reason',coalesce(resolved.reason,'lead_not_matched')); end if;
  perform public.apply_whatsapp_directory_name(p_organization_id,p_account_id,resolved.lead_id);
  direction:=case when p_from_me then 'human' else 'lead' end;
  body:=coalesce(nullif(btrim(p_text),''), '[Mensagem sem texto; revisão humana necessária.]');
  insert into public.lead_messages(organization_id,lead_id,whatsapp_account_id,sender,sender_name,type,text,sent_at,provider,message_origin,provider_message_id,provider_occurred_at)
  values(p_organization_id,resolved.lead_id,p_account_id,direction,case when p_from_me then 'WhatsApp no celular' else 'Lead' end,
    case when p_from_me then 'sent' else 'received' end,body,at,'wa_akg',case when p_from_me then 'business_app' else 'customer' end,p_message_id,at)
  on conflict do nothing returning id into message_id;
  update public.leads set last_contact=greatest(coalesce(last_contact,at),at),
    first_inbound_at=case when p_from_me then first_inbound_at else coalesce(first_inbound_at,at) end,
    contact_approval_status=case when p_from_me then contact_approval_status else 'approved' end,
    contact_approval_reason=case when p_from_me then contact_approval_reason else 'Contato iniciou uma conversa individual pelo WhatsApp.' end,
    contact_approved_at=case when p_from_me then contact_approved_at else at end
   where id=resolved.lead_id and organization_id=p_organization_id;
  return jsonb_build_object('lead_id',resolved.lead_id,'inserted',message_id is not null);
end $$;
revoke all on function public.persist_wa_akg_synced_message(uuid,uuid,text,text,boolean,text,timestamptz) from public,anon,authenticated;
grant execute on function public.persist_wa_akg_synced_message(uuid,uuid,text,text,boolean,text,timestamptz) to service_role;
