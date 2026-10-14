-- Linearizable maintenance fence for WA-AKG side effects.
--
-- A capture transition is only considered active after every already-started
-- provider dispatch, callback worker, and source-bound Ana run has drained.
-- New work takes the same control-row lock before it crosses an effect
-- boundary, so it either finishes before the transition or is held for review.
begin;

alter table public.messaging_send_reservations
  drop constraint if exists messaging_send_reservations_state_check;

alter table public.messaging_send_reservations
  add constraint messaging_send_reservations_state_check
    check (state in ('reserved', 'dispatching', 'sent', 'failed', 'reconciliation_required')),
  add column if not exists dispatch_token uuid,
  add column if not exists dispatch_started_at timestamptz;

alter table public.daily_lead_report_deliveries
  drop constraint if exists daily_lead_report_deliveries_status_check;

alter table public.daily_lead_report_deliveries
  add constraint daily_lead_report_deliveries_status_check
    check (status in ('queued', 'sending', 'sent', 'failed', 'reconciliation_required', 'blocked'));

create or replace function public.reserve_whatsapp_send_slot(
  p_organization_id uuid,
  p_whatsapp_account_id uuid,
  p_idempotency_key text
)
returns table(allowed boolean, reason text, not_before timestamptz)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_existing public.messaging_send_reservations%rowtype;
  v_controls public.messaging_provider_controls%rowtype;
  v_last timestamptz;
  v_not_before timestamptz;
  v_delay integer;
  v_burst_count integer;
  v_daily_count integer;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'wa_akg_send_slot_access_denied';
  end if;
  if p_organization_id is null or p_whatsapp_account_id is null
     or p_idempotency_key is null
     or char_length(btrim(p_idempotency_key)) not between 1 and 180 then
    raise exception 'wa_akg_send_slot_input_invalid';
  end if;

  -- This lock is also held by the capture transition and the final dispatch
  -- claim. It makes the control decision and reservation ordering explicit.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('wa_akg_capture:' || p_organization_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('wa_akg_send:' || p_organization_id::text || ':' || p_whatsapp_account_id::text, 0)
  );

  select r.* into v_existing
    from public.messaging_send_reservations r
   where r.organization_id = p_organization_id
     and r.whatsapp_account_id = p_whatsapp_account_id
     and r.idempotency_key = btrim(p_idempotency_key)
   limit 1;
  if found then
    if v_existing.state = 'reserved' then
      return query select true, 'already_reserved', v_existing.not_before;
    else
      return query select false, 'wa_akg_slot_' || v_existing.state, v_existing.not_before;
    end if;
    return;
  end if;

  select c.* into v_controls
    from public.messaging_provider_controls c
   where c.organization_id = p_organization_id and c.provider = 'wa_akg'
   for update;
  if not found then
    return query select false, 'wa_akg_controls_not_ready', pg_catalog.now();
    return;
  end if;
  if v_controls.capture_only then
    return query select false, 'wa_akg_capture_only', pg_catalog.now();
    return;
  end if;
  if v_controls.kill_switch then
    return query select false, 'wa_akg_kill_switch', pg_catalog.now();
    return;
  end if;
  if not v_controls.send_enabled then
    return query select false, 'wa_akg_send_disabled', pg_catalog.now();
    return;
  end if;

  if not exists (
    select 1 from public.whatsapp_accounts a
     where a.id = p_whatsapp_account_id
       and a.organization_id = p_organization_id
       and a.provider = 'wa_akg'
       and a.enabled
       and a.connection_status = 'connected'
       and a.archived_at is null
  ) then
    return query select false, 'wa_akg_account_not_ready', pg_catalog.now();
    return;
  end if;

  select count(*)::integer into v_daily_count
    from public.messaging_send_reservations r
   where r.organization_id = p_organization_id
     and r.provider = 'wa_akg'
     and r.state in ('reserved', 'dispatching', 'sent')
     and r.created_at >= pg_catalog.now() - interval '24 hours';
  if v_daily_count >= v_controls.daily_limit then
    return query select false, 'wa_akg_daily_limit_reached', pg_catalog.now() + interval '1 hour';
    return;
  end if;

  select count(*)::integer into v_burst_count
    from public.messaging_send_reservations r
   where r.organization_id = p_organization_id
     and r.whatsapp_account_id = p_whatsapp_account_id
     and r.state in ('reserved', 'dispatching', 'sent')
     and r.not_before >= pg_catalog.now() - pg_catalog.make_interval(secs => v_controls.burst_window_seconds);

  select max(r.not_before) into v_last
    from public.messaging_send_reservations r
   where r.organization_id = p_organization_id
     and r.whatsapp_account_id = p_whatsapp_account_id
     and r.state in ('reserved', 'dispatching', 'sent')
     and r.created_at >= pg_catalog.now() - interval '24 hours';

  v_delay := v_controls.min_delay_seconds
    + floor(random() * (v_controls.max_delay_seconds - v_controls.min_delay_seconds + 1))::integer;
  v_not_before := greatest(pg_catalog.now(), coalesce(v_last, pg_catalog.now()))
    + pg_catalog.make_interval(secs => v_delay);
  if v_burst_count >= v_controls.burst_limit then
    v_not_before := greatest(
      v_not_before,
      pg_catalog.now() + pg_catalog.make_interval(secs => v_controls.burst_window_seconds)
    );
  end if;

  insert into public.messaging_send_reservations (
    organization_id, whatsapp_account_id, provider, idempotency_key, not_before
  ) values (
    p_organization_id, p_whatsapp_account_id, 'wa_akg', btrim(p_idempotency_key), v_not_before
  );
  return query select true, 'reserved', v_not_before;
