begin;

-- Keep the directory row linked to an existing lead when one already exists.
-- This prevents "Tornar lead" from creating a duplicate after a later sync.
create or replace function private.link_wa_akg_directory_lead()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if new.lead_id is null then
    select l.id into new.lead_id
      from public.leads l
     where l.organization_id = new.organization_id
       and l.whatsapp_account_id = new.whatsapp_account_id
       and (l.whatsapp_identity = public.normalize_phone_identity(new.phone)
         or l.phone_identity = public.normalize_phone_identity(new.phone))
     order by l.updated_at desc nulls last, l.created_at desc nulls last
     limit 1;
  end if;
  return new;
end;
$function$;

drop trigger if exists whatsapp_contact_directory_lead_link on public.whatsapp_contact_directory;
create trigger whatsapp_contact_directory_lead_link
before insert or update on public.whatsapp_contact_directory
for each row execute function private.link_wa_akg_directory_lead();

update public.whatsapp_contact_directory d
   set lead_id = l.id,
       updated_at = pg_catalog.now()
  from public.leads l
 where d.lead_id is null
   and l.organization_id = d.organization_id
   and l.whatsapp_account_id = d.whatsapp_account_id
   and (l.whatsapp_identity = public.normalize_phone_identity(d.phone)
     or l.phone_identity = public.normalize_phone_identity(d.phone));

commit;
