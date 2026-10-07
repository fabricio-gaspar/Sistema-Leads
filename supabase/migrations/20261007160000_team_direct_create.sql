-- Direct administration creates a NEW global Auth identity, then attaches it
-- atomically to one tenant. Existing identities are never adopted or reset.
create or replace function private.team_direct_create_assert(
  p_org uuid, p_actor uuid, p_role text
) returns void
language plpgsql volatile security definer set search_path = '' as $function$
begin
  -- Serialize with the R4 invite/member barrier and check the actor, not the
  -- service-role JWT used by the Edge Function.
  update public.organizations set updated_at = updated_at where id = p_org;
  if not found or p_actor is null
    or not private.has_org_permission(p_org, p_actor, 'team.manage')
    or not exists (
      select 1 from public.organization_members m
      where m.organization_id = p_org and m.user_id = p_actor
        and m.role::text = 'administrador' and m.status = 'active'
    )
    or not exists (
      select 1 from public.profiles p
      where p.id = p_actor and p.active = true and p.active_organization_id = p_org
    ) then
    raise exception 'organization_access_denied' using errcode = '42501';
  end if;
  perform private.r4_assert_available_role(p_org, p_role);
  if not exists (
    select 1 from pg_catalog.pg_trigger t
    where t.tgrelid = 'auth.users'::regclass
      and t.tgname = 'on_auth_user_created'
      and t.tgenabled <> 'D'
      and pg_catalog.strpos(pg_catalog.pg_get_functiondef(t.tgfoid), 'wayflex_invitation') > 0
  ) then
    raise exception 'member_auth_bootstrap_incompatible';
  end if;
  if p_role = 'vendedor' and not exists (
    select 1 from pg_catalog.pg_trigger t
    where t.tgrelid = 'public.organization_members'::regclass
      and t.tgname = 'evolution_go_seller_membership_lifecycle'
      and t.tgenabled <> 'D'
  ) then
    raise exception 'evolution_go_lifecycle_unavailable';
  end if;
end;
$function$;

create or replace function public.team_direct_create_preflight(
  p_org uuid, p_actor uuid, p_role text
) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $function$
begin
  perform private.team_direct_create_assert(p_org, p_actor, p_role);
  return pg_catalog.jsonb_build_object('ready', true);
end;
$function$;

create or replace function public.team_direct_create_attach(
  p_org uuid, p_actor uuid, p_user uuid, p_email text, p_name text, p_role text
) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $function$
declare
  v_email text := lower(pg_catalog.btrim(p_email));
  v_name text := pg_catalog.btrim(p_name);
begin
  perform private.team_direct_create_assert(p_org, p_actor, p_role);
  if v_name = '' or pg_catalog.length(v_name) > 120
    or v_email = '' or pg_catalog.length(v_email) > 254 then
    raise exception 'invalid_member_identity' using errcode = '22023';
  end if;
  -- The marker only identifies a fresh identity created by the trusted Edge
  -- path; authorization comes from service-role-only EXECUTE plus actor checks.
  if not exists (
    select 1 from auth.users u
    where u.id = p_user and lower(u.email) = v_email
      and u.email_confirmed_at is not null
      and u.created_at > pg_catalog.now() - interval '10 minutes'
      and u.raw_user_meta_data->>'wayflex_direct_create' = 'true'
  ) or exists (
    select 1 from public.organization_members m where m.user_id = p_user
  ) then
    raise exception 'member_identity_not_attachable' using errcode = '42501';
  end if;

  update public.profiles
     set name = v_name, email = v_email, active = true,
         active_organization_id = p_org, updated_at = pg_catalog.now()
   where id = p_user and active_organization_id is null;
  if not found then
    raise exception 'member_profile_not_attachable' using errcode = '42501';
  end if;

  -- The existing Evolution GO membership trigger creates the disabled account,
  -- integration and durable per-seller job in this SAME transaction.
  insert into public.organization_members(organization_id, user_id, role, status)
  values (p_org, p_user, p_role::public.app_role, 'active');

  insert into public.audit_logs(
    organization_id, actor_id, actor_name, actor_type, action, detail,
    entity_table, event_data
  ) values (
    p_org, p_actor, 'Administrador autorizado', 'user', 'team.member_created',
    'Acesso direto criado para um novo usuário.', 'organization_members',
    pg_catalog.jsonb_build_object('user_id', p_user, 'role', p_role)
  );
  return pg_catalog.jsonb_build_object('user_id', p_user, 'role', p_role);
end;
$function$;

revoke all on function private.team_direct_create_assert(uuid,uuid,text),
  public.team_direct_create_preflight(uuid,uuid,text),
  public.team_direct_create_attach(uuid,uuid,uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function private.team_direct_create_assert(uuid,uuid,text),
  public.team_direct_create_preflight(uuid,uuid,text),
  public.team_direct_create_attach(uuid,uuid,uuid,text,text,text)
  to service_role;
