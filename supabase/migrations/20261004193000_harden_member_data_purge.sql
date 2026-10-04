-- Permanent member removal must also clean credentials that live outside the
-- public schema. Both helpers are service-role only and are called by the
-- authenticated team-members Edge Function after its authorization checks.

begin;

create or replace function public.delete_integration_secret(p_integration uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, vault
as $function$
declare
  v_secret_id uuid;
begin
  select nullif(configuration ->> 'secret_ref', '')::uuid
    into v_secret_id
  from public.integrations
  where id = p_integration
  for update;

  if not found then
    return false;
  end if;

  -- Clear the reference before the integration row is removed, then remove
  -- the Vault record itself. A missing Vault row is harmless and idempotent.
  update public.integrations
  set configuration = coalesce(configuration, '{}'::jsonb) - 'secret_ref',
      updated_at = now()
  where id = p_integration;

  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;

  return true;
end;
$function$;

create or replace function public.purge_user_owned_storage(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, storage
as $function$
declare
  v_deleted_count integer;
begin
  -- Supabase Storage has used both owner (uuid) and owner_id (text) across
  -- versions. Check both so deleting an Auth identity cannot leave files or
  -- fail because the user still owns an object.
  delete from storage.objects
  where owner = p_user_id
     or owner_id = p_user_id::text;

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$function$;

revoke all on function public.delete_integration_secret(uuid) from public, anon, authenticated;
revoke all on function public.purge_user_owned_storage(uuid) from public, anon, authenticated;
grant execute on function public.delete_integration_secret(uuid) to service_role;
grant execute on function public.purge_user_owned_storage(uuid) to service_role;

comment on function public.delete_integration_secret(uuid) is
  'Service-only cleanup of a Vault secret before deleting an integration.';
comment on function public.purge_user_owned_storage(uuid) is
  'Service-only cleanup of Storage objects owned by an Auth user before permanent deletion.';

commit;
