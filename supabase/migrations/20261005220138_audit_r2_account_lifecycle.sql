-- R2: orchestration only. whatsapp_accounts/integrations/provider controls remain
-- the authorization source. No gateway calls or operational data backfill.
create table private.whatsapp_account_lifecycle (
  account_id uuid primary key references public.whatsapp_accounts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('wa_akg', 'evolution_go')),
  revision bigint not null default 0 check (revision >= 0),
  desired_action text,
  requested_by uuid,
  state text not null default 'idle' check (state in ('idle','pending','in_flight','completed','failed','needs_review')),
  operation_id uuid,
  operation_revision bigint,
  operation_action text,
  operation_actor_id uuid,
  operation_started_at timestamptz,
  error_code text,
  updated_at timestamptz not null default now(),
  check ((operation_id is null) = (operation_revision is null))
);
create index whatsapp_account_lifecycle_org_idx on private.whatsapp_account_lifecycle(organization_id);
alter table private.whatsapp_account_lifecycle enable row level security;
revoke all on private.whatsapp_account_lifecycle from public, anon, authenticated;
grant select, insert, update on private.whatsapp_account_lifecycle to service_role;
grant usage on schema private to service_role;

create function private.assert_whatsapp_lifecycle_access(
  p_organization_id uuid, p_account_id uuid, p_provider text, p_actor_id uuid, p_access text
) returns void language plpgsql security invoker set search_path = '' as $$
declare v_account public.whatsapp_accounts%rowtype;
begin
  if current_user not in ('service_role','postgres') or p_provider not in ('wa_akg','evolution_go') then
    raise exception 'account_lifecycle_access_denied';
  end if;
  select a.* into v_account from public.whatsapp_accounts a
    where a.id=p_account_id and a.organization_id=p_organization_id
      and a.provider=p_provider and a.archived_at is null;
  if not found or not exists (
    select 1 from public.profiles p join public.organization_members m
      on m.user_id=p.id and m.organization_id=p_organization_id and m.status='active'
      where p.id=p_actor_id and p.active_organization_id=p_organization_id
  ) or not exists (
    select 1 from public.integrations i where i.id=v_account.integration_id
      and i.organization_id=p_organization_id
      and pg_catalog.regexp_replace(pg_catalog.lower(i.provider),'[^a-z0-9]+','_','g')=p_provider
  ) then raise exception 'account_lifecycle_access_denied'; end if;
  if private.has_org_permission(p_organization_id,p_actor_id,'channels.manage_all')
    or private.has_org_permission(p_organization_id,p_actor_id,'configuration.manage') then return; end if;
  if p_access='view' and v_account.account_type='corporate' and v_account.is_default then return; end if;
  if p_access <> 'manage' and v_account.account_type='seller' and v_account.owner_user_id=p_actor_id
    and private.has_org_permission(p_organization_id,p_actor_id,
      case when p_access='view' then 'channels.view_own' else 'channels.connect_own' end) then return; end if;
  raise exception 'account_lifecycle_access_denied';
