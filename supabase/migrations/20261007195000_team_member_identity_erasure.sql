-- Permanent identity removal is a second, service-only phase after the
-- Evolution GO instance is confirmed absent and the membership is finalized.
-- Company-owned leads, contacts and conversations are not deleted.

create or replace function public.team_member_identity_erasure_preflight(
  p_organization_id uuid,
  p_actor_id uuid,
  p_user_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_email text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_actor_id = p_user_id then
    raise exception 'member_self_deletion_protected' using errcode = '42501';
  end if;
  perform 1 from public.organization_members
    where organization_id = p_organization_id and user_id = p_actor_id
      and role::text = 'administrador' and status = 'active';
  if not found then
    raise exception 'member_removal_admin_required' using errcode = '42501';
  end if;
  select email into v_email from auth.users where id = p_user_id;
  if v_email is null then
    raise exception 'member_identity_not_found';
  end if;
  if exists (
    select 1 from public.organization_members
    where user_id = p_user_id and organization_id <> p_organization_id
  ) or exists (
    select 1 from public.audit_logs
    where actor_id = p_user_id and organization_id <> p_organization_id
  ) or exists (
    select 1 from public.organization_invites
    where lower(email) = lower(v_email) and organization_id <> p_organization_id
      and accepted_at is null and cancelled_at is null and expires_at > now()
  ) then
    raise exception 'member_linked_to_another_organization';
  end if;
  if exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id and user_id = p_user_id
      and role::text = 'administrador' and status = 'active'
  ) and not exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id and user_id <> p_user_id
      and role::text = 'administrador' and status = 'active'
  ) then
    raise exception 'last_administrator_protected';
  end if;
  return pg_catalog.jsonb_build_object('ready', true);
end;
$function$;

create or replace function public.team_member_identity_erasure_finalize(
  p_organization_id uuid,
  p_actor_id uuid,
  p_user_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_email text;
  v_audit_ids uuid[];
  v_deleted_users integer := 0;
  v_audit_count integer := 0;
  v_invite_count integer := 0;
begin
  perform public.team_member_identity_erasure_preflight(
    p_organization_id, p_actor_id, p_user_id
  );
  perform 1 from public.team_member_evolution_removal_claims
    where organization_id = p_organization_id and user_id = p_user_id
      and state = 'finalized' for update;
  if not found then
    raise exception 'member_remote_removal_unconfirmed';
  end if;
  if exists (select 1 from public.organization_members where user_id = p_user_id)
    or exists (select 1 from public.whatsapp_accounts where owner_user_id = p_user_id)
    or exists (select 1 from public.evolution_go_seller_provisioning_jobs where user_id = p_user_id)
    or exists (select 1 from storage.objects where owner_id = p_user_id::text)
  then
    raise exception 'member_local_finalize_failed';
  end if;
  select email into v_email from auth.users where id = p_user_id for update;
  select pg_catalog.array_agg(id) into v_audit_ids from public.audit_logs
    where organization_id = p_organization_id and actor_id = p_user_id;

  -- The immutable audit trigger is suspended only inside this RPC transaction.
  -- Auth's ON DELETE SET NULL FK updates audit actor_id, so it must be disabled
  -- before deleting Auth. ALTER TABLE holds an exclusive lock until COMMIT;
  -- failures roll the deletion, scrub and trigger state back together.
  execute 'alter table public.audit_logs disable trigger audit_logs_immutable';
  delete from auth.users where id = p_user_id and lower(email) = lower(v_email);
  get diagnostics v_deleted_users = row_count;
  if v_deleted_users <> 1 then raise exception 'member_identity_deletion_unconfirmed'; end if;
  delete from public.organization_invites
    where organization_id = p_organization_id and lower(email) = lower(v_email);
  get diagnostics v_invite_count = row_count;
  update public.audit_logs
    set actor_id = null,
        actor_name = 'Usuário excluído',
        detail = 'Dados pessoais removidos após exclusão administrativa.',
        rule = case when rule ilike '%' || v_email || '%' or rule ilike '%' || p_user_id::text || '%'
          then null else rule end,
        entity_id = case when entity_id = p_user_id then null else entity_id end,
        event_data = '{}'::jsonb
    where organization_id = p_organization_id and (
      id = any(coalesce(v_audit_ids, '{}'::uuid[]))
      or actor_id = p_user_id
      or event_data::text ilike '%' || p_user_id::text || '%'
      or event_data::text ilike '%' || v_email || '%'
      or coalesce(detail, '') ilike '%' || v_email || '%'
      or coalesce(detail, '') ilike '%' || p_user_id::text || '%'
      or coalesce(rule, '') ilike '%' || v_email || '%'
      or coalesce(rule, '') ilike '%' || p_user_id::text || '%'
      or entity_id = p_user_id
    );
  get diagnostics v_audit_count = row_count;
  execute 'alter table public.audit_logs enable trigger audit_logs_immutable';

  insert into public.audit_logs (
    organization_id, actor_id, actor_name, actor_type, action, detail,
    entity_table, event_data
  ) values (
    p_organization_id, p_actor_id, 'Administrador', 'user',
    'team.identity_erased',
    'Identidade excluída; histórico comercial da empresa preservado.',
    'auth.users',
    pg_catalog.jsonb_build_object('audit_rows_anonymized', v_audit_count,
      'invites_deleted', v_invite_count)
  );
  return pg_catalog.jsonb_build_object('identity_deleted', true,
    'audit_rows_anonymized', v_audit_count,
    'invites_deleted', v_invite_count);
end;
$function$;

revoke all on function public.team_member_identity_erasure_preflight(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.team_member_identity_erasure_finalize(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.team_member_identity_erasure_preflight(uuid, uuid, uuid)
  to service_role;
grant execute on function public.team_member_identity_erasure_finalize(uuid, uuid, uuid)
  to service_role;
