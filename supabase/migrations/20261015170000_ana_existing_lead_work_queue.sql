-- Ana can review a small existing portfolio without reusing paid prospecting
-- or treating a historical inbound as permission for a first approach.  The
-- queue is server-only, tenant-scoped and intentionally fails closed.

begin;

alter table public.agent_runs
  add column if not exists existing_lead_batch_item_id uuid;

alter table public.ana_jobs
  add column if not exists existing_lead_batch_item_id uuid;

alter table public.agent_runs
  drop constraint if exists agent_runs_event_check,
  add constraint agent_runs_event_check check (event in (
    'lead.created', 'message.received', 'stage.changed', 'meeting.done',
    'timeout.48h', 'manual.run', 'cadence.followup', 'existing_lead.selected'
  ));

alter table public.ana_jobs
  drop constraint if exists ana_jobs_event_check,
  add constraint ana_jobs_event_check check (event in (
    'lead.created', 'message.received', 'stage.changed', 'meeting.done',
    'timeout.48h', 'manual.run', 'cadence.followup', 'existing_lead.selected'
  ));

create table if not exists public.ana_existing_lead_policies (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  enabled boolean not null default false,
  mode text not null default 'review_only'
    check (mode in ('review_only', 'approved_followup')),
  batch_limit integer not null default 10 check (batch_limit between 1 and 10),
  interval_minutes integer not null default 30 check (interval_minutes between 5 and 1440),
  next_run_at timestamptz,
  scheduler_lease_id uuid,
  scheduler_lease_expires_at timestamptz,
  policy_version bigint not null default 1 check (policy_version > 0),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table if not exists public.ana_existing_lead_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  request_key text not null check (char_length(request_key) between 1 and 180),
  policy_version bigint not null check (policy_version > 0),
  mode text not null check (mode in ('review_only', 'approved_followup')),
  requested_limit integer not null check (requested_limit between 1 and 10),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'needs_review', 'cancelled', 'failed')),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  queued_count integer not null default 0 check (queued_count >= 0),
  completed_count integer not null default 0 check (completed_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  review_count integer not null default 0 check (review_count >= 0),
  error_code text,
  created_at timestamptz not null default pg_catalog.now(),
  requested_at timestamptz not null default pg_catalog.now(),
  completed_at timestamptz,
  updated_at timestamptz not null default pg_catalog.now(),
  unique (organization_id, request_key)
);

create table if not exists public.ana_existing_lead_batch_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  batch_id uuid not null references public.ana_existing_lead_batches(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  position smallint not null check (position between 1 and 10),
  status text not null default 'selected'
    check (status in ('selected', 'queued', 'processing', 'completed', 'skipped', 'needs_review', 'cancelled')),
  reason_code text,
  snapshot jsonb not null default '{}'::jsonb,
  preempted_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  completed_at timestamptz,
  unique (batch_id, lead_id),
  unique (batch_id, position)
);

-- An unresolved human-review item is also a reservation. Otherwise the
-- scheduler could keep selecting the same lead every interval without a
-- human ever deciding what to do with it.
create unique index if not exists ana_existing_lead_item_active_one_per_lead_uq
  on public.ana_existing_lead_batch_items (organization_id, lead_id)
  where status in ('selected', 'queued', 'processing', 'needs_review');
create index if not exists ana_existing_lead_batches_org_created_idx
  on public.ana_existing_lead_batches (organization_id, created_at desc);
create index if not exists ana_existing_lead_items_batch_status_idx
  on public.ana_existing_lead_batch_items (organization_id, batch_id, status, position);
create index if not exists ana_existing_lead_policy_due_idx
  on public.ana_existing_lead_policies (next_run_at)
  where enabled = true and mode = 'approved_followup';

-- `batch_id` and `lead_id` are globally unique UUIDs, so their ordinary FKs
-- alone cannot prove they belong to the same tenant as the item. Keep that
-- invariant in the database even for service-only callers.
create or replace function private.enforce_ana_existing_lead_item_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_batch_organization_id uuid;
  v_lead_organization_id uuid;
begin
  select organization_id into v_batch_organization_id
    from public.ana_existing_lead_batches where id = new.batch_id;
  select organization_id into v_lead_organization_id
    from public.leads where id = new.lead_id;
  if v_batch_organization_id is null or v_lead_organization_id is null
     or v_batch_organization_id <> new.organization_id
     or v_lead_organization_id <> new.organization_id then
    raise exception 'ana_existing_lead_item_cross_tenant';
  end if;
  return new;
end;
$function$;

drop trigger if exists ana_existing_lead_item_scope on public.ana_existing_lead_batch_items;
create trigger ana_existing_lead_item_scope
before insert or update of organization_id, batch_id, lead_id on public.ana_existing_lead_batch_items
for each row execute function private.enforce_ana_existing_lead_item_scope();

alter table public.ana_jobs
  add constraint ana_jobs_existing_lead_batch_item_fkey
  foreign key (existing_lead_batch_item_id)
  references public.ana_existing_lead_batch_items(id) on delete restrict;
alter table public.agent_runs
  add constraint agent_runs_existing_lead_batch_item_fkey
  foreign key (existing_lead_batch_item_id)
  references public.ana_existing_lead_batch_items(id) on delete restrict;
create unique index if not exists ana_jobs_existing_lead_item_uq
  on public.ana_jobs (existing_lead_batch_item_id)
  where existing_lead_batch_item_id is not null;

