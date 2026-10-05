-- The Storage schema is intentionally not exposed through PostgREST. This
-- service-only function returns paths for a single Auth user so the Edge
-- Function can delete the corresponding files through the Storage API.
begin;

create or replace function public.list_user_owned_storage(
  p_user_id uuid,
  p_limit integer default 100
)
returns table(bucket_id text, name text)
language sql
security definer
set search_path = pg_catalog, storage
as $function$
  select o.bucket_id::text, o.name::text
  from storage.objects as o
  where o.owner = p_user_id
     or o.owner_id = p_user_id::text
  order by o.bucket_id, o.name
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$function$;

revoke all on function public.list_user_owned_storage(uuid, integer) from public, anon, authenticated;
grant execute on function public.list_user_owned_storage(uuid, integer) to service_role;

comment on function public.list_user_owned_storage(uuid, integer) is
  'Service-only listing of Storage object paths for permanent member cleanup; deletion stays in the Storage API.';

commit;