end;
$function$;

create or replace function public.begin_wa_akg_send_dispatch(
  p_organization_id uuid,
  p_whatsapp_account_id uuid,
  p_idempotency_key text
)
returns table(allowed boolean, reason text, dispatch_token uuid)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_controls public.messaging_provider_controls%rowtype;
  v_reservation public.messaging_send_reservations%rowtype;
  v_token uuid := pg_catalog.gen_random_uuid();
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'wa_akg_send_dispatch_access_denied';
  end if;
  if p_organization_id is null or p_whatsapp_account_id is null
     or p_idempotency_key is null
     or char_length(btrim(p_idempotency_key)) not between 1 and 180 then
    raise exception 'wa_akg_send_dispatch_input_invalid';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('wa_akg_capture:' || p_organization_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('wa_akg_send:' || p_organization_id::text || ':' || p_whatsapp_account_id::text, 0)
  );
  select c.* into v_controls
    from public.messaging_provider_controls c
   where c.organization_id = p_organization_id and c.provider = 'wa_akg'
   for update;
  if not found then
    return query select false, 'wa_akg_controls_not_ready', null::uuid;
    return;
  end if;
  if v_controls.capture_only then
    return query select false, 'wa_akg_capture_only', null::uuid;
    return;
  end if;
  if v_controls.kill_switch then
    return query select false, 'wa_akg_kill_switch', null::uuid;
    return;
  end if;
  if not v_controls.send_enabled then
    return query select false, 'wa_akg_send_disabled', null::uuid;
    return;
  end if;
  select r.* into v_reservation
    from public.messaging_send_reservations r
   where r.organization_id = p_organization_id
     and r.whatsapp_account_id = p_whatsapp_account_id
     and r.idempotency_key = btrim(p_idempotency_key)
   for update;
  if not found then
    return query select false, 'wa_akg_slot_missing', null::uuid;
    return;
  end if;
  if v_reservation.state <> 'reserved' then
    return query select false, 'wa_akg_slot_' || v_reservation.state, null::uuid;
    return;
  end if;
  if v_reservation.not_before > pg_catalog.now() then
    return query select false, 'wa_akg_pacing_wait', null::uuid;
    return;
  end if;
  update public.messaging_send_reservations
     set state = 'dispatching', dispatch_token = v_token, dispatch_started_at = pg_catalog.now()
   where id = v_reservation.id;
  return query select true, 'dispatching', v_token;
end;
$function$;

