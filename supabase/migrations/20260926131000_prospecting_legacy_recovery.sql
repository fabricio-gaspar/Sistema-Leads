-- Fecha a janela de rollout da proteção idempotente sem atribuir um escopo
-- inventado a execuções antigas. Uma execução ativa legada só pode ser
-- reutilizada pelo mesmo solicitante, nunca reiniciada automaticamente.
drop index if exists public.prospecting_runs_active_equivalent_uq;
create unique index prospecting_runs_active_equivalent_uq
  on public.prospecting_runs (
    organization_id, source_config_id, source_key, mode, execution_scope_key, filters_hash
  )
  where status = 'running' and execution_scope_key is not null;

create index if not exists prospecting_runs_legacy_active_lookup_idx
  on public.prospecting_runs (
    organization_id, source_key, filters_hash, requested_by, started_at desc
  )
  where status = 'running' and execution_scope_key is null;

create or replace function public.reserve_prospecting_run(
  p_organization_id uuid,
  p_source_config_id uuid,
  p_source_key text,
  p_mode text,
  p_filters jsonb,
  p_filters_hash text,
  p_requested_quantity integer,
  p_requested_by uuid,
  p_idempotency_key text,
  p_execution_scope_key text
)
returns table(
  run_id uuid,
  run_status text,
  provider_run_id text,
  result_cache_id uuid,
  provider_start_state text,
  reused boolean,
  start_claimed boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run public.prospecting_runs%rowtype;
  v_now timestamptz := now();
begin
  if p_organization_id is null
    or p_source_config_id is null
    or p_requested_by is null
    or nullif(btrim(p_source_key), '') is null
    or nullif(btrim(p_mode), '') is null
    or jsonb_typeof(p_filters) is distinct from 'object'
    or nullif(btrim(p_filters_hash), '') is null
    or p_requested_quantity is null or p_requested_quantity < 1 or p_requested_quantity > 100
    or nullif(btrim(p_idempotency_key), '') is null or length(p_idempotency_key) > 200
    or nullif(btrim(p_execution_scope_key), '') is null or length(p_execution_scope_key) > 200
  then
    raise exception 'prospecting_run_reservation_invalid' using errcode = '22023';
  end if;

  select * into v_run
  from public.prospecting_runs
  where organization_id = p_organization_id
    and idempotency_key = btrim(p_idempotency_key)
  for update;

  if found then
    if v_run.source_config_id is distinct from p_source_config_id
      or v_run.source_key is distinct from btrim(p_source_key)
      or v_run.mode is distinct from btrim(p_mode)
      or v_run.filters_hash is distinct from btrim(p_filters_hash)
      or v_run.execution_scope_key is distinct from btrim(p_execution_scope_key)
      or v_run.requested_by is distinct from p_requested_by
    then
      raise exception 'prospecting_idempotency_conflict' using errcode = '23505';
    end if;
    return query select v_run.id, v_run.status, v_run.provider_run_id, v_run.result_cache_id,
      v_run.provider_start_state, true, false;
    return;
  end if;

  select * into v_run
  from public.prospecting_runs
  where organization_id = p_organization_id
    and source_config_id = p_source_config_id
    and source_key = btrim(p_source_key)
    and mode = btrim(p_mode)
    and execution_scope_key = btrim(p_execution_scope_key)
    and filters_hash = btrim(p_filters_hash)
    and status = 'running'
  for update;

  if found then
    return query select v_run.id, v_run.status, v_run.provider_run_id, v_run.result_cache_id,
      v_run.provider_start_state, true, false;
    return;
  end if;

  -- A origem do escopo antigo não é comprovável. Reusar a execução do mesmo
  -- solicitante é mais seguro que iniciar outro POST ao provedor.
  select * into v_run
  from public.prospecting_runs
  where organization_id = p_organization_id
    and source_key = btrim(p_source_key)
    and filters_hash = btrim(p_filters_hash)
    and requested_by = p_requested_by
    and execution_scope_key is null
    and status = 'running'
  order by started_at desc nulls last, id desc
  limit 1
  for update;

  if found then
    return query select v_run.id, v_run.status, v_run.provider_run_id, v_run.result_cache_id,
      v_run.provider_start_state, true, false;
    return;
  end if;

  begin
    insert into public.prospecting_runs (
      organization_id, source_config_id, source_key, mode, status, filters, filters_hash,
      requested_quantity, estimated_records, quote_expires_at, requested_by, cost_known,
      requires_confirmation, estimate_basis, started_at, idempotency_key,
      execution_scope_key, provider_start_state, provider_start_attempted_at
    ) values (
      p_organization_id, p_source_config_id, btrim(p_source_key), btrim(p_mode), 'running',
      p_filters, btrim(p_filters_hash), p_requested_quantity, p_requested_quantity, v_now,
      p_requested_by, false, false, 'provider_actual', v_now, btrim(p_idempotency_key),
      btrim(p_execution_scope_key), 'attempting', v_now
    ) returning * into v_run;
  exception when unique_violation then
    select * into v_run
    from public.prospecting_runs
    where organization_id = p_organization_id
      and idempotency_key = btrim(p_idempotency_key)
    for update;
    if not found then
      select * into v_run
      from public.prospecting_runs
      where organization_id = p_organization_id
        and source_config_id = p_source_config_id
        and source_key = btrim(p_source_key)
        and mode = btrim(p_mode)
        and execution_scope_key = btrim(p_execution_scope_key)
        and filters_hash = btrim(p_filters_hash)
        and status = 'running'
      for update;
    end if;
    if not found then
      select * into v_run
      from public.prospecting_runs
      where organization_id = p_organization_id
        and source_key = btrim(p_source_key)
        and filters_hash = btrim(p_filters_hash)
        and requested_by = p_requested_by
        and execution_scope_key is null
        and status = 'running'
      order by started_at desc nulls last, id desc
      limit 1
      for update;
    end if;
    if not found then
      raise;
    end if;
    if v_run.idempotency_key = btrim(p_idempotency_key)
      and (v_run.source_config_id is distinct from p_source_config_id
        or v_run.source_key is distinct from btrim(p_source_key)
        or v_run.mode is distinct from btrim(p_mode)
        or v_run.filters_hash is distinct from btrim(p_filters_hash)
        or v_run.execution_scope_key is distinct from btrim(p_execution_scope_key)
        or v_run.requested_by is distinct from p_requested_by)
    then
      raise exception 'prospecting_idempotency_conflict' using errcode = '23505';
    end if;
    return query select v_run.id, v_run.status, v_run.provider_run_id, v_run.result_cache_id,
      v_run.provider_start_state, true, false;
    return;
  end;

  return query select v_run.id, v_run.status, v_run.provider_run_id, v_run.result_cache_id,
    v_run.provider_start_state, false, true;
end;
$$;

revoke all on function public.reserve_prospecting_run(uuid, uuid, text, text, jsonb, text, integer, uuid, text, text) from public, anon, authenticated;
grant execute on function public.reserve_prospecting_run(uuid, uuid, text, text, jsonb, text, integer, uuid, text, text) to service_role;

-- Uma finalização só pode preservar um identificador de execução Apify que foi
-- realmente informado. `<> NULL` não protege essa fronteira em SQL.
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
  v_provider_run_id text := nullif(btrim(coalesce(p_provider_run_id, '')), '');
begin
  select * into v_run
  from public.prospecting_runs
  where id = p_run_id
    and organization_id = p_organization_id
    and requested_by = p_requested_by
  for update;

  if not found then raise exception 'prospecting_run_not_found'; end if;
  if v_run.status = 'completed' then
    if v_run.result_cache_id is null then raise exception 'prospecting_results_unavailable'; end if;
    return query select v_run.result_cache_id, false;
    return;
  end if;

  if v_provider_run_id is null
     or v_run.status <> 'running'
     or (v_run.provider_run_id is not null and v_run.provider_run_id is distinct from v_provider_run_id)
     or (v_run.source_key = 'apify' and (v_run.provider_run_id is null or v_run.provider_start_state <> 'accepted'))
  then
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
  set status = 'completed', provider_run_id = v_provider_run_id,
      result_cache_id = v_cache_id, result_count = jsonb_array_length(p_results),
      completed_at = now(), updated_at = now(), last_error = null,
      provider_start_state = 'accepted',
      provider_start_confirmed_at = coalesce(provider_start_confirmed_at, now())
  where id = v_run.id;

  return query select v_cache_id, true;
end;
$$;

revoke all on function public.finalize_prospecting_run(uuid, uuid, uuid, text, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.finalize_prospecting_run(uuid, uuid, uuid, text, jsonb, jsonb, text) to service_role;