alter table public.ana_existing_lead_policies enable row level security;
alter table public.ana_existing_lead_batches enable row level security;
alter table public.ana_existing_lead_batch_items enable row level security;
revoke all on table public.ana_existing_lead_policies, public.ana_existing_lead_batches,
  public.ana_existing_lead_batch_items from public, anon, authenticated;
grant all on table public.ana_existing_lead_policies, public.ana_existing_lead_batches,
  public.ana_existing_lead_batch_items to service_role;

-- Map job outcomes to the safe, aggregate-only batch state.  A preempted
-- running job remains auditable but cannot later produce a provider effect.
create or replace function private.sync_ana_existing_lead_item_from_job()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_status text;
begin
  if new.existing_lead_batch_item_id is null then
    return new;
  end if;
  v_status := case new.status
    when 'queued' then 'queued'
    when 'retry' then 'queued'
    when 'running' then 'processing'
    when 'completed' then 'completed'
    when 'skipped' then 'skipped'
    when 'cancelled' then 'cancelled'
    else 'needs_review'
  end;
  update public.ana_existing_lead_batch_items as item
     set status = case
                    -- A response received while a job was leased must remain
                    -- fenced even if that stale worker later reports success.
                    when item.preempted_at is not null and item.status = 'needs_review' then 'needs_review'
                    when item.preempted_at is not null and v_status = 'processing' then 'needs_review'
                    else v_status
                  end,
         reason_code = case when new.status in ('needs_review', 'dead_letter')
                              then coalesce(new.last_error_code, 'ana_requires_review')
                            when new.status = 'cancelled'
                              then coalesce(new.last_error_code, 'ana_existing_lead_cancelled')
                            else item.reason_code end,
         completed_at = case when v_status in ('completed','skipped','needs_review','cancelled')
                               then pg_catalog.now() else item.completed_at end,
         updated_at = pg_catalog.now()
   where item.id = new.existing_lead_batch_item_id
     and item.organization_id = new.organization_id;
  return new;
end;
$function$;

drop trigger if exists ana_jobs_sync_existing_lead_item on public.ana_jobs;
create trigger ana_jobs_sync_existing_lead_item
after insert or update of status, last_error_code, existing_lead_batch_item_id on public.ana_jobs
for each row execute function private.sync_ana_existing_lead_item_from_job();

create or replace function private.enforce_ana_existing_lead_job_link()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_item public.ana_existing_lead_batch_items%rowtype;
begin
  if new.event = 'existing_lead.selected' then
    if new.existing_lead_batch_item_id is null then
      raise exception 'ana_existing_lead_item_required';
    end if;
    select * into v_item
      from public.ana_existing_lead_batch_items
     where id = new.existing_lead_batch_item_id
       and organization_id = new.organization_id;
    if not found or v_item.lead_id <> new.lead_id then
      raise exception 'ana_existing_lead_item_mismatch';
    end if;
    if new.modo <> 'ia' then
      raise exception 'ana_existing_lead_mode_invalid';
    end if;
  elsif new.existing_lead_batch_item_id is not null then
    raise exception 'ana_existing_lead_event_required';
  end if;
  return new;
end;
$function$;

drop trigger if exists ana_jobs_existing_lead_job_link on public.ana_jobs;
create trigger ana_jobs_existing_lead_job_link
before insert or update of event, modo, lead_id, organization_id, existing_lead_batch_item_id
on public.ana_jobs
for each row execute function private.enforce_ana_existing_lead_job_link();

-- `agent_runs` is the second durable record of this execution. Keep its
-- linkage as strict as the queue record so a portfolio selection can never be
-- represented later as an unrelated run.
create or replace function private.enforce_ana_existing_lead_run_link()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_item public.ana_existing_lead_batch_items%rowtype;
begin
  if new.event = 'existing_lead.selected' then
    if new.existing_lead_batch_item_id is null then
      raise exception 'ana_existing_lead_item_required';
    end if;
    select * into v_item
      from public.ana_existing_lead_batch_items
     where id = new.existing_lead_batch_item_id
       and organization_id = new.organization_id;
    if not found or v_item.lead_id <> new.lead_id then
      raise exception 'ana_existing_lead_item_mismatch';
    end if;
    if new.modo <> 'ia' then
      raise exception 'ana_existing_lead_mode_invalid';
    end if;
  elsif new.existing_lead_batch_item_id is not null then
    raise exception 'ana_existing_lead_event_required';
  end if;
  return new;
end;
$function$;

drop trigger if exists agent_runs_existing_lead_run_link on public.agent_runs;
create trigger agent_runs_existing_lead_run_link
before insert or update of event, modo, lead_id, organization_id, existing_lead_batch_item_id
on public.agent_runs
for each row execute function private.enforce_ana_existing_lead_run_link();

-- Batch counters are derived from durable item state. This keeps the aggregate
-- shown to the UI truthful after a retry, cancellation, inbound preemption or
-- asynchronous worker completion instead of only at initial reservation.
create or replace function private.sync_ana_existing_lead_batch_from_item()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_batch_id uuid;
  v_organization_id uuid;
  v_total integer := 0;
  v_active integer := 0;
  v_completed integer := 0;
  v_skipped integer := 0;
  v_cancelled integer := 0;
  v_review integer := 0;
  v_reason text := null;
  v_cancel_reason text := null;
