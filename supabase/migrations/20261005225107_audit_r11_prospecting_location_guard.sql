-- Local remediation only. No data backfill, execution, or automatic activation.
create or replace function private.ana_prospecting_filters_issue(p_filters jsonb)
returns text language plpgsql immutable set search_path = '' as $$
declare v_terms jsonb;
begin
  if jsonb_typeof(p_filters -> 'cidade') is distinct from 'string'
     or length(btrim(p_filters ->> 'cidade')) not between 2 and 120 then
    return 'operation_city_required';
  end if;
  if jsonb_typeof(p_filters -> 'estados') is distinct from 'array' then
    return 'operation_single_state_required';
  end if;
  if jsonb_array_length(p_filters -> 'estados') <> 1
     or not coalesce((p_filters -> 'estados' ->> 0) = any(array[
       'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
     ]), false) then
    return 'operation_single_state_required';
  end if;
  v_terms := (case when jsonb_typeof(p_filters -> 'atividades') = 'array' then p_filters -> 'atividades' else '[]'::jsonb end)
          || (case when jsonb_typeof(p_filters -> 'segmentos') = 'array' then p_filters -> 'segmentos' else '[]'::jsonb end);
  if not exists(select 1 from jsonb_array_elements(v_terms) term
    where jsonb_typeof(term) = 'string' and length(btrim(term #>> '{}')) between 2 and 120) then
    return 'operation_search_terms_required';
  end if;
  return null;
end;
$$;
revoke all on function private.ana_prospecting_filters_issue(jsonb) from public, anon, authenticated;

create or replace function private.guard_ana_schedule_location()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_issue text;
begin
  if new.active then
    v_issue := private.ana_prospecting_filters_issue(new.filters);
    if v_issue is not null then raise exception using errcode = '23514', message = v_issue; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_ana_schedule_location() from public, anon, authenticated;
drop trigger if exists ana_schedule_location_guard on public.prospecting_schedules;
create trigger ana_schedule_location_guard before insert or update on public.prospecting_schedules
  for each row execute function private.guard_ana_schedule_location();

create or replace function private.guard_ana_run_location()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_filters jsonb; v_issue text;
begin
  if new.operation_mode <> 'simulation' and new.status in ('awaiting_approval','queued','running') then
    -- Approval of an older run must check that run's parent, not the most recent routine.
    select schedule.filters into v_filters from public.prospecting_schedules schedule
      where schedule.id = new.schedule_id and schedule.organization_id = new.organization_id for share;
    if not found then raise exception using errcode = '23514', message = 'operation_schedule_missing'; end if;
    v_issue := private.ana_prospecting_filters_issue(v_filters);
    if v_issue is not null then raise exception using errcode = '23514', message = v_issue; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_ana_run_location() from public, anon, authenticated;
drop trigger if exists ana_run_location_guard on public.prospecting_schedule_runs;
create trigger ana_run_location_guard before insert or update on public.prospecting_schedule_runs
  for each row execute function private.guard_ana_run_location();
