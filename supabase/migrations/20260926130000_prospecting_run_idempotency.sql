-- Reserva uma execução antes de chamar o provedor externo. A tabela existente
-- continua sendo a fonte única de verdade; não há nova fila ou motor paralelo.
alter table public.prospecting_runs
  add column if not exists idempotency_key text,
  add column if not exists execution_scope_key text,
  add column if not exists provider_start_state text not null default 'ready',
  add column if not exists provider_start_attempted_at timestamptz,
  add column if not exists provider_start_confirmed_at timestamptz;

alter table public.prospecting_runs
  drop constraint if exists prospecting_runs_provider_start_state_check;
alter table public.prospecting_runs
  add constraint prospecting_runs_provider_start_state_check
  check (provider_start_state in ('ready', 'attempting', 'accepted', 'unknown', 'rejected'));

-- Execuções antigas sem um ID do provedor não podem ser reiniciadas por
-- suposição. Elas ficam explícitas como início não confirmado.
update public.prospecting_runs
set provider_start_state = case
  when provider_run_id is not null or status = 'completed' then 'accepted'
  when status = 'running' then 'unknown'
  else 'rejected'
end,
provider_start_attempted_at = case
  when provider_run_id is not null or status in ('running', 'completed', 'failed') then coalesce(started_at, created_at)
  else null
end,
provider_start_confirmed_at = case
  when provider_run_id is not null or status = 'completed' then coalesce(started_at, created_at)
  else null
end
where provider_start_state = 'ready';

create unique index if not exists prospecting_runs_org_idempotency_key_uq
  on public.prospecting_runs (organization_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists prospecting_runs_active_equivalent_uq
  on public.prospecting_runs (organization_id, source_key, execution_scope_key, filters_hash)
  where status = 'running' and execution_scope_key is not null;

-- Apenas o servidor usa esta RPC. Ela retorna a mesma execução tanto para a
-- mesma tentativa quanto para a mesma busca ativa equivalente no mesmo escopo.
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
    and source_key = btrim(p_source_key)
    and execution_scope_key = btrim(p_execution_scope_key)
    and filters_hash = btrim(p_filters_hash)
    and status = 'running'
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
        and source_key = btrim(p_source_key)
        and execution_scope_key = btrim(p_execution_scope_key)
        and filters_hash = btrim(p_filters_hash)
        and status = 'running'
      for update;
    end if;
    if not found then
      raise;
    end if;
    if v_run.idempotency_key = btrim(p_idempotency_key)
      and (v_run.source_config_id is distinct from p_source_config_id
        or v_run.source_key is distinct from btrim(p_source_key)
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

-- A identidade e o escopo não mudam depois da reserva. O estado de início só
-- progride; `unknown` bloqueia novo POST automático ao provedor.
create or replace function private.protect_prospecting_run()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if (
    new.organization_id is distinct from old.organization_id
    or new.source_config_id is distinct from old.source_config_id
    or new.source_key is distinct from old.source_key
    or new.mode is distinct from old.mode
    or new.filters is distinct from old.filters
    or new.filters_hash is distinct from old.filters_hash
    or new.requested_quantity is distinct from old.requested_quantity
    or new.estimated_records is distinct from old.estimated_records
    or new.estimated_credits is distinct from old.estimated_credits
    or new.estimated_cost is distinct from old.estimated_cost
    or new.maximum_cost is distinct from old.maximum_cost
    or new.currency is distinct from old.currency
    or new.cost_known is distinct from old.cost_known
    or new.requires_confirmation is distinct from old.requires_confirmation
    or new.estimate_basis is distinct from old.estimate_basis
    or new.blocking_reason is distinct from old.blocking_reason
    or new.quote_expires_at is distinct from old.quote_expires_at
    or new.requested_by is distinct from old.requested_by
    or new.idempotency_key is distinct from old.idempotency_key
    or new.execution_scope_key is distinct from old.execution_scope_key
    or (
      old.requires_confirmation = false
      and new.result_cache_id is distinct from old.result_cache_id
      and not (
        old.status = 'running'
        and new.status = 'completed'
        and old.result_cache_id is null
        and new.result_cache_id is not null
        and exists (
          select 1 from public.prospecting_cache cache
          where cache.id = new.result_cache_id
            and cache.organization_id = old.organization_id
            and cache.user_id = old.requested_by
            and cache.filters_hash = old.filters_hash
            and cache.source = old.source_key
        )
      )
    )
  ) then
    raise exception 'A cotação confirmável é imutável; gere uma nova prévia';
  end if;

  if not (
    (old.status = 'quoted' and new.status in ('confirmed','cancelled','expired'))
    or (old.status = 'confirmed' and new.status in ('running','cancelled'))
    or (old.status = 'running' and new.status in ('completed','failed'))
    or (old.status = new.status)
  ) then
    raise exception 'Transição inválida da execução de prospecção: % -> %', old.status, new.status;
  end if;

  if not (
    old.provider_start_state = new.provider_start_state
    or (old.provider_start_state = 'ready' and new.provider_start_state in ('attempting', 'accepted', 'unknown', 'rejected'))
    or (old.provider_start_state = 'attempting' and new.provider_start_state in ('accepted', 'unknown', 'rejected'))
  ) then
    raise exception 'Transição inválida do início no provedor: % -> %', old.provider_start_state, new.provider_start_state;
  end if;

  if old.status = 'quoted' and new.status = 'confirmed' then
    if old.quote_expires_at <= now() then raise exception 'A prévia expirou'; end if;
    if not old.cost_known or old.blocking_reason is not null then
      raise exception 'A execução possui custo ou bloqueio não resolvido';
    end if;
    if not (select private.is_org_admin(old.organization_id, auth.uid())) then
      raise exception 'Somente administradores podem confirmar execuções externas';
    end if;
    if new.confirmed_by is distinct from auth.uid() or new.confirmed_at is null then
      raise exception 'Confirmação explícita e identificada é obrigatória';
    end if;
  end if;

  if old.status = 'confirmed' and new.status = 'running' then
    if auth.uid() is not null
      and auth.uid() is distinct from old.requested_by
      and not (select private.is_org_admin(old.organization_id, auth.uid()))
    then
      raise exception 'Somente o solicitante ou um administrador pode iniciar a execução';
    end if;
  end if;

  return new;
end;
$$;

-- Não finalize uma execução Apify cujo início não foi comprovado.
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

  if not found then raise exception 'prospecting_run_not_found'; end if;
  if v_run.status = 'completed' then
    if v_run.result_cache_id is null then raise exception 'prospecting_results_unavailable'; end if;
    return query select v_run.result_cache_id, false;
    return;
  end if;

  if v_run.status <> 'running'
     or (v_run.provider_run_id is not null and v_run.provider_run_id <> p_provider_run_id)
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
  set status = 'completed', provider_run_id = p_provider_run_id,
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