end;
$$;
revoke all on function private.assert_whatsapp_lifecycle_access(uuid,uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function private.assert_whatsapp_lifecycle_access(uuid,uuid,text,uuid,text) to service_role;

create function public.get_whatsapp_account_lifecycle(
  p_organization_id uuid, p_account_id uuid, p_provider text, p_actor_id uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_row private.whatsapp_account_lifecycle%rowtype;
begin
  perform private.assert_whatsapp_lifecycle_access(p_organization_id,p_account_id,p_provider,p_actor_id,'view');
  select l.* into v_row from private.whatsapp_account_lifecycle l where l.account_id=p_account_id;
  return pg_catalog.jsonb_build_object('state',coalesce(v_row.state,'idle'),'revision',coalesce(v_row.revision,0),
    'desired_action',v_row.desired_action,'error_code',v_row.error_code);
end;
$$;

create function public.begin_whatsapp_account_lifecycle(
  p_organization_id uuid, p_account_id uuid, p_provider text, p_actor_id uuid, p_action text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_account public.whatsapp_accounts%rowtype;
  v_row private.whatsapp_account_lifecycle%rowtype;
  v_token uuid;
begin
  if p_action is null or p_action not in ('activate','deactivate','connect','reconnect','disconnect','logout','qr','pair','refresh_status','save','create_instance','configure_gateway','provision') then
    raise exception 'account_lifecycle_action_invalid';
  end if;
  -- Consistent short lock order also serializes corporate-default selection.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('whatsapp-lifecycle:' || p_organization_id::text,0));
  perform private.assert_whatsapp_lifecycle_access(p_organization_id,p_account_id,p_provider,p_actor_id,
    case when p_action in ('save','create_instance','configure_gateway','provision') then 'manage' else 'connect' end);
  select a.* into strict v_account from public.whatsapp_accounts a where a.id=p_account_id for update;
  perform 1 from public.integrations i where i.id=v_account.integration_id and i.organization_id=p_organization_id for update;
  if not found then raise exception 'account_lifecycle_integration_missing'; end if;
  insert into private.whatsapp_account_lifecycle(account_id,organization_id,provider)
    values(p_account_id,p_organization_id,p_provider) on conflict(account_id) do nothing;
  select l.* into strict v_row from private.whatsapp_account_lifecycle l where l.account_id=p_account_id for update;
  if v_row.organization_id<>p_organization_id or v_row.provider<>p_provider then
    raise exception 'account_lifecycle_scope_mismatch';
  end if;
  if p_action<>'refresh_status' then
    -- This transaction must commit before any credential lookup or external call.
    -- Integration first: its legacy trigger also writes whatsapp_accounts.
    update public.integrations set enabled=false, paused=true,
      status_detail='Uso local bloqueado; transição de conta pendente.',updated_at=pg_catalog.now()
      where id=v_account.integration_id and organization_id=p_organization_id;
    if not found then raise exception 'account_lifecycle_integration_missing'; end if;
    update public.whatsapp_accounts set enabled=false,is_default=false,updated_at=pg_catalog.now()
      where id=p_account_id and organization_id=p_organization_id;
    if not found then raise exception 'account_lifecycle_account_missing'; end if;
    update private.whatsapp_account_lifecycle set revision=revision+1, desired_action=p_action,requested_by=p_actor_id,
      state=case when state='needs_review' then 'needs_review' else 'pending' end,updated_at=pg_catalog.now()
      where account_id=p_account_id returning * into v_row;
    insert into public.audit_logs(organization_id,actor_id,actor_name,actor_type,action,detail,entity_table,entity_id,event_data)
      values(p_organization_id,p_actor_id,'Usuário','user','whatsapp.account_intent',
        'Intenção persistida; uso local bloqueado antes de contato com o provedor.','whatsapp_accounts',p_account_id,
        pg_catalog.jsonb_build_object('provider',p_provider,'action',p_action,'revision',v_row.revision));
  end if;
  if v_row.operation_id is not null or exists (
    select 1 from private.whatsapp_account_lifecycle other
      where other.organization_id=p_organization_id and other.provider=p_provider and other.account_id<>p_account_id
        and other.operation_id is not null and (p_action='configure_gateway' or other.operation_action='configure_gateway')
  ) then
    return pg_catalog.jsonb_build_object('admitted',false,'state',case when v_row.state='needs_review' then 'needs_review' else 'pending' end,
      'revision',v_row.revision,'desired_action',v_row.desired_action,'error_code',v_row.error_code);
  end if;
  if p_action='deactivate' then
    update private.whatsapp_account_lifecycle set state='completed',error_code=null where account_id=p_account_id;
    return pg_catalog.jsonb_build_object('admitted',false,'state','completed','revision',v_row.revision,'desired_action',p_action);
  end if;
  v_token := pg_catalog.gen_random_uuid();
  update private.whatsapp_account_lifecycle set operation_id=v_token,operation_revision=v_row.revision,
    operation_action=p_action,operation_actor_id=p_actor_id,operation_started_at=pg_catalog.now(),
    state='in_flight',error_code=null,updated_at=pg_catalog.now() where account_id=p_account_id;
  return pg_catalog.jsonb_build_object('admitted',true,'state','in_flight','revision',v_row.revision,
    'desired_action',v_row.desired_action,'operation_id',v_token);
end;
$$;

create function public.check_whatsapp_account_lifecycle(
  p_organization_id uuid, p_account_id uuid, p_provider text, p_actor_id uuid, p_operation_id uuid, p_revision bigint
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_action text;
begin
  select l.operation_action into v_action from private.whatsapp_account_lifecycle l where l.account_id=p_account_id;
  perform private.assert_whatsapp_lifecycle_access(p_organization_id,p_account_id,p_provider,p_actor_id,
    case when v_action in ('save','create_instance','configure_gateway','provision') then 'manage' else 'connect' end);
  return pg_catalog.jsonb_build_object('current',exists (
    select 1 from private.whatsapp_account_lifecycle l where l.account_id=p_account_id
      and l.organization_id=p_organization_id and l.provider=p_provider and l.revision=p_revision
      and l.operation_id=p_operation_id and l.operation_revision=p_revision and l.operation_actor_id=p_actor_id
      and l.state='in_flight'));
end;
$$;

create function public.finish_whatsapp_account_lifecycle(
  p_organization_id uuid, p_account_id uuid, p_provider text, p_actor_id uuid,
  p_operation_id uuid, p_revision bigint, p_result jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_row private.whatsapp_account_lifecycle%rowtype;
  v_account public.whatsapp_accounts%rowtype;
  v_integration public.integrations%rowtype;
  v_success boolean := coalesce((p_result->>'success')::boolean,false);
  v_uncertain boolean := coalesce((p_result->>'uncertain')::boolean,false);
  v_connected boolean := coalesce((p_result->>'connected')::boolean,false);
  v_enabled boolean := false;
  v_status text;
  v_error text := pg_catalog.left(pg_catalog.regexp_replace(coalesce(p_result->>'error_code','account_lifecycle_remote_failed'),'[^a-z0-9_]','','g'),120);
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('whatsapp-lifecycle:' || p_organization_id::text,0));
  perform private.assert_whatsapp_lifecycle_access(p_organization_id,p_account_id,p_provider,p_actor_id,'connect');
  select a.* into strict v_account from public.whatsapp_accounts a where a.id=p_account_id for update;
  select i.* into strict v_integration from public.integrations i where i.id=v_account.integration_id and i.organization_id=p_organization_id for update;
  select l.* into strict v_row from private.whatsapp_account_lifecycle l where l.account_id=p_account_id for update;
  if v_row.operation_action in ('save','create_instance','configure_gateway','provision') then
    perform private.assert_whatsapp_lifecycle_access(p_organization_id,p_account_id,p_provider,p_actor_id,'manage');
  end if;
  if v_row.organization_id<>p_organization_id or v_row.provider<>p_provider or v_row.operation_id is distinct from p_operation_id
    or v_row.operation_revision is distinct from p_revision or v_row.operation_actor_id is distinct from p_actor_id then
    raise exception 'account_lifecycle_operation_mismatch';
  end if;
  if not v_success and v_uncertain then
    update private.whatsapp_account_lifecycle set state='needs_review',error_code=v_error,updated_at=pg_catalog.now() where account_id=p_account_id;
    return pg_catalog.jsonb_build_object('state','needs_review','revision',v_row.revision,'desired_action',v_row.desired_action,'error_code',v_error);
  end if;
  if v_row.revision<>p_revision then
    -- Release only the operation token we own. Never apply an older result.
    update private.whatsapp_account_lifecycle set operation_id=null,operation_revision=null,operation_action=null,
      operation_actor_id=null,operation_started_at=null,error_code=null,
      state=case when desired_action='deactivate' then 'completed' else 'pending' end,updated_at=pg_catalog.now() where account_id=p_account_id;
    return pg_catalog.jsonb_build_object('state','pending','revision',v_row.revision,'desired_action',v_row.desired_action,'error_code','account_lifecycle_superseded');
  end if;
  if v_success then
    if v_row.operation_action='activate' and not v_connected then raise exception 'account_lifecycle_connection_required'; end if;
    if v_row.operation_action='activate' and v_account.account_type='seller' and not exists (
      select 1 from public.organization_members m where m.organization_id=p_organization_id
        and m.user_id=v_account.owner_user_id and m.status='active'
    ) then raise exception 'account_lifecycle_owner_inactive'; end if;
    v_enabled := case when v_row.operation_action='activate' then true
      when v_row.operation_action='refresh_status' then v_connected and v_account.enabled and v_integration.enabled and not v_integration.paused
      else false end;
    v_status := case when v_connected then 'connected'
      when v_row.operation_action in ('connect','reconnect','qr','pair','provision') then 'qr'
      when v_row.operation_action in ('save','create_instance','configure_gateway') then 'configured'
      when p_result->>'connection_status'='qr' then 'qr' else 'disconnected' end;
    update public.integrations set connected=v_connected,enabled=v_enabled,paused=not v_enabled,
      last_tested_at=pg_catalog.now(),last_success_at=case when v_connected then pg_catalog.now() else last_success_at end,
      last_error=null,last_error_at=null,
      status_detail=case when v_enabled then 'Conta habilitada localmente; uso condicionado aos controles administrativos do provedor.'
        when v_connected then 'Sessão conectada; uso local desativado.' else 'Uso local desativado; conexão depende do provedor.' end,
      updated_at=pg_catalog.now() where id=v_account.integration_id and organization_id=p_organization_id;
    if not found then raise exception 'account_lifecycle_integration_missing'; end if;
    if v_enabled and v_row.operation_action='activate' and v_account.account_type='corporate' and p_provider='evolution_go' then
      update public.whatsapp_accounts set is_default=false where organization_id=p_organization_id and account_type='corporate' and id<>p_account_id;
    end if;
    update public.whatsapp_accounts set enabled=v_enabled,connection_status=v_status,
      is_default=case when not v_enabled then false when v_row.operation_action='activate' then account_type='corporate' and p_provider='evolution_go' else is_default end,
      connected_phone_suffix=case when p_result->>'phone_suffix' ~ '^[0-9]{4}$' then p_result->>'phone_suffix' else connected_phone_suffix end,
      connected_at=case when v_connected then coalesce(connected_at,pg_catalog.now()) else null end,
      webhook_registered_at=case when (p_result->>'webhook_registered')::boolean is true then pg_catalog.now() else webhook_registered_at end,
      status_checked_at=pg_catalog.now(),last_error_code=null,updated_at=pg_catalog.now()
      where id=p_account_id and organization_id=p_organization_id;
    if not found then raise exception 'account_lifecycle_account_missing'; end if;
  end if;
  update private.whatsapp_account_lifecycle set operation_id=null,operation_revision=null,operation_action=null,
    operation_actor_id=null,operation_started_at=null,state=case when v_success then 'completed' else 'failed' end,
    error_code=case when v_success then null else v_error end,updated_at=pg_catalog.now() where account_id=p_account_id;
  insert into public.audit_logs(organization_id,actor_id,actor_name,actor_type,action,detail,entity_table,entity_id,event_data)
    values(p_organization_id,p_actor_id,'Usuário','user','whatsapp.account_transition',
      case when v_success then 'Transição local concluída sem alterar controles globais.' else 'Transição falhou; não houve liberação local.' end,
      'whatsapp_accounts',p_account_id,pg_catalog.jsonb_build_object('provider',p_provider,'action',v_row.operation_action,'revision',p_revision,'success',v_success));
  return pg_catalog.jsonb_build_object('state',case when v_success then 'completed' else 'failed' end,
    'revision',v_row.revision,'desired_action',v_row.desired_action,'error_code',case when v_success then null else v_error end);
end;
$$;

create function public.set_whatsapp_account_provider_controls(
  p_organization_id uuid, p_account_id uuid, p_provider text, p_actor_id uuid,
  p_inbound_enabled boolean, p_send_enabled boolean, p_automation_enabled boolean, p_kill_switch boolean
) returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('whatsapp-lifecycle:' || p_organization_id::text,0));
  perform private.assert_whatsapp_lifecycle_access(p_organization_id,p_account_id,p_provider,p_actor_id,'manage');
  if p_inbound_enabled is null or p_send_enabled is null or p_automation_enabled is null or p_kill_switch is null
    or (p_kill_switch and (p_inbound_enabled or p_send_enabled or p_automation_enabled))
    or (p_automation_enabled and not (p_inbound_enabled and p_send_enabled)) then
    raise exception 'provider_controls_invalid';
  end if;
  if not p_kill_switch and (p_inbound_enabled or p_send_enabled or p_automation_enabled) and not exists (
    select 1 from public.whatsapp_accounts a join public.integrations i on i.id=a.integration_id and i.organization_id=a.organization_id
      where a.id=p_account_id and a.organization_id=p_organization_id and a.provider=p_provider and a.archived_at is null
        and a.enabled and a.connection_status='connected' and i.connected and i.enabled and not i.paused
        and not exists(select 1 from private.whatsapp_account_lifecycle l where l.account_id=a.id and (l.operation_id is not null or l.state in ('pending','needs_review')))
  ) then raise exception 'provider_account_not_ready'; end if;
  insert into public.messaging_provider_controls(organization_id,provider,inbound_enabled,send_enabled,automation_enabled,kill_switch,reason,changed_by)
    values(p_organization_id,p_provider,p_inbound_enabled,p_send_enabled,p_automation_enabled,p_kill_switch,'explicit_administrative_policy',p_actor_id)
    on conflict(organization_id,provider) do update set inbound_enabled=excluded.inbound_enabled,send_enabled=excluded.send_enabled,
      automation_enabled=excluded.automation_enabled,kill_switch=excluded.kill_switch,reason=excluded.reason,changed_by=excluded.changed_by,updated_at=pg_catalog.now();
  insert into public.audit_logs(organization_id,actor_id,actor_name,actor_type,action,detail,entity_table,entity_id,event_data)
    values(p_organization_id,p_actor_id,'Usuário','user','whatsapp.provider_policy_changed','Controles do provedor alterados por decisão administrativa explícita.',
      'whatsapp_accounts',p_account_id,pg_catalog.jsonb_build_object('provider',p_provider,'inbound',p_inbound_enabled,'send',p_send_enabled,'automation',p_automation_enabled,'kill_switch',p_kill_switch));
  return pg_catalog.jsonb_build_object('saved',true);
end;
$$;

revoke all on function public.get_whatsapp_account_lifecycle(uuid,uuid,text,uuid),
  public.begin_whatsapp_account_lifecycle(uuid,uuid,text,uuid,text),
  public.check_whatsapp_account_lifecycle(uuid,uuid,text,uuid,uuid,bigint),
  public.finish_whatsapp_account_lifecycle(uuid,uuid,text,uuid,uuid,bigint,jsonb),
  public.set_whatsapp_account_provider_controls(uuid,uuid,text,uuid,boolean,boolean,boolean,boolean)
  from public, anon, authenticated;
grant execute on function public.get_whatsapp_account_lifecycle(uuid,uuid,text,uuid),
  public.begin_whatsapp_account_lifecycle(uuid,uuid,text,uuid,text),
  public.check_whatsapp_account_lifecycle(uuid,uuid,text,uuid,uuid,bigint),
  public.finish_whatsapp_account_lifecycle(uuid,uuid,text,uuid,uuid,bigint,jsonb),
  public.set_whatsapp_account_provider_controls(uuid,uuid,text,uuid,boolean,boolean,boolean,boolean)
  to service_role;
