begin;

-- Historical Z-API/Evolution records remain available to foreign keys and
-- audits, but cannot be selected, rebound, or re-enabled as an active route.
update public.whatsapp_accounts
   set enabled = false,
       is_default = false,
       connection_status = 'disconnected',
       last_error_code = 'provider_retired',
       updated_at = pg_catalog.now()
 where provider in ('zapi', 'evolution_go')
   and archived_at is null;

update public.messaging_provider_controls
   set inbound_enabled = false,
       send_enabled = false,
       automation_enabled = false,
       kill_switch = true,
       reason = 'provider_retired',
       updated_at = pg_catalog.now()
 where provider in ('zapi', 'evolution_go');

update public.integrations
   set enabled = false,
       connected = false,
       paused = true,
       status_detail = 'Canal desativado: WA-AKG é o único transporte WhatsApp ativo.',
       updated_at = pg_catalog.now()
 where key like 'whatsapp_zapi:%'
    or key like 'whatsapp_evolution_go:%'
    or lower(coalesce(provider, '')) in ('z-api', 'zapi', 'evolution go', 'evolution_go');

-- A legacy bound lead must be released and rebound through the WA-AKG route;
-- it must never make an old provider an implicit outbound fallback.
create or replace function public.resolve_lead_whatsapp_account(
  p_organization_id uuid,
  p_lead_id uuid
)
returns table (
  account_id uuid,
  integration_id uuid,
  owner_user_id uuid,
  is_default boolean,
  connection_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_lead public.leads%rowtype;
  v_account public.whatsapp_accounts%rowtype;
  v_legacy_account_id uuid;
  v_legacy_bound boolean := false;
begin
  select lead.* into v_lead
    from public.leads as lead
   where lead.id = p_lead_id
     and lead.organization_id = p_organization_id
   for update;
  if not found then raise exception 'lead_not_found'; end if;

  if v_lead.whatsapp_account_id is not null then
    select account.* into v_account
      from public.whatsapp_accounts as account
      join public.integrations as integration
        on integration.id = account.integration_id
       and integration.organization_id = account.organization_id
      join public.messaging_provider_controls as control
        on control.organization_id = account.organization_id
       and control.provider = 'wa_akg'
     where account.id = v_lead.whatsapp_account_id
       and account.organization_id = p_organization_id
       and account.provider = 'wa_akg'
       and account.enabled
       and account.connection_status = 'connected'
       and account.archived_at is null
       and integration.enabled
       and integration.connected
       and not integration.paused
       and control.send_enabled
       and not control.kill_switch
       and not control.capture_only;

    if not found then
      select account.id into v_legacy_account_id
        from public.whatsapp_accounts as account
       where account.id = v_lead.whatsapp_account_id
         and account.organization_id = p_organization_id
         and account.provider in ('zapi', 'evolution_go')
       for update;
      if not found then raise exception 'whatsapp_account_unavailable'; end if;
      -- Do not clear a live historical binding until an eligible WA-AKG
      -- replacement has been selected below. A failed route lookup is read-only.
      v_legacy_bound := true;
    end if;
  end if;

  if v_lead.whatsapp_account_id is null or v_legacy_bound then
    select account.* into v_account
      from public.whatsapp_accounts as account
      join public.integrations as integration
        on integration.id = account.integration_id
       and integration.organization_id = account.organization_id
      join public.messaging_provider_controls as control
        on control.organization_id = account.organization_id
       and control.provider = 'wa_akg'
     where account.organization_id = p_organization_id
       and account.provider = 'wa_akg'
       and account.archived_at is null
       and account.enabled
       and account.connection_status = 'connected'
       and account.account_type = 'seller'
       and account.owner_user_id is not null
       and account.owner_user_id in (v_lead.assigned_to, v_lead.owner_id)
       and integration.enabled
       and integration.connected
       and not integration.paused
       and control.send_enabled
       and not control.kill_switch
       and not control.capture_only
     order by
       case when account.owner_user_id = v_lead.assigned_to then 0 else 1 end,
       case when account.connection_status = 'connected' then 0 else 1 end,
       account.updated_at desc
     limit 1;

    if not found then
      select account.* into v_account
        from public.whatsapp_accounts as account
        join public.integrations as integration
          on integration.id = account.integration_id
         and integration.organization_id = account.organization_id
        join public.messaging_provider_controls as control
          on control.organization_id = account.organization_id
         and control.provider = 'wa_akg'
       where account.organization_id = p_organization_id
         and account.provider = 'wa_akg'
         and account.archived_at is null
         and account.enabled
         and account.connection_status = 'connected'
         and account.is_default
         and integration.enabled
         and integration.connected
         and not integration.paused
         and control.send_enabled
         and not control.kill_switch
         and not control.capture_only
       limit 1;
    end if;
    if not found then raise exception 'whatsapp_account_not_configured'; end if;

    if v_legacy_bound then
      update public.lead_whatsapp_account_bindings as binding
         set unbound_at = pg_catalog.now()
       where binding.organization_id = p_organization_id
         and binding.lead_id = p_lead_id
         and binding.whatsapp_account_id = v_legacy_account_id
         and binding.unbound_at is null;
    end if;

    update public.leads as lead
       set whatsapp_account_id = v_account.id,
           updated_at = pg_catalog.now()
     where lead.id = p_lead_id
       and lead.organization_id = p_organization_id;
  end if;

  if v_account.provider <> 'wa_akg' then raise exception 'legacy_whatsapp_provider_not_routable'; end if;
  if v_account.enabled is not true then raise exception 'whatsapp_account_disabled'; end if;
  if exists (
    select 1
      from public.messaging_provider_controls as control
     where control.organization_id = p_organization_id
       and control.provider = 'wa_akg'
       and (control.kill_switch or not control.send_enabled)
  ) then
    raise exception 'whatsapp_provider_disabled';
  end if;

  if exists (
    select 1
      from public.lead_whatsapp_account_bindings as binding
     where binding.organization_id = p_organization_id
       and binding.lead_id = p_lead_id
       and binding.unbound_at is null
       and binding.whatsapp_account_id is distinct from v_account.id
  ) then
    raise exception 'whatsapp_account_binding_mismatch';
  end if;

  insert into public.lead_whatsapp_account_bindings (
    organization_id, lead_id, whatsapp_account_id, reason
  )
  select p_organization_id, p_lead_id, v_account.id,
         case when v_legacy_bound then 'wa_akg_migration_reroute'
              else 'outbound_account_binding' end
   where not exists (
     select 1
       from public.lead_whatsapp_account_bindings as binding
      where binding.organization_id = p_organization_id
        and binding.lead_id = p_lead_id
        and binding.unbound_at is null
   );

  return query
  select v_account.id, v_account.integration_id, v_account.owner_user_id,
         v_account.is_default, v_account.connection_status;
end;
$function$;

revoke all on function public.resolve_lead_whatsapp_account(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_lead_whatsapp_account(uuid, uuid)
  to service_role;

-- Automatic work requires a stronger route contract than a manual reply.  The
-- locked control row makes the automation decision and any legacy rebinding a
-- single database transaction, so a concurrent Ana pause cannot persist a new
-- outbound route before the worker is rejected.
create or replace function public.resolve_lead_automatic_whatsapp_account(
  p_organization_id uuid,
  p_lead_id uuid
)
returns table (
  account_id uuid,
  integration_id uuid,
  owner_user_id uuid,
  is_default boolean,
  connection_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_control public.messaging_provider_controls%rowtype;
begin
  select control.* into v_control
    from public.messaging_provider_controls as control
   where control.organization_id = p_organization_id
     and control.provider = 'wa_akg'
   for update;
  if not found
     or coalesce(v_control.capture_only, false)
     or v_control.kill_switch
     or v_control.send_enabled is not true
     or v_control.automation_enabled is not true then
    raise exception 'wa_akg_automation_not_ready';
  end if;

  return query
  select route.account_id,
         route.integration_id,
         route.owner_user_id,
         route.is_default,
         route.connection_status
    from public.resolve_lead_whatsapp_account(
      p_organization_id,
      p_lead_id
    ) as route;
end;
$function$;

revoke all on function public.resolve_lead_automatic_whatsapp_account(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_lead_automatic_whatsapp_account(uuid, uuid)
  to service_role;

-- This protects all current and future handoff callers, including callers that
-- predate the WA-AKG-only UI. Existing historic bindings are not rewritten.
create or replace function private.enforce_wa_akg_lead_route()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_provider text;
begin
  if new.whatsapp_account_id is null then return new; end if;
  if tg_op = 'UPDATE'
     and new.whatsapp_account_id is not distinct from old.whatsapp_account_id then
    return new;
  end if;

  select account.provider into v_provider
    from public.whatsapp_accounts as account
   where account.id = new.whatsapp_account_id
     and account.organization_id = new.organization_id;
  -- Meta may still bind an inbound coexistence conversation through its own
  -- separately gated path. Only retired providers are forbidden here; every
  -- new outbound resolver and handoff selection above remains WA-AKG-only.
  if v_provider in ('zapi', 'evolution_go') then
    raise exception 'legacy_whatsapp_provider_not_routable' using errcode = '23514';
  end if;
  return new;
end;
$function$;

drop trigger if exists leads_wa_akg_route_guard on public.leads;
create trigger leads_wa_akg_route_guard
before insert or update of whatsapp_account_id on public.leads
for each row execute function private.enforce_wa_akg_lead_route();

create or replace function public.central_list_transfer_targets(p_lead_id uuid)
returns table (
  user_id uuid,
  member_name text,
  member_role text,
  account_id uuid,
  account_label text,
  account_provider text,
  phone_suffix text,
  connection_status text,
  channel_ready boolean,
  unavailable_reason text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_organization_id uuid := public.current_org_id();
  v_user_id uuid := auth.uid();
begin
  if v_organization_id is null or v_user_id is null
     or not private.is_active_org_member(v_organization_id, v_user_id) then
    raise exception 'organization_context_required';
  end if;
  if not exists (
    select 1
      from public.leads as lead
     where lead.id = p_lead_id
       and lead.organization_id = v_organization_id
       and private.can_access_lead(v_organization_id, lead.id, v_user_id)
  ) then
    raise exception 'lead_not_found_or_access_denied';
  end if;

  return query
  select member.user_id,
         coalesce(nullif(btrim(profile.name), ''), 'Usuário') as member_name,
         member.role::text as member_role,
         account.id,
         account.label,
         account.provider,
         account.connected_phone_suffix,
         coalesce(account.connection_status, 'unconfigured') as connection_status,
         coalesce(
           account.id is not null
           and account.enabled
           and account.connection_status = 'connected'
           and integration.enabled
           and integration.connected
           and not integration.paused
           and control.send_enabled
           and not control.kill_switch
           and not coalesce(control.capture_only, false),
           false
         ) as channel_ready,
         case
           when account.id is null then 'seller_channel_required'
           when not account.enabled then 'seller_channel_disabled'
           when account.connection_status <> 'connected' then 'seller_channel_not_connected'
           when integration.id is null or not integration.enabled or not integration.connected or integration.paused
             then 'seller_integration_not_ready'
           when control.organization_id is null or control.kill_switch or not control.send_enabled
             then 'seller_provider_not_ready'
           when coalesce(control.capture_only, false) then 'seller_channel_maintenance'
           else null
         end as unavailable_reason
    from public.organization_members as member
    join public.profiles as profile on profile.id = member.user_id
    left join lateral (
      select candidate.*
        from public.whatsapp_accounts as candidate
       where candidate.organization_id = member.organization_id
         and candidate.owner_user_id = member.user_id
         and candidate.provider = 'wa_akg'
         and candidate.account_type = 'seller'
         and candidate.archived_at is null
       order by candidate.updated_at desc
       limit 1
    ) as account on true
    left join public.integrations as integration
      on integration.id = account.integration_id
     and integration.organization_id = member.organization_id
    left join public.messaging_provider_controls as control
      on control.organization_id = member.organization_id
     and control.provider = 'wa_akg'
   where member.organization_id = v_organization_id
     and member.status = 'active'
     and (
       private.has_org_permission(v_organization_id, member.user_id, 'conversations.reply_all')
       or private.has_org_permission(v_organization_id, member.user_id, 'conversations.reply_assigned')
     )
   order by coalesce(nullif(btrim(profile.name), ''), 'Usuário') asc, member.user_id;
end;
$function$;

revoke all on function public.central_list_transfer_targets(uuid) from public, anon;
grant execute on function public.central_list_transfer_targets(uuid) to authenticated, service_role;

-- Select the operational WA-AKG channel at the database boundary. A user may
-- retain Meta history (or a retired legacy row), but a human handoff must not
-- choose it merely because it was updated more recently than a ready WA-AKG
-- seller account.
create or replace function public.assign_human_handoff(
  p_lead_id uuid,
  p_reason text,
  p_category text default 'operator_takeover',
  p_target_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_organization_id uuid := public.current_org_id();
  v_user_id uuid := auth.uid();
  v_target_user_id uuid := coalesce(p_target_user_id, auth.uid());
  v_target_name text;
  v_actor_name text := 'Usuário';
  v_lead public.leads%rowtype;
  v_target_account public.whatsapp_accounts%rowtype;
  v_handoff_id uuid;
  v_cancelled_jobs integer := 0;
  v_reused boolean := false;
  v_now timestamptz := now();
begin
  if v_user_id is null or v_organization_id is null
     or not private.is_active_org_member(v_organization_id, v_user_id) then
    raise exception 'organization_context_required';
  end if;
  if p_lead_id is null or nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'lead_and_reason_required';
  end if;
  if nullif(btrim(coalesce(p_category, '')), '') not in ('operator_takeover', 'operator_transfer') then
    raise exception 'invalid_handoff_category';
  end if;

  select lead.* into v_lead
    from public.leads as lead
   where lead.id = p_lead_id
     and lead.organization_id = v_organization_id
     and (
       private.has_org_role(v_organization_id, v_user_id, array[
         'administrador'::public.app_role,
         'sdr'::public.app_role,
         'ia'::public.app_role,
         'cx'::public.app_role
       ])
       or lead.owner_id = v_user_id
       or lead.assigned_to = v_user_id
     )
   for update;
  if not found then raise exception 'lead_not_found_or_access_denied'; end if;

  select profile.name into v_target_name
    from public.organization_members as member
    join public.profiles as profile on profile.id = member.user_id
   where member.organization_id = v_organization_id
     and member.user_id = v_target_user_id
     and member.status = 'active'
   limit 1;
  if v_target_name is null then raise exception 'handoff_assignee_inactive'; end if;
  if not private.has_org_permission(v_organization_id, v_target_user_id, 'conversations.reply_all')
     and not private.has_org_permission(v_organization_id, v_target_user_id, 'conversations.reply_assigned') then
    raise exception 'handoff_assignee_cannot_reply';
  end if;

  select account.* into v_target_account
    from public.whatsapp_accounts as account
    join public.integrations as integration
      on integration.id = account.integration_id
     and integration.organization_id = account.organization_id
    join public.messaging_provider_controls as control
      on control.organization_id = account.organization_id
     and control.provider = 'wa_akg'
   where account.organization_id = v_organization_id
     and account.owner_user_id = v_target_user_id
     and account.provider = 'wa_akg'
     and account.account_type = 'seller'
     and account.archived_at is null
     and account.enabled
     and account.connection_status = 'connected'
     and integration.enabled
     and integration.connected
     and not integration.paused
     and control.send_enabled
     and not control.kill_switch
     and not control.capture_only
   order by account.updated_at desc
   limit 1
   for update of account;
  if not found then raise exception 'handoff_target_whatsapp_account_required'; end if;

  select coalesce(nullif(btrim(profile.name), ''), 'Usuário')
    into v_actor_name
    from public.profiles as profile
   where profile.id = v_user_id;

  update public.leads as lead
     set modo_atendimento = 'humano',
         ai_paused = true,
         automation_status = 'human',
         automation_error = null,
         automation_updated_at = v_now,
         no_reply_deadline_at = null,
         assigned_to = v_target_user_id,
         owner_id = v_target_user_id,
         owner = left(coalesce(nullif(btrim(v_target_name), ''), 'Responsável'), 160),
         whatsapp_account_id = v_target_account.id,
         active_channel = 'whatsapp',
         updated_at = v_now
   where lead.id = p_lead_id
     and lead.organization_id = v_organization_id;

  update public.outreach_jobs as job
     set status = 'cancelled', processed_at = v_now, locked_at = null, locked_by = null,
         error = 'cancelled_by_human_handoff'
   where job.organization_id = v_organization_id
     and job.lead_id = p_lead_id
     and job.status in ('queued', 'retry', 'reconciliation_required')
     and job.processed_at is null
     and job.locked_at is null
     and job.locked_by is null
     and lower(coalesce(job.payload ->> 'manual', 'false')) <> 'true'
     and not coalesce(job.payload ? 'provider_message_id', false)
     and not exists (
       select 1
         from public.lead_outreach as outreach
        where outreach.id = job.id
          and outreach.organization_id = job.organization_id
          and (
            outreach.provider_message_id is not null
            or outreach.status in ('sent', 'delivered', 'read', 'replied', 'failed')
          )
     );
  get diagnostics v_cancelled_jobs = row_count;

  select handoff.id into v_handoff_id
    from public.lead_handoffs as handoff
   where handoff.organization_id = v_organization_id
     and handoff.lead_id = p_lead_id
     and handoff.status in ('pending', 'accepted')
   order by handoff.requested_at desc, handoff.created_at desc
   limit 1
   for update;

  if v_handoff_id is null then
    insert into public.lead_handoffs (
      organization_id, lead_id, from_user_id, to_user_id, assigned_to, status,
      requested_at, reason, category, summary, context, updated_at
    ) values (
      v_organization_id, p_lead_id, v_user_id, v_target_user_id, v_target_user_id,
      'pending', v_now, left(btrim(p_reason), 1000), left(p_category, 120),
      left(btrim(p_reason), 1000),
      jsonb_build_object(
        'source', 'central_atendimento',
        'actor_id', v_user_id,
        'cancelled_automatic_jobs', v_cancelled_jobs,
        'previous_whatsapp_account_id', v_lead.whatsapp_account_id,
        'whatsapp_account_id', v_target_account.id
      ),
      v_now
    ) returning id into v_handoff_id;
  else
    v_reused := true;
    update public.lead_handoffs as handoff
       set to_user_id = v_target_user_id,
           assigned_to = v_target_user_id,
           reason = left(btrim(p_reason), 1000),
           category = left(p_category, 120),
           context = coalesce(handoff.context, '{}'::jsonb) || jsonb_build_object(
             'last_request_at', v_now,
             'last_actor_id', v_user_id,
             'cancelled_automatic_jobs', v_cancelled_jobs,
             'previous_whatsapp_account_id', v_lead.whatsapp_account_id,
             'whatsapp_account_id', v_target_account.id
           ),
           updated_at = v_now
     where handoff.id = v_handoff_id
       and handoff.organization_id = v_organization_id;
  end if;

  if v_lead.whatsapp_account_id is distinct from v_target_account.id then
    if v_lead.whatsapp_account_id is not null and not exists (
      select 1
        from public.lead_whatsapp_account_bindings as binding
       where binding.organization_id = v_organization_id
         and binding.lead_id = p_lead_id
         and binding.unbound_at is null
    ) then
      insert into public.lead_whatsapp_account_bindings (
        organization_id, lead_id, whatsapp_account_id, bound_by,
        reason, bound_at
      ) values (
        v_organization_id, p_lead_id, v_lead.whatsapp_account_id, v_user_id,
        'reconstructed_before_handoff', coalesce(v_lead.updated_at, v_now)
      );
    end if;

    update public.lead_whatsapp_account_bindings as binding
       set unbound_at = v_now
     where binding.organization_id = v_organization_id
       and binding.lead_id = p_lead_id
       and binding.unbound_at is null;

    insert into public.lead_whatsapp_account_bindings (
      organization_id, lead_id, whatsapp_account_id, handoff_id,
      bound_by, reason, bound_at
    ) values (
      v_organization_id, p_lead_id, v_target_account.id, v_handoff_id,
      v_user_id, p_category, v_now
    );
  elsif not exists (
    select 1
      from public.lead_whatsapp_account_bindings as binding
     where binding.organization_id = v_organization_id
       and binding.lead_id = p_lead_id
       and binding.unbound_at is null
  ) then
    insert into public.lead_whatsapp_account_bindings (
      organization_id, lead_id, whatsapp_account_id, handoff_id,
      bound_by, reason, bound_at
    ) values (
      v_organization_id, p_lead_id, v_target_account.id, v_handoff_id,
      v_user_id, p_category, v_now
    );
  end if;

  insert into public.audit_logs (
    organization_id, actor_id, actor_name, actor_type, action, detail,
    entity_table, entity_id, event_data
  ) values (
    v_organization_id, v_user_id, coalesce(v_actor_name, 'Usuário'), 'user',
    case when p_category = 'operator_takeover'
      then 'lead.handoff.taken_over'
      else 'lead.handoff.transferred'
    end,
    case when p_category = 'operator_takeover'
      then 'Atendimento assumido com o canal privado do operador.'
      else 'Atendimento e canal de saída transferidos para o responsável selecionado.'
    end,
    'leads', p_lead_id,
    jsonb_build_object(
      'handoff_id', v_handoff_id,
      'target_user_id', v_target_user_id,
      'category', p_category,
      'reused', v_reused,
      'cancelled_automatic_jobs', v_cancelled_jobs,
      'previous_whatsapp_account_id', v_lead.whatsapp_account_id,
      'whatsapp_account_id', v_target_account.id,
      'provider', v_target_account.provider,
      'phone_suffix', v_target_account.connected_phone_suffix
    )
  );

  return v_handoff_id;
end;
$function$;

revoke all on function public.assign_human_handoff(uuid, text, text, uuid)
  from public, anon;
grant execute on function public.assign_human_handoff(uuid, text, text, uuid)
  to authenticated, service_role;

commit;
