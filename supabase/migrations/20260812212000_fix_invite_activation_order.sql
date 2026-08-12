-- The profile guard validates membership, so establish the membership first.

begin;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_invite public.organization_invites%rowtype;
  v_name text;
begin
  select * into v_invite
  from public.organization_invites i
  where lower(i.email) = lower(coalesce(new.email, ''))
    and i.accepted_at is null
    and i.expires_at > now()
  order by i.created_at
  limit 1;
  if v_invite.id is null then
    raise exception 'Seu e-mail ainda não possui convite para esta organização';
  end if;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_invite.organization_id, new.id, v_invite.role, 'active')
  on conflict (organization_id, user_id) do update set status = 'active', updated_at = now();

  v_name := coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, 'Usuário'), '@', 1));
  insert into public.profiles (id, name, email, active, can_use_ia, active_organization_id)
  values (new.id, v_name, new.email, true, true, v_invite.organization_id)
  on conflict (id) do update set
    email = excluded.email,
    active = true,
    active_organization_id = coalesce(public.profiles.active_organization_id, excluded.active_organization_id),
    updated_at = now();

  insert into public.user_roles (organization_id, user_id, role)
  values (v_invite.organization_id, new.id, v_invite.role)
  on conflict (organization_id, user_id, role) do nothing;
  update public.organization_invites set accepted_at = now() where id = v_invite.id;
  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

commit;
