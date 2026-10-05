begin;

alter table public.whatsapp_accounts
  drop constraint if exists whatsapp_accounts_provider_check,
  drop constraint if exists whatsapp_accounts_provider_integration_check;

alter table public.whatsapp_accounts
  add constraint whatsapp_accounts_provider_check
    check (provider in ('zapi', 'meta_cloud', 'evolution_go', 'wa_akg')),
  add constraint whatsapp_accounts_provider_integration_check
    check (provider not in ('zapi', 'evolution_go', 'wa_akg') or integration_id is not null);

alter table public.messaging_provider_controls
  drop constraint if exists messaging_provider_controls_provider_check;

alter table public.messaging_provider_controls
  add constraint messaging_provider_controls_provider_check
    check (provider in ('zapi', 'meta_cloud', 'evolution_go', 'wa_akg')),
  add column if not exists min_delay_seconds integer not null default 10
    check (min_delay_seconds between 1 and 3600),
  add column if not exists max_delay_seconds integer not null default 30
    check (max_delay_seconds between 1 and 7200),
  add column if not exists burst_limit integer not null default 3
    check (burst_limit between 1 and 100),
  add column if not exists burst_window_seconds integer not null default 60
    check (burst_window_seconds between 10 and 86400),
  add column if not exists daily_limit integer not null default 100
    check (daily_limit between 1 and 100000),
  add constraint messaging_provider_controls_delay_order_check
    check (max_delay_seconds >= min_delay_seconds);

drop index if exists public.whatsapp_accounts_org_owner_uidx;
create unique index whatsapp_accounts_org_owner_provider_uidx
  on public.whatsapp_accounts (organization_id, owner_user_id, provider)
  where account_type = 'seller' and owner_user_id is not null and archived_at is null;

create unique index if not exists lead_messages_wa_akg_provider_message_uidx
  on public.lead_messages (organization_id, provider_message_id)
  where provider = 'wa_akg' and provider_message_id is not null;

create table public.wa_akg_webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  whatsapp_account_id uuid not null references public.whatsapp_accounts(id) on delete cascade,
  integration_id uuid not null references public.integrations(id) on delete cascade,
  external_event_id text not null check (char_length(external_event_id) between 1 and 300),
  event_kind text not null check (event_kind in ('inbound', 'receipt', 'connection', 'ignored')),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  sanitized_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(sanitized_payload) = 'object'),
  processing_status text not null default 'queued'
    check (processing_status in ('queued', 'processing', 'processed', 'ignored', 'needs_review', 'failed', 'dead_letter')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  next_retry_at timestamptz not null default now(),
  occurred_at timestamptz,
  processed_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, whatsapp_account_id, external_event_id)
);

create index wa_akg_webhook_events_queue_idx
  on public.wa_akg_webhook_events (next_retry_at, created_at)
  where processing_status in ('queued', 'failed');
create index wa_akg_webhook_events_account_idx
  on public.wa_akg_webhook_events (organization_id, whatsapp_account_id, created_at desc);
create index wa_akg_webhook_events_integration_fk_idx
  on public.wa_akg_webhook_events (integration_id);

alter table public.wa_akg_webhook_events enable row level security;
revoke all on table public.wa_akg_webhook_events from public, anon, authenticated;
grant all on table public.wa_akg_webhook_events to service_role;

drop trigger if exists wa_akg_webhook_events_set_updated_at on public.wa_akg_webhook_events;
create trigger wa_akg_webhook_events_set_updated_at
before update on public.wa_akg_webhook_events
for each row execute procedure public.set_updated_at();

create table public.wa_akg_seller_provisioning_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  account_id uuid references public.whatsapp_accounts(id) on delete set null,
  integration_id uuid references public.integrations(id) on delete set null,
  invite_id uuid references public.organization_invites(id) on delete set null,
  source text not null default 'direct_create' check (source in ('direct_create', 'invite', 'manual')),
  session_name text not null check (char_length(session_name) between 8 and 120),
  state text not null default 'queued'
    check (state in ('queued', 'processing', 'completed', 'failed', 'needs_review', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by uuid,
  error_code text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, owner_user_id)
);

