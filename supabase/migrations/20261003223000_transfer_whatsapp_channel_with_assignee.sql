begin;

-- A conversa muda de número somente em uma transferência humana explícita.
-- O vínculo histórico permite reconhecer respostas tardias recebidas no número
-- anterior sem voltar silenciosamente o canal ativo do lead.
create table if not exists public.lead_whatsapp_account_bindings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  whatsapp_account_id uuid not null references public.whatsapp_accounts(id) on delete restrict,
  handoff_id uuid references public.lead_handoffs(id) on delete set null,
  bound_by uuid references auth.users(id) on delete set null,
  reason text not null default 'initial_binding',
  bound_at timestamptz not null default now(),
  unbound_at timestamptz,
  created_at timestamptz not null default now(),
  constraint lead_whatsapp_account_bindings_window_check
    check (unbound_at is null or unbound_at >= bound_at)
);

create unique index if not exists lead_whatsapp_account_bindings_active_uidx
  on public.lead_whatsapp_account_bindings (organization_id, lead_id)
  where unbound_at is null;

create index if not exists lead_whatsapp_account_bindings_history_idx
  on public.lead_whatsapp_account_bindings
  (organization_id, whatsapp_account_id, lead_id, bound_at desc);

alter table public.lead_whatsapp_account_bindings enable row level security;
revoke all on table public.lead_whatsapp_account_bindings from public, anon, authenticated;
grant all on table public.lead_whatsapp_account_bindings to service_role;

insert into public.lead_whatsapp_account_bindings (
  organization_id, lead_id, whatsapp_account_id, reason, bound_at
)
select l.organization_id, l.id, l.whatsapp_account_id, 'migration_current_account',
       coalesce(l.updated_at, l.created_at, now())
  from public.leads as l
 where l.whatsapp_account_id is not null
   and l.archived_at is null
   and not exists (
     select 1
       from public.lead_whatsapp_account_bindings as binding
      where binding.organization_id = l.organization_id
        and binding.lead_id = l.id
        and binding.unbound_at is null
   );

create or replace function public.resolve_whatsapp_lead_for_account(
  p_organization_id uuid,
  p_account_id uuid,
  p_phone text
)
returns table (lead_id uuid, reason text)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_identity text;
  v_lead_id uuid;
  v_count integer;
begin
  if not exists (
    select 1
      from public.whatsapp_accounts as account
     where account.id = p_account_id
       and account.organization_id = p_organization_id
       and account.archived_at is null
  ) then
    return query select null::uuid, 'account_not_found'::text;
    return;
  end if;

  v_identity := public.normalize_phone_identity(p_phone);
  if v_identity is null then
    return query select null::uuid, 'invalid_phone'::text;
    return;
  end if;

  -- O canal atualmente fixado sempre vence.
  select count(*)::int, (array_agg(l.id order by l.id))[1]
    into v_count, v_lead_id
    from public.leads as l
   where l.organization_id = p_organization_id
     and l.whatsapp_account_id = p_account_id
     and (l.whatsapp_identity = v_identity or l.phone_identity = v_identity);

  if v_count = 1 then
    return query select v_lead_id, 'account_identity'::text;
    return;
  elsif v_count > 1 then
    select count(*)::int, (array_agg(l.id order by l.id))[1]
      into v_count, v_lead_id
      from public.leads as l
     where l.organization_id = p_organization_id
       and l.whatsapp_account_id = p_account_id
       and (l.whatsapp_identity = v_identity or l.phone_identity = v_identity)
       and l.modo_atendimento = 'ia'
       and l.ai_paused = false
       and l.opt_out = false;
    if v_count = 1 then
      return query select v_lead_id, 'account_active_ai_conversation'::text;
      return;
    end if;
    return query select null::uuid, 'ambiguous_identity'::text;
    return;
  end if;

  -- Resposta tardia no número anterior: vincula a mensagem ao mesmo lead, mas
  -- não altera leads.whatsapp_account_id. O próximo envio continua no número
  -- do atendente que recebeu a transferência.
  select count(distinct l.id)::int, (array_agg(distinct l.id))[1]
    into v_count, v_lead_id
    from public.lead_whatsapp_account_bindings as binding
    join public.leads as l
      on l.id = binding.lead_id
     and l.organization_id = binding.organization_id
   where binding.organization_id = p_organization_id
     and binding.whatsapp_account_id = p_account_id
     and binding.unbound_at is not null
     and l.whatsapp_account_id is distinct from p_account_id
     and (l.whatsapp_identity = v_identity or l.phone_identity = v_identity);

  if v_count = 1 then
    return query select v_lead_id, 'account_history_identity'::text;
    return;
  elsif v_count > 1 then
    return query select null::uuid, 'ambiguous_identity'::text;
    return;
  end if;

  select count(*)::int, (array_agg(l.id order by l.id))[1]
    into v_count, v_lead_id
    from public.leads as l
   where l.organization_id = p_organization_id
     and l.whatsapp_account_id is null
     and (l.whatsapp_identity = v_identity or l.phone_identity = v_identity);

  if v_count > 1 then
    select count(*)::int, (array_agg(l.id order by l.id))[1]
      into v_count, v_lead_id
      from public.leads as l
     where l.organization_id = p_organization_id
       and l.whatsapp_account_id is null
       and (l.whatsapp_identity = v_identity or l.phone_identity = v_identity)
       and l.modo_atendimento = 'ia'
       and l.ai_paused = false
       and l.opt_out = false;
  end if;

  if v_count = 1 then
    update public.leads as l
       set whatsapp_account_id = p_account_id,
           updated_at = now()
     where l.id = v_lead_id
       and l.organization_id = p_organization_id
       and l.whatsapp_account_id is null;

    insert into public.lead_whatsapp_account_bindings (
      organization_id, lead_id, whatsapp_account_id, reason
    )
    select p_organization_id, v_lead_id, p_account_id, 'inbound_first_binding'
     where not exists (
       select 1
         from public.lead_whatsapp_account_bindings as binding
        where binding.organization_id = p_organization_id
          and binding.lead_id = v_lead_id
          and binding.unbound_at is null
     );

    return query select v_lead_id, 'account_bound'::text;
    return;
  elsif v_count > 1 then
    return query select null::uuid, 'ambiguous_identity'::text;
    return;
  end if;

  if exists (
    select 1
      from public.leads as l
     where l.organization_id = p_organization_id
       and (l.whatsapp_identity = v_identity or l.phone_identity = v_identity)
       and l.whatsapp_account_id is distinct from p_account_id
  ) then
    return query select null::uuid, 'account_mismatch'::text;
    return;
  end if;

  return query select null::uuid, 'not_found'::text;