begin
  v_batch_id := new.batch_id;
  v_organization_id := new.organization_id;
  select
    count(*),
    count(*) filter (where item.status in ('selected', 'queued', 'processing')),
    count(*) filter (where item.status = 'completed'),
    count(*) filter (where item.status = 'skipped'),
    count(*) filter (where item.status = 'cancelled'),
    count(*) filter (where item.status = 'needs_review'),
    max(item.reason_code) filter (where item.status = 'needs_review'),
    max(item.reason_code) filter (where item.status = 'cancelled')
  into v_total, v_active, v_completed, v_skipped, v_cancelled, v_review, v_reason, v_cancel_reason
  from public.ana_existing_lead_batch_items item
  where item.batch_id = v_batch_id and item.organization_id = v_organization_id;

  update public.ana_existing_lead_batches batch
     set candidate_count = v_total,
         queued_count = v_active,
         completed_count = v_completed,
         skipped_count = v_skipped,
         review_count = v_review,
         error_code = case
           when v_review > 0 then v_reason
           when v_cancelled > 0 then coalesce(v_cancel_reason, 'existing_lead_work_cancelled')
           else null
         end,
         status = case
           when v_active > 0 then 'processing'
           when v_total > 0 and v_cancelled = v_total then 'cancelled'
           when v_review > 0 then 'needs_review'
           when v_total = 0 or v_completed + v_skipped + v_cancelled = v_total then 'completed'
           else 'needs_review'
         end,
         completed_at = case when v_active = 0 then pg_catalog.now() else null end,
         updated_at = pg_catalog.now()
   where batch.id = v_batch_id and batch.organization_id = v_organization_id;
  return new;
end;
$function$;

drop trigger if exists ana_existing_lead_item_sync_batch on public.ana_existing_lead_batch_items;
create trigger ana_existing_lead_item_sync_batch
after insert or update of status, reason_code, preempted_at on public.ana_existing_lead_batch_items
for each row execute function private.sync_ana_existing_lead_batch_from_item();

