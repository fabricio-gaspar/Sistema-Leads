-- The old guard rejected result_cache_id for runs created without a quote.
-- Permit that field only once, when a running run is completed with its own cache.
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

-- Recover only unambiguously matching, existing, unexpired review caches.
-- No Actor call, new cache, lead import, or new cost occurs here.
with matches as (
  select r.id as run_id, c.id as cache_id, c.total_found, c.created_at,
         count(*) over (partition by r.id) as per_run,
         count(*) over (partition by c.id) as per_cache
  from public.prospecting_runs r
  join public.prospecting_cache c
    on c.organization_id = r.organization_id
   and c.user_id = r.requested_by
   and c.filters_hash = r.filters_hash
   and c.source = r.source_key
   and c.created_at between r.started_at and r.started_at + interval '10 minutes'
  where r.status = 'running'
    and r.result_cache_id is null
    and r.provider_run_id is not null
    and c.expires_at > now()
    and jsonb_typeof(c.results) = 'array'
    and jsonb_array_length(c.results) = c.total_found
    and c.total_found <= r.requested_quantity
)
update public.prospecting_runs r
set status = 'completed', result_cache_id = m.cache_id,
    result_count = m.total_found, completed_at = m.created_at,
    last_error = null, updated_at = now()
from matches m
where r.id = m.run_id and m.per_run = 1 and m.per_cache = 1
  and r.status = 'running' and r.result_cache_id is null;
