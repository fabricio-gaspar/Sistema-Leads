-- O provedor escolhido pelo administrador precisa ser respeitado por todos os
-- caminhos de saída. A ausência de uma linha para Z-API mantém a compatibilidade
-- com organizações legadas; uma linha explícita desligada bloqueia a conta.
create or replace function public.resolve_lead_whatsapp_account(
  p_organization_id uuid,
  p_lead_id uuid
)
returns table (
  account_id uuid,
  integration_id uuid,
  owner_user_id uuid,
  is_default boolean,
  connection_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_lead public.leads%rowtype;
  v_account public.whatsapp_accounts%rowtype;
begin
  select * into v_lead
  from public.leads
  where id = p_lead_id and organization_id = p_organization_id
  for update;
  if not found then raise exception 'lead_not_found'; end if;

  if v_lead.whatsapp_account_id is not null then
    select * into v_account
    from public.whatsapp_accounts
    where id = v_lead.whatsapp_account_id
      and organization_id = p_organization_id
      and archived_at is null;
    if not found then raise exception 'whatsapp_account_unavailable'; end if;
  else
    select * into v_account
    from public.whatsapp_accounts
    where organization_id = p_organization_id
      and archived_at is null
      and enabled
      and account_type = 'seller'
      and owner_user_id is not null
      and owner_user_id in (v_lead.assigned_to, v_lead.owner_id)
    order by
      case when owner_user_id = v_lead.assigned_to then 0 else 1 end,
      case when connection_status = 'connected' then 0 else 1 end,
      updated_at desc
    limit 1;

    if not found then
      select * into v_account
      from public.whatsapp_accounts
      where organization_id = p_organization_id
        and archived_at is null
        and enabled
        and is_default
      limit 1;
    end if;
    if not found then raise exception 'whatsapp_account_not_configured'; end if;

    update public.leads
    set whatsapp_account_id = v_account.id,
        updated_at = now()
    where id = p_lead_id and organization_id = p_organization_id;
  end if;

  if v_account.enabled is not true then
    raise exception 'whatsapp_account_disabled';
  end if;

  if exists (
    select 1
    from public.messaging_provider_controls c
    where c.organization_id = p_organization_id
      and c.provider = v_account.provider
      and (c.kill_switch or not c.send_enabled)
  ) then
    raise exception 'whatsapp_provider_disabled';
  end if;

  return query select v_account.id, v_account.integration_id,
    v_account.owner_user_id, v_account.is_default, v_account.connection_status;
end;
$$;

revoke all on function public.resolve_lead_whatsapp_account(uuid, uuid) from public, anon, authenticated;
grant execute on function public.resolve_lead_whatsapp_account(uuid, uuid) to service_role;
