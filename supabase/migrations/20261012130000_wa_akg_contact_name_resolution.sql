begin;

-- Directory snapshots and inbound leads can use different phone spellings
-- (formatted/local vs canonical international).  Always compare through the
-- same normalizer before deciding whether a name belongs to a lead.
create or replace function public.apply_whatsapp_directory_name(
  p_organization_id uuid,
  p_account_id uuid,
  p_lead_id uuid
)
returns boolean
language plpgsql
set search_path = ''
as $function$
declare
  preferred text;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'whatsapp_directory_access_denied';
  end if;

  select coalesce(nullif(pg_catalog.btrim(d.agenda_name), ''),
                 nullif(pg_catalog.btrim(d.whatsapp_name), ''),
                 nullif(pg_catalog.btrim(d.public_name), ''))
    into preferred
    from public.whatsapp_contact_directory d
    join public.leads l
      on l.id = p_lead_id
     and l.organization_id = p_organization_id
     and l.whatsapp_account_id = p_account_id
   where d.organization_id = p_organization_id
     and d.whatsapp_account_id = p_account_id
     and public.normalize_phone_identity(d.phone) = public.normalize_phone_identity(coalesce(l.whatsapp_identity, l.phone_identity, l.whatsapp, l.phone))
   order by d.last_synced_at desc nulls last, d.updated_at desc nulls last
   limit 1;

  if coalesce(preferred, '') = '' then
    return false;
  end if;

  update public.leads
     set contact = preferred,
         updated_at = pg_catalog.now()
   where id = p_lead_id
     and organization_id = p_organization_id
     and whatsapp_account_id = p_account_id
     and coalesce(contact, '') in ('', 'Contato não identificado');
  return found;
end;
$function$;

create or replace function public.apply_whatsapp_directory_names(
  p_organization_id uuid,
  p_account_id uuid
)
returns integer
language plpgsql
set search_path = ''
as $function$
declare
  updated_count integer := 0;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'whatsapp_directory_access_denied';
  end if;

  with preferred as (
    select distinct on (public.normalize_phone_identity(d.phone))
      public.normalize_phone_identity(d.phone) as phone,
      coalesce(nullif(pg_catalog.btrim(d.agenda_name), ''),
               nullif(pg_catalog.btrim(d.whatsapp_name), ''),
               nullif(pg_catalog.btrim(d.public_name), '')) as name
      from public.whatsapp_contact_directory d
     where d.organization_id = p_organization_id
       and d.whatsapp_account_id = p_account_id
       and coalesce(nullif(pg_catalog.btrim(d.agenda_name), ''),
                    nullif(pg_catalog.btrim(d.whatsapp_name), ''),
                    nullif(pg_catalog.btrim(d.public_name), '')) is not null
     order by public.normalize_phone_identity(d.phone), d.last_synced_at desc nulls last, d.updated_at desc nulls last
  ), updated as (
    update public.leads l
       set contact = preferred.name,
           updated_at = pg_catalog.now()
      from preferred
     where l.organization_id = p_organization_id
       and l.whatsapp_account_id = p_account_id
       and public.normalize_phone_identity(coalesce(l.whatsapp_identity, l.phone_identity, l.whatsapp, l.phone)) = preferred.phone
       and coalesce(l.contact, '') in ('', 'Contato não identificado')
     returning 1
  )
  select count(*) into updated_count from updated;
  return updated_count;
end;
$function$;

