-- Meta WhatsApp Cloud API / Coexistence foundation.
-- This migration is additive and leaves every existing Z-API account and
-- dispatch path unchanged. Meta traffic starts disabled at organization and
-- provider level and can only be enabled after staged homologation.

alter table public.whatsapp_accounts
  drop constraint if exists whatsapp_accounts_provider_check;

alter table public.whatsapp_accounts
  alter column integration_id drop not null,
  add constraint whatsapp_accounts_provider_check
    check (provider in ('zapi', 'meta_cloud')),
  add constraint whatsapp_accounts_zapi_integration_check
    check (provider <> 'zapi' or integration_id is not null),
  add column if not exists business_account_id text,
  add column if not exists phone_number_id text,
  add column if not exists display_phone_number text,
  add column if not exists verified_name text,
  add column if not exists quality_rating text,
  add column if not exists onboarding_status text not null default 'not_started'
    check (onboarding_status in ('not_started', 'pending', 'connected', 'failed', 'revoked')),
  add column if not exists sync_status text not null default 'not_started'
    check (sync_status in ('not_started', 'pending', 'running', 'complete', 'partial', 'failed')),
  add column if not exists messaging_mode text not null default 'suggestion'
    check (messaging_mode in ('suggestion', 'assisted', 'automatic')),
  add column if not exists daily_message_goal integer not null default 0
    check (daily_message_goal between 0 and 100000),
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb;

create unique index if not exists whatsapp_accounts_meta_phone_uidx
  on public.whatsapp_accounts (phone_number_id)
  where provider = 'meta_cloud' and phone_number_id is not null and archived_at is null;

create index if not exists whatsapp_accounts_meta_business_idx
  on public.whatsapp_accounts (organization_id, business_account_id)
  where provider = 'meta_cloud' and archived_at is null;

create table public.organization_feature_flags (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  flag_key text not null check (flag_key ~ '^[a-z][a-z0-9_]{2,79}$'),
  enabled boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  enabled_by uuid references auth.users(id) on delete set null,
  enabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, flag_key)
);

create table public.messaging_provider_controls (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('zapi', 'meta_cloud')),
  inbound_enabled boolean not null default false,
  send_enabled boolean not null default false,
  automation_enabled boolean not null default false,
  kill_switch boolean not null default true,
  reason text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, provider)
);

create table public.meta_onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  state_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'exchanged', 'completed', 'expired', 'failed', 'cancelled')),
  business_account_id text,
  phone_number_id text,
  failure_code text,
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meta_onboarding_sessions_org_idx
  on public.meta_onboarding_sessions (organization_id, created_at desc);

create table public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  whatsapp_account_id uuid not null references public.whatsapp_accounts(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  owner_user_id uuid references auth.users(id) on delete set null,
  external_conversation_id text not null,
  customer_phone_identity text,
  status text not null default 'open'
    check (status in ('open', 'waiting_human', 'closed', 'blocked', 'needs_review')),
  service_window_opened_at timestamptz,
  service_window_expires_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  last_message_at timestamptz,
  unread_count integer not null default 0 check (unread_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, whatsapp_account_id, external_conversation_id)
);

create index whatsapp_conversations_owner_idx
  on public.whatsapp_conversations (organization_id, owner_user_id, last_message_at desc);
create index whatsapp_conversations_lead_idx
  on public.whatsapp_conversations (lead_id) where lead_id is not null;
create index whatsapp_conversations_window_idx
  on public.whatsapp_conversations (organization_id, service_window_expires_at)
  where status = 'open';

create table public.messaging_webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  whatsapp_account_id uuid references public.whatsapp_accounts(id) on delete set null,
  provider text not null check (provider = 'meta_cloud'),
  external_event_id text not null,
  event_kind text not null
    check (event_kind in ('inbound', 'status', 'message_echo', 'history', 'sync', 'unknown')),
  payload_hash text not null,
  sanitized_metadata jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'needs_review', 'failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 100),
  error_code text,
  occurred_at timestamptz,
  processed_at timestamptz,
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, external_event_id)
);

create index messaging_webhook_events_retry_idx
  on public.messaging_webhook_events (processing_status, next_retry_at)
  where processing_status = 'failed';

