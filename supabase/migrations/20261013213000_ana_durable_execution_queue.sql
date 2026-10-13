-- Ana: fila durável por lead, leases recuperáveis e trilha de efeitos.
-- A tabela é exclusivamente server-side: nenhum navegador pode enfileirar,
-- reclamar ou concluir a automação diretamente.

begin;

alter table public.agent_runs
  add column if not exists attempt_count integer not null default 0,
  add column if not exists retryable boolean not null default false,
  add column if not exists lease_id uuid,
  add column if not exists lease_expires_at timestamptz;

create index if not exists agent_runs_recovery_idx
  on public.agent_runs (status, lease_expires_at)
  where status = 'running';

create table if not exists public.ana_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  source_message_id uuid references public.lead_messages(id) on delete set null,
  source_integration_id uuid references public.integrations(id) on delete set null,
  event text not null check (event in ('lead.created', 'message.received', 'stage.changed', 'meeting.done', 'timeout.48h', 'manual.run', 'cadence.followup')),
  modo text not null check (modo in ('ia', 'humano')),
  request_id text not null check (char_length(request_id) between 1 and 180),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 360),
  input_context jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'running', 'retry', 'completed', 'skipped', 'needs_review', 'dead_letter', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 8),
  run_at timestamptz not null default now(),
  lease_id uuid,
  lease_expires_at timestamptz,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  last_error_code text,
  last_error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ana_jobs_org_idempotency_key_uq
  on public.ana_jobs (organization_id, idempotency_key);
create index if not exists ana_jobs_claim_idx
  on public.ana_jobs (status, run_at, created_at)
  where status in ('queued', 'retry', 'running');
create index if not exists ana_jobs_lead_fifo_idx
  on public.ana_jobs (organization_id, lead_id, created_at, id)
  where status in ('queued', 'retry', 'running', 'needs_review', 'dead_letter');

create table if not exists public.ana_effects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  ana_job_id uuid references public.ana_jobs(id) on delete set null,
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  effect_key text not null check (char_length(effect_key) between 1 and 360),
  effect_type text not null check (effect_type in ('qualification', 'lead_transition', 'outbound_queue', 'handoff', 'proposal', 'calendar')),
  status text not null check (status in ('planned', 'completed', 'failed', 'needs_review')),
  payload jsonb not null default '{}'::jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists ana_effects_org_effect_key_uq
  on public.ana_effects (organization_id, effect_key);
create index if not exists ana_effects_review_idx
  on public.ana_effects (organization_id, status, created_at desc)
  where status in ('planned', 'failed', 'needs_review');

alter table public.ana_jobs enable row level security;
alter table public.ana_effects enable row level security;
revoke all on table public.ana_jobs, public.ana_effects from public, anon, authenticated;

