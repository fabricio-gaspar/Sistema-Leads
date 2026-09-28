-- Kanban operational portfolio: user-owned saved views plus a single, RLS-bound
-- server read for the board.  No provider, automation or lead mutation is
-- performed by this migration.

-- The pipeline already owns the commercial stages.  This is intentionally a
-- threshold, not a new status: the board can call attention to a lead that is
-- stopped in a stage without changing its stage or creating an automation.
alter table public.pipeline_stages
  add column if not exists alert_after_hours integer not null default 72
  check (alert_after_hours between 1 and 8760);

create table if not exists public.user_saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  module_key text not null check (module_key in ('kanban')),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, module_key, name)
);

create unique index if not exists user_saved_views_one_default_per_module
  on public.user_saved_views (organization_id, user_id, module_key)
  where is_default;

create index if not exists user_saved_views_lookup_idx
  on public.user_saved_views (organization_id, user_id, module_key, updated_at desc);

alter table public.user_saved_views enable row level security;

drop policy if exists user_saved_views_select_own on public.user_saved_views;
create policy user_saved_views_select_own on public.user_saved_views
for select to authenticated
using (
  organization_id = (select public.current_org_id())
  and user_id = (select auth.uid())
  and (select private.is_active_org_member(organization_id, (select auth.uid())))
);

drop policy if exists user_saved_views_insert_own on public.user_saved_views;
create policy user_saved_views_insert_own on public.user_saved_views
for insert to authenticated
with check (
  organization_id = (select public.current_org_id())
  and user_id = (select auth.uid())
  and (select private.is_active_org_member(organization_id, (select auth.uid())))
);

drop policy if exists user_saved_views_update_own on public.user_saved_views;
create policy user_saved_views_update_own on public.user_saved_views
for update to authenticated
using (
  organization_id = (select public.current_org_id())
  and user_id = (select auth.uid())
)
with check (
  organization_id = (select public.current_org_id())
  and user_id = (select auth.uid())
  and (select private.is_active_org_member(organization_id, (select auth.uid())))
);

drop policy if exists user_saved_views_delete_own on public.user_saved_views;
create policy user_saved_views_delete_own on public.user_saved_views
for delete to authenticated
using (
  organization_id = (select public.current_org_id())
  and user_id = (select auth.uid())
);

revoke all on public.user_saved_views from anon;
grant select, insert, update, delete on public.user_saved_views to authenticated;
grant all on public.user_saved_views to service_role;

