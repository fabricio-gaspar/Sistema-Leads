-- Atomic dashboard control for the already configured Ana operation.
-- The browser never updates operational tables directly. Only the authenticated
-- Edge Function may call this service-role-only function after its own checks.

create or replace function public.set_ana_automatic_operation(
  p_organization_id uuid,
  p_actor_id uuid,
  p_enabled boolean,
  p_next_run_at timestamptz default null
)
returns table (
  enabled boolean,
  mode text,
  schedule_id uuid,
  next_run_at timestamptz,
  cancelled_runs integer
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_schedule public.prospecting_schedules%rowtype;
  v_company public.company_settings%rowtype;
  v_role text;
  v_override boolean;
  v_ready_integrations integer := 0;
  v_cancelled_runs integer := 0;
begin
  if p_organization_id is null or p_actor_id is null then
    raise exception 'organization_context_required';
  end if;

  select member.role
    into v_role
    from public.organization_members member
   where member.organization_id = p_organization_id
     and member.user_id = p_actor_id
     and member.status = 'active'
   limit 1;

  if v_role is null then
    raise exception 'organization_access_denied';
  end if;

  select permission.allowed
    into v_override
    from public.team_member_permissions permission
   where permission.organization_id = p_organization_id
     and permission.user_id = p_actor_id
     and permission.permission = 'configuration.manage'
   limit 1;

  if v_role <> 'administrador' and coalesce(v_override, false) is not true then
    raise exception 'permission_denied';
  end if;

  select schedule.*
    into v_schedule
    from public.prospecting_schedules schedule
   where schedule.organization_id = p_organization_id
   order by schedule.created_at desc
   limit 1
   for update;

  if v_schedule.id is null then
    raise exception 'operation_schedule_missing';
  end if;

  select company.*
    into v_company
    from public.company_settings company
   where company.organization_id = p_organization_id
   for update;

  if v_company.organization_id is null then
    raise exception 'operation_configuration_missing';
  end if;

  if p_enabled then
    if v_schedule.paid_prospecting_approved is not true then
      raise exception 'paid_prospecting_approval_required';
    end if;
    if p_next_run_at is null or p_next_run_at <= now() then
      raise exception 'next_run_not_found';
    end if;
    if v_company.active is not true
      or v_company.sandbox_mode is not false
      or v_company.can_use_ia is not true
      or v_company.ai_actions_enabled is not true then
      raise exception 'automatic_mode_not_ready';
    end if;
    if not exists (
      select 1
        from public.ai_agents agent
       where agent.organization_id = p_organization_id
         and agent.key = 'ana'
         and agent.active_version_id is not null
    ) then
      raise exception 'automatic_mode_not_ready';
    end if;

    select count(*)::integer
      into v_ready_integrations
      from (
        select integration.key
          from public.integrations integration
         where integration.organization_id = p_organization_id
           and integration.key in ('ai', 'apify', 'scheduler', 'whatsapp', 'zapi_webhook')
           and integration.connected is true
           and integration.enabled is true
           and integration.paused is false
         group by integration.key
      ) ready;

    if v_ready_integrations <> 5 then
      raise exception 'automatic_mode_not_ready';
    end if;
    if not exists (
      select 1
        from public.organization_module_data runtime
       where runtime.organization_id = p_organization_id
         and runtime.module_key = 'configuracao_runtime'
         and runtime.data -> 'killSwitchGlobal' = 'false'::jsonb
    ) then
      raise exception 'automatic_mode_not_ready';
    end if;
    if exists (
      select 1
        from public.prospecting_schedule_runs run
       where run.organization_id = p_organization_id
         and run.schedule_id = v_schedule.id
         and run.status in ('queued', 'running', 'awaiting_approval')
    ) then
      raise exception 'operation_run_in_progress';
    end if;
  else
    update public.prospecting_schedule_runs run
       set status = 'cancelled',
           error_code = 'ana_operation_paused_from_dashboard',
           completed_at = now(),
           next_run_at = null,
           locked_at = null,
           locked_by = null
     where run.organization_id = p_organization_id
       and run.schedule_id = v_schedule.id
       and run.status in ('queued', 'awaiting_approval');
    get diagnostics v_cancelled_runs = row_count;
  end if;

  update public.prospecting_schedules schedule
     set active = p_enabled,
         next_run_at = case when p_enabled then p_next_run_at else null end,
         updated_by = p_actor_id,
         updated_at = now()
   where schedule.id = v_schedule.id
     and schedule.organization_id = p_organization_id;

  update public.company_settings company
     set ana_operation_enabled = p_enabled,
         ana_operation_mode = 'automatic',
         updated_at = now()
   where company.organization_id = p_organization_id;

  insert into public.audit_logs (
    organization_id, actor_id, actor_type, action, detail,
    entity_table, entity_id, event_data
  ) values (
    p_organization_id,
    p_actor_id,
    'user',
    case when p_enabled then 'ana.automatic_enabled_from_dashboard' else 'ana.automatic_paused_from_dashboard' end,
    case when p_enabled then 'Operação automática da Ana ativada pela Dashboard.' else 'Operação automática da Ana pausada pela Dashboard.' end,
    'prospecting_schedules',
    v_schedule.id,
    jsonb_build_object('enabled', p_enabled, 'mode', 'automatic', 'cancelled_runs', v_cancelled_runs)
  );

  return query
  select p_enabled, 'automatic'::text, v_schedule.id,
    case when p_enabled then p_next_run_at else null end,
    v_cancelled_runs;
end;
$$;

revoke all on function public.set_ana_automatic_operation(uuid, uuid, boolean, timestamptz)
  from public, anon, authenticated;
grant execute on function public.set_ana_automatic_operation(uuid, uuid, boolean, timestamptz)
  to service_role;
