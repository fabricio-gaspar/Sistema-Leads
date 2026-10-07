-- Finalize a confirmed remote Evolution GO removal in one database transaction.
-- Historical contacts, conversations, messages and account references are never deleted.
create table if not exists public.team_member_evolution_removal_claims (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  instance_name text not null,
  remote_id uuid,
  state text not null check (state in ('claimed', 'remote_absent', 'finalized')),
  claimed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
alter table public.team_member_evolution_removal_claims enable row level security;
revoke all on public.team_member_evolution_removal_claims from public, anon, authenticated;
grant select, insert, update on public.team_member_evolution_removal_claims to service_role;

create or replace function public.team_member_evolution_remove_finalize(
  p_organization_id uuid,
  p_actor_id uuid,
  p_user_id uuid,
  p_instance_name text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor public.organization_members%rowtype;
  v_target public.organization_members%rowtype;
  v_account public.whatsapp_accounts%rowtype;
  v_integration public.integrations%rowtype;
  v_expected_name text;
  v_claim public.team_member_evolution_removal_claims%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_actor_id = p_user_id then
    raise exception 'member_self_deletion_protected' using errcode = '42501';
  end if;

  -- Serialize last-administrator checks and removal of this membership.
  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then raise exception 'organization_not_found'; end if;
  select * into v_actor from public.organization_members
    where organization_id = p_organization_id and user_id = p_actor_id for update;
  if v_actor.user_id is null or v_actor.status <> 'active' or v_actor.role::text <> 'administrador' then
    raise exception 'member_removal_admin_required' using errcode = '42501';
  end if;
  select * into v_target from public.organization_members
    where organization_id = p_organization_id and user_id = p_user_id for update;
  if v_target.user_id is null then raise exception 'member_not_found'; end if;
  if v_target.role::text = 'administrador' and v_target.status = 'active' and not exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id and m.user_id <> p_user_id
      and m.role::text = 'administrador' and m.status = 'active'
  ) then
    raise exception 'last_administrator_protected';
  end if;

  v_expected_name := 'wf-' || left(replace(p_organization_id::text, '-', ''), 12)
    || '-' || left(replace(p_user_id::text, '-', ''), 12);
  if p_instance_name <> v_expected_name then
    raise exception 'member_instance_identity_mismatch';
  end if;
  select * into v_claim from public.team_member_evolution_removal_claims
    where organization_id = p_organization_id and user_id = p_user_id for update;
  if v_claim.user_id is null or v_claim.state <> 'remote_absent'
     or v_claim.instance_name <> v_expected_name then
    raise exception 'member_remote_removal_unconfirmed';
  end if;
  if exists (
    select 1 from public.evolution_go_seller_provisioning_jobs j
    where j.organization_id = p_organization_id and j.user_id = p_user_id
      and j.instance_name <> v_expected_name
  ) then
    raise exception 'member_instance_identity_mismatch';
  end if;
  if (select count(*) from public.whatsapp_accounts a
      where a.organization_id = p_organization_id and a.owner_user_id = p_user_id
        and a.provider = 'evolution_go' and a.account_type = 'seller'
        and a.archived_at is null) > 1 then
    raise exception 'member_multiple_active_instances';
  end if;

  select * into v_account from public.whatsapp_accounts a
    where a.organization_id = p_organization_id and a.owner_user_id = p_user_id
      and a.provider = 'evolution_go' and a.account_type = 'seller'
      and a.archived_at is null for update;
  if v_account.id is not null then
    if coalesce(v_account.provider_metadata ->> 'instance_name', '') <> v_expected_name
       or v_account.integration_id is null then
      raise exception 'member_instance_identity_mismatch';
    end if;
    select * into v_integration from public.integrations
      where id = v_account.integration_id and organization_id = p_organization_id for update;
    if v_integration.id is null or v_integration.key <> 'whatsapp_evolution_go:' || v_account.id::text
       or exists (select 1 from public.whatsapp_accounts a
         where a.integration_id = v_integration.id and a.id <> v_account.id) then
      raise exception 'member_integration_not_individual';
    end if;
  end if;

  -- Remove only operational binding and credentials. Keep the disabled account
  -- and integration as tombstones for historical FK references.
  if v_integration.id is not null then
    update public.integrations set enabled = false, connected = false, paused = true,
      status_detail = 'Instância removida após exclusão do membro.', updated_at = now()
      where id = v_integration.id;
    if not public.delete_integration_secret(v_integration.id) then
      raise exception 'member_secret_removal_failed';
    end if;
    update public.integrations set configuration = '{}'::jsonb, updated_at = now()
      where id = v_integration.id;
  end if;
  delete from public.evolution_go_seller_provisioning_jobs
    where organization_id = p_organization_id and user_id = p_user_id;
  if v_account.id is not null then
    update public.messaging_outbox set status = 'cancelled', updated_at = now()
      where whatsapp_account_id = v_account.id and status in ('queued', 'processing');
    update public.seller_routing_profiles set whatsapp_account_id = null, updated_at = now()
      where organization_id = p_organization_id and user_id = p_user_id
        and whatsapp_account_id = v_account.id;
    update public.whatsapp_accounts set owner_user_id = null, enabled = false,
      is_default = false, archived_at = now(), connection_status = 'disconnected',
      connected_at = null, connected_phone_suffix = null, display_phone_number = null,
      webhook_registered_at = null, provider_metadata = '{}'::jsonb,
      updated_at = now() where id = v_account.id;
  end if;

  delete from public.team_member_permissions
    where organization_id = p_organization_id and user_id = p_user_id;
  delete from public.user_roles
    where organization_id = p_organization_id and user_id = p_user_id;
  delete from public.organization_members
    where organization_id = p_organization_id and user_id = p_user_id;
  update public.profiles p set active_organization_id = (
      select m.organization_id from public.organization_members m
      where m.user_id = p_user_id and m.status = 'active'
      order by m.created_at limit 1
    ) where p.id = p_user_id and p.active_organization_id = p_organization_id;

  insert into public.audit_logs (
    organization_id, actor_id, actor_name, actor_type, action, detail,
    entity_table, event_data
  ) values (
    p_organization_id, p_actor_id, 'Administrador', 'user',
    'team.member_removed',
    'Acesso e vínculo Evolution GO removidos; contatos e conversas preservados.',
    'organization_members',
    pg_catalog.jsonb_build_object('user_id', p_user_id,
      'instance_name', v_expected_name, 'account_archived', v_account.id is not null)
  );
  update public.team_member_evolution_removal_claims
    set state = 'finalized', updated_at = now()
    where organization_id = p_organization_id and user_id = p_user_id;
  return pg_catalog.jsonb_build_object('membership_removed', true,
    'instance_name', v_expected_name, 'account_archived', v_account.id is not null,
    'history_preserved', true, 'identity_deleted', false);
end;
$function$;

revoke all on function public.team_member_evolution_remove_finalize(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.team_member_evolution_remove_finalize(uuid, uuid, uuid, text)
  to service_role;
