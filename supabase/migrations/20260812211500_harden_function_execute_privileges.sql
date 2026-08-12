-- Remove legacy direct grants and keep RPCs security-invoker whenever possible.

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
  v_name := coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, 'Usuário'), '@', 1));
  insert into public.profiles (id, name, email, active, can_use_ia, active_organization_id)
  values (new.id, v_name, new.email, true, true, v_invite.organization_id)
  on conflict (id) do update set
    email = excluded.email,
    active = true,
    active_organization_id = coalesce(public.profiles.active_organization_id, excluded.active_organization_id),
    updated_at = now();
  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_invite.organization_id, new.id, v_invite.role, 'active')
  on conflict (organization_id, user_id) do update set status = 'active', updated_at = now();
  insert into public.user_roles (organization_id, user_id, role)
  values (v_invite.organization_id, new.id, v_invite.role)
  on conflict (organization_id, user_id, role) do nothing;
  update public.organization_invites set accepted_at = now() where id = v_invite.id;
  return new;
end;
$$;

create or replace function private.prevent_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Logs de auditoria são imutáveis';
end;
$$;

create or replace function private.audit_business_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_org uuid;
  v_id uuid;
begin
  if tg_op = 'DELETE' then
    v_org := old.organization_id;
    v_id := old.id;
  else
    v_org := new.organization_id;
    v_id := new.id;
  end if;
  if v_org is not null then
    insert into public.audit_logs (organization_id, actor_id, actor_name, actor_type, action, detail, entity_table, entity_id, event_data)
    values (
      v_org, auth.uid(), coalesce(auth.jwt() ->> 'email', 'system'),
      case when auth.uid() is null then 'system' else 'human' end,
      lower(tg_table_name) || '_' || lower(tg_op), format('%s %s', tg_op, tg_table_name),
      tg_table_name, v_id, jsonb_build_object('operation', tg_op)
    );
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure private.handle_new_auth_user();

drop trigger if exists audit_logs_immutable on public.audit_logs;
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute procedure private.prevent_audit_mutation();

do $$
declare r record;
begin
  for r in select unnest(array[
    'leads','contact_points','lead_outreach','lead_messages','appointments','proposals','orders',
    'lead_tasks','lead_notes','consent_events','contact_suppressions','documents','services',
    'objections','tickets','organization_members','organization_invites','privacy_requests'
  ]) as table_name
  loop
    if to_regclass('public.' || r.table_name) is not null then
      execute format('drop trigger if exists %I on public.%I', 'audit_' || r.table_name, r.table_name);
      execute format('create trigger %I after insert or update or delete on public.%I for each row execute procedure private.audit_business_change()', 'audit_' || r.table_name, r.table_name);
    end if;
  end loop;
end $$;

drop function if exists public.handle_new_auth_user();
drop function if exists public.prevent_audit_mutation();
drop function if exists public.audit_business_change();

create or replace function private.enforce_active_organization()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.active_organization_id is not null
     and not private.is_org_member(new.active_organization_id, new.id) then
    raise exception 'A organização ativa precisa ser um vínculo ativo do usuário';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_active_organization_guard on public.profiles;
create trigger profiles_active_organization_guard
  before insert or update of active_organization_id on public.profiles
  for each row execute procedure private.enforce_active_organization();

create or replace function public.current_org_id()
returns uuid
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
declare v_org uuid;
begin
  select p.active_organization_id into v_org
  from public.profiles p
  where p.id = auth.uid() and p.active = true;
  if v_org is null or not private.is_org_member(v_org, auth.uid()) then
    raise exception 'Nenhuma organização ativa para este usuário';
  end if;
  return v_org;
end;
$$;

create or replace function public.set_active_organization(_organization_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is null or not private.is_org_member(_organization_id, auth.uid()) then
    raise exception 'Organização não disponível para este usuário';
  end if;
  update public.profiles
     set active_organization_id = _organization_id, updated_at = now()
   where id = auth.uid();
  return _organization_id;
end;
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  select _user_id = auth.uid()
     and _role = 'administrador'
     and exists (
       select 1 from public.profiles p
       where p.id = _user_id and private.is_org_admin(p.active_organization_id, _user_id)
     );
$$;

create or replace function public.has_contact_suppression(_lead_id uuid, _hashes text[])
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1 from public.leads l
    join public.contact_suppressions s on s.organization_id = l.organization_id
    where l.id = _lead_id
      and private.is_active_org_member(l.organization_id, auth.uid())
      and s.contact_hash = any(_hashes)
  );
$$;

create or replace function public.clear_contact_suppressions(_lead_id uuid, _hashes text[])
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.leads where id = _lead_id;
  if v_org is null or not private.is_active_org_member(v_org, auth.uid()) then
    raise exception 'Lead não disponível na organização ativa';
  end if;
  delete from public.contact_suppressions
   where organization_id = v_org and contact_hash = any(_hashes);
end;
$$;

create or replace function public.anonymize_lead_lgpd(_lead_id uuid, _reason text default 'privacy_request')
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.leads where id = _lead_id for update;
  if v_org is null or not private.is_org_admin(v_org, auth.uid()) then
    raise exception 'Apenas administradores da organização podem anonimizar dados';
  end if;
  update public.contact_points set status = 'opt_out', value = '[anonimizado]', value_normalized = '[anonimizado]', updated_at = now()
   where lead_id = _lead_id;
  update public.leads set contact = null, title = null, phone = null, whatsapp = null, email = null,
    opt_out = true, ai_paused = true, next_action_at = null, updated_at = now() where id = _lead_id;
  insert into public.privacy_requests (organization_id, lead_id, requester_hash, request_type, status, notes, fulfilled_at, handled_by)
  values (v_org, _lead_id, encode(digest(_lead_id::text, 'sha256'), 'hex'), 'deletion', 'completed', _reason, now(), auth.uid());
end;
$$;

-- Supabase projects created before the restrictive default permissions may
-- have direct role grants in addition to PUBLIC grants. Revoke both explicitly.
revoke all on function public.current_org_id() from public, anon;
revoke all on function public.set_active_organization(uuid) from public, anon;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.has_contact_suppression(uuid, text[]) from public, anon;
revoke all on function public.clear_contact_suppressions(uuid, text[]) from public, anon;
revoke all on function public.anonymize_lead_lgpd(uuid, text) from public, anon;
grant execute on function public.current_org_id() to authenticated;
grant execute on function public.set_active_organization(uuid) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.has_contact_suppression(uuid, text[]) to authenticated;
grant execute on function public.clear_contact_suppressions(uuid, text[]) to authenticated;
grant execute on function public.anonymize_lead_lgpd(uuid, text) to authenticated;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
revoke all on function private.prevent_audit_mutation() from public, anon, authenticated;
revoke all on function private.audit_business_change() from public, anon, authenticated;
revoke all on function private.enforce_active_organization() from public, anon, authenticated;

commit;