end;
$function$;

revoke all on function public.resolve_whatsapp_lead_for_account(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.resolve_whatsapp_lead_for_account(uuid, uuid, text)
  to service_role;

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
     where account.id = v_lead.whatsapp_account_id
       and account.organization_id = p_organization_id
       and account.archived_at is null;
    if not found then raise exception 'whatsapp_account_unavailable'; end if;
  else
    select account.* into v_account
      from public.whatsapp_accounts as account
     where account.organization_id = p_organization_id
       and account.archived_at is null
       and account.enabled
       and account.account_type = 'seller'
       and account.owner_user_id is not null
       and account.owner_user_id in (v_lead.assigned_to, v_lead.owner_id)
     order by
       case when account.owner_user_id = v_lead.assigned_to then 0 else 1 end,
       case when account.connection_status = 'connected' then 0 else 1 end,
       account.updated_at desc
     limit 1;

    if not found then
      select account.* into v_account
        from public.whatsapp_accounts as account
       where account.organization_id = p_organization_id
         and account.archived_at is null
         and account.enabled
         and account.is_default
       limit 1;
    end if;
    if not found then raise exception 'whatsapp_account_not_configured'; end if;

    update public.leads as lead
       set whatsapp_account_id = v_account.id,
           updated_at = now()
     where lead.id = p_lead_id
       and lead.organization_id = p_organization_id;
  end if;

  if v_account.enabled is not true then raise exception 'whatsapp_account_disabled'; end if;
  if exists (
    select 1
      from public.messaging_provider_controls as control
     where control.organization_id = p_organization_id
       and control.provider = v_account.provider
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
  select p_organization_id, p_lead_id, v_account.id, 'outbound_account_binding'
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
           and not control.kill_switch,
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
           else null
         end as unavailable_reason
    from public.organization_members as member
    join public.profiles as profile on profile.id = member.user_id
    left join lateral (
      select candidate.*
        from public.whatsapp_accounts as candidate
       where candidate.organization_id = member.organization_id
         and candidate.owner_user_id = member.user_id
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
     and control.provider = account.provider
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
   where account.organization_id = v_organization_id
     and account.owner_user_id = v_target_user_id
     and account.account_type = 'seller'
     and account.archived_at is null
   order by account.updated_at desc
   limit 1
   for update;
  if not found then raise exception 'handoff_target_whatsapp_account_required'; end if;
  if not v_target_account.enabled or v_target_account.connection_status <> 'connected' then
    raise exception 'handoff_target_whatsapp_account_not_ready';
  end if;
  if not exists (
    select 1
      from public.integrations as integration
     where integration.id = v_target_account.integration_id
       and integration.organization_id = v_organization_id
       and integration.enabled
       and integration.connected
       and not integration.paused
  ) then
    raise exception 'handoff_target_whatsapp_integration_not_ready';
  end if;
  if not exists (
    select 1
      from public.messaging_provider_controls as control
     where control.organization_id = v_organization_id
       and control.provider = v_target_account.provider
       and control.send_enabled
       and not control.kill_switch
  ) then
    raise exception 'handoff_target_whatsapp_provider_not_ready';
  end if;

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
