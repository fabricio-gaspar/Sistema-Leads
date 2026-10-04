-- Team administrators cannot present another member's JWT to GoTrue. This
-- service-only helper revokes that member's renewable sessions by user id.
begin;

create or replace function public.revoke_user_auth_sessions(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, auth
as $function$
declare
  v_deleted_count integer;
begin
  delete from auth.sessions where user_id = p_user_id;
  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$function$;

revoke all on function public.revoke_user_auth_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_auth_sessions(uuid) to service_role;

comment on function public.revoke_user_auth_sessions(uuid) is
  'Service-only revocation of renewable Auth sessions before a member is disabled, reset, or permanently removed.';

commit;
