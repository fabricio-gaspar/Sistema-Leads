-- Keep the legacy heartbeat view aligned with the scheduler integration.
-- Operational diagnostics read integrations directly; this table remains for
-- historical reports that still consume automation_engine.
create or replace function private.sync_legacy_scheduler_heartbeat()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if new.key = 'scheduler'
    and new.last_success_at is not null
    and new.last_success_at is distinct from old.last_success_at then
    insert into public.automation_heartbeats as heartbeat (
      job_name,
      last_started_at,
      last_finished_at,
      status,
      last_error,
      detail,
      updated_at
    ) values (
      'automation_engine',
      new.last_success_at,
      new.last_success_at,
      'success',
      null,
      jsonb_build_object(
        'source', 'scheduler_integration',
        'organization_id', new.organization_id,
        'worker', 'automation-worker'
      ),
      new.last_success_at
    )
    on conflict (job_name) do update set
      last_started_at = excluded.last_started_at,
      last_finished_at = excluded.last_finished_at,
      status = excluded.status,
      last_error = null,
      detail = excluded.detail,
      updated_at = excluded.updated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_legacy_scheduler_heartbeat on public.integrations;

create trigger sync_legacy_scheduler_heartbeat
after update of last_success_at on public.integrations
for each row
when (new.key = 'scheduler' and new.last_success_at is distinct from old.last_success_at)
execute function private.sync_legacy_scheduler_heartbeat();

-- Repair the stale row immediately from the latest confirmed scheduler run.
insert into public.automation_heartbeats as heartbeat (
  job_name,
  last_started_at,
  last_finished_at,
  status,
  last_error,
  detail,
  updated_at
)
select
  'automation_engine',
  scheduler.last_success_at,
  scheduler.last_success_at,
  'success',
  null,
  jsonb_build_object(
    'source', 'scheduler_integration_backfill',
    'organization_id', scheduler.organization_id,
    'worker', 'automation-worker'
  ),
  scheduler.last_success_at
from public.integrations as scheduler
where scheduler.key = 'scheduler'
  and scheduler.last_success_at is not null
order by scheduler.last_success_at desc
limit 1
on conflict (job_name) do update set
  last_started_at = excluded.last_started_at,
  last_finished_at = excluded.last_finished_at,
  status = excluded.status,
  last_error = null,
  detail = excluded.detail,
  updated_at = excluded.updated_at;
