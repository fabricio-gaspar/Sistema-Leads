-- Company-owned records must never disappear as a side effect of deleting
-- an Auth identity. Reassign these records before deleting the member.
create or replace function private.assert_no_shared_company_data_for_user(p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $function$
begin
  if exists (select 1 from public.appointments where user_id = p_user_id)
    or exists (select 1 from public.lead_handoff_policies where assignee_user_id = p_user_id)
    or exists (select 1 from public.handoff_whatsapp_deliveries where recipient_user_id = p_user_id)
    or exists (select 1 from public.daily_lead_report_deliveries where user_id = p_user_id)
    or exists (select 1 from public.prospecting_cache where user_id = p_user_id)
  then
    raise exception 'member_shared_company_data_requires_reassignment';
  end if;
end;
$function$;

revoke all on function private.assert_no_shared_company_data_for_user(uuid)
  from public, anon, authenticated;

create or replace function public.team_member_shared_data_preflight(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $function$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  perform private.assert_no_shared_company_data_for_user(p_user_id);
  return pg_catalog.jsonb_build_object('ready', true);
end;
$function$;

revoke all on function public.team_member_shared_data_preflight(uuid)
  from public, anon, authenticated;
grant execute on function public.team_member_shared_data_preflight(uuid)
  to service_role;

create or replace function private.prevent_auth_delete_with_shared_company_data()
returns trigger
language plpgsql security definer set search_path = ''
as $function$
begin
  perform private.assert_no_shared_company_data_for_user(old.id);
  return old;
end;
$function$;

revoke all on function private.prevent_auth_delete_with_shared_company_data()
  from public, anon, authenticated;

drop trigger if exists preserve_shared_company_data_before_auth_delete on auth.users;
create trigger preserve_shared_company_data_before_auth_delete
  before delete on auth.users
  for each row execute function private.prevent_auth_delete_with_shared_company_data();
