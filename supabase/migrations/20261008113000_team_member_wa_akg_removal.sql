-- WA-AKG-only member removal. This supersedes the former provider-specific
-- removal path without rewriting historical migrations.

-- The migration is intentionally data-preserving: old provider records stay
-- available to historical foreign keys but can no longer route traffic.
update public.whatsapp_accounts
  set enabled = false,
      is_default = false,
      connection_status = 'disconnected',
      last_error_code = 'provider_retired',
      updated_at = now()
  where provider = 'evolution_go' and archived_at is null;

update public.messaging_provider_controls
  set inbound_enabled = false,
      send_enabled = false,
      automation_enabled = false,
      kill_switch = true,
      reason = 'provider_retired',
      updated_at = now()
  where provider = 'evolution_go';

update public.integrations
  set enabled = false,
      connected = false,
      paused = true,
      status_detail = 'Canal desativado: WA-AKG é o único transporte WhatsApp ativo.',
      updated_at = now()
  where key like 'whatsapp_evolution_go:%' or provider = 'Evolution GO';

create table if not exists public.team_member_wa_akg_removal_claims (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid,
  state text not null check (state in ('claimed', 'finalized')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

alter table public.team_member_wa_akg_removal_claims enable row level security;
revoke all on public.team_member_wa_akg_removal_claims from public, anon, authenticated;
grant select, insert, update on public.team_member_wa_akg_removal_claims to service_role;

create or replace function public.team_member_wa_akg_remove_finalize(
  p_organization_id uuid,
  p_actor_id uuid,
  p_user_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor public.organization_members%rowtype;
  v_target public.organization_members%rowtype;
  v_account public.whatsapp_accounts%rowtype;
  v_integration public.integrations%rowtype;
  v_claim public.team_member_wa_akg_removal_claims%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_actor_id = p_user_id then
    raise exception 'member_self_deletion_protected' using errcode = '42501';
  end if;
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
    select 1 from public.organization_members m where m.organization_id = p_organization_id
      and m.user_id <> p_user_id and m.role::text = 'administrador' and m.status = 'active'
  ) then raise exception 'last_administrator_protected'; end if;

  select * into v_claim from public.team_member_wa_akg_removal_claims
    where organization_id = p_organization_id and user_id = p_user_id for update;
  if v_claim.user_id is null or v_claim.state <> 'claimed' then
    raise exception 'member_removal_claim_required';
  end if;
  if (select count(*) from public.whatsapp_accounts a where a.organization_id = p_organization_id
      and a.owner_user_id = p_user_id and a.provider = 'wa_akg' and a.account_type = 'seller'
      and a.archived_at is null) > 1 then raise exception 'member_multiple_active_accounts'; end if;
  select * into v_account from public.whatsapp_accounts a where a.organization_id = p_organization_id
    and a.owner_user_id = p_user_id and a.provider = 'wa_akg' and a.account_type = 'seller'
    and a.archived_at is null for update;
  if v_account.id is not null then
    select * into v_integration from public.integrations where id = v_account.integration_id
      and organization_id = p_organization_id for update;
    if v_integration.id is null or v_integration.key <> 'whatsapp_wa_akg:' || v_account.id::text
      or exists (select 1 from public.whatsapp_accounts a where a.integration_id = v_integration.id
        and a.id <> v_account.id) then raise exception 'member_integration_not_individual'; end if;
    update public.messaging_outbox set status = 'cancelled', updated_at = now()
      where whatsapp_account_id = v_account.id and status in ('queued', 'processing');
    update public.seller_routing_profiles set whatsapp_account_id = null, updated_at = now()
      where organization_id = p_organization_id and user_id = p_user_id and whatsapp_account_id = v_account.id;
    if not public.delete_integration_secret(v_integration.id) then raise exception 'member_secret_removal_failed'; end if;
    update public.integrations set enabled = false, connected = false, paused = true,
      configuration = '{}'::jsonb, status_detail = 'Canal WA-AKG removido após exclusão do membro.', updated_at = now()
      where id = v_integration.id;
    update public.whatsapp_accounts set owner_user_id = null, enabled = false, is_default = false,
      archived_at = now(), connection_status = 'disconnected', connected_at = null,
      connected_phone_suffix = null, display_phone_number = null, webhook_registered_at = null,
      provider_metadata = '{}'::jsonb, updated_at = now() where id = v_account.id;
  end if;
  delete from public.wa_akg_seller_provisioning_jobs
    where organization_id = p_organization_id and owner_user_id = p_user_id;
  delete from public.team_member_permissions where organization_id = p_organization_id and user_id = p_user_id;
  delete from public.user_roles where organization_id = p_organization_id and user_id = p_user_id;
  delete from public.organization_members where organization_id = p_organization_id and user_id = p_user_id;
  update public.profiles p set active_organization_id = (
    select m.organization_id from public.organization_members m where m.user_id = p_user_id
      and m.status = 'active' order by m.created_at limit 1
  ) where p.id = p_user_id and p.active_organization_id = p_organization_id;
  insert into public.audit_logs (organization_id, actor_id, actor_name, actor_type, action, detail, entity_table, event_data)
  values (p_organization_id, p_actor_id, 'Administrador', 'user', 'team.member_removed',
    'Acesso e vínculo WA-AKG removidos; contatos e conversas preservados.', 'organization_members',
    pg_catalog.jsonb_build_object('user_id', p_user_id, 'account_archived', v_account.id is not null));
  update public.team_member_wa_akg_removal_claims set state = 'finalized', updated_at = now()
    where organization_id = p_organization_id and user_id = p_user_id;
  return pg_catalog.jsonb_build_object('membership_removed', true,
    'account_archived', v_account.id is not null, 'history_preserved', true);
end;
$function$;

create or replace function public.team_member_wa_akg_identity_erasure_finalize(
  p_organization_id uuid,
  p_actor_id uuid,
  p_user_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare v_email text; v_deleted integer := 0; v_audit_count integer := 0; v_invite_count integer := 0;
begin
  perform public.team_member_identity_erasure_preflight(p_organization_id, p_actor_id, p_user_id);
  perform 1 from public.team_member_wa_akg_removal_claims where organization_id = p_organization_id
    and user_id = p_user_id and state = 'finalized' for update;
  if not found then raise exception 'member_local_finalize_failed'; end if;
  if exists (select 1 from public.organization_members where user_id = p_user_id)
    or exists (select 1 from public.whatsapp_accounts where owner_user_id = p_user_id)
    or exists (select 1 from public.wa_akg_seller_provisioning_jobs where owner_user_id = p_user_id)
    or exists (select 1 from storage.objects where owner_id = p_user_id::text) then
    raise exception 'member_local_finalize_failed';
  end if;
  select email into v_email from auth.users where id = p_user_id for update;
  execute 'alter table public.audit_logs disable trigger audit_logs_immutable';
  delete from auth.users where id = p_user_id and lower(email) = lower(v_email);
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then raise exception 'member_identity_deletion_unconfirmed'; end if;
  delete from public.organization_invites where organization_id = p_organization_id and lower(email) = lower(v_email);
  get diagnostics v_invite_count = row_count;
  update public.audit_logs set actor_id = null, actor_name = 'Usuário excluído',
    detail = 'Dados pessoais removidos após exclusão administrativa.', event_data = '{}'::jsonb
    where organization_id = p_organization_id and (actor_id = p_user_id or event_data::text ilike '%' || p_user_id::text || '%'
      or event_data::text ilike '%' || v_email || '%');
  get diagnostics v_audit_count = row_count;
  execute 'alter table public.audit_logs enable trigger audit_logs_immutable';
  insert into public.audit_logs (organization_id, actor_id, actor_name, actor_type, action, detail, entity_table, event_data)
  values (p_organization_id, p_actor_id, 'Administrador', 'user', 'team.identity_erased',
    'Identidade excluída; histórico comercial da empresa preservado.', 'auth.users',
    pg_catalog.jsonb_build_object('audit_rows_anonymized', v_audit_count, 'invites_deleted', v_invite_count));
  return pg_catalog.jsonb_build_object('identity_deleted', true, 'audit_rows_anonymized', v_audit_count,
    'invites_deleted', v_invite_count);
end;
$function$;

revoke all on function public.team_member_wa_akg_remove_finalize(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.team_member_wa_akg_identity_erasure_finalize(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.team_member_wa_akg_remove_finalize(uuid, uuid, uuid) to service_role;
grant execute on function public.team_member_wa_akg_identity_erasure_finalize(uuid, uuid, uuid) to service_role;