-- A service-only assertion is used both when a candidate is reserved and again
-- by ana-run immediately before a provider effect.  Missing evidence blocks;
-- it never becomes a permissive fallback.
create or replace function private.assert_existing_lead_work_allowed(
  p_organization_id uuid,
  p_item_id uuid,
  p_job_id uuid default null,
  p_lease_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_item public.ana_existing_lead_batch_items%rowtype;
  v_policy public.ana_existing_lead_policies%rowtype;
  v_lead public.leads%rowtype;
  v_reason text := null;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'ana_existing_lead_access_denied';
  end if;
  select * into v_item from public.ana_existing_lead_batch_items
   where id = p_item_id and organization_id = p_organization_id;
  if not found then return jsonb_build_object('allowed', false, 'reason', 'existing_lead_item_not_found'); end if;
  select * into v_policy from public.ana_existing_lead_policies
   where organization_id = p_organization_id;
  if not found or not v_policy.enabled or v_policy.mode <> 'approved_followup' then
    return jsonb_build_object('allowed', false, 'reason', 'existing_lead_policy_not_approved');
  end if;
  select * into v_lead from public.leads
   where id = v_item.lead_id and organization_id = p_organization_id;
  if not found then return jsonb_build_object('allowed', false, 'reason', 'existing_lead_not_found'); end if;

  if coalesce(v_item.snapshot ->> 'policy_version', '') <> v_policy.policy_version::text then v_reason := 'existing_lead_policy_changed';
  elsif v_item.preempted_at is not null then v_reason := 'existing_lead_preempted_by_inbound';
  elsif v_item.status not in ('selected', 'queued', 'processing') then v_reason := 'existing_lead_item_not_actionable';
  elsif v_lead.archived_at is not null or coalesce(v_lead.ana_outcome, '') in ('ganho','perdido') or v_lead.ana_stage = 'fechado' then v_reason := 'existing_lead_terminal';
  elsif v_lead.modo_atendimento <> 'ia' or v_lead.ai_paused or coalesce(v_lead.automation_status, '') = 'human' then v_reason := 'existing_lead_human_mode';
  elsif v_lead.opt_out or v_lead.contact_approval_status <> 'approved' then v_reason := 'existing_lead_contact_not_approved';
  elsif pg_catalog.lower(coalesce(v_lead.active_channel, '')) <> 'whatsapp' then v_reason := 'existing_lead_whatsapp_channel_required';
  elsif not exists (
    select 1 from public.organization_members member
     where member.organization_id = p_organization_id and member.status = 'active'
       and member.user_id in (v_lead.owner_id, v_lead.assigned_to)
  ) then v_reason := 'existing_lead_owner_inactive';
  elsif not exists (
    select 1 from public.lead_messages message
     where message.organization_id = p_organization_id and message.lead_id = v_lead.id
       and message.sender = 'lead'
  ) then v_reason := 'existing_lead_prior_inbound_required';
  elsif exists (
    select 1 from public.lead_handoffs handoff
     where handoff.organization_id = p_organization_id and handoff.lead_id = v_lead.id
       and handoff.status in ('pending', 'accepted')
  ) then v_reason := 'existing_lead_handoff_open';
  elsif not exists (
    select 1
      from public.whatsapp_accounts account
      join public.integrations integration
        on integration.id = account.integration_id and integration.organization_id = account.organization_id
      join public.messaging_provider_controls control
        on control.organization_id = account.organization_id and control.provider = 'wa_akg'
     where account.id = v_lead.whatsapp_account_id
       and account.organization_id = p_organization_id
       and account.provider = 'wa_akg'
       and account.archived_at is null
       and account.enabled
       and account.connection_status = 'connected'
       and integration.connected and integration.enabled and not integration.paused
       and control.inbound_enabled and control.send_enabled and control.automation_enabled
       and not control.kill_switch and not coalesce(control.capture_only, false)
  ) then v_reason := 'existing_lead_wa_akg_not_ready';
  elsif not exists (
    select 1 from private.wa_akg_contact_policy contact_policy
     where contact_policy.organization_id = p_organization_id
       and contact_policy.whatsapp_account_id = v_lead.whatsapp_account_id
       and contact_policy.lead_id = v_lead.id
       and contact_policy.classification_state = 'lead_authorized'
       and contact_policy.contact_only = false
       and contact_policy.evidence_state in ('provider_verified', 'operator_confirmed')
  ) then v_reason := 'existing_lead_authorization_missing';
  elsif private.wa_akg_bound_lead_requires_protection(p_organization_id, v_lead.id) then v_reason := 'existing_lead_contact_protected';
  elsif (p_job_id is null) <> (p_lease_id is null) then v_reason := 'existing_lead_job_lease_invalid';
  elsif p_job_id is not null and not exists (
    select 1 from public.ana_jobs job
     where job.id = p_job_id and job.organization_id = p_organization_id
       and job.lead_id = v_lead.id and job.event = 'existing_lead.selected'
       and job.existing_lead_batch_item_id = v_item.id and job.status = 'running'
       and job.lease_id = p_lease_id and job.lease_expires_at > pg_catalog.now()
  ) then v_reason := 'existing_lead_job_lease_invalid';
  end if;

  return jsonb_build_object(
    'allowed', v_reason is null,
    'reason', v_reason,
    'policy_version', v_policy.policy_version,
    'item_id', v_item.id
  );
end;
$function$;

revoke all on function private.assert_existing_lead_work_allowed(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.assert_existing_lead_work_allowed(uuid, uuid, uuid, uuid) to service_role;

-- Supabase RPC only exposes the public schema. The wrapper remains
-- service-only and returns the fence decision without exposing items, leads or
-- contacts to a browser. The private implementation stays unavailable to API
-- roles and remains the single source of the actual eligibility checks.
create or replace function public.assert_existing_lead_work_allowed(
  p_organization_id uuid,
  p_item_id uuid,
  p_job_id uuid default null,
  p_lease_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'ana_existing_lead_access_denied';
  end if;
  return private.assert_existing_lead_work_allowed(
    p_organization_id,
    p_item_id,
    p_job_id,
    p_lease_id
  );
end;
$function$;

revoke all on function public.assert_existing_lead_work_allowed(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.assert_existing_lead_work_allowed(uuid, uuid, uuid, uuid) to service_role;

create or replace function public.enqueue_existing_lead_ana_job(
  p_organization_id uuid,
  p_item_id uuid,
  p_request_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_item public.ana_existing_lead_batch_items%rowtype;
  v_job public.ana_jobs%rowtype;
  v_allowed jsonb;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'ana_existing_lead_access_denied';
  end if;
  if nullif(btrim(p_request_id), '') is null or char_length(p_request_id) > 180 then
    raise exception 'ana_existing_lead_request_invalid';
  end if;
  select * into v_item from public.ana_existing_lead_batch_items
   where id = p_item_id and organization_id = p_organization_id for update;
  if not found then raise exception 'ana_existing_lead_item_not_found'; end if;
  v_allowed := private.assert_existing_lead_work_allowed(p_organization_id, p_item_id, null, null);
  if coalesce((v_allowed ->> 'allowed')::boolean, false) is not true then
    update public.ana_existing_lead_batch_items
       set status = 'needs_review', reason_code = coalesce(v_allowed ->> 'reason', 'existing_lead_not_allowed'),
           completed_at = pg_catalog.now(), updated_at = pg_catalog.now()
     where id = p_item_id and organization_id = p_organization_id;
    return jsonb_build_object('queued', false, 'reason', v_allowed ->> 'reason');
  end if;
  insert into public.ana_jobs (
    organization_id, lead_id, event, modo, request_id, idempotency_key,
    input_context, existing_lead_batch_item_id
  ) values (
    p_organization_id, v_item.lead_id, 'existing_lead.selected', 'ia', btrim(p_request_id),
    concat('ana-existing-lead-v1:', p_item_id::text),
    jsonb_build_object('existing_lead_batch_item_id', p_item_id, 'existing_lead_policy_version', v_allowed ->> 'policy_version'),
    p_item_id
  ) on conflict (organization_id, idempotency_key) do update
    set updated_at = pg_catalog.now()
  returning * into v_job;
  update public.ana_existing_lead_batch_items
     set status = case when v_job.status in ('queued','retry') then 'queued' else status end,
         updated_at = pg_catalog.now()
   where id = p_item_id and organization_id = p_organization_id;
  return jsonb_build_object('queued', v_job.status in ('queued','retry'), 'job_id', v_job.id, 'status', v_job.status);
end;
$function$;

create or replace function public.reserve_existing_leads_for_ana(
  p_organization_id uuid,
  p_requested_by uuid,
  p_request_key text,
  p_requested_limit integer default null,
  p_scheduler_lease_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_policy public.ana_existing_lead_policies%rowtype;
  v_batch public.ana_existing_lead_batches%rowtype;
  v_candidate record;
  v_limit integer;
  v_position integer := 0;
  v_queued integer := 0;
  v_review integer := 0;
  v_enqueue jsonb;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'ana_existing_lead_access_denied';
  end if;
  if p_organization_id is null or nullif(btrim(p_request_key), '') is null
     or char_length(p_request_key) > 180 then
    raise exception 'ana_existing_lead_request_invalid';
  end if;
  if p_requested_by is not null and (
    not private.is_active_org_member(p_organization_id, p_requested_by)
    or not private.has_org_permission(p_organization_id, p_requested_by, 'configuration.manage')
  ) then raise exception 'ana_existing_lead_configuration_denied'; end if;

  perform pg_catalog.pg_advisory_xact_lock(hashtextextended('ana-existing-lead:' || p_organization_id::text, 0));
  select * into v_policy from public.ana_existing_lead_policies
   where organization_id = p_organization_id for update;
  if not found or not v_policy.enabled then raise exception 'ana_existing_lead_policy_disabled'; end if;
  if p_requested_by is null then
    if p_scheduler_lease_id is null
       or v_policy.scheduler_lease_id is distinct from p_scheduler_lease_id
       or v_policy.scheduler_lease_expires_at is null
       or v_policy.scheduler_lease_expires_at <= pg_catalog.now() then
      raise exception 'ana_existing_lead_scheduler_lease_invalid';
    end if;
  elsif p_scheduler_lease_id is not null then
    raise exception 'ana_existing_lead_scheduler_lease_unexpected';
  end if;
  v_limit := least(10, greatest(1, coalesce(p_requested_limit, v_policy.batch_limit)));

  select * into v_batch from public.ana_existing_lead_batches
   where organization_id = p_organization_id and request_key = btrim(p_request_key) for update;
  if found then
    return jsonb_build_object('batch_id', v_batch.id, 'status', v_batch.status,
      'candidate_count', v_batch.candidate_count, 'queued_count', v_batch.queued_count,
      'review_count', v_batch.review_count, 'idempotent', true);
  end if;

  insert into public.ana_existing_lead_batches (
    organization_id, requested_by, request_key, policy_version, mode, requested_limit, status
  ) values (
    p_organization_id, p_requested_by, btrim(p_request_key), v_policy.policy_version,
    v_policy.mode, v_limit, case when v_policy.mode = 'review_only' then 'needs_review' else 'queued' end
  ) returning * into v_batch;

  -- No first outreach: every candidate must have a prior inbound message,
  -- current approval and a canonical, explicitly authorized WA-AKG identity.
  for v_candidate in
    select lead.id, lead.updated_at, lead.contact_approved_at
      from public.leads as lead
     where lead.organization_id = p_organization_id
       and lead.archived_at is null
       and coalesce(lead.ana_stage, 'novo') <> 'fechado'
       and coalesce(lead.ana_outcome, '') not in ('ganho', 'perdido')
       and lead.modo_atendimento = 'ia'
       and lead.ai_paused = false
       and lead.opt_out = false
       and pg_catalog.lower(coalesce(lead.active_channel, '')) = 'whatsapp'
       and coalesce(lead.automation_status, '') <> 'human'
       and lead.contact_approval_status = 'approved'
       and exists (
         select 1 from public.organization_members member
          where member.organization_id = p_organization_id and member.status = 'active'
            and member.user_id in (lead.owner_id, lead.assigned_to)
       )
       and exists (
         select 1 from public.lead_messages message
          where message.organization_id = p_organization_id and message.lead_id = lead.id
            and message.sender = 'lead'
       )
       and not exists (
         select 1 from public.lead_handoffs handoff
          where handoff.organization_id = p_organization_id and handoff.lead_id = lead.id
            and handoff.status in ('pending', 'accepted')
       )
       and exists (
         select 1
           from public.whatsapp_accounts account
           join public.integrations integration
             on integration.id = account.integration_id and integration.organization_id = account.organization_id
           join public.messaging_provider_controls control
             on control.organization_id = account.organization_id and control.provider = 'wa_akg'
          where account.id = lead.whatsapp_account_id
            and account.organization_id = p_organization_id
            and account.provider = 'wa_akg'
            and account.archived_at is null and account.enabled
            and account.connection_status = 'connected'
            and integration.connected and integration.enabled and not integration.paused
            and control.inbound_enabled and control.send_enabled and control.automation_enabled
            and not control.kill_switch and not coalesce(control.capture_only, false)
       )
       and exists (
         select 1 from private.wa_akg_contact_policy contact_policy
          where contact_policy.organization_id = p_organization_id
            and contact_policy.whatsapp_account_id = lead.whatsapp_account_id
            and contact_policy.lead_id = lead.id
            and contact_policy.classification_state = 'lead_authorized'
            and contact_policy.contact_only = false
            and contact_policy.evidence_state in ('provider_verified', 'operator_confirmed')
       )
       and not private.wa_akg_bound_lead_requires_protection(p_organization_id, lead.id)
       and not exists (
         select 1 from public.ana_existing_lead_batch_items active_item
          where active_item.organization_id = p_organization_id and active_item.lead_id = lead.id
            and active_item.status in ('selected', 'queued', 'processing', 'needs_review')
       )
       and not exists (
         select 1 from public.ana_jobs job
          where job.organization_id = p_organization_id and job.lead_id = lead.id
            and job.status in ('queued', 'retry', 'running')
       )
       and not exists (
         select 1 from public.outreach_jobs outreach
          where outreach.organization_id = p_organization_id and outreach.lead_id = lead.id
            and outreach.status in ('queued', 'retry', 'processing', 'reconciliation_required')
       )
     order by coalesce(lead.next_action_at, lead.last_contact, lead.updated_at) asc, lead.id
     for update of lead skip locked
     limit v_limit
  loop
    v_position := v_position + 1;
    insert into public.ana_existing_lead_batch_items (
      organization_id, batch_id, lead_id, position, status, snapshot
    ) values (
      p_organization_id, v_batch.id, v_candidate.id, v_position,
      case when v_policy.mode = 'review_only' then 'needs_review' else 'selected' end,
      jsonb_build_object('policy_version', v_policy.policy_version, 'lead_updated_at', v_candidate.updated_at,
        'contact_approved_at', v_candidate.contact_approved_at)
    );
    if v_policy.mode = 'approved_followup' then
      v_enqueue := public.enqueue_existing_lead_ana_job(
        p_organization_id,
        (select id from public.ana_existing_lead_batch_items where batch_id = v_batch.id and lead_id = v_candidate.id),
        concat('existing-lead:', v_batch.id::text, ':', v_candidate.id::text)
      );
      if coalesce((v_enqueue ->> 'queued')::boolean, false) then v_queued := v_queued + 1;
      else v_review := v_review + 1; end if;
    else
      v_review := v_review + 1;
    end if;
  end loop;

  update public.ana_existing_lead_batches
     set candidate_count = v_position,
         queued_count = v_queued,
         review_count = v_review,
         status = case when v_position = 0 then 'completed'
                       when v_policy.mode = 'review_only' or v_queued = 0 then 'needs_review'
                       else 'queued' end,
         completed_at = case when v_position = 0 then pg_catalog.now() else null end,
         updated_at = pg_catalog.now()
   where id = v_batch.id and organization_id = p_organization_id;

  return jsonb_build_object('batch_id', v_batch.id, 'status',
    case when v_position = 0 then 'completed' when v_policy.mode = 'review_only' or v_queued = 0 then 'needs_review' else 'queued' end,
    'candidate_count', v_position, 'queued_count', v_queued, 'review_count', v_review,
    'idempotent', false);
end;
$function$;

-- A newer inbound message always wins over a stale proactive selection.  A
-- claimed job is not falsely marked done; its item becomes review-only and
-- ana-run rechecks the same fence before any effect.
create or replace function public.preempt_existing_lead_work_for_inbound(
  p_organization_id uuid,
  p_lead_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_items_changed integer := 0;
  v_jobs_changed integer := 0;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'ana_existing_lead_access_denied';
  end if;
  update public.ana_existing_lead_batch_items item
     set preempted_at = pg_catalog.now(),
         status = case when item.status = 'processing' then 'needs_review' else 'cancelled' end,
         reason_code = 'preempted_by_inbound',
         completed_at = case when item.status = 'processing' then null else pg_catalog.now() end,
         updated_at = pg_catalog.now()
   where item.organization_id = p_organization_id and item.lead_id = p_lead_id
     and item.status in ('selected', 'queued', 'processing');
  get diagnostics v_items_changed = row_count;
  update public.ana_jobs job
     set status = 'cancelled', lease_id = null, lease_expires_at = null,
         completed_at = pg_catalog.now(), last_error_code = 'preempted_by_inbound',
         last_error_message = 'Uma nova mensagem recebida substituiu o trabalho proativo pendente.',
         updated_at = pg_catalog.now()
   where job.organization_id = p_organization_id and job.lead_id = p_lead_id
     and job.event = 'existing_lead.selected'
     and job.status in ('queued', 'retry');
  get diagnostics v_jobs_changed = row_count;
  return v_items_changed + v_jobs_changed;
end;
$function$;

-- Scheduler-only lease: it creates at most one batch per eligible policy
-- tick.  The worker will still execute only one proactive job after inbound.
create or replace function public.claim_due_existing_lead_policy(
  p_organization_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare v_policy public.ana_existing_lead_policies%rowtype;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'ana_existing_lead_access_denied';
  end if;
  select * into v_policy from public.ana_existing_lead_policies policy
   where policy.organization_id = p_organization_id
     and policy.enabled
     and policy.next_run_at is not null and policy.next_run_at <= pg_catalog.now()
     and (policy.scheduler_lease_expires_at is null or policy.scheduler_lease_expires_at <= pg_catalog.now())
     and exists (
       select 1 from public.company_settings company
        where company.organization_id = p_organization_id
          and company.active = true and company.sandbox_mode is not true
          and company.can_use_ia = true and company.ai_actions_enabled = true
          and company.ana_operation_enabled = true and company.ana_operation_mode = 'automatic'
     )
   for update skip locked;
  if not found then return null; end if;
  update public.ana_existing_lead_policies
     set scheduler_lease_id = gen_random_uuid(), scheduler_lease_expires_at = pg_catalog.now() + interval '90 seconds',
         updated_at = pg_catalog.now()
   where organization_id = p_organization_id
   returning * into v_policy;
  return jsonb_build_object('organization_id', v_policy.organization_id, 'lease_id', v_policy.scheduler_lease_id,
    'batch_limit', v_policy.batch_limit, 'policy_version', v_policy.policy_version);
end;
$function$;

create or replace function public.finish_due_existing_lead_policy(
  p_organization_id uuid,
  p_lease_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare v_changed integer;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'ana_existing_lead_access_denied';
  end if;
  update public.ana_existing_lead_policies
     set next_run_at = pg_catalog.now() + make_interval(mins => interval_minutes),
         scheduler_lease_id = null, scheduler_lease_expires_at = null,
         updated_at = pg_catalog.now()
   where organization_id = p_organization_id and scheduler_lease_id = p_lease_id
     and scheduler_lease_expires_at > pg_catalog.now();
  get diagnostics v_changed = row_count;
  return v_changed = 1;
end;
$function$;

create or replace function public.get_ana_existing_lead_work_snapshot(
  p_organization_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_policy public.ana_existing_lead_policies%rowtype;
  v_latest jsonb := null;
  v_queued integer := 0;
  v_eligible integer := 0;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'ana_existing_lead_access_denied';
  end if;
  select * into v_policy from public.ana_existing_lead_policies where organization_id = p_organization_id;
  if not found then
    return jsonb_build_object('settings', jsonb_build_object('enabled', false, 'mode', 'review_only', 'batchLimit', 10),
      'nextRunAt', null, 'eligibleCount', 0, 'queuedCount', 0, 'latestBatch', null);
  end if;
  select count(*) into v_queued from public.ana_existing_lead_batch_items
   where organization_id = p_organization_id and status in ('selected','queued','processing');
  -- This count intentionally omits lead identity, names and contact fields.
  select count(*) into v_eligible from public.leads lead
   where lead.organization_id = p_organization_id and lead.archived_at is null
     and coalesce(lead.ana_stage, 'novo') <> 'fechado'
     and coalesce(lead.ana_outcome, '') not in ('ganho', 'perdido')
     and lead.modo_atendimento = 'ia'
     and lead.ai_paused = false
     and lead.opt_out = false
     and pg_catalog.lower(coalesce(lead.active_channel, '')) = 'whatsapp'
     and coalesce(lead.automation_status, '') <> 'human'
     and lead.contact_approval_status = 'approved'
     and exists (
       select 1 from public.organization_members member
        where member.organization_id = p_organization_id and member.status = 'active'
          and member.user_id in (lead.owner_id, lead.assigned_to)
     )
     and exists (
       select 1 from public.lead_messages message
        where message.organization_id = p_organization_id and message.lead_id = lead.id
          and message.sender = 'lead'
     )
     and not exists (
       select 1 from public.lead_handoffs handoff
        where handoff.organization_id = p_organization_id and handoff.lead_id = lead.id
          and handoff.status in ('pending', 'accepted')
     )
     and exists (
       select 1
         from public.whatsapp_accounts account
         join public.integrations integration
           on integration.id = account.integration_id and integration.organization_id = account.organization_id
         join public.messaging_provider_controls control
           on control.organization_id = account.organization_id and control.provider = 'wa_akg'
        where account.id = lead.whatsapp_account_id
          and account.organization_id = p_organization_id
          and account.provider = 'wa_akg'
          and account.archived_at is null and account.enabled
          and account.connection_status = 'connected'
          and integration.connected and integration.enabled and not integration.paused
          and control.inbound_enabled and control.send_enabled and control.automation_enabled
          and not control.kill_switch and not coalesce(control.capture_only, false)
     )
     and exists (
       select 1 from private.wa_akg_contact_policy contact_policy
        where contact_policy.organization_id = p_organization_id
          and contact_policy.whatsapp_account_id = lead.whatsapp_account_id
          and contact_policy.lead_id = lead.id
          and contact_policy.classification_state = 'lead_authorized'
          and contact_policy.contact_only = false
          and contact_policy.evidence_state in ('provider_verified', 'operator_confirmed')
     )
     and not private.wa_akg_bound_lead_requires_protection(p_organization_id, lead.id)
     and not exists (
       select 1 from public.ana_existing_lead_batch_items active_item
        where active_item.organization_id = p_organization_id and active_item.lead_id = lead.id
          and active_item.status in ('selected', 'queued', 'processing', 'needs_review')
     )
     and not exists (
       select 1 from public.ana_jobs job
        where job.organization_id = p_organization_id and job.lead_id = lead.id
          and job.status in ('queued', 'retry', 'running')
     )
     and not exists (
       select 1 from public.outreach_jobs outreach
        where outreach.organization_id = p_organization_id and outreach.lead_id = lead.id
          and outreach.status in ('queued', 'retry', 'processing', 'reconciliation_required')
     );
  select jsonb_build_object(
    'status', batch.status, 'requestedAt', batch.requested_at,
    'candidateCount', batch.candidate_count, 'queuedCount', batch.queued_count,
    'completedCount', batch.completed_count, 'skippedCount', batch.skipped_count,
    'reviewCount', batch.review_count, 'errorCode', batch.error_code,
    'reviewReason', case when batch.status = 'needs_review' then 'human_review_required' else null end
  ) into v_latest
  from public.ana_existing_lead_batches batch
  where batch.organization_id = p_organization_id
  order by batch.created_at desc limit 1;
  return jsonb_build_object(
    'settings', jsonb_build_object('enabled', v_policy.enabled, 'mode', v_policy.mode, 'batchLimit', v_policy.batch_limit),
    'nextRunAt', v_policy.next_run_at, 'eligibleCount', v_eligible, 'queuedCount', v_queued, 'latestBatch', v_latest
  );
end;
$function$;

create or replace function public.save_ana_existing_lead_work_policy(
  p_organization_id uuid,
  p_actor_id uuid,
  p_enabled boolean,
  p_mode text,
  p_batch_limit integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare v_policy public.ana_existing_lead_policies%rowtype;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'ana_existing_lead_access_denied';
  end if;
  if p_actor_id is null or not private.is_active_org_member(p_organization_id, p_actor_id)
     or not private.has_org_permission(p_organization_id, p_actor_id, 'configuration.manage') then
    raise exception 'ana_existing_lead_configuration_denied';
  end if;
  -- This release only schedules a safe human-review batch. A future
  -- follow-up feature requires its own explicit approval workflow; merely
  -- changing a client payload must never turn a review into an outbound run.
  if p_mode <> 'review_only' or p_batch_limit not between 1 and 10 then
    raise exception 'ana_existing_lead_policy_invalid';
  end if;
  insert into public.ana_existing_lead_policies (
    organization_id, enabled, mode, batch_limit, next_run_at, created_by, updated_by
  ) values (
    p_organization_id, p_enabled, p_mode, p_batch_limit,
    case when p_enabled then pg_catalog.now() else null end,
    p_actor_id, p_actor_id
  ) on conflict (organization_id) do update
    set enabled = excluded.enabled, mode = excluded.mode, batch_limit = excluded.batch_limit,
        next_run_at = case when excluded.enabled then pg_catalog.now() else null end,
        scheduler_lease_id = null, scheduler_lease_expires_at = null,
        policy_version = public.ana_existing_lead_policies.policy_version + 1,
        updated_by = excluded.updated_by, updated_at = pg_catalog.now()
  returning * into v_policy;
  return public.get_ana_existing_lead_work_snapshot(p_organization_id);
end;
$function$;

-- Inbound conversations always outrank proactive work across the queue. The
-- worker additionally stops after one existing-lead job in a tick, so a large
-- portfolio reservation cannot consume a scheduler cycle or overtake a reply.
create or replace function public.claim_ana_job(p_job_id uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_job public.ana_jobs%rowtype;
  v_lease uuid := pg_catalog.gen_random_uuid();
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'ana_job_access_denied';
  end if;
  update public.ana_jobs
     set status = 'dead_letter', lease_id = null, lease_expires_at = null,
         completed_at = pg_catalog.now(), last_error_code = 'ana_job_lease_expired_max_attempts',
         last_error_message = 'A execução expirou após consumir as tentativas seguras e requer revisão humana.',
         updated_at = pg_catalog.now()
   where status = 'running' and lease_expires_at <= pg_catalog.now() and attempt_count >= max_attempts;
  select job.* into v_job
    from public.ana_jobs as job
   where (p_job_id is null or job.id = p_job_id)
     and ((job.status in ('queued', 'retry') and job.run_at <= pg_catalog.now())
       or (job.status = 'running' and job.lease_expires_at <= pg_catalog.now()))
     and job.attempt_count < job.max_attempts
     and not exists (
       select 1 from public.ana_jobs as earlier
        where earlier.organization_id = job.organization_id and earlier.lead_id = job.lead_id
          and earlier.id <> job.id
          and earlier.status in ('queued', 'retry', 'running', 'needs_review', 'dead_letter')
          and (earlier.created_at, earlier.id) < (job.created_at, job.id)
     )
   order by case job.event
              when 'message.received' then 0
              when 'existing_lead.selected' then 2
              else 1
            end,
            job.run_at, job.created_at, job.id
   for update skip locked limit 1;
  if v_job.id is null then return null; end if;
  if v_job.source_integration_id is not null and exists (
    select 1 from public.whatsapp_accounts account
     where account.organization_id = v_job.organization_id
       and account.integration_id = v_job.source_integration_id
       and account.provider = 'wa_akg'
       and account.archived_at is null
  ) then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('wa_akg_capture:' || v_job.organization_id::text, 0)
    );
  end if;
  update public.ana_jobs as job
     set status = 'running', attempt_count = job.attempt_count + 1, lease_id = v_lease,
         lease_expires_at = pg_catalog.now() + interval '90 seconds',
         started_at = coalesce(job.started_at, pg_catalog.now()), last_error_code = null,
         last_error_message = null, updated_at = pg_catalog.now()
   where job.id = v_job.id
   returning * into v_job;
  if v_job.status <> 'running' then return null; end if;
  return pg_catalog.to_jsonb(v_job);
end;
$function$;

revoke all on function public.enqueue_existing_lead_ana_job(uuid, uuid, text),
  public.reserve_existing_leads_for_ana(uuid, uuid, text, integer, uuid),
  public.preempt_existing_lead_work_for_inbound(uuid, uuid),
  public.claim_due_existing_lead_policy(uuid), public.finish_due_existing_lead_policy(uuid, uuid),
  public.get_ana_existing_lead_work_snapshot(uuid),
  public.save_ana_existing_lead_work_policy(uuid, uuid, boolean, text, integer)
  from public, anon, authenticated;
grant execute on function public.enqueue_existing_lead_ana_job(uuid, uuid, text),
  public.reserve_existing_leads_for_ana(uuid, uuid, text, integer, uuid),
  public.preempt_existing_lead_work_for_inbound(uuid, uuid),
  public.claim_due_existing_lead_policy(uuid), public.finish_due_existing_lead_policy(uuid, uuid),
  public.get_ana_existing_lead_work_snapshot(uuid),
  public.save_ana_existing_lead_work_policy(uuid, uuid, boolean, text, integer)
  to service_role;

revoke all on function private.sync_ana_existing_lead_item_from_job(),
  private.enforce_ana_existing_lead_item_scope(),
  private.enforce_ana_existing_lead_job_link(),
  private.enforce_ana_existing_lead_run_link(),
  private.sync_ana_existing_lead_batch_from_item() from public, anon, authenticated;

commit;
