-- Complete one provider run and its review cache in a single, short transaction.
-- Only the server-side service role may call this function after checking the user.
create or replace function public.finalize_prospecting_run(
  p_run_id uuid,
  p_organization_id uuid,
  p_requested_by uuid,
  p_provider_run_id text,
  p_cache_filters jsonb,
  p_results jsonb,
  p_name text
)
returns table(cache_id uuid, newly_completed boolean)
language plpgsql
set search_path = ''
as $$
declare
  v_run public.prospecting_runs%rowtype;
  v_cache_id uuid;
begin
  select * into v_run
  from public.prospecting_runs
  where id = p_run_id
    and organization_id = p_organization_id
    and requested_by = p_requested_by
  for update;

  if not found then
    raise exception 'prospecting_run_not_found';
  end if;

  if v_run.status = 'completed' then
    if v_run.result_cache_id is null then
      raise exception 'prospecting_results_unavailable';
    end if;
    return query select v_run.result_cache_id, false;
    return;
  end if;

  if v_run.status <> 'running'
     or (v_run.provider_run_id is not null and v_run.provider_run_id <> p_provider_run_id)
     or (v_run.source_key = 'apify' and v_run.provider_run_id is null) then
    raise exception 'prospecting_run_not_pending';
  end if;

  if jsonb_typeof(p_results) is distinct from 'array'
     or jsonb_array_length(p_results) > v_run.requested_quantity then
    raise exception 'prospecting_results_invalid';
  end if;

  insert into public.prospecting_cache (
    organization_id, user_id, filters_hash, filters, results,
    total_found, scored, name, saved, expires_at, source
  ) values (
    v_run.organization_id, v_run.requested_by, v_run.filters_hash,
    coalesce(p_cache_filters, '{}'::jsonb), p_results,
    jsonb_array_length(p_results), true, left(p_name, 200), true,
    now() + interval '30 days', v_run.source_key
  ) returning id into v_cache_id;

  update public.prospecting_runs
  set status = 'completed', provider_run_id = p_provider_run_id,
      result_cache_id = v_cache_id, result_count = jsonb_array_length(p_results),
      completed_at = now(), updated_at = now(), last_error = null
  where id = v_run.id;

  return query select v_cache_id, true;
end;
$$;

revoke all on function public.finalize_prospecting_run(uuid, uuid, uuid, text, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.finalize_prospecting_run(uuid, uuid, uuid, text, jsonb, jsonb, text) to service_role;

create index if not exists prospecting_runs_org_requester_started_idx
  on public.prospecting_runs (organization_id, requested_by, started_at desc)
  where source_key = 'apify';