create table public.message_status_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  whatsapp_account_id uuid not null references public.whatsapp_accounts(id) on delete cascade,
  lead_message_id uuid references public.lead_messages(id) on delete set null,
  provider_message_id text not null,
  status text not null check (status in ('sent', 'delivered', 'read', 'failed')),
  occurred_at timestamptz not null,
  sanitized_error jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, provider_message_id, status, occurred_at)
);

create index message_status_events_message_idx
  on public.message_status_events (organization_id, provider_message_id, occurred_at desc);

create table public.messaging_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  whatsapp_account_id uuid not null references public.whatsapp_accounts(id) on delete restrict,
  lead_id uuid not null references public.leads(id) on delete cascade,
  lead_message_id uuid references public.lead_messages(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  origin text not null check (origin in ('panel', 'ana', 'template', 'system')),
  message_kind text not null check (message_kind in ('text', 'template', 'image', 'document')),
  recipient_identity text not null,
  content jsonb not null,
  idempotency_key text not null unique,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'sent', 'failed', 'dead_letter', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 100),
  run_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  provider_message_id text,
  provider_status_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index messaging_outbox_queue_idx
  on public.messaging_outbox (run_at, created_at)
  where status in ('queued', 'failed');
create index messaging_outbox_lead_idx
  on public.messaging_outbox (organization_id, lead_id, created_at desc);

create table public.whatsapp_sync_state (
  whatsapp_account_id uuid primary key references public.whatsapp_accounts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sync_kind text not null default 'coexistence'
    check (sync_kind in ('coexistence', 'history', 'contacts', 'templates')),
  status text not null default 'not_started'
    check (status in ('not_started', 'pending', 'running', 'complete', 'partial', 'failed')),
  cursor_value text,
  last_event_at timestamptz,
  last_completed_at timestamptz,
  last_error_code text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  whatsapp_account_id uuid not null references public.whatsapp_accounts(id) on delete cascade,
  provider_template_id text,
  name text not null,
  language text not null,
  category text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'paused', 'disabled', 'unknown')),
  components jsonb not null default '[]'::jsonb,
  source_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (whatsapp_account_id, name, language)
);

create table public.meta_rate_cards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  country_code text not null,
  message_category text not null,
  currency text,
  amount_per_message numeric(14, 6),
  effective_from date not null,
  effective_to date,
  source_url text not null,
  source_checked_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (organization_id, country_code, message_category, effective_from)
);

