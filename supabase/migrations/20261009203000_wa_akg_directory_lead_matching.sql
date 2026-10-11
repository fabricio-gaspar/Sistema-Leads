-- Never let one seller directory name a lead attached to another seller device.
begin;

create or replace function public.apply_whatsapp_directory_name(
  p_organization_id uuid,
  p_account_id uuid,
  p_lead_id uuid
)
returns boolean
language plpgsql
set search_path = ''
as $function$
declare preferred text;
begin
  if current_user not in ('postgres', 'service_role') then raise exception 'whatsapp_directory_access_denied'; end if;
  select coalesce(nullif(btrim(d.agenda_name),''), nullif(btrim(d.whatsapp_name),''), nullif(btrim(d.public_name),'')) into preferred
    from public.whatsapp_contact_directory d join public.leads l
      on l.id=p_lead_id and l.organization_id=p_organization_id and l.whatsapp_account_id=p_account_id
   where d.organization_id=p_organization_id and d.whatsapp_account_id=p_account_id
     and d.phone=coalesce(l.whatsapp_identity, l.phone_identity)
   order by d.last_synced_at desc limit 1;
  if coalesce(preferred,'')='' then return false; end if;
  update public.leads set contact=preferred, updated_at=pg_catalog.now()
   where id=p_lead_id and organization_id=p_organization_id and whatsapp_account_id=p_account_id
     and coalesce(contact,'') in ('', 'Contato não identificado');
  return found;
end $function$;

create or replace function public.apply_whatsapp_directory_names(
  p_organization_id uuid,
  p_account_id uuid
)
returns integer
language plpgsql
set search_path = ''
as $function$
declare updated_count integer := 0;
begin
  if current_user not in ('postgres', 'service_role') then raise exception 'whatsapp_directory_access_denied'; end if;
  with preferred as (
    select distinct on (d.phone) d.phone,
      coalesce(nullif(btrim(d.agenda_name),''), nullif(btrim(d.whatsapp_name),''), nullif(btrim(d.public_name),'')) as name
      from public.whatsapp_contact_directory d
     where d.organization_id=p_organization_id and d.whatsapp_account_id=p_account_id
       and coalesce(nullif(btrim(d.agenda_name),''), nullif(btrim(d.whatsapp_name),''), nullif(btrim(d.public_name),'')) is not null
     order by d.phone, d.last_synced_at desc
  ), updated as (
    update public.leads l set contact=preferred.name, updated_at=pg_catalog.now()
      from preferred
     where l.organization_id=p_organization_id and l.whatsapp_account_id=p_account_id
       and coalesce(l.whatsapp_identity, l.phone_identity)=preferred.phone
       and coalesce(l.contact,'') in ('', 'Contato não identificado')
    returning 1
  ) select count(*) into updated_count from updated;
  return updated_count;
end $function$;

revoke all on function public.apply_whatsapp_directory_name(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.apply_whatsapp_directory_names(uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_whatsapp_directory_name(uuid, uuid, uuid) to service_role;
grant execute on function public.apply_whatsapp_directory_names(uuid, uuid) to service_role;

commit;