create or replace function public.complete_wa_akg_send_dispatch(
  p_organization_id uuid,
  p_whatsapp_account_id uuid,
  p_idempotency_key text,
  p_dispatch_token uuid,
  p_provider_message_id text,
  p_outcome text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_changed integer;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'wa_akg_send_dispatch_access_denied';
  end if;
  if p_outcome not in ('sent', 'failed', 'reconciliation_required') then
    raise exception 'wa_akg_send_dispatch_outcome_invalid';
  end if;
  update public.messaging_send_reservations
     set state = p_outcome,
         provider_message_id = case when p_outcome = 'sent' then nullif(btrim(p_provider_message_id), '') else null end,
         dispatch_token = null
   where organization_id = p_organization_id
     and whatsapp_account_id = p_whatsapp_account_id
     and idempotency_key = btrim(p_idempotency_key)
     and state = 'dispatching'
     and dispatch_token = p_dispatch_token;
  get diagnostics v_changed = row_count;
  return v_changed = 1;
end;
$function$;

-- Keep the immediately previous signature as a service-role-only bridge for
-- an invocation that began just before an Edge deployment.  New callers use
-- the explicit outcome above; this overload never widens access or retries.
create or replace function public.complete_wa_akg_send_dispatch(
  p_organization_id uuid,
  p_whatsapp_account_id uuid,
  p_idempotency_key text,
  p_dispatch_token uuid,
  p_provider_message_id text,
  p_succeeded boolean
)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select public.complete_wa_akg_send_dispatch(
    p_organization_id,
    p_whatsapp_account_id,
    p_idempotency_key,
    p_dispatch_token,
    p_provider_message_id,
    case when p_succeeded then 'sent' else 'failed' end
  );
$function$;

-- Automatic work has one stricter effect boundary than a human reply.  The
-- control row is locked in the same transaction as the existing reservation
-- and dispatch functions, so a late Ana pause cannot be bypassed between the
-- worker's final read and the provider call.
create or replace function public.reserve_automatic_wa_akg_send_slot(
  p_organization_id uuid,
  p_whatsapp_account_id uuid,
  p_idempotency_key text
)
returns table(allowed boolean, reason text, not_before timestamptz)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_controls public.messaging_provider_controls%rowtype;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'wa_akg_send_slot_access_denied';
  end if;
  select control.* into v_controls
    from public.messaging_provider_controls as control
   where control.organization_id = p_organization_id
     and control.provider = 'wa_akg'
   for update;
  if not found
     or coalesce(v_controls.capture_only, false)
     or v_controls.kill_switch
     or v_controls.send_enabled is not true
     or v_controls.automation_enabled is not true then
    return query select false, 'wa_akg_automation_not_ready', pg_catalog.now();
    return;
  end if;
  return query
  select slot.allowed, slot.reason, slot.not_before
    from public.reserve_whatsapp_send_slot(
      p_organization_id,
      p_whatsapp_account_id,
      p_idempotency_key
    ) as slot;
end;
$function$;

create or replace function public.begin_automatic_wa_akg_send_dispatch(
  p_organization_id uuid,
  p_whatsapp_account_id uuid,
  p_idempotency_key text
)
returns table(allowed boolean, reason text, dispatch_token uuid)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_controls public.messaging_provider_controls%rowtype;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'wa_akg_send_dispatch_access_denied';
  end if;
  select control.* into v_controls
    from public.messaging_provider_controls as control
   where control.organization_id = p_organization_id
     and control.provider = 'wa_akg'
   for update;
  if not found
     or coalesce(v_controls.capture_only, false)
     or v_controls.kill_switch
     or v_controls.send_enabled is not true
     or v_controls.automation_enabled is not true then
    return query select false, 'wa_akg_automation_not_ready', null::uuid;
    return;
  end if;
  return query
  select dispatch.allowed, dispatch.reason, dispatch.dispatch_token
    from public.begin_wa_akg_send_dispatch(
      p_organization_id,
      p_whatsapp_account_id,
      p_idempotency_key
    ) as dispatch;
end;
$function$;

-- Use this RPC for maintenance transitions.  It does not claim success while
-- a provider request, callback worker, or source-bound Ana execution is live.
create or replace function public.set_wa_akg_capture_only(
  p_organization_id uuid,
  p_capture_only boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_controls public.messaging_provider_controls%rowtype;
  v_in_flight boolean;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'wa_akg_capture_access_denied';
  end if;
  if p_organization_id is null then raise exception 'wa_akg_capture_input_invalid'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('wa_akg_capture:' || p_organization_id::text, 0)
  );
  select c.* into v_controls
    from public.messaging_provider_controls c
   where c.organization_id = p_organization_id and c.provider = 'wa_akg'
   for update;
  if not found then raise exception 'wa_akg_controls_not_found'; end if;

  if p_capture_only then
    select exists (
      select 1 from public.messaging_send_reservations r
       where r.organization_id = p_organization_id and r.provider = 'wa_akg' and r.state = 'dispatching'
      union all
      select 1 from public.wa_akg_webhook_events e
       where e.organization_id = p_organization_id and e.processing_status = 'processing'
      union all
      select 1 from public.ana_jobs j
       join public.whatsapp_accounts a
         on a.integration_id = j.source_integration_id
        and a.organization_id = j.organization_id
        and a.provider = 'wa_akg'
        and a.archived_at is null
       where j.organization_id = p_organization_id and j.status = 'running'
    ) into v_in_flight;
    if v_in_flight then
      return pg_catalog.jsonb_build_object('applied', false, 'reason', 'wa_akg_dispatch_in_flight');
    end if;
    -- A reservation has not crossed the provider-effect boundary. Preserve it
    -- so the same idempotency key can resume after maintenance ends; marking it
    -- failed here would silently discard a paced, unsent message.
  end if;

  update public.messaging_provider_controls
     set capture_only = p_capture_only
   where organization_id = p_organization_id and provider = 'wa_akg';
  return pg_catalog.jsonb_build_object('applied', true, 'capture_only', p_capture_only);
end;
$function$;

revoke all on function public.reserve_whatsapp_send_slot(uuid, uuid, text),
  public.reserve_automatic_wa_akg_send_slot(uuid, uuid, text),
  public.begin_wa_akg_send_dispatch(uuid, uuid, text),
  public.begin_automatic_wa_akg_send_dispatch(uuid, uuid, text),
  public.complete_wa_akg_send_dispatch(uuid, uuid, text, uuid, text, text),
  public.complete_wa_akg_send_dispatch(uuid, uuid, text, uuid, text, boolean),
  public.set_wa_akg_capture_only(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.reserve_whatsapp_send_slot(uuid, uuid, text),
  public.reserve_automatic_wa_akg_send_slot(uuid, uuid, text),
  public.begin_wa_akg_send_dispatch(uuid, uuid, text),
  public.begin_automatic_wa_akg_send_dispatch(uuid, uuid, text),
  public.complete_wa_akg_send_dispatch(uuid, uuid, text, uuid, text, text),
  public.complete_wa_akg_send_dispatch(uuid, uuid, text, uuid, text, boolean),
  public.set_wa_akg_capture_only(uuid, boolean)
  to service_role;

-- Claiming a callback participates in the same lock protocol as capture. A
-- transition therefore sees any successful claim as in-flight and waits for an
-- operator retry instead of allowing that callback to cross an effect fence.
create or replace function public.claim_whatsapp_webhook_event(
  p_provider text,
  p_event_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  t text := private.whatsapp_event_table(p_provider);
  e record;
  w private.whatsapp_inbound_work%rowtype;
  token uuid;
  v_capture_only boolean := false;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('whatsapp-event:' || p_provider || ':' || p_event_id::text, 0)
  );
  execute pg_catalog.format('select * from public.%I where id=$1 for update', t)
    into e using p_event_id;
  if e.id is null
     or e.processing_status not in ('queued', 'failed', 'processing')
     or (e.processing_status <> 'processing' and e.next_retry_at > pg_catalog.now()) then
    return null;
  end if;
  if not exists (
    select 1 from public.whatsapp_accounts account_row
      join public.integrations integration_row
        on integration_row.id = account_row.integration_id
       and integration_row.organization_id = account_row.organization_id
     where account_row.id = e.whatsapp_account_id
       and account_row.organization_id = e.organization_id
       and account_row.integration_id = e.integration_id
       and account_row.provider = p_provider
       and account_row.archived_at is null
  ) then
    raise exception 'whatsapp_event_scope_invalid';
  end if;
  if p_provider = 'wa_akg' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('wa_akg_capture:' || e.organization_id::text, 0)
    );
    select c.capture_only into v_capture_only
      from public.messaging_provider_controls c
     where c.organization_id = e.organization_id and c.provider = 'wa_akg'
     for share;
    if coalesce(v_capture_only, false) then return null; end if;
  end if;
  select * into w from private.whatsapp_inbound_work
   where provider = p_provider and event_id = p_event_id for update;
  if (w.event_id is null and e.processing_status = 'processing')
     or (w.phase = 'dispatching' and w.lease_expires_at <= pg_catalog.now()) then
    execute pg_catalog.format(
      'update public.%I set processing_status=''needs_review'',error_code=''inbound_effect_unknown'',processed_at=now() where id=$1', t
    ) using p_event_id;
    update private.whatsapp_inbound_work
       set phase = 'needs_review', updated_at = pg_catalog.now()
     where provider = p_provider and event_id = p_event_id;
    return null;
  end if;
  if w.phase in ('dispatching', 'completed', 'needs_review') or w.lease_expires_at > pg_catalog.now() then
    return null;
  end if;
  token := pg_catalog.gen_random_uuid();
  insert into private.whatsapp_inbound_work(
    provider, event_id, organization_id, account_id, lease_id, lease_expires_at
  ) values (
    p_provider, p_event_id, e.organization_id, e.whatsapp_account_id,
    token, pg_catalog.now() + interval '2 minutes'
  ) on conflict(provider, event_id) do update
    set lease_id = excluded.lease_id,
        lease_expires_at = excluded.lease_expires_at,
        updated_at = pg_catalog.now()
    returning * into w;
  if w.organization_id <> e.organization_id or w.account_id <> e.whatsapp_account_id then
    raise exception 'whatsapp_event_scope_invalid';
  end if;
  execute pg_catalog.format(
    'update public.%I set processing_status=''processing'',attempt_count=least(attempt_count+1,20),next_retry_at=now()+interval ''2 minutes'',error_code=null where id=$1 returning *', t
  ) into e using p_event_id;
  return pg_catalog.to_jsonb(e) || pg_catalog.jsonb_build_object('lease_id', token, 'phase', w.phase);
end;
$function$;

-- Queue-triggered Ana runs from a WA-AKG source enter review once capture has
-- been committed.  This protects both enqueue and claim/retry paths.
create or replace function private.fence_wa_akg_capture_ana_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.source_integration_id is null or new.status not in ('queued', 'retry', 'running') then
    return new;
  end if;
  -- Only WA-AKG-originated jobs share the maintenance protocol.  Taking the
  -- organization lock before the capture read closes the enqueue/claim race:
  -- a job either becomes running before capture (so capture refuses) or is
  -- preserved for review after capture commits.
  if exists (
    select 1 from public.whatsapp_accounts a
     where a.organization_id = new.organization_id
       and a.integration_id = new.source_integration_id
       and a.provider = 'wa_akg'
       and a.archived_at is null
  ) then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('wa_akg_capture:' || new.organization_id::text, 0)
    );
  else
    return new;
  end if;
  if exists (
    select 1 from public.whatsapp_accounts a
      join public.messaging_provider_controls c
        on c.organization_id = a.organization_id
       and c.provider = 'wa_akg'
       and c.capture_only
     where a.organization_id = new.organization_id
       and a.integration_id = new.source_integration_id
       and a.provider = 'wa_akg'
       and a.archived_at is null
  ) then
    new.status := 'needs_review';
    new.lease_id := null;
    new.lease_expires_at := null;
    new.completed_at := coalesce(new.completed_at, pg_catalog.now());
    new.last_error_code := 'wa_akg_capture_only';
    new.last_error_message := 'A execução originada do WhatsApp foi preservada para revisão durante manutenção.';
  end if;
  return new;