create table public.seller_routing_profiles (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  whatsapp_account_id uuid references public.whatsapp_accounts(id) on delete set null,
  messaging_mode text not null default 'suggestion'
    check (messaging_mode in ('suggestion', 'assisted', 'automatic')),
  daily_message_goal integer not null default 0 check (daily_message_goal between 0 and 100000),
  handoff_stage text,
  handoff_notifications_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

alter table public.lead_messages
  add column if not exists conversation_id uuid references public.whatsapp_conversations(id) on delete set null,
  add column if not exists provider text,
  add column if not exists message_origin text
    check (message_origin is null or message_origin in ('customer', 'business_app', 'panel', 'ana', 'template', 'system')),
  add column if not exists message_category text,
  add column if not exists delivery_status text
    check (delivery_status is null or delivery_status in ('queued', 'sent', 'delivered', 'read', 'failed')),
  add column if not exists provider_status_at timestamptz,
  add column if not exists provider_occurred_at timestamptz,
  add column if not exists pricing_category text,
  add column if not exists cost_amount numeric(14, 6),
  add column if not exists cost_currency text,
  add column if not exists cost_source text;

alter table public.lead_outreach
  add column if not exists provider_status_at timestamptz,
  add column if not exists pricing_category text,
  add column if not exists cost_amount numeric(14, 6),
  add column if not exists cost_currency text,
  add column if not exists cost_source text;

create index if not exists lead_messages_conversation_idx
  on public.lead_messages (conversation_id, created_at) where conversation_id is not null;
create index if not exists lead_messages_provider_message_idx
  on public.lead_messages (organization_id, provider, provider_message_id)
  where provider_message_id is not null;

alter table public.organization_feature_flags enable row level security;
alter table public.messaging_provider_controls enable row level security;
alter table public.meta_onboarding_sessions enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.messaging_webhook_events enable row level security;
alter table public.message_status_events enable row level security;
alter table public.messaging_outbox enable row level security;
alter table public.whatsapp_sync_state enable row level security;
alter table public.whatsapp_templates enable row level security;
alter table public.meta_rate_cards enable row level security;
alter table public.seller_routing_profiles enable row level security;

revoke all on table public.organization_feature_flags, public.messaging_provider_controls,
  public.meta_onboarding_sessions, public.whatsapp_conversations,
  public.messaging_webhook_events, public.message_status_events, public.messaging_outbox,
  public.whatsapp_sync_state, public.whatsapp_templates, public.meta_rate_cards,
  public.seller_routing_profiles from public, anon, authenticated;

grant select on table public.organization_feature_flags, public.messaging_provider_controls,
  public.whatsapp_conversations, public.whatsapp_sync_state, public.whatsapp_templates,
  public.meta_rate_cards, public.seller_routing_profiles to authenticated;

grant all on table public.organization_feature_flags, public.messaging_provider_controls,
  public.meta_onboarding_sessions, public.whatsapp_conversations,
  public.messaging_webhook_events, public.message_status_events, public.messaging_outbox,
  public.whatsapp_sync_state, public.whatsapp_templates, public.meta_rate_cards,
  public.seller_routing_profiles to service_role;

create policy organization_feature_flags_read on public.organization_feature_flags
  for select to authenticated
  using (private.is_active_org_member(organization_id, (select auth.uid())));

create policy messaging_provider_controls_read on public.messaging_provider_controls
  for select to authenticated
  using (
    private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage')
    or private.has_org_permission(organization_id, (select auth.uid()), 'channels.manage_all')
  );

create policy whatsapp_conversations_read on public.whatsapp_conversations
  for select to authenticated
  using (
    private.has_org_permission(organization_id, (select auth.uid()), 'conversations.read_all')
    or owner_user_id = (select auth.uid())
    or exists (
      select 1 from public.leads l
      where l.id = whatsapp_conversations.lead_id
        and l.organization_id = whatsapp_conversations.organization_id
        and (l.owner_id = (select auth.uid()) or l.assigned_to = (select auth.uid()))
    )
  );

create policy whatsapp_sync_state_read on public.whatsapp_sync_state
  for select to authenticated
  using (
    private.has_org_permission(organization_id, (select auth.uid()), 'channels.manage_all')
    or exists (
      select 1 from public.whatsapp_accounts a
      where a.id = whatsapp_sync_state.whatsapp_account_id
        and a.organization_id = whatsapp_sync_state.organization_id
        and a.owner_user_id = (select auth.uid())
    )
  );

create policy whatsapp_templates_read on public.whatsapp_templates
  for select to authenticated
  using (
    private.has_org_permission(organization_id, (select auth.uid()), 'conversations.read_all')
    or exists (
      select 1 from public.whatsapp_accounts a
      where a.id = whatsapp_templates.whatsapp_account_id
        and a.organization_id = whatsapp_templates.organization_id
        and a.owner_user_id = (select auth.uid())
    )
  );

create policy meta_rate_cards_read on public.meta_rate_cards
  for select to authenticated
  using (private.is_active_org_member(organization_id, (select auth.uid())));

create policy seller_routing_profiles_read on public.seller_routing_profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_org_permission(organization_id, (select auth.uid()), 'team.manage')
    or private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage')
  );

drop trigger if exists organization_feature_flags_set_updated_at on public.organization_feature_flags;
create trigger organization_feature_flags_set_updated_at before update on public.organization_feature_flags
  for each row execute procedure public.set_updated_at();
drop trigger if exists messaging_provider_controls_set_updated_at on public.messaging_provider_controls;
create trigger messaging_provider_controls_set_updated_at before update on public.messaging_provider_controls
  for each row execute procedure public.set_updated_at();
drop trigger if exists meta_onboarding_sessions_set_updated_at on public.meta_onboarding_sessions;
create trigger meta_onboarding_sessions_set_updated_at before update on public.meta_onboarding_sessions
  for each row execute procedure public.set_updated_at();