create index wa_akg_seller_provisioning_queue_idx
  on public.wa_akg_seller_provisioning_jobs (next_attempt_at, created_at)
  where state in ('queued', 'failed');
create index wa_akg_seller_provisioning_requested_by_idx
  on public.wa_akg_seller_provisioning_jobs (requested_by) where requested_by is not null;
create index wa_akg_seller_provisioning_account_idx
  on public.wa_akg_seller_provisioning_jobs (account_id) where account_id is not null;
create index wa_akg_seller_provisioning_integration_idx
  on public.wa_akg_seller_provisioning_jobs (integration_id) where integration_id is not null;
create index wa_akg_seller_provisioning_invite_idx
  on public.wa_akg_seller_provisioning_jobs (invite_id) where invite_id is not null;

alter table public.wa_akg_seller_provisioning_jobs enable row level security;
revoke all on table public.wa_akg_seller_provisioning_jobs from public, anon, authenticated;
grant all on table public.wa_akg_seller_provisioning_jobs to service_role;

drop trigger if exists wa_akg_seller_provisioning_set_updated_at on public.wa_akg_seller_provisioning_jobs;
create trigger wa_akg_seller_provisioning_set_updated_at
before update on public.wa_akg_seller_provisioning_jobs
for each row execute procedure public.set_updated_at();

create or replace function public.enqueue_wa_akg_seller_provisioning(
  p_organization_id uuid,
  p_user_id uuid,
  p_created_by uuid,
  p_source text,
  p_invite_id uuid default null
)
returns table(
  job_id uuid,
  whatsapp_account_id uuid,
  integration_id uuid,
  instance_name text,
  state text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job_id uuid;
  v_account_id uuid;
  v_integration_id uuid;
  v_session_name text;
  v_label text;
  v_state text;
begin
  if p_organization_id is null or p_user_id is null or p_created_by is null
     or p_source not in ('direct_create', 'invite', 'manual') then
    raise exception 'wa_akg_provisioning_input_invalid';
  end if;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = p_user_id
      and m.status = 'active'
  ) then
    raise exception 'wa_akg_owner_inactive';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text || ':' || p_user_id::text || ':wa_akg', 0)
  );

  select a.id, a.integration_id into v_account_id, v_integration_id
  from public.whatsapp_accounts a
  where a.organization_id = p_organization_id
    and a.owner_user_id = p_user_id
    and a.provider = 'wa_akg'
    and a.account_type = 'seller'
    and a.archived_at is null
  limit 1;

  v_session_name := 'seller_' || replace(p_user_id::text, '-', '');
  select coalesce(nullif(btrim(p.name), ''), 'WhatsApp do vendedor') into v_label
  from public.profiles p where p.id = p_user_id;
  v_label := coalesce(v_label, 'WhatsApp do vendedor');

  if v_account_id is null then
    v_account_id := gen_random_uuid();
    v_integration_id := gen_random_uuid();
    insert into public.integrations (
      id, organization_id, key, label, provider, category, connected, enabled, paused, mode,
      status_detail, configuration
    ) values (
      v_integration_id, p_organization_id, 'whatsapp_wa_akg:' || v_account_id::text,
      v_label, 'WA-AKG', 'communication', false, false, true, 'real',
      'Canal individual criado; aguardando provisionamento seguro do WA-AKG.',
      jsonb_build_object('configured', false, 'session_name', v_session_name, 'provider_version', '1.7.0-beta.1')
    );
    insert into public.whatsapp_accounts (
      id, organization_id, integration_id, owner_user_id, label, provider, account_type,
      is_default, enabled, connection_status, created_by, provider_metadata
    ) values (
      v_account_id, p_organization_id, v_integration_id, p_user_id, v_label, 'wa_akg', 'seller',
      false, false, 'unconfigured', p_created_by,
      jsonb_build_object('session_name', v_session_name, 'provider_version', '1.7.0-beta.1')
    );
  end if;

  insert into public.wa_akg_seller_provisioning_jobs (
    organization_id, owner_user_id, requested_by, account_id, integration_id, invite_id,
    source, session_name, state, next_attempt_at, error_code
  ) values (
    p_organization_id, p_user_id, p_created_by, v_account_id, v_integration_id, p_invite_id,
    p_source, v_session_name, 'queued', now(), null
  )
  on conflict (organization_id, owner_user_id) do update
    set requested_by = excluded.requested_by,
        account_id = excluded.account_id,
        integration_id = excluded.integration_id,
        invite_id = excluded.invite_id,
        source = excluded.source,
        session_name = excluded.session_name,
        state = case when wa_akg_seller_provisioning_jobs.state = 'completed'
          then wa_akg_seller_provisioning_jobs.state else 'queued' end,
        next_attempt_at = case when wa_akg_seller_provisioning_jobs.state = 'completed'
          then wa_akg_seller_provisioning_jobs.next_attempt_at else now() end,
        error_code = case when wa_akg_seller_provisioning_jobs.state = 'completed'
          then wa_akg_seller_provisioning_jobs.error_code else null end,
        updated_at = now()
  returning id, wa_akg_seller_provisioning_jobs.state into v_job_id, v_state;

  return query select v_job_id, v_account_id, v_integration_id, v_session_name, v_state;
