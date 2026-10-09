-- WA-AKG contact directory: the browser never receives cross-account contacts.
-- The owner needs the existing own-channel permission; administrators may review a
-- selected seller account through the Central.

begin;

create or replace function private.can_read_wa_akg_contact_directory(
  p_organization_id uuid,
  p_account_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select exists (
    select 1
      from public.organization_members m
     where m.organization_id = p_organization_id
       and m.user_id = p_user_id
       and m.status = 'active'
       and lower(m.role::text) in ('administrador', 'admin')
  ) or exists (
    select 1
      from public.whatsapp_accounts a
     where a.id = p_account_id
       and a.organization_id = p_organization_id
       and a.provider = 'wa_akg'
       and a.account_type = 'seller'
       and a.owner_user_id = p_user_id
       and a.archived_at is null
       and private.has_org_permission(p_organization_id, p_user_id, 'channels.view_own')
  );
$function$;

revoke all on function private.can_read_wa_akg_contact_directory(uuid, uuid, uuid) from public, anon, authenticated;

-- A seller may see Central conversations linked to their own WA-AKG device only.
-- Conversations without a WA-AKG account keep the existing lead-scoping rules.
create or replace function private.can_read_wa_akg_central_lead(
  p_organization_id uuid,
  p_account_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select p_account_id is null or exists (
    select 1
      from public.organization_members m
     where m.organization_id = p_organization_id
       and m.user_id = p_user_id
       and m.status = 'active'
       and lower(m.role::text) in ('administrador', 'admin')
  ) or exists (
    select 1
      from public.whatsapp_accounts a
     where a.id = p_account_id
       and a.organization_id = p_organization_id
       and a.provider = 'wa_akg'
       and a.account_type = 'seller'
       and a.owner_user_id = p_user_id
       and a.archived_at is null
       and private.has_org_permission(p_organization_id, p_user_id, 'channels.view_own')
  );
$function$;

revoke all on function private.can_read_wa_akg_central_lead(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.central_list_wa_akg_contact_directory(
  p_account_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_organization_id uuid := public.current_org_id();
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 250);
begin
  if v_organization_id is null or v_user_id is null
    or not private.can_read_wa_akg_contact_directory(v_organization_id, p_account_id, v_user_id) then
    raise exception 'wa_akg_contact_directory_access_denied';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'phone', d.phone,
      'name', coalesce(nullif(btrim(d.agenda_name), ''), nullif(btrim(d.whatsapp_name), ''), nullif(btrim(d.public_name), ''), 'Contato sem nome'),
      'last_synced_at', d.last_synced_at
    ) order by coalesce(nullif(btrim(d.agenda_name), ''), nullif(btrim(d.whatsapp_name), ''), nullif(btrim(d.public_name), ''), d.phone) asc)
      from (
        select phone, agenda_name, whatsapp_name, public_name, last_synced_at
          from public.whatsapp_contact_directory
         where organization_id = v_organization_id
           and whatsapp_account_id = p_account_id
         order by last_synced_at desc, phone asc
         limit v_limit
      ) d
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.central_list_wa_akg_contact_directory(uuid, integer) from public, anon;
grant execute on function public.central_list_wa_akg_contact_directory(uuid, integer) to authenticated, service_role;

-- Existing Central filtering keeps its lead-RLS behavior. This guard stops a
-- non-administrator from using the owner selector to inspect another user.
do $migration$
declare
  list_definition text;
  detail_definition text;
  marker constant text := $$if v_view not in ('all', 'unread', 'waiting', 'mine') then v_view := 'all'; end if;$$;
  list_scope_marker constant text := $$where l.organization_id = v_organization_id
        and l.archived_at is null
        and ($$;
  list_scope_guard constant text := $$where l.organization_id = v_organization_id
        and l.archived_at is null
        and private.can_read_wa_akg_central_lead(l.organization_id, l.whatsapp_account_id, v_user_id)
        and ($$;
  detail_scope_marker constant text := $$where l.id = p_lead_id and l.organization_id = v_organization_id and l.archived_at is null$$;
  detail_scope_guard constant text := $$where l.id = p_lead_id and l.organization_id = v_organization_id and l.archived_at is null
        and private.can_read_wa_akg_central_lead(l.organization_id, l.whatsapp_account_id, auth.uid())$$;
  guard constant text := $$if v_owner_id is not null and not exists (
    select 1 from public.organization_members m
     where m.organization_id = v_organization_id and m.user_id = v_user_id
       and m.status = 'active' and lower(m.role::text) in ('administrador', 'admin')
  ) then
    raise exception 'central_owner_filter_admin_required';
  end if;
  if v_view not in ('all', 'unread', 'waiting', 'mine') then v_view := 'all'; end if;$$;
begin
  select pg_get_functiondef('public.central_list_conversations(text,jsonb,integer,integer)'::regprocedure) into list_definition;
  if list_definition is null or position(marker in list_definition) = 0 or position(list_scope_marker in list_definition) = 0 then
    raise exception 'central_list_conversations_contract_changed';
  end if;
  execute replace(replace(list_definition, marker, guard), list_scope_marker, list_scope_guard);

  select pg_get_functiondef('public.central_get_conversation_detail(uuid,timestamp with time zone,integer)'::regprocedure) into detail_definition;
  if detail_definition is null or position(detail_scope_marker in detail_definition) = 0 then
    raise exception 'central_get_conversation_detail_contract_changed';
  end if;
  execute replace(detail_definition, detail_scope_marker, detail_scope_guard);
end;
$migration$;

commit;