drop trigger if exists whatsapp_conversations_set_updated_at on public.whatsapp_conversations;
create trigger whatsapp_conversations_set_updated_at before update on public.whatsapp_conversations
  for each row execute procedure public.set_updated_at();
drop trigger if exists messaging_outbox_set_updated_at on public.messaging_outbox;
create trigger messaging_outbox_set_updated_at before update on public.messaging_outbox
  for each row execute procedure public.set_updated_at();
drop trigger if exists whatsapp_sync_state_set_updated_at on public.whatsapp_sync_state;
create trigger whatsapp_sync_state_set_updated_at before update on public.whatsapp_sync_state
  for each row execute procedure public.set_updated_at();
drop trigger if exists whatsapp_templates_set_updated_at on public.whatsapp_templates;
create trigger whatsapp_templates_set_updated_at before update on public.whatsapp_templates
  for each row execute procedure public.set_updated_at();
drop trigger if exists seller_routing_profiles_set_updated_at on public.seller_routing_profiles;
create trigger seller_routing_profiles_set_updated_at before update on public.seller_routing_profiles
  for each row execute procedure public.set_updated_at();

insert into public.organization_feature_flags (organization_id, flag_key, enabled, configuration)
select id, 'meta_coexistence', false, jsonb_build_object('gate', 1, 'reason', 'awaiting_meta_homologation')
from public.organizations
on conflict (organization_id, flag_key) do nothing;

insert into public.messaging_provider_controls (
  organization_id, provider, inbound_enabled, send_enabled, automation_enabled, kill_switch, reason
)
select id, 'meta_cloud', false, false, false, true, 'Gate 1: integração Meta ainda não homologada'
from public.organizations
on conflict (organization_id, provider) do nothing;

create or replace function public.meta_service_window(p_last_customer_message_at timestamptz)
returns table (is_open boolean, expires_at timestamptz)
language sql
stable
set search_path = pg_catalog
as $$
  select
    p_last_customer_message_at is not null
      and pg_catalog.now() < p_last_customer_message_at + interval '24 hours',
    case when p_last_customer_message_at is null then null::timestamptz
      else p_last_customer_message_at + interval '24 hours' end;
$$;

revoke all on function public.meta_service_window(timestamptz) from public, anon;
grant execute on function public.meta_service_window(timestamptz) to authenticated, service_role;