create or replace function public.enqueue_ana_job(
  p_organization_id uuid,
  p_lead_id uuid,
  p_event text,
  p_modo text,
  p_request_id text,
  p_source_message_id uuid default null,
  p_source_integration_id uuid default null,
  p_input_context jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  v_lead public.leads%rowtype;
  v_job public.ana_jobs%rowtype;
  v_key text;
begin
  if current_user not in ('postgres', 'service_role') then raise exception 'ana_job_access_denied'; end if;
  if p_event not in ('lead.created', 'message.received', 'stage.changed', 'meeting.done', 'timeout.48h', 'manual.run', 'cadence.followup')
    or p_modo not in ('ia', 'humano')
    or p_request_id is null or char_length(trim(p_request_id)) = 0 or char_length(p_request_id) > 180 then
    raise exception 'ana_job_input_invalid';
  end if;
  select * into v_lead from public.leads
   where id = p_lead_id and organization_id = p_organization_id;
  if v_lead.id is null then raise exception 'ana_job_lead_not_found'; end if;
  if p_source_message_id is not null and not exists (
    select 1 from public.lead_messages as message
     where message.id = p_source_message_id
       and message.organization_id = p_organization_id
       and message.lead_id = p_lead_id
       and message.sender = 'lead'
  ) then
    raise exception 'ana_job_source_message_invalid';
  end if;
  if p_source_integration_id is not null and not exists (
    select 1 from public.integrations as integration
     where integration.id = p_source_integration_id
       and integration.organization_id = p_organization_id
  ) then
    raise exception 'ana_job_source_integration_invalid';
  end if;

  v_key := concat_ws(':', 'ana-job-v1', p_event, p_lead_id::text, coalesce(p_source_message_id::text, p_request_id));
  insert into public.ana_jobs (
    organization_id, lead_id, source_message_id, source_integration_id,
    event, modo, request_id, idempotency_key, input_context
  ) values (
    p_organization_id, p_lead_id, p_source_message_id, p_source_integration_id,
    p_event, p_modo, trim(p_request_id), v_key, coalesce(p_input_context, '{}'::jsonb)
  ) on conflict (organization_id, idempotency_key) do update
    set updated_at = now()
  returning * into v_job;
  return pg_catalog.to_jsonb(v_job);
end $$;

create or replace function public.claim_ana_job(p_job_id uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  v_job public.ana_jobs%rowtype;
  v_lease uuid := gen_random_uuid();
begin
  if current_user not in ('postgres', 'service_role') then raise exception 'ana_job_access_denied'; end if;
  -- A worker can disappear after claiming a lease. Once all safe retry
  -- attempts were consumed, make the stop visible and preserve the FIFO
  -- barrier instead of leaving an expired `running` row forever.
  update public.ana_jobs
     set status = 'dead_letter',
         lease_id = null,
         lease_expires_at = null,
         completed_at = now(),
         last_error_code = 'ana_job_lease_expired_max_attempts',
         last_error_message = 'A execução expirou após consumir as tentativas seguras e requer revisão humana.',
         updated_at = now()
   where status = 'running'
     and lease_expires_at <= now()
     and attempt_count >= max_attempts;
  select job.* into v_job
    from public.ana_jobs as job
   where (p_job_id is null or job.id = p_job_id)
     and (
       (job.status in ('queued', 'retry') and job.run_at <= now())
       or (job.status = 'running' and job.lease_expires_at <= now())
     )
     and job.attempt_count < job.max_attempts
     and not exists (
       select 1 from public.ana_jobs as earlier
        where earlier.organization_id = job.organization_id
          and earlier.lead_id = job.lead_id
          and earlier.id <> job.id
          -- A review/dead-letter is an explicit per-lead stop. Processing a
          -- newer message past it could answer without the missing context.
          and earlier.status in ('queued', 'retry', 'running', 'needs_review', 'dead_letter')
          and (earlier.created_at, earlier.id) < (job.created_at, job.id)
     )
   order by job.run_at, job.created_at, job.id
   for update skip locked
   limit 1;
  if v_job.id is null then return null; end if;

  update public.ana_jobs as job
     set status = 'running',
         attempt_count = job.attempt_count + 1,
         lease_id = v_lease,
         lease_expires_at = now() + interval '90 seconds',
         started_at = coalesce(job.started_at, now()),
         last_error_code = null,
         last_error_message = null,
         updated_at = now()
   where job.id = v_job.id
   returning * into v_job;
  return pg_catalog.to_jsonb(v_job);
end $$;

create or replace function public.validate_ana_job_lease(p_job_id uuid, p_lease_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_job public.ana_jobs%rowtype;
begin
  if current_user not in ('postgres', 'service_role') then raise exception 'ana_job_access_denied'; end if;
  select * into v_job from public.ana_jobs
   where id = p_job_id and status = 'running' and lease_id = p_lease_id and lease_expires_at > now();
  if v_job.id is null then raise exception 'ana_job_lease_lost'; end if;
  return pg_catalog.to_jsonb(v_job);
end $$;

create or replace function public.finish_ana_job(
  p_job_id uuid,
  p_lease_id uuid,
  p_status text,
  p_agent_run_id uuid default null
) returns boolean
language plpgsql security invoker set search_path='' as $$
declare v_changed integer;
begin
  if current_user not in ('postgres', 'service_role') then raise exception 'ana_job_access_denied'; end if;
  if p_status not in ('completed', 'skipped') then raise exception 'ana_job_terminal_status_invalid'; end if;
  update public.ana_jobs
     set status = p_status, agent_run_id = coalesce(p_agent_run_id, agent_run_id),
         lease_id = null, lease_expires_at = null, completed_at = now(), updated_at = now()
   where id = p_job_id and status = 'running' and lease_id = p_lease_id;
  get diagnostics v_changed = row_count;
  return v_changed = 1;
end $$;

create or replace function public.fail_ana_job(
  p_job_id uuid,
  p_lease_id uuid,
  p_error_code text,
  p_error_message text,
  p_retryable boolean,
  p_agent_run_id uuid default null
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  v_job public.ana_jobs%rowtype;
  v_status text;
  v_retry_at timestamptz;
begin
  if current_user not in ('postgres', 'service_role') then raise exception 'ana_job_access_denied'; end if;
  select * into v_job from public.ana_jobs
   where id = p_job_id and status = 'running' and lease_id = p_lease_id for update;
  if v_job.id is null then raise exception 'ana_job_lease_lost'; end if;

  if p_retryable and v_job.attempt_count < v_job.max_attempts then
    v_status := 'retry';
    v_retry_at := now() + pg_catalog.make_interval(
      secs => least(900, (15 * power(2::numeric, greatest(v_job.attempt_count - 1, 0)))::integer)
    );
  elsif p_retryable then
    v_status := 'dead_letter';
    v_retry_at := now();
  else
    v_status := 'needs_review';
    v_retry_at := now();
  end if;

  update public.ana_jobs
     set status = v_status,
         agent_run_id = coalesce(p_agent_run_id, agent_run_id),
         run_at = v_retry_at,
         lease_id = null,
         lease_expires_at = null,
         last_error_code = nullif(left(coalesce(p_error_code, ''), 120), ''),
         last_error_message = nullif(left(coalesce(p_error_message, ''), 500), ''),
         completed_at = case when v_status in ('needs_review', 'dead_letter') then now() else null end,
         updated_at = now()
   where id = v_job.id
   returning * into v_job;
  return pg_catalog.to_jsonb(v_job);
end $$;

revoke all on function public.enqueue_ana_job(uuid,uuid,text,text,text,uuid,uuid,jsonb),
  public.claim_ana_job(uuid), public.validate_ana_job_lease(uuid,uuid),
  public.finish_ana_job(uuid,uuid,text,uuid), public.fail_ana_job(uuid,uuid,text,text,boolean,uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_ana_job(uuid,uuid,text,text,text,uuid,uuid,jsonb),
  public.claim_ana_job(uuid), public.validate_ana_job_lease(uuid,uuid),
  public.finish_ana_job(uuid,uuid,text,uuid), public.fail_ana_job(uuid,uuid,text,text,boolean,uuid)
  to service_role;

-- These business events are audit signals, not implicit permission for Ana to
-- contact someone. A future policy may enqueue a reviewed action from them;
-- until then they only make stage and meeting transitions observable.
create or replace function private.emit_ana_stage_changed_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.stage is not distinct from old.stage
     and new.ana_stage is not distinct from old.ana_stage then
    return new;
  end if;
  insert into public.domain_events (
    organization_id, event_name, entity_type, entity_id, actor_type,
    actor_id, idempotency_key, payload
  ) values (
    new.organization_id,
    'stage.changed',
    'lead',
    new.id,
    'system',
    null,
    concat('lead-stage:', new.id::text, ':', coalesce(new.updated_at::text, clock_timestamp()::text)),
    jsonb_build_object(
      'from_stage', old.stage,
      'to_stage', new.stage,
      'from_ana_stage', old.ana_stage,
      'to_ana_stage', new.ana_stage
    )
  ) on conflict (organization_id, idempotency_key) do nothing;
  return new;
end;
$$;

create or replace function private.emit_ana_meeting_done_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.status is distinct from 'completed'
     or old.status is not distinct from new.status then
    return new;
  end if;
  insert into public.domain_events (
    organization_id, event_name, entity_type, entity_id, actor_type,
    actor_id, idempotency_key, payload
  ) values (
    new.organization_id,
    'meeting.done',
    'appointment',
    new.id,
    'system',
    null,
    concat('meeting-done:', new.id::text),
    jsonb_build_object('lead_id', new.lead_id, 'appointment_id', new.id, 'status', new.status)
  ) on conflict (organization_id, idempotency_key) do nothing;
  return new;
end;
$$;

drop trigger if exists leads_emit_ana_stage_changed_event on public.leads;
create trigger leads_emit_ana_stage_changed_event
after update of stage, ana_stage on public.leads
for each row execute function private.emit_ana_stage_changed_event();

drop trigger if exists appointments_emit_ana_meeting_done_event on public.appointments;
create trigger appointments_emit_ana_meeting_done_event
after update of status on public.appointments
for each row execute function private.emit_ana_meeting_done_event();

revoke all on function private.emit_ana_stage_changed_event(), private.emit_ana_meeting_done_event()
  from public, anon, authenticated;

commit;
