-- Mantém separadas a sessão remota da Z-API e a habilitação operacional do canal.
-- Pausar o provedor não desconecta a instância e não deve transformar uma sessão
-- remota válida em erro de conexão.

create or replace function private.sync_whatsapp_account_from_integration()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  update public.whatsapp_accounts
  set enabled = new.enabled,
      connection_status = case
        when new.connected then 'connected'
        when new.last_error is not null then 'error'
        when coalesce((new.configuration ->> 'configured')::boolean, false) then 'configured'
        else 'unconfigured'
      end,
      connected_at = case when new.connected then coalesce(connected_at, now()) else connected_at end,
      status_checked_at = coalesce(new.last_tested_at, status_checked_at),
      last_error_code = case when new.connected then null else new.last_error end
  where integration_id = new.id
    and archived_at is null;
  return new;
end;
$$;

update public.whatsapp_accounts a
set enabled = i.enabled,
    connection_status = case
      when i.connected then 'connected'
      when i.last_error is not null then 'error'
      when coalesce((i.configuration ->> 'configured')::boolean, false) then 'configured'
      else 'unconfigured'
    end,
    connected_at = case when i.connected then coalesce(a.connected_at, now()) else a.connected_at end,
    status_checked_at = coalesce(i.last_tested_at, a.status_checked_at),
    last_error_code = case when i.connected then null else i.last_error end
from public.integrations i
where a.integration_id = i.id
  and a.archived_at is null;
