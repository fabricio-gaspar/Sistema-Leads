-- R4: a tenant administers membership, never a person's global Auth identity.
-- All user-facing mutations are authenticated RPCs. The organization row is a
-- write barrier (not merely an advisory lock), including under repeatable read.
alter table public.organization_invites add column if not exists revision bigint not null default 1;
alter table public.organization_invites add column if not exists accepted_by uuid references auth.users(id);
revoke insert, update, delete, truncate on public.organization_invites, public.organization_members from authenticated, anon;

create function private.r4_assert_team_manager(p_org uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.organizations set updated_at=updated_at where id=p_org;
  if auth.uid() is null or p_org is distinct from public.current_org_id()
    or not private.has_org_permission(p_org,auth.uid(),'team.manage')
    or exists(select 1 from public.profiles where id=auth.uid() and active=false) then
    raise exception 'organization_access_denied' using errcode='42501';
  end if;
end;
$$;
create function private.r4_assert_available_role(p_org uuid,p_role text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_role not in ('administrador','vendedor','sdr','cx') or p_role is null then
    raise exception 'invalid_member_role' using errcode='22023';
  end if;
  if exists(select 1 from public.organization_module_data where organization_id=p_org
    and module_key='access_security_policy' and data->'availableRoles'->p_role='false'::jsonb) then
    raise exception 'member_role_unavailable' using errcode='42501';
  end if;
end;
$$;

create function private.r4_team_invite_prepare(p_org uuid,p_email text,p_role text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v public.organization_invites%rowtype; v_email text:=lower(trim(p_email));
begin
  perform private.r4_assert_team_manager(p_org);
  perform private.r4_assert_available_role(p_org,p_role);
  if v_email is null or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_member_email' using errcode='22023';
  end if;
  if exists(select 1 from auth.users u join public.organization_members m on m.user_id=u.id
    where lower(u.email)=v_email and m.organization_id=p_org and m.status='active') then
    raise exception 'member_already_active';
  end if;
  select * into v from public.organization_invites where organization_id=p_org and lower(email)=v_email
    order by created_at desc limit 1 for update;
  if v.id is null then
    insert into public.organization_invites(organization_id,email,role,invited_by,expires_at)
      values(p_org,v_email,p_role::public.app_role,auth.uid(),now()+interval '15 minutes') returning * into v;
  else
    update public.organization_invites set email=v_email,role=p_role::public.app_role,invited_by=auth.uid(),
      expires_at=now()+interval '15 minutes',accepted_at=null,accepted_by=null,cancelled_at=null,revision=revision+1
      where id=v.id returning * into v;
  end if;
  insert into public.audit_logs(organization_id,actor_id,actor_name,actor_type,action,detail,entity_table,entity_id,event_data)
    values(p_org,auth.uid(),'Usuário autorizado','user','team.member_invited','Convite registrado; aguardando aceite do titular.',
      'organization_invites',v.id,jsonb_build_object('role',p_role,'revision',v.revision));
  return jsonb_build_object('id',v.id,'email',v.email,'role',v.role,'revision',v.revision,'expires_at',v.expires_at);
end;
$$;

create function private.r4_team_invite_cancel(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v public.organization_invites%rowtype;
begin
  select * into v from public.organization_invites where id=p_id;
  if v.id is null then raise exception 'invite_not_found'; end if;
  perform private.r4_assert_team_manager(v.organization_id);
  select * into v from public.organization_invites where id=p_id for update;
  if v.accepted_at is not null then raise exception 'invite_already_accepted'; end if;
  if v.cancelled_at is not null then return; end if;
  update public.organization_invites set cancelled_at=now(),revision=revision+1 where id=p_id;
  insert into public.audit_logs(organization_id,actor_id,actor_name,actor_type,action,detail,entity_table,entity_id)
    values(v.organization_id,auth.uid(),'Usuário autorizado','user','team.invite_cancelled','Convite cancelado.', 'organization_invites',p_id);
end;
$$;

create function private.r4_pending_invites() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'organization_id',i.organization_id,
    'organization_name',o.name,'email',i.email,'role',i.role,'revision',i.revision,'expires_at',i.expires_at)
    order by i.created_at),'[]'::jsonb)
  from public.organization_invites i join public.organizations o on o.id=i.organization_id
  join auth.users u on u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=lower(i.email)
  where i.accepted_at is null and i.cancelled_at is null and i.expires_at>now();
$$;
create function private.r4_team_invite_accept(p_id uuid,p_revision bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v public.organization_invites%rowtype; v_user uuid:=auth.uid(); v_email text;
begin
  select email into v_email from auth.users where id=v_user and email_confirmed_at is not null;
  if v_email is null then raise exception 'verified_email_required' using errcode='42501'; end if;
  select * into v from public.organization_invites where id=p_id;
  if v.id is null then raise exception 'invite_not_found'; end if;
  update public.organizations set updated_at=updated_at where id=v.organization_id;
  select * into v from public.organization_invites where id=p_id for update;
  if lower(v.email)<>lower(v_email) then raise exception 'invite_access_denied' using errcode='42501'; end if;
  if v.revision is distinct from p_revision or v.cancelled_at is not null then raise exception 'invite_not_current'; end if;
  if v.accepted_at is not null then
    if v.accepted_by=v_user and exists(select 1 from public.organization_members where organization_id=v.organization_id
      and user_id=v_user and status='active') then
      return jsonb_build_object('organization_id',v.organization_id,'role',v.role,'activated',false,'already_accepted',true);
    end if;
    raise exception 'invite_already_accepted';
  end if;
  if v.expires_at<=now() then raise exception 'invite_expired'; end if;
  if not private.has_org_permission(v.organization_id,v.invited_by,'team.manage') then
    raise exception 'inviter_authority_revoked' using errcode='42501';
  end if;
  if exists(select 1 from public.profiles where id=v_user and active=false) then
    raise exception 'identity_inactive' using errcode='42501';
  end if;
  perform private.r4_assert_available_role(v.organization_id,v.role::text);
  insert into public.organization_members(organization_id,user_id,role,status)
    values(v.organization_id,v_user,v.role,'active')
    on conflict(organization_id,user_id) do update set role=excluded.role,status='active',updated_at=now();
  -- This is the authenticated person's explicit choice, not an admin's global profile mutation.
  update public.profiles set active_organization_id=v.organization_id,updated_at=now() where id=v_user;
  update public.organization_invites set accepted_at=now(),accepted_by=v_user where id=p_id;
  insert into public.audit_logs(organization_id,actor_id,actor_name,actor_type,action,detail,entity_table,entity_id)
    values(v.organization_id,v_user,'Titular do convite','user','team.invite_accepted','Convite aceito pelo titular.', 'organization_invites',p_id);
  return jsonb_build_object('organization_id',v.organization_id,'role',v.role,'activated',true);
end;
$$;

create function private.r4_team_member_change(p_org uuid,p_user uuid,p_action text,p_role text,p_enabled boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v public.organization_members%rowtype; v_action text;
begin
  perform private.r4_assert_team_manager(p_org);
  select * into v from public.organization_members where organization_id=p_org and user_id=p_user for update;
  if v.user_id is null then raise exception 'member_not_found'; end if;
  if p_action='update_role' then
    perform private.r4_assert_available_role(p_org,p_role);
    update public.organization_members set role=p_role::public.app_role,updated_at=now() where organization_id=p_org and user_id=p_user;
    v_action:='team.member_role_changed';
  elsif p_action='set_status' and p_enabled is not null then
    if v.status='invited' and p_enabled then raise exception 'invite_acceptance_required'; end if;
    if p_enabled then perform private.r4_assert_available_role(p_org,v.role::text); end if;
    update public.organization_members set status=case when p_enabled then 'active' else 'disabled' end,updated_at=now()
      where organization_id=p_org and user_id=p_user;
    v_action:=case when p_enabled then 'team.member_enabled' else 'team.member_disabled' end;
  elsif p_action='remove' then
    if p_user=auth.uid() then raise exception 'member_self_deletion_protected'; end if;
    delete from public.team_member_permissions where organization_id=p_org and user_id=p_user;
    delete from public.user_roles where organization_id=p_org and user_id=p_user;
    delete from public.organization_members where organization_id=p_org and user_id=p_user;
    v_action:='team.member_removed';
  else raise exception 'unsupported_action'; end if;
  if p_action='remove' or (p_action='set_status' and not p_enabled) then
    -- Fence older in-flight connect/provision operations; never call the provider here.
    perform pg_advisory_xact_lock(hashtextextended('whatsapp-lifecycle:'||p_org::text,0));
    update private.whatsapp_account_lifecycle l set revision=revision+1,desired_action='deactivate',
      state=case when operation_id is null then 'completed' else 'needs_review' end,error_code='member_access_removed'
      where l.organization_id=p_org and exists(select 1 from public.whatsapp_accounts a
        where a.id=l.account_id and a.organization_id=p_org and a.owner_user_id=p_user);
    update public.integrations set enabled=false,connected=false,updated_at=now() where organization_id=p_org and id in
      (select integration_id from public.whatsapp_accounts where organization_id=p_org and owner_user_id=p_user);
    update public.whatsapp_accounts set enabled=false,is_default=false,connection_status='disconnected',updated_at=now()
      where organization_id=p_org and owner_user_id=p_user;
    update public.wa_akg_seller_provisioning_jobs set state='cancelled',completed_at=now(),error_code='member_access_removed',updated_at=now()
      where organization_id=p_org and owner_user_id=p_user and state in ('queued','failed','processing');
    update public.evolution_go_seller_provisioning_jobs set state='cancelled',completed_at=now(),last_error_code='member_access_removed',updated_at=now()
      where organization_id=p_org and whatsapp_account_id in (select id from public.whatsapp_accounts
        where organization_id=p_org and owner_user_id=p_user) and state in ('queued','failed','processing','awaiting_qr');
    -- A previously accepted token cannot grant access again after removal.
    update public.organization_invites set cancelled_at=now(),revision=revision+1 where organization_id=p_org
      and lower(email)=(select lower(email) from auth.users where id=p_user) and cancelled_at is null;
  end if;
  insert into public.audit_logs(organization_id,actor_id,actor_name,actor_type,action,detail,entity_table,event_data)
    values(p_org,auth.uid(),'Usuário autorizado','user',v_action,'Vínculo da empresa atualizado; identidade global e histórico preservados.',
      'organization_members',jsonb_build_object('user_id',p_user,'role',p_role,'enabled',p_enabled));
  return jsonb_build_object('deleted_identity',false,'membership_removed',p_action='remove');
end;
$$;

-- Protect the security-policy record against the generic module_data member write policy.
create policy r4_security_policy_insert on public.organization_module_data as restrictive for insert to authenticated
  with check(module_key<>'access_security_policy' or private.has_org_permission(organization_id,(select auth.uid()),'team.manage'));
create policy r4_security_policy_update on public.organization_module_data as restrictive for update to authenticated
  using(module_key<>'access_security_policy' or private.has_org_permission(organization_id,(select auth.uid()),'team.manage'))
  with check(module_key<>'access_security_policy' or private.has_org_permission(organization_id,(select auth.uid()),'team.manage'));
create policy r4_security_policy_delete on public.organization_module_data as restrictive for delete to authenticated
  using(module_key<>'access_security_policy' or private.has_org_permission(organization_id,(select auth.uid()),'team.manage'));

-- Serialize policy changes with invite acceptance / role assignment. Neither a
-- cached policy nor a concurrent UPDATE can authorize a disabled role afterward.
create function private.r4_security_policy_barrier() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_org uuid;
begin
  if tg_op<>'INSERT' and old.module_key='access_security_policy' then v_org:=old.organization_id; end if;
  if tg_op<>'DELETE' and new.module_key='access_security_policy' then
    if v_org is not null and v_org<>new.organization_id then raise exception 'security_policy_scope_immutable'; end if;
    v_org:=new.organization_id;
  end if;
  if v_org is not null then
    update public.organizations set updated_at=updated_at where id=v_org;
    if auth.uid() is not null then perform private.r4_assert_team_manager(v_org); end if;
    if tg_op<>'DELETE' and new.module_key='access_security_policy' then
      if jsonb_typeof(new.data->'availableRoles') is distinct from 'object' then raise exception 'security_policy_required'; end if;
      if exists(select 1 from jsonb_each(new.data->'availableRoles') e where e.key not in ('administrador','vendedor','sdr','cx') or jsonb_typeof(e.value)<>'boolean') then
        raise exception 'invalid_security_policy_role';
      end if;
      if new.data->'requireMfa'='true'::jsonb and (tg_op='INSERT' or old.data->'requireMfa' is distinct from 'true'::jsonb) then
        raise exception 'mfa_enforcement_not_available';
      end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.r4_security_policy_barrier() from public,anon,authenticated;
create trigger r4_security_policy_barrier before insert or update or delete on public.organization_module_data
  for each row execute function private.r4_security_policy_barrier();

-- Public invoker wrappers expose a narrow authenticated API, not privileged bodies.
create function public.team_invite_prepare(p_org uuid,p_email text,p_role text) returns jsonb
language sql volatile security invoker set search_path='' as $$ select private.r4_team_invite_prepare(p_org,p_email,p_role) $$;
create function public.team_invite_cancel(p_id uuid) returns void
language sql volatile security invoker set search_path='' as $$ select private.r4_team_invite_cancel(p_id) $$;
create function public.team_pending_invites() returns jsonb
language sql stable security invoker set search_path='' as $$ select private.r4_pending_invites() $$;
create function public.team_invite_accept(p_id uuid,p_revision bigint) returns jsonb
language sql volatile security invoker set search_path='' as $$ select private.r4_team_invite_accept(p_id,p_revision) $$;
create function public.team_member_change(p_org uuid,p_user uuid,p_action text,p_role text default null,p_enabled boolean default null) returns jsonb
language sql volatile security invoker set search_path='' as $$ select private.r4_team_member_change(p_org,p_user,p_action,p_role,p_enabled) $$;
revoke all on function private.r4_assert_team_manager(uuid),private.r4_assert_available_role(uuid,text) from public,anon,authenticated;
revoke all on function private.r4_team_invite_prepare(uuid,text,text), private.r4_team_invite_cancel(uuid),private.r4_pending_invites(),
  private.r4_team_invite_accept(uuid,bigint),private.r4_team_member_change(uuid,uuid,text,text,boolean),
  public.team_invite_prepare(uuid,text,text),public.team_invite_cancel(uuid),public.team_pending_invites(),
  public.team_invite_accept(uuid,bigint),public.team_member_change(uuid,uuid,text,text,boolean) from public,anon;
grant execute on function private.r4_team_invite_prepare(uuid,text,text),private.r4_team_invite_cancel(uuid),private.r4_pending_invites(),
  private.r4_team_invite_accept(uuid,bigint),private.r4_team_member_change(uuid,uuid,text,text,boolean),
  public.team_invite_prepare(uuid,text,text),public.team_invite_cancel(uuid),public.team_pending_invites(),
  public.team_invite_accept(uuid,bigint),public.team_member_change(uuid,uuid,text,text,boolean) to authenticated;

-- Preserve normal self-signup onboarding; invitations confer no access in the Auth trigger.
CREATE OR REPLACE FUNCTION private.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_invite public.organization_invites%rowtype;
  v_name text;
  v_org_name text;
  v_org_id uuid;
  v_slug text;
  v_pipeline_id uuid;
begin
  select * into v_invite
  from public.organization_invites i
  where lower(i.email) = lower(coalesce(new.email, ''))
    and i.accepted_at is null
    and i.cancelled_at is null
    and i.expires_at > now()
  order by i.created_at
  limit 1;
  v_name := coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, 'Usuário'), '@', 1));
  -- Auth creation is not invitation acceptance. Never create or activate a tenant
  -- membership here; the verified titular accepts a current revision explicitly.
  -- GoTrue sets invited_at during sendInvite, after INSERT. This untrusted
  -- metadata marker only suppresses independent-company bootstrap: it cannot
  -- authorize anything. Role and membership still require the canonical RPC.
  if new.invited_at is not null or v_invite.id is not null
    or new.raw_user_meta_data->'wayflex_invitation'='true'::jsonb then
    insert into public.profiles(id,name,email,active,can_use_ia)
      values(new.id,v_name,new.email,true,true) on conflict(id) do nothing;
    return new;
  end if;
  v_org_name := coalesce(nullif(new.raw_user_meta_data #>> '{empresa,nome}', ''), nullif(new.raw_user_meta_data ->> 'company', ''), nullif(new.raw_user_meta_data ->> 'company_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, 'Organização'), '@', 1));
  v_slug := lower(regexp_replace(v_org_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then v_slug := 'organizacao'; end if;
  v_slug := left(v_slug, 48) || '-' || left(new.id::text, 8);
  insert into public.organizations (name, slug) values (v_org_name, v_slug) returning id into v_org_id;
  insert into public.organization_members (organization_id, user_id, role, status) values (v_org_id, new.id, 'administrador', 'active');
  insert into public.profiles (id, name, email, phone, active, can_use_ia, active_organization_id) values (new.id, v_name, new.email, nullif(new.raw_user_meta_data ->> 'phone', ''), true, true, v_org_id);
  insert into public.user_roles (organization_id, user_id, role) values (v_org_id, new.id, 'administrador');
  insert into public.company_settings (organization_id, name, cnpj, segment, address, phone, email, website, sandbox_mode, lead_flow)
  values (v_org_id, v_org_name, nullif(new.raw_user_meta_data ->> 'cnpj', ''), nullif(new.raw_user_meta_data ->> 'segment', ''), nullif(new.raw_user_meta_data ->> 'address', ''), nullif(new.raw_user_meta_data ->> 'phone', ''), new.email, nullif(new.raw_user_meta_data ->> 'website', ''), true, jsonb_build_object('timeout_hours', 48, 'destination_stage', 'Contatos Perdidos', 'open_conversation_on_reply', true, 'auto_start_ai', true, 'human_task_sla_hours', 24));
  -- Descriptive signup metadata seeds only this newly created company. It never
  -- determines tenant membership/roles, permissions, safety or automation flags.
  update public.company_settings set
    cnpj=coalesce(nullif(new.raw_user_meta_data #>> '{empresa,cnpj}',''),cnpj),
    segment=coalesce(nullif(new.raw_user_meta_data #>> '{empresa,segmento}',''),segment),
    address=coalesce(nullif(new.raw_user_meta_data #>> '{empresa,endereco}',''),address),
    phone=coalesce(nullif(new.raw_user_meta_data #>> '{empresa,telefone}',''),phone),
    website=coalesce(nullif(new.raw_user_meta_data #>> '{empresa,site}',''),website),
    ui_settings=jsonb_build_object('ramo',coalesce(new.raw_user_meta_data #>> '{empresa,segmento}',''),
      'organizacao',jsonb_build_object('nome',v_org_name,'nomeComercial',v_org_name,
        'email',new.email,'cnpj',coalesce(new.raw_user_meta_data #>> '{empresa,cnpj}',''),
        'endereco',coalesce(new.raw_user_meta_data #>> '{empresa,endereco}',''),
        'telefone',coalesce(new.raw_user_meta_data #>> '{empresa,telefone}',''),
        'site',coalesce(new.raw_user_meta_data #>> '{empresa,site}',''),
        'whatsapp',coalesce(new.raw_user_meta_data #>> '{empresa,whatsapp}',''),
        'social_media',jsonb_build_object('linkedin',coalesce(new.raw_user_meta_data #>> '{empresa,social_media,linkedin}',''),
          'instagram',coalesce(new.raw_user_meta_data #>> '{empresa,social_media,instagram}',''),
          'facebook',coalesce(new.raw_user_meta_data #>> '{empresa,social_media,facebook}',''))))
    where organization_id=v_org_id;
  insert into public.pipelines (organization_id, name, description, active, is_default, created_by)
  values (v_org_id, 'Pipeline Comercial', 'Pipeline padrão criado no onboarding', true, true, new.id)
  returning id into v_pipeline_id;
  insert into public.pipeline_stages (organization_id, pipeline_id, name, position, color, probability, legacy_stage, is_won, is_lost, active)
  values
    (v_org_id, v_pipeline_id, 'Prospecção', 1, '#0ea5e9', 10, 'Prospecção', false, false, true),
    (v_org_id, v_pipeline_id, 'Qualificado', 2, '#8b5cf6', 30, 'Qualificado', false, false, true),
    (v_org_id, v_pipeline_id, 'Proposta', 3, '#f59e0b', 50, 'Proposta', false, false, true),
    (v_org_id, v_pipeline_id, 'Negociação', 4, '#ec4899', 75, 'Negociação', false, false, true),
    (v_org_id, v_pipeline_id, 'Pedido', 5, '#14b8a6', 90, 'Pedido', false, false, true),
    (v_org_id, v_pipeline_id, 'Fechado', 6, '#22c55e', 100, 'Fechado', true, false, true),
    (v_org_id, v_pipeline_id, 'Perdido', 7, '#64748b', 0, 'Perdido', false, true, true),
    (v_org_id, v_pipeline_id, 'Contatos Perdidos', 8, '#94a3b8', 0, 'Contatos Perdidos', false, true, true);
  return new;
end;
$function$
;
revoke all on function private.handle_new_auth_user() from public,anon,authenticated;