end;
$function$;

drop trigger if exists ana_jobs_wa_akg_capture_fence on public.ana_jobs;
create trigger ana_jobs_wa_akg_capture_fence
before insert or update of status on public.ana_jobs
for each row execute function private.fence_wa_akg_capture_ana_job();

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
  if current_user not in ('postgres', 'service_role') then raise exception 'ana_job_access_denied'; end if;
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
   order by job.run_at, job.created_at, job.id
   for update skip locked limit 1;
  if v_job.id is null then return null; end if;
  if v_job.source_integration_id is not null and exists (
    select 1 from public.whatsapp_accounts a
     where a.organization_id = v_job.organization_id
       and a.integration_id = v_job.source_integration_id
       and a.provider = 'wa_akg'
       and a.archived_at is null
  ) then
    -- The trigger below uses the same lock.  This makes a queue claim and a
    -- capture transition linearizable even when they begin concurrently.
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
  -- The BEFORE UPDATE fence can turn this claim into needs_review. Never
  -- return that row to an Edge worker as if it had a valid execution lease.
  if v_job.status <> 'running' then return null; end if;
  return pg_catalog.to_jsonb(v_job);
end;
$function$;

revoke all on function public.claim_whatsapp_webhook_event(text, uuid), public.claim_ana_job(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_whatsapp_webhook_event(text, uuid), public.claim_ana_job(uuid)
  to service_role;

commit;
