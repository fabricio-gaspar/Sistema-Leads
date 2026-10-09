-- A confirmed device logout must preserve the CRM account and history while
-- removing only the public pairing metadata. This RPC is Edge-only.
create function public.clear_wa_akg_device(
  p_organization_id uuid, p_account_id uuid, p_provider text
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('service_role', 'postgres') or p_provider <> 'wa_akg' then
    raise exception 'wa_akg_device_unlink_denied';
  end if;
  update public.whatsapp_accounts
    set connected_phone_suffix = null, connected_at = null, connection_status = 'configured',
        enabled = false, is_default = false, updated_at = pg_catalog.now()
    where id = p_account_id and organization_id = p_organization_id and provider = p_provider
      and account_type = 'seller' and archived_at is null;
  if not found then raise exception 'wa_akg_device_account_missing'; end if;
end;
$$;

revoke all on function public.clear_wa_akg_device(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.clear_wa_akg_device(uuid, uuid, text) to service_role;