create or replace function public.apply_meta_message_status(
  p_organization_id uuid,
  p_whatsapp_account_id uuid,
  p_provider_message_id text,
  p_status text,
  p_occurred_at timestamptz,
  p_sanitized_error jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_inserted integer := 0;
  v_message_id uuid;
begin
  if p_status not in ('sent', 'delivered', 'read', 'failed')
     or nullif(pg_catalog.btrim(p_provider_message_id), '') is null
     or p_occurred_at is null then
    raise exception 'meta_status_input_invalid';
  end if;

  if not exists (
    select 1 from public.whatsapp_accounts a
    where a.id = p_whatsapp_account_id
      and a.organization_id = p_organization_id
      and a.provider = 'meta_cloud'
      and a.archived_at is null
  ) then
    raise exception 'meta_whatsapp_account_not_found';
  end if;

  select m.id into v_message_id
  from public.lead_messages m
  where m.organization_id = p_organization_id
    and m.whatsapp_account_id = p_whatsapp_account_id
    and m.provider_message_id = p_provider_message_id
  order by m.created_at desc
  limit 1;

  insert into public.message_status_events (
    organization_id, whatsapp_account_id, lead_message_id,
    provider_message_id, status, occurred_at, sanitized_error
  ) values (
    p_organization_id, p_whatsapp_account_id, v_message_id,
    p_provider_message_id, p_status, p_occurred_at, p_sanitized_error
  ) on conflict (organization_id, provider_message_id, status, occurred_at) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return false; end if;

  update public.lead_messages m
  set delivery_status = p_status,
      provider_status_at = p_occurred_at
  where m.organization_id = p_organization_id
    and m.whatsapp_account_id = p_whatsapp_account_id
    and m.provider_message_id = p_provider_message_id
    and (
      m.provider_status_at is null
      or m.provider_status_at < p_occurred_at
      or (
        m.provider_status_at = p_occurred_at
        and case p_status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else 4 end
          >= case coalesce(m.delivery_status, 'queued')
            when 'queued' then 0 when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else 4 end
      )
    );

  update public.lead_outreach o
  set status = p_status,
      provider_status_at = p_occurred_at,
      sent_at = case when p_status = 'sent' then coalesce(o.sent_at, p_occurred_at) else o.sent_at end,
      delivered_at = case when p_status = 'delivered' then coalesce(o.delivered_at, p_occurred_at) else o.delivered_at end,
      read_at = case when p_status = 'read' then coalesce(o.read_at, p_occurred_at) else o.read_at end,
      failed_at = case when p_status = 'failed' then coalesce(o.failed_at, p_occurred_at) else o.failed_at end,
      error = case when p_status = 'failed' then 'meta_delivery_failed' else o.error end,
      updated_at = pg_catalog.now()
  where o.organization_id = p_organization_id
    and o.whatsapp_account_id = p_whatsapp_account_id
    and o.provider_message_id = p_provider_message_id
    and (
      o.provider_status_at is null
      or o.provider_status_at < p_occurred_at
      or (
        o.provider_status_at = p_occurred_at
        and case p_status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else 4 end
          >= case coalesce(o.status, 'pending')
            when 'pending' then 0 when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else 4 end
      )
    );

  return true;
end;
$$;

revoke all on function public.apply_meta_message_status(uuid, uuid, text, text, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_meta_message_status(uuid, uuid, text, text, timestamptz, jsonb)
  to service_role;

create or replace function public.queue_meta_whatsapp_message(
  p_organization_id uuid,
  p_lead_id uuid,
  p_whatsapp_account_id uuid,
  p_user_id uuid,
  p_sender_name text,
  p_request_id uuid,
  p_recipient_identity text,
  p_message_kind text,
  p_content jsonb
)
returns table (job_id uuid, message_id uuid, job_status text, duplicate boolean)
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  v_key text := 'meta:' || p_organization_id::text || ':' || p_user_id::text || ':' || p_request_id::text;
  v_job public.messaging_outbox%rowtype;
  v_lead public.leads%rowtype;
  v_message_id uuid;
  v_body text;
  v_origin text;
begin
  if p_organization_id is null or p_lead_id is null or p_whatsapp_account_id is null
     or p_user_id is null or p_request_id is null
     or nullif(pg_catalog.btrim(p_recipient_identity), '') is null
     or p_message_kind not in ('text', 'template', 'image', 'document')
     or p_content is null then
    raise exception 'meta_message_input_required';
  end if;
  if not private.is_active_org_member(p_organization_id, p_user_id) then
    raise exception 'organization_access_denied';
  end if;

  select l.* into v_lead
  from public.leads l
  where l.id = p_lead_id
    and l.organization_id = p_organization_id
    and (
      private.has_org_permission(p_organization_id, p_user_id, 'conversations.reply_all')
      or (
        private.has_org_permission(p_organization_id, p_user_id, 'conversations.reply_assigned')
        and p_user_id in (l.owner_id, l.assigned_to)
      )
    )
  for update;
  if not found then raise exception 'lead_not_found_or_access_denied'; end if;
  if v_lead.opt_out then raise exception 'lead_opted_out'; end if;
  if v_lead.whatsapp_account_id is distinct from p_whatsapp_account_id then
    raise exception 'meta_account_lead_mismatch';
  end if;

  if not exists (
    select 1 from public.whatsapp_accounts a
    where a.id = p_whatsapp_account_id
      and a.organization_id = p_organization_id
      and a.provider = 'meta_cloud'
      and a.enabled
      and a.connection_status = 'connected'
      and a.archived_at is null
  ) then raise exception 'meta_account_not_ready'; end if;

  if not exists (
    select 1 from public.organization_feature_flags f
    join public.messaging_provider_controls c
      on c.organization_id = f.organization_id and c.provider = 'meta_cloud'
    where f.organization_id = p_organization_id
      and f.flag_key = 'meta_coexistence'
      and f.enabled
      and c.send_enabled
      and not c.kill_switch
  ) then raise exception 'meta_send_disabled'; end if;

  if p_message_kind <> 'template' and not exists (
    select 1 from public.whatsapp_conversations c
    where c.organization_id = p_organization_id
      and c.whatsapp_account_id = p_whatsapp_account_id
      and c.lead_id = p_lead_id
      and c.service_window_expires_at > pg_catalog.now()
  ) then raise exception 'meta_template_required_outside_service_window'; end if;

  if p_message_kind = 'template' and not exists (
    select 1 from public.whatsapp_templates t
    where t.organization_id = p_organization_id
      and t.whatsapp_account_id = p_whatsapp_account_id
      and t.name = nullif(p_content ->> 'name', '')
      and t.language = nullif(p_content ->> 'language', '')
      and t.status = 'approved'
  ) then raise exception 'meta_template_not_approved'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key, 0));
  select j.* into v_job from public.messaging_outbox j where j.idempotency_key = v_key limit 1;
  if found then
    if v_job.organization_id is distinct from p_organization_id
       or v_job.lead_id is distinct from p_lead_id
       or v_job.whatsapp_account_id is distinct from p_whatsapp_account_id
       or v_job.recipient_identity is distinct from p_recipient_identity
       or v_job.message_kind is distinct from p_message_kind
       or v_job.content is distinct from p_content then
      raise exception 'idempotency_payload_mismatch';
    end if;
    return query select v_job.id, v_job.lead_message_id, v_job.status, true;
    return;
  end if;

  v_body := case p_message_kind
    when 'text' then nullif(pg_catalog.btrim(p_content ->> 'text'), '')
    when 'template' then '[Template Meta: ' || coalesce(nullif(p_content ->> 'name', ''), 'não identificado') || ']'
    when 'image' then coalesce(nullif(pg_catalog.btrim(p_content ->> 'caption'), ''), '[Imagem enviada]')
    else coalesce(nullif(pg_catalog.btrim(p_content ->> 'caption'), ''), '[Documento enviado]')
  end;
  if v_body is null or pg_catalog.char_length(v_body) > 4096 then raise exception 'meta_message_content_invalid'; end if;
  v_origin := case when p_message_kind = 'template' then 'template' else 'panel' end;

  insert into public.lead_messages (
    organization_id, lead_id, whatsapp_account_id, sender, sender_name, type,
    text, sent_at, provider, message_origin, message_category, delivery_status
  ) values (
    p_organization_id, p_lead_id, p_whatsapp_account_id, 'human',
    coalesce(nullif(pg_catalog.btrim(p_sender_name), ''), 'Atendente'), 'queued',
    pg_catalog.left(v_body, 4096), null, 'meta_cloud', v_origin, p_message_kind, 'queued'
  ) returning id into v_message_id;

  insert into public.messaging_outbox (
    organization_id, whatsapp_account_id, lead_id, lead_message_id, requested_by,
    origin, message_kind, recipient_identity, content, idempotency_key
  ) values (
    p_organization_id, p_whatsapp_account_id, p_lead_id, v_message_id, p_user_id,
    v_origin, p_message_kind, p_recipient_identity, p_content, v_key
  ) returning * into v_job;

  return query select v_job.id, v_message_id, v_job.status, false;
end;
$$;

revoke all on function public.queue_meta_whatsapp_message(uuid, uuid, uuid, uuid, text, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.queue_meta_whatsapp_message(uuid, uuid, uuid, uuid, text, uuid, text, text, jsonb)
  to service_role;

comment on table public.organization_feature_flags is
  'Organization-scoped rollout gates. meta_coexistence is inserted disabled.';
comment on table public.messaging_provider_controls is
  'Independent inbound, send and automation controls plus provider kill switch.';
comment on table public.messaging_webhook_events is
  'Idempotent sanitized webhook ledger. Full provider payloads are never persisted.';
comment on table public.messaging_outbox is
  'Provider-neutral Meta outbox isolated from the currently homologated Z-API queue.';
comment on column public.whatsapp_accounts.provider_metadata is
  'Non-secret provider metadata only. Tokens and app secrets remain in Vault/backend.';