create or replace function public.get_kanban_portfolio(
  p_filters jsonb default '{}'::jsonb,
  p_offset integer default 0,
  p_limit integer default 200
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  with parameters as (
    select
      lower(btrim(coalesce(p_filters ->> 'query', ''))) as search_query,
      regexp_replace(coalesce(p_filters ->> 'query', ''), '\D', '', 'g') as search_phone,
      nullif(p_filters ->> 'owner_id', '') as owner_id,
      nullif(p_filters ->> 'segment', '') as segment,
      nullif(p_filters ->> 'city', '') as city,
      nullif(upper(p_filters ->> 'uf'), '') as uf,
      nullif(p_filters ->> 'origin', '') as origin,
      nullif(p_filters ->> 'list_id', '') as list_id,
      case when coalesce(p_filters ->> 'score_min', '') ~ '^\\d{1,3}$' then least(100, greatest(0, (p_filters ->> 'score_min')::integer)) end as score_min,
      case when coalesce(p_filters ->> 'score_max', '') ~ '^\\d{1,3}$' then least(100, greatest(0, (p_filters ->> 'score_max')::integer)) end as score_max,
      nullif(p_filters ->> 'contact', '') as contact,
      nullif(p_filters ->> 'next_action', '') as next_action,
      case when coalesce(p_filters ->> 'inactive_days', '') ~ '^\\d{1,3}$' then (p_filters ->> 'inactive_days')::integer end as inactive_days,
      case when coalesce(p_filters ->> 'stage_days', '') ~ '^\\d{1,4}$' then (p_filters ->> 'stage_days')::integer end as stage_days,
      nullif(p_filters ->> 'entered_from', '')::date as entered_from,
      nullif(p_filters ->> 'entered_to', '')::date as entered_to,
      nullif(p_filters ->> 'contact_approval', '') as contact_approval,
      case when p_filters ->> 'quick' in ('mine', 'overdue', 'without_contact', 'without_action', 'high_fit') then p_filters ->> 'quick' else '' end as quick_filter,
      coalesce((p_filters ->> 'duplicates')::boolean, false) as duplicates_only,
      coalesce((p_filters ->> 'show_closed')::boolean, false) as show_closed,
      case when p_filters ->> 'sort' in ('next_action', 'fit', 'stage_age', 'updated', 'company') then p_filters ->> 'sort' else 'next_action' end as sort_key,
      greatest(0, coalesce(p_offset, 0)) as page_offset,
      least(200, greatest(1, coalesce(p_limit, 200))) as page_limit
  ),
  prepared as (
    select
      lead.*,
      private.canonical_lead_stage_key(lead.ana_stage, lead.ana_outcome) as stage_key,
      next_task.id as next_task_id,
      next_task.text as next_task_text,
      next_task.due_at as next_task_due_at,
      next_task.owner_label as next_task_owner_label,
      qualification.next_action as qualification_next_action,
      qualification.next_action_due_at as qualification_next_action_due_at,
      list_source.id as list_id,
      list_source.name as list_name,
      stage_event.created_at as stage_entered_at,
      pipeline_stage.alert_after_hours as stage_alert_after_hours,
      duplicate_match.exists as duplicate_suspected
    from public.leads lead
    left join lateral (
      select task.id, task.text, task.due_at, task.owner_label
      from public.lead_tasks task
      where task.organization_id = lead.organization_id
        and task.lead_id = lead.id
        and task.completed = false
      order by task.due_at asc nulls last, task.created_at asc
      limit 1
    ) next_task on true
    left join lateral (
      select qualification_row.next_action, qualification_row.next_action_due_at
      from public.lead_qualifications qualification_row
      where qualification_row.organization_id = lead.organization_id
        and qualification_row.lead_id = lead.id
      order by qualification_row.updated_at desc
      limit 1
    ) qualification on true
    left join lateral (
      select list_row.id, list_row.name
      from public.lead_list_members member
      join public.lead_lists list_row on list_row.id = member.list_id
        and list_row.organization_id = member.organization_id
      where member.organization_id = lead.organization_id
        and member.lead_id = lead.id
      order by member.created_at desc
      limit 1
    ) list_source on true
    left join lateral (
      select history.created_at
      from public.lead_stage_history history
      where history.organization_id = lead.organization_id
        and history.lead_id = lead.id
        and history.to_stage = private.canonical_lead_stage_key(lead.ana_stage, lead.ana_outcome)
      order by history.created_at desc
      limit 1
    ) stage_event on true
    left join public.pipeline_stages pipeline_stage
      on pipeline_stage.id = lead.pipeline_stage_id
    left join lateral (
      select exists (
        select 1
        from public.leads other
        where other.organization_id = lead.organization_id
          and other.id <> lead.id
          and other.archived_at is null
          and (
            (nullif(lower(btrim(lead.email)), '') is not null and lower(btrim(other.email)) = lower(btrim(lead.email)))
            or (nullif(regexp_replace(coalesce(lead.phone, '') || coalesce(lead.whatsapp, ''), '\D', '', 'g'), '') is not null
              and regexp_replace(coalesce(other.phone, '') || coalesce(other.whatsapp, ''), '\D', '', 'g') = regexp_replace(coalesce(lead.phone, '') || coalesce(lead.whatsapp, ''), '\D', '', 'g'))
            or (nullif(lower(split_part(regexp_replace(coalesce(lead.source_url, ''), '^https?://', '', 'i'), '/', 1)), '') is not null
              and lower(split_part(regexp_replace(coalesce(other.source_url, ''), '^https?://', '', 'i'), '/', 1)) = lower(split_part(regexp_replace(coalesce(lead.source_url, ''), '^https?://', '', 'i'), '/', 1)))
            or (nullif(lead.source_record_id, '') is not null and other.source_record_id = lead.source_record_id)
            or (nullif(lower(btrim(lead.company)), '') is not null
              and lower(btrim(other.company)) = lower(btrim(lead.company))
              and nullif(lower(btrim(other.city)), '') = nullif(lower(btrim(lead.city)), '')
              and nullif(upper(btrim(other.uf)), '') = nullif(upper(btrim(lead.uf)), ''))
          )
      ) as exists
    ) duplicate_match on true
  ),
  base_filtered as (
    select
      prepared.*,
      coalesce(next_task_due_at, next_action_at, qualification_next_action_due_at) as effective_next_action_at,
      coalesce(next_task_text, qualification_next_action) as effective_next_action_text,
      coalesce(stage_entered_at, case when stage_key = 'novo' then created_at end) as effective_stage_entered_at
    from prepared
    cross join parameters p
    where prepared.organization_id = (select public.current_org_id())
      and prepared.archived_at is null
      and prepared.modo_atendimento is not null
      and coalesce(prepared.owner_id, prepared.assigned_to) is not null
      and (p.show_closed or prepared.stage_key <> 'perdido')
      and (p.owner_id is null or prepared.owner_id::text = p.owner_id or prepared.assigned_to::text = p.owner_id)
      and (p.segment is null or lower(prepared.segment) = lower(p.segment))
      and (p.city is null or lower(prepared.city) = lower(p.city))
      and (p.uf is null or upper(prepared.uf) = p.uf)
      and (p.origin is null or lower(prepared.origin) = lower(p.origin))
      and (p.list_id is null or prepared.list_id::text = p.list_id)
      and (p.score_min is null or prepared.score >= p.score_min)
      and (p.score_max is null or prepared.score <= p.score_max)
      and (p.contact is null
        or (p.contact = 'with_phone' and nullif(regexp_replace(coalesce(prepared.phone, '') || coalesce(prepared.whatsapp, ''), '\D', '', 'g'), '') is not null)
        or (p.contact = 'without_phone' and nullif(regexp_replace(coalesce(prepared.phone, '') || coalesce(prepared.whatsapp, ''), '\D', '', 'g'), '') is null)
        or (p.contact = 'whatsapp' and nullif(regexp_replace(coalesce(prepared.whatsapp, ''), '\D', '', 'g'), '') is not null)
        or (p.contact = 'with_email' and nullif(btrim(prepared.email), '') is not null)
        or (p.contact = 'without_email' and nullif(btrim(prepared.email), '') is null)
        or (p.contact = 'without_contact'
          and nullif(regexp_replace(coalesce(prepared.phone, '') || coalesce(prepared.whatsapp, ''), '\D', '', 'g'), '') is null
          and nullif(btrim(prepared.email), '') is null))
      and (p.next_action is null
        or (p.next_action = 'without' and coalesce(next_task_due_at, next_action_at, qualification_next_action_due_at) is null)
        or (p.next_action = 'overdue' and coalesce(next_task_due_at, next_action_at, qualification_next_action_due_at) < now()))
      and (p.inactive_days is null or prepared.last_contact is null or prepared.last_contact < now() - make_interval(days => p.inactive_days))
      and (p.stage_days is null or coalesce(stage_entered_at, case when stage_key = 'novo' then created_at end) <= now() - make_interval(days => p.stage_days))
      and (p.entered_from is null or prepared.created_at::date >= p.entered_from)
      and (p.entered_to is null or prepared.created_at::date <= p.entered_to)
      and (p.contact_approval is null or prepared.contact_approval_status = p.contact_approval)
      and (not p.duplicates_only or duplicate_suspected)
      and (
        p.search_query = ''
        or translate(lower(coalesce(prepared.contact, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') like '%' || translate(p.search_query, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') || '%'
        or translate(lower(coalesce(prepared.company, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') like '%' || translate(p.search_query, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') || '%'
        or translate(lower(coalesce(prepared.city, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') like '%' || translate(p.search_query, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') || '%'
        or lower(coalesce(prepared.uf, '')) = p.search_query
        or lower(coalesce(prepared.source_record_id, '')) = p.search_query
        or lower(coalesce(prepared.email, '')) = p.search_query
        or lower(coalesce(prepared.source_url, '')) like '%' || p.search_query || '%'
        or (length(p.search_phone) >= 7 and regexp_replace(coalesce(prepared.phone, '') || coalesce(prepared.whatsapp, ''), '\D', '', 'g') like '%' || p.search_phone || '%')
      )
  ),
  filtered as (
    select base_filtered.*
      from base_filtered
      cross join parameters p
     where p.quick_filter = ''
        or (p.quick_filter = 'mine' and (base_filtered.owner_id = auth.uid() or base_filtered.assigned_to = auth.uid()))
        or (p.quick_filter = 'overdue' and base_filtered.effective_next_action_at is not null and base_filtered.effective_next_action_at < now())
        or (p.quick_filter = 'without_contact' and nullif(regexp_replace(coalesce(base_filtered.phone, '') || coalesce(base_filtered.whatsapp, ''), '\D', '', 'g'), '') is null and nullif(btrim(base_filtered.email), '') is null)
        or (p.quick_filter = 'without_action' and base_filtered.effective_next_action_at is null)
        or (p.quick_filter = 'high_fit' and base_filtered.score >= 80)
  ),
  numbered as (
    select
      filtered.*,
      count(*) over () as total_count,
      count(*) filter (where stage_key = 'novo') over () as novo_count,
      count(*) filter (where stage_key = 'apresentado') over () as apresentado_count,
      count(*) filter (where stage_key = 'qualificando') over () as qualificando_count,
      count(*) filter (where stage_key = 'reuniao') over () as reuniao_count,
      count(*) filter (where stage_key = 'orcamento') over () as orcamento_count,
      count(*) filter (where stage_key = 'ganho') over () as ganho_count,
      count(*) filter (where stage_key = 'perdido') over () as perdido_count
    from filtered
  ),
  paged as (
    select numbered.*
    from numbered
    cross join parameters p
    order by
      case when p.sort_key = 'next_action' then coalesce(numbered.effective_next_action_at, 'infinity'::timestamptz) end asc,
      case when p.sort_key = 'fit' then numbered.score end desc,
      case when p.sort_key = 'stage_age' then numbered.effective_stage_entered_at end asc,
      case when p.sort_key = 'updated' then numbered.updated_at end desc,
      case when p.sort_key = 'company' then translate(lower(numbered.company), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') end asc,
      numbered.updated_at desc,
      numbered.id
    offset (select page_offset from parameters)
    limit (select page_limit from parameters)
  ),
  summary as (
    select coalesce(max(total_count), 0) as total_count,
      coalesce(max(novo_count), 0) as novo_count,
      coalesce(max(apresentado_count), 0) as apresentado_count,
      coalesce(max(qualificando_count), 0) as qualificando_count,
      coalesce(max(reuniao_count), 0) as reuniao_count,
      coalesce(max(orcamento_count), 0) as orcamento_count,
      coalesce(max(ganho_count), 0) as ganho_count,
      coalesce(max(perdido_count), 0) as perdido_count
    from numbered
  ),
  quick_summary as (
    select
      count(*) filter (where owner_id = auth.uid() or assigned_to = auth.uid()) as mine_count,
      count(*) filter (where effective_next_action_at is not null and effective_next_action_at < now()) as overdue_count,
      count(*) filter (where nullif(regexp_replace(coalesce(phone, '') || coalesce(whatsapp, ''), '\D', '', 'g'), '') is null and nullif(btrim(email), '') is null) as without_contact_count,
      count(*) filter (where effective_next_action_at is null) as without_action_count,
      count(*) filter (where score >= 80) as high_fit_count
    from base_filtered
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(paged)) from paged), '[]'::jsonb),
    'total', (select total_count from summary),
    'stage_counts', jsonb_build_object(
      'novo', (select novo_count from summary),
      'apresentado', (select apresentado_count from summary),
      'qualificando', (select qualificando_count from summary),
      'reuniao', (select reuniao_count from summary),
      'orcamento', (select orcamento_count from summary),
      'ganho', (select ganho_count from summary),
      'perdido', (select perdido_count from summary)
    ),
    'quick_counts', jsonb_build_object(
      'mine', coalesce((select mine_count from quick_summary), 0),
      'overdue', coalesce((select overdue_count from quick_summary), 0),
      'without_contact', coalesce((select without_contact_count from quick_summary), 0),
      'without_action', coalesce((select without_action_count from quick_summary), 0),
      'high_fit', coalesce((select high_fit_count from quick_summary), 0)
    )
  );
$$;

revoke all on function public.get_kanban_portfolio(jsonb, integer, integer) from public, anon;
grant execute on function public.get_kanban_portfolio(jsonb, integer, integer) to authenticated, service_role;

-- A short, human-only undo window gives the board optimistic interaction
-- without opening terminal stages or silently accepting a stale drag.  The
-- lead row and latest history item are locked, the original transition must
-- belong to the current user and the trigger writes a second audit record.
create or replace function public.undo_recent_lead_stage_transition(
  p_lead_id uuid,
  p_expected_stage text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid := public.current_org_id();
  v_lead public.leads%rowtype;
  v_history public.lead_stage_history%rowtype;
  v_current_stage text;
  v_target_pipeline_stage uuid;
begin
  if v_user_id is null or v_organization_id is null then
    raise exception 'authentication_required';
  end if;

  select * into v_lead
    from public.leads
   where id = p_lead_id and organization_id = v_organization_id
   for update;
  if not found then
    raise exception 'lead_not_found_or_forbidden';
  end if;
  if not (
    private.has_org_permission(v_organization_id, v_user_id, 'leads.edit_all')
    or (
      private.has_org_permission(v_organization_id, v_user_id, 'leads.edit_assigned')
      and (v_lead.owner_id = v_user_id or v_lead.assigned_to = v_user_id)
    )
  ) then
    raise exception 'lead_stage_transition_forbidden';
  end if;

  v_current_stage := private.canonical_lead_stage_key(v_lead.ana_stage, v_lead.ana_outcome);
  if v_current_stage <> lower(btrim(coalesce(p_expected_stage, ''))) then
    raise exception 'stage_transition_changed_by_another_actor';
  end if;
  if v_current_stage in ('ganho', 'perdido') then
    raise exception 'terminal_stage_cannot_be_reopened';
  end if;

  select * into v_history
    from public.lead_stage_history
   where organization_id = v_organization_id and lead_id = v_lead.id
   order by created_at desc, id desc
   limit 1
   for update;
  if not found
    or v_history.source <> 'human'
    or v_history.changed_by is distinct from v_user_id
    or v_history.to_stage <> v_current_stage
    or v_history.from_stage is null
    or v_history.from_stage in ('ganho', 'perdido')
    or v_history.created_at < now() - interval '30 seconds' then
    raise exception 'stage_undo_window_expired';
  end if;

  select id into v_target_pipeline_stage
    from public.pipeline_stages
   where organization_id = v_organization_id
     and pipeline_id = v_lead.pipeline_id
     and ana_stage_key = v_history.from_stage
     and active
   limit 1;
  if v_target_pipeline_stage is null then
    raise exception 'canonical_pipeline_stage_not_found';
  end if;

  perform set_config('wayflex.stage_change_source', 'human', true);
  perform set_config('wayflex.stage_change_reason', 'Reversão dentro da janela operacional.', true);

  update public.leads
     set pipeline_stage_id = v_target_pipeline_stage,
         ana_stage = v_history.from_stage,
         ana_outcome = null,
         updated_at = now()
   where id = v_lead.id and organization_id = v_organization_id;

  return jsonb_build_object('lead_id', v_lead.id, 'stage', v_history.from_stage, 'changed', true);
end;
$$;

revoke all on function public.undo_recent_lead_stage_transition(uuid, text) from public, anon;
grant execute on function public.undo_recent_lead_stage_transition(uuid, text) to authenticated, service_role;

create or replace function public.update_kanban_stage_alert_threshold(
  p_stage_id uuid,
  p_alert_after_hours integer
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid := public.current_org_id();
begin
  if v_user_id is null or v_organization_id is null then
    raise exception 'authentication_required';
  end if;
  if not private.has_org_permission(v_organization_id, v_user_id, 'configuration.manage') then
    raise exception 'configuration_forbidden';
  end if;
  if p_alert_after_hours is null or p_alert_after_hours < 1 or p_alert_after_hours > 8760 then
    raise exception 'invalid_stage_alert_threshold';
  end if;
  update public.pipeline_stages
     set alert_after_hours = p_alert_after_hours, updated_at = now()
   where id = p_stage_id and organization_id = v_organization_id;
  if not found then
    raise exception 'pipeline_stage_not_found_or_forbidden';
  end if;
  return jsonb_build_object('stage_id', p_stage_id, 'alert_after_hours', p_alert_after_hours);
end;
$$;

revoke all on function public.update_kanban_stage_alert_threshold(uuid, integer) from public, anon;
grant execute on function public.update_kanban_stage_alert_threshold(uuid, integer) to authenticated, service_role;

create index if not exists leads_kanban_portfolio_idx
  on public.leads (organization_id, archived_at, ana_stage, ana_outcome, updated_at desc);

create index if not exists lead_tasks_kanban_next_action_idx
  on public.lead_tasks (organization_id, lead_id, completed, due_at asc, created_at asc);

create index if not exists lead_stage_history_kanban_entered_idx
  on public.lead_stage_history (organization_id, lead_id, to_stage, created_at desc);
