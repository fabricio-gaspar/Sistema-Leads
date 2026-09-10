begin;

-- A reservation is kept on the existing queue row. It serializes only the
-- automatic outbound quota for one organization/lead/channel/local day; no
-- new operational table or browser-callable endpoint is introduced.
create index if not exists outreach_jobs_ana_policy_reservation_idx
  on public.outreach_jobs (
    organization_id,
    lead_id,
    channel,
    ((payload ->> 'ana_policy_day'))
  )
  where status in ('processing', 'reconciliation_required')
    and coalesce(payload ->> 'manual', 'false') <> 'true';

create or replace function public.reserve_ana_outbound_policy(
  p_organization_id uuid,
  p_job_id uuid,
  p_lead_id uuid,
  p_channel text,
  p_daily_limit integer,
  p_time_zone text,
  p_local_day date,
  p_configuration_version_id uuid
)
returns table(
  allowed boolean,
  reason text,
  used_count integer,
  local_day date
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_job public.outreach_jobs%rowtype;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_used integer := 0;
begin
  if p_organization_id is null
     or p_job_id is null
     or p_lead_id is null
     or p_channel not in ('whatsapp', 'email')
     or p_daily_limit is null
     or p_daily_limit < 1
     or p_daily_limit > 20
     or p_local_day is null
     or p_configuration_version_id is null
     or not exists (
       select 1
         from pg_catalog.pg_timezone_names
        where name = p_time_zone
     ) then
    raise exception 'ana_policy_reservation_input_invalid';
  end if;

  -- This lock makes the count and reservation one operation even if two
  -- scheduler invocations claim different jobs at the same time.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_organization_id::text || ':' || p_lead_id::text || ':' || p_channel || ':' || p_local_day::text,
      0
    )
  );

  select j.*
    into v_job
    from public.outreach_jobs as j
   where j.id = p_job_id
     and j.organization_id = p_organization_id
   for update;
  if not found then
    raise exception 'ana_policy_job_not_found';
  end if;
  if v_job.status <> 'processing' then
    return query select false, 'ana_policy_job_not_processing', 0, p_local_day;
    return;
  end if;
  if v_job.channel <> p_channel then
    return query select false, 'ana_policy_channel_mismatch', 0, p_local_day;
    return;
  end if;
  if v_job.lead_id <> p_lead_id then
    return query select false, 'ana_policy_lead_mismatch', 0, p_local_day;
    return;
  end if;
  if coalesce(v_job.payload ->> 'manual', 'false') = 'true' then
    return query select false, 'ana_policy_manual_job', 0, p_local_day;
    return;
  end if;

  v_start_at := p_local_day::timestamp at time zone p_time_zone;
  v_end_at := (p_local_day + 1)::timestamp at time zone p_time_zone;

  select count(*)::integer
    into v_used
   from public.outreach_jobs as j
   where j.organization_id = p_organization_id
     and j.lead_id = p_lead_id
     and j.channel = p_channel
     and coalesce(j.payload ->> 'manual', 'false') <> 'true'
     and (
       (j.status = 'processed'
        and j.processed_at >= v_start_at
        and j.processed_at < v_end_at)
       or (
         j.status in ('processing', 'reconciliation_required')
         and j.payload ->> 'ana_policy_day' = p_local_day::text
       )
     );

  -- A retry of the same already-reserved job is idempotent; it must not be
  -- rejected merely because its own reservation is counted.
  if v_job.payload ->> 'ana_policy_day' = p_local_day::text then
    return query select true, 'ana_policy_already_reserved', v_used, p_local_day;
    return;
  end if;
  if v_used >= p_daily_limit then
    return query select false, 'ana_daily_message_limit_reached', v_used, p_local_day;
    return;
  end if;

  update public.outreach_jobs as j
     set payload = coalesce(j.payload, '{}'::jsonb)
       || pg_catalog.jsonb_build_object(
         'ana_policy_day', p_local_day::text,
         'ana_policy_version_id', p_configuration_version_id::text,
         'ana_policy_reserved_at', pg_catalog.now()
       )
   where j.id = p_job_id
     and j.organization_id = p_organization_id
     and j.status = 'processing';
  if not found then
    raise exception 'ana_policy_job_changed';
  end if;

  return query select true, 'ana_policy_reserved', v_used + 1, p_local_day;
end;
$function$;

revoke all on function public.reserve_ana_outbound_policy(uuid, uuid, uuid, text, integer, text, date, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_ana_outbound_policy(uuid, uuid, uuid, text, integer, text, date, uuid)
  to service_role;

commit;
