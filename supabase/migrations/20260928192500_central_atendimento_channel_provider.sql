-- Resolve somente o provedor já fixado ao lead no instante de envio humano.
-- Não retorna credenciais e não permite escolher/trocar a conta do WhatsApp.

begin;

create or replace function public.central_get_conversation_channel_provider(p_lead_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select case
    when account.provider in ('zapi', 'meta_cloud') then account.provider
    else null
  end
    from public.leads as lead
    left join public.whatsapp_accounts as account
      on account.id = lead.whatsapp_account_id
     and account.organization_id = lead.organization_id
   where lead.id = p_lead_id
     and lead.organization_id = public.current_org_id()
     and lead.archived_at is null
     and private.can_access_lead(lead.organization_id, lead.id, auth.uid())
   limit 1
$function$;

revoke all on function public.central_get_conversation_channel_provider(uuid) from public, anon;
grant execute on function public.central_get_conversation_channel_provider(uuid) to authenticated, service_role;

commit;