revoke all on function public.apply_whatsapp_directory_name(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.apply_whatsapp_directory_names(uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_whatsapp_directory_name(uuid, uuid, uuid) to service_role;
grant execute on function public.apply_whatsapp_directory_names(uuid, uuid) to service_role;

-- Resolve a name at write time as well as during an explicit sync.  This
-- covers inbound-created leads and keeps later updates from reintroducing the
-- placeholder while preserving the existing agenda-protection trigger.
create or replace function private.resolve_wa_akg_lead_contact_name()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  preferred text;
begin
  if new.whatsapp_account_id is null
     or coalesce(new.contact, '') not in ('', 'Contato não identificado') then
    return new;
  end if;

  select coalesce(nullif(btrim(d.agenda_name), ''),
                 nullif(btrim(d.whatsapp_name), ''),
                 nullif(btrim(d.public_name), ''))
    into preferred
    from public.whatsapp_contact_directory d
   where d.organization_id = new.organization_id
     and d.whatsapp_account_id = new.whatsapp_account_id
     and public.normalize_phone_identity(d.phone) = public.normalize_phone_identity(coalesce(new.whatsapp_identity, new.phone_identity, new.whatsapp, new.phone))
   order by d.last_synced_at desc nulls last, d.updated_at desc nulls last
   limit 1;

  if coalesce(preferred, '') <> '' then
    new.contact := preferred;
  end if;
  return new;
end;
$function$;

drop trigger if exists leads_wa_akg_contact_name_resolution on public.leads;
create trigger leads_wa_akg_contact_name_resolution
before insert or update of contact, whatsapp_account_id, whatsapp_identity, phone_identity, whatsapp, phone
on public.leads
for each row execute function private.resolve_wa_akg_lead_contact_name();

-- A later contact snapshot must repair any lead created before its directory
-- name was available.  Scope is always organization + receiving account +
-- canonical phone; no cross-device name propagation is possible.
create or replace function private.sync_wa_akg_directory_name_to_leads()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  preferred text := coalesce(nullif(pg_catalog.btrim(new.agenda_name), ''),
                             nullif(pg_catalog.btrim(new.whatsapp_name), ''),
                             nullif(pg_catalog.btrim(new.public_name), ''));
  canonical_phone text := public.normalize_phone_identity(new.phone);
begin
  if canonical_phone is null or preferred is null or preferred = '' then
    return new;
  end if;

  update public.leads l
     set contact = preferred,
         updated_at = pg_catalog.now()
   where l.organization_id = new.organization_id
     and l.whatsapp_account_id = new.whatsapp_account_id
     and public.normalize_phone_identity(coalesce(l.whatsapp_identity, l.phone_identity, l.whatsapp, l.phone)) = canonical_phone
     and coalesce(l.contact, '') in ('', 'Contato não identificado');
  return new;
end;
$function$;

drop trigger if exists whatsapp_contact_directory_name_resolution on public.whatsapp_contact_directory;
create trigger whatsapp_contact_directory_name_resolution
after insert or update of agenda_name, whatsapp_name, public_name, phone, whatsapp_account_id
on public.whatsapp_contact_directory
for each row execute function private.sync_wa_akg_directory_name_to_leads();

-- Repair existing placeholders without touching messages, approvals, or
-- automation decisions.  The existing protection trigger still controls Ana.
with preferred as (
  select distinct on (d.organization_id, d.whatsapp_account_id, public.normalize_phone_identity(d.phone))
    d.organization_id,
    d.whatsapp_account_id,
    public.normalize_phone_identity(d.phone) as phone,
    coalesce(nullif(pg_catalog.btrim(d.agenda_name), ''),
             nullif(pg_catalog.btrim(d.whatsapp_name), ''),
             nullif(pg_catalog.btrim(d.public_name), '')) as name
    from public.whatsapp_contact_directory d
   where coalesce(nullif(pg_catalog.btrim(d.agenda_name), ''),
                  nullif(pg_catalog.btrim(d.whatsapp_name), ''),
                  nullif(pg_catalog.btrim(d.public_name), '')) is not null
   order by d.organization_id, d.whatsapp_account_id,
            public.normalize_phone_identity(d.phone),
            d.last_synced_at desc nulls last, d.updated_at desc nulls last
)
update public.leads l
   set contact = preferred.name,
       updated_at = pg_catalog.now()
  from preferred
 where l.organization_id = preferred.organization_id
   and l.whatsapp_account_id = preferred.whatsapp_account_id
   and public.normalize_phone_identity(coalesce(l.whatsapp_identity, l.phone_identity, l.whatsapp, l.phone)) = preferred.phone
   and coalesce(l.contact, '') in ('', 'Contato não identificado');

commit;
