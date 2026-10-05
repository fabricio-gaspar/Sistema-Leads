-- Restore the canonical Ana -> WhatsApp activation path.
--
-- RETURNS TABLE output names are PL/pgSQL variables. The previous resolver
-- referenced columns such as owner_user_id, connection_status and is_default
-- without a table alias, so PostgreSQL treated them as ambiguous and aborted
-- before the canonical presentation could be persisted or queued.
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
  select l.* into v_lead
  from public.leads as l
  where l.id = p_lead_id
    and l.organization_id = p_organization_id
  for update;
  if not found then raise exception 'lead_not_found'; end if;

  if v_lead.whatsapp_account_id is not null then
    select wa.* into v_account
    from public.whatsapp_accounts as wa
    where wa.id = v_lead.whatsapp_account_id
      and wa.organization_id = p_organization_id
      and wa.archived_at is null;
    if not found then raise exception 'whatsapp_account_unavailable'; end if;
  else
    select wa.* into v_account
    from public.whatsapp_accounts as wa
    where wa.organization_id = p_organization_id
      and wa.archived_at is null
      and wa.enabled
      and wa.account_type = 'seller'
      and wa.owner_user_id is not null
      and wa.owner_user_id in (v_lead.assigned_to, v_lead.owner_id)
    order by
      case when wa.owner_user_id = v_lead.assigned_to then 0 else 1 end,
      case when wa.connection_status = 'connected' then 0 else 1 end,
      wa.updated_at desc
    limit 1;

    if not found then
      select wa.* into v_account
      from public.whatsapp_accounts as wa
      where wa.organization_id = p_organization_id
        and wa.archived_at is null
        and wa.enabled
        and wa.is_default
      limit 1;
    end if;
    if not found then raise exception 'whatsapp_account_not_configured'; end if;

    update public.leads as l
    set whatsapp_account_id = v_account.id,
        updated_at = now()
    where l.id = p_lead_id
      and l.organization_id = p_organization_id;
  end if;

  if v_account.enabled is not true then
    raise exception 'whatsapp_account_disabled';
  end if;

  if exists (
    select 1
    from public.messaging_provider_controls as c
    where c.organization_id = p_organization_id
      and c.provider = v_account.provider
      and (c.kill_switch or not c.send_enabled)
  ) then
    raise exception 'whatsapp_provider_disabled';
  end if;

  return query
  select
    v_account.id,
    v_account.integration_id,
    v_account.owner_user_id,
    v_account.is_default,
    v_account.connection_status;
end;
$$;

revoke all on function public.resolve_lead_whatsapp_account(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_lead_whatsapp_account(uuid, uuid)
  to service_role;