end;
$function$;

revoke all on function public.enqueue_wa_akg_seller_provisioning(uuid, uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_wa_akg_seller_provisioning(uuid, uuid, uuid, text, uuid)
  to service_role;

create table public.messaging_send_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  whatsapp_account_id uuid not null references public.whatsapp_accounts(id) on delete cascade,
  provider text not null check (provider = 'wa_akg'),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 180),
  not_before timestamptz not null,
  state text not null default 'reserved' check (state in ('reserved', 'sent', 'failed')),
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, whatsapp_account_id, idempotency_key)
);

create index messaging_send_reservations_schedule_idx
  on public.messaging_send_reservations (organization_id, whatsapp_account_id, not_before desc);
create index messaging_send_reservations_account_fk_idx
  on public.messaging_send_reservations (whatsapp_account_id);
create index messaging_send_reservations_daily_idx
  on public.messaging_send_reservations (organization_id, provider, created_at desc)
  where state in ('reserved', 'sent');

alter table public.messaging_send_reservations enable row level security;
revoke all on table public.messaging_send_reservations from public, anon, authenticated;
grant all on table public.messaging_send_reservations to service_role;

drop trigger if exists messaging_send_reservations_set_updated_at on public.messaging_send_reservations;
create trigger messaging_send_reservations_set_updated_at
before update on public.messaging_send_reservations
for each row execute procedure public.set_updated_at();

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
  if p_organization_id is null or p_whatsapp_account_id is null
     or p_idempotency_key is null
     or char_length(btrim(p_idempotency_key)) not between 1 and 180 then
    raise exception 'wa_akg_send_slot_input_invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text || ':' || p_whatsapp_account_id::text, 0)
  );

  select r.* into v_existing
  from public.messaging_send_reservations r
  where r.organization_id = p_organization_id
    and r.whatsapp_account_id = p_whatsapp_account_id
    and r.idempotency_key = btrim(p_idempotency_key)
  limit 1;
  if found then
    return query select true, 'already_reserved', v_existing.not_before;
    return;
  end if;

  select c.* into v_controls
  from public.messaging_provider_controls c
  where c.organization_id = p_organization_id and c.provider = 'wa_akg'
  for update;
  if not found or v_controls.kill_switch or not v_controls.send_enabled then
    return query select false, 'wa_akg_send_not_ready', now();
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
    return query select false, 'wa_akg_account_not_ready', now();
    return;
  end if;

  select count(*)::integer into v_daily_count
  from public.messaging_send_reservations r
  where r.organization_id = p_organization_id
    and r.provider = 'wa_akg'
    and r.state in ('reserved', 'sent')
    and r.created_at >= now() - interval '24 hours';
  if v_daily_count >= v_controls.daily_limit then
    return query select false, 'wa_akg_daily_limit_reached', now() + interval '1 hour';
    return;
  end if;

  select count(*)::integer into v_burst_count
  from public.messaging_send_reservations r
  where r.organization_id = p_organization_id
    and r.whatsapp_account_id = p_whatsapp_account_id
    and r.state in ('reserved', 'sent')
    and r.not_before >= now() - pg_catalog.make_interval(secs => v_controls.burst_window_seconds);

  select max(r.not_before) into v_last
  from public.messaging_send_reservations r
  where r.organization_id = p_organization_id
    and r.whatsapp_account_id = p_whatsapp_account_id
    and r.state in ('reserved', 'sent')
    and r.created_at >= now() - interval '24 hours';

  v_delay := v_controls.min_delay_seconds
    + floor(random() * (v_controls.max_delay_seconds - v_controls.min_delay_seconds + 1))::integer;
  v_not_before := greatest(now(), coalesce(v_last, now())) + pg_catalog.make_interval(secs => v_delay);
  if v_burst_count >= v_controls.burst_limit then
    v_not_before := greatest(
      v_not_before,
      now() + pg_catalog.make_interval(secs => v_controls.burst_window_seconds)
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

revoke all on function public.reserve_whatsapp_send_slot(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.reserve_whatsapp_send_slot(uuid, uuid, text)
  to service_role;

create or replace function public.complete_whatsapp_send_slot(
  p_organization_id uuid,
  p_whatsapp_account_id uuid,
  p_idempotency_key text,
  p_provider_message_id text,
  p_succeeded boolean
)
returns void
language sql
security invoker
set search_path = ''
as $function$
  update public.messaging_send_reservations
     set state = case when p_succeeded then 'sent' else 'failed' end,
         provider_message_id = case when p_succeeded then nullif(btrim(p_provider_message_id), '') else null end,
         updated_at = now()
   where organization_id = p_organization_id
     and whatsapp_account_id = p_whatsapp_account_id
     and idempotency_key = btrim(p_idempotency_key)
     and state = 'reserved'
$function$;

revoke all on function public.complete_whatsapp_send_slot(uuid, uuid, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.complete_whatsapp_send_slot(uuid, uuid, text, text, boolean)
  to service_role;

insert into public.messaging_provider_controls (
  organization_id, provider, inbound_enabled, send_enabled, automation_enabled, kill_switch,
  reason, min_delay_seconds, max_delay_seconds, burst_limit, burst_window_seconds, daily_limit
)
select id, 'wa_akg', false, false, false, true,
  'provider_not_validated', 10, 30, 3, 60, 100
from public.organizations
on conflict (organization_id, provider) do nothing;

create or replace function public.central_get_conversation_channel_provider(p_lead_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select case
    when account.provider in ('zapi', 'meta_cloud', 'evolution_go', 'wa_akg') then account.provider
    else null
  end
  from public.leads lead
  left join public.whatsapp_accounts account
    on account.id = lead.whatsapp_account_id
   and account.organization_id = lead.organization_id
  where lead.id = p_lead_id
    and lead.organization_id = public.current_org_id()
    and lead.archived_at is null
    and private.can_access_lead(lead.organization_id, lead.id, auth.uid())
  limit 1
$function$;

revoke all on function public.central_get_conversation_channel_provider(uuid) from public, anon;
grant execute on function public.central_get_conversation_channel_provider(uuid) to authenticated, service_role;

-- Receipt reconciliation was originally restricted to Z-API names. Keep the
-- identity and monotonic-status rules, but allow every provider supported by
-- the canonical WhatsApp account route.
create or replace function public.reconcile_whatsapp_receipt(
  p_organization_id uuid,
  p_provider_message_ids text[],
  p_expected_message_count integer,
  p_status text,
  p_occurred_at timestamptz
)
returns table(
  outreach_id uuid,
  lead_id uuid,
  message_id uuid,
  provider_message_id text,
  previous_status text,
  current_status text,
  changed boolean
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_outreach public.lead_outreach%rowtype;
  v_message_id uuid;
  v_previous text;
  v_current text;
  v_changed boolean;
  v_match_count integer;
  v_at timestamptz := pg_catalog.coalesce(p_occurred_at, pg_catalog.now());
begin
  if p_organization_id is null
     or pg_catalog.coalesce(pg_catalog.cardinality(p_provider_message_ids), 0) = 0
     or p_expected_message_count is null
     or p_expected_message_count < 1
     or p_status not in ('sent', 'delivered', 'read', 'failed') then
    raise exception 'receipt_input_invalid';
  end if;

  select pg_catalog.count(distinct o.id)::integer into v_match_count
  from public.lead_outreach o
  where o.organization_id = p_organization_id
    and o.channel = 'whatsapp'
    and pg_catalog.lower(pg_catalog.coalesce(o.provider, '')) in ('zapi', 'z-api', 'meta_cloud', 'evolution_go', 'wa_akg')
    and o.provider_message_id = any(p_provider_message_ids);
  if v_match_count > p_expected_message_count then raise exception 'receipt_identity_ambiguous'; end if;

  for v_outreach in
    select o.* from public.lead_outreach o
    where o.organization_id = p_organization_id
      and o.channel = 'whatsapp'
      and pg_catalog.lower(pg_catalog.coalesce(o.provider, '')) in ('zapi', 'z-api', 'meta_cloud', 'evolution_go', 'wa_akg')
      and o.provider_message_id = any(p_provider_message_ids)
    order by o.created_at, o.id
    for update
  loop
    v_message_id := null;
    v_changed := false;
    v_previous := v_outreach.status;
    v_current := v_previous;
    if p_status = 'failed' then
      if v_previous not in ('delivered', 'read', 'replied') then
        v_current := 'failed';
        v_changed := v_previous is distinct from v_current or v_outreach.failed_at is null;
      end if;
    elsif (case p_status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else -1 end)
      > (case v_previous when 'pending' then 0 when 'sent' then 1 when 'delivered' then 2
          when 'read' then 3 when 'replied' then 4 when 'failed' then 4 else -1 end) then
      v_current := p_status;
      v_changed := true;
    end if;

    v_changed := v_changed
      or (v_current in ('sent', 'delivered', 'read') and v_outreach.sent_at is null)
      or (v_current in ('delivered', 'read') and v_outreach.delivered_at is null)
      or (v_current = 'read' and v_outreach.read_at is null)
      or (p_status = 'failed' and v_current = 'failed' and v_outreach.failed_at is null);

    if v_changed then
      update public.lead_outreach o set
        status = v_current,
        sent_at = case when v_current in ('sent', 'delivered', 'read') then pg_catalog.coalesce(o.sent_at, v_at) else o.sent_at end,
        delivered_at = case when v_current in ('delivered', 'read') then pg_catalog.coalesce(o.delivered_at, v_at) else o.delivered_at end,
        read_at = case when v_current = 'read' then pg_catalog.coalesce(o.read_at, v_at) else o.read_at end,
        failed_at = case when v_current = 'failed' then pg_catalog.coalesce(o.failed_at, v_at) else o.failed_at end,
        error = case when v_current = 'failed' then 'provider_delivery_failed' else null end,
        updated_at = pg_catalog.now()
      where o.id = v_outreach.id and o.organization_id = p_organization_id;
    end if;

    if (v_outreach.metadata ->> 'message_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      v_message_id := (v_outreach.metadata ->> 'message_id')::uuid;
      update public.lead_messages m set
        type = case when v_current = 'failed' then 'failed' else 'sent' end,
        provider_message_id = pg_catalog.coalesce(m.provider_message_id, v_outreach.provider_message_id)
      where m.id = v_message_id
        and m.organization_id = p_organization_id
        and m.lead_id = v_outreach.lead_id
        and (m.provider_message_id is null or m.provider_message_id = v_outreach.provider_message_id);
      if not found then raise exception 'receipt_message_identity_conflict'; end if;
    end if;

    return query select v_outreach.id, v_outreach.lead_id, v_message_id,
      v_outreach.provider_message_id, v_previous, v_current, v_changed;
  end loop;
end;
$function$;

comment on table public.wa_akg_webhook_events is
  'Callbacks WA-AKG sanitized and service-role only. Never stores API keys, webhook secrets, QR codes or raw payloads.';
comment on table public.messaging_send_reservations is
  'Durable per-session WA-AKG pacing. It reduces burst risk; it is not an anti-ban guarantee.';

commit;
