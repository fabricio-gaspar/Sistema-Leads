-- LeadAI Phase 1 — commercial multi-tenant foundation
--
-- Apply this migration to a clean Supabase project or a dedicated development
-- branch. It intentionally does not mutate the legacy key-value tables. The
-- cutover from the legacy mock/blob model is handled by application services
-- after the new schema is deployed and verified.

create extension if not exists pgcrypto;
create schema if not exists app_private;

do $$
begin
  create type public.organization_role as enum ('owner', 'admin', 'manager', 'seller', 'viewer');
exception
  when duplicate_object then null;
end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  display_name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text not null default 'America/Sao_Paulo',
  locale text not null default 'pt-BR',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'seller',
  status text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  business_profile jsonb not null default '{}'::jsonb,
  commercial_rules jsonb not null default '{}'::jsonb,
  ai_configuration jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(business_profile) = 'object'),
  check (jsonb_typeof(commercial_rules) = 'object'),
  check (jsonb_typeof(ai_configuration) = 'object')
);

-- Never store provider tokens in config or JSON. `secret_ref` points to a
-- server-managed secret / Vault record and is never returned to the browser.
create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('whatsapp_meta', 'whatsapp_zapi', 'resend', 'openai', 'anthropic', 'google_calendar', 'stripe')),
  external_account_id text,
  status text not null default 'disconnected' check (status in ('disconnected', 'pending', 'connected', 'error', 'revoked')),
  configuration jsonb not null default '{}'::jsonb,
  secret_ref text,
  connected_by uuid references auth.users(id) on delete set null,
  last_verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, external_account_id),
  check (jsonb_typeof(configuration) = 'object')
);

create table public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  company_name text not null,
  primary_contact_name text,
  primary_email text,
  primary_phone text,
  segment text,
  lifecycle_stage text not null default 'new',
  score smallint not null default 0 check (score between 0 and 100),
  source text,
  consent_status text not null default 'unknown' check (consent_status in ('unknown', 'legitimate_interest', 'opted_in', 'opted_out')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create table public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  job_title text,
  is_primary boolean not null default false,
  opted_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index crm_contacts_one_primary_per_lead_idx
  on public.crm_contacts (lead_id) where is_primary;

create table public.crm_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  contact_id uuid references public.crm_contacts(id) on delete set null,
  integration_connection_id uuid references public.integration_connections(id) on delete set null,
  channel text not null check (channel in ('whatsapp', 'email', 'instagram', 'web', 'phone')),
  status text not null default 'open' check (status in ('open', 'waiting_human', 'closed')),
  assigned_to uuid references auth.users(id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.crm_conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound', 'internal')),
  sender_type text not null check (sender_type in ('contact', 'member', 'assistant', 'system')),
  body text not null,
  provider_message_id text,
  sent_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create table public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  stage text not null,
  amount numeric(14, 2),
  currency char(3) not null default 'BRL',
  expected_close_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount is null or amount >= 0)
);

create table public.crm_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid not null references public.crm_opportunities(id) on delete cascade,
  number text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired')),
  valid_until date,
  total_amount numeric(14, 2) not null default 0 check (total_amount >= 0),
  currency char(3) not null default 'BRL',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, number)
);

create table public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.crm_leads(id) on delete cascade,
  opportunity_id uuid references public.crm_opportunities(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_connection_id uuid not null references public.integration_connections(id) on delete cascade,
  provider text not null,
  external_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  unique (integration_connection_id, external_event_id)
);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  idempotency_key text not null,
  workflow_name text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  check (jsonb_typeof(input) = 'object'),
  check (output is null or jsonb_typeof(output) = 'object')
);

-- Outbox pattern: browser code may request a message, but only a controlled
-- server worker is allowed to send it to an external provider.
create table public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_connection_id uuid not null references public.integration_connections(id) on delete restrict,
  channel text not null check (channel in ('whatsapp', 'email')),
  recipient text not null,
  subject text,
  body text not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'failed', 'cancelled')),
  idempotency_key text not null,
  requested_by uuid references auth.users(id) on delete set null,
  provider_message_id text,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

-- Composite tenant keys prevent a child row from referencing an entity that
-- belongs to another organization, even in privileged server-side code.
alter table public.integration_connections
  add constraint integration_connections_id_organization_unique unique (id, organization_id);
alter table public.crm_leads
  add constraint crm_leads_id_organization_unique unique (id, organization_id);
alter table public.crm_contacts
  add constraint crm_contacts_id_organization_unique unique (id, organization_id);
alter table public.crm_conversations
  add constraint crm_conversations_id_organization_unique unique (id, organization_id);
alter table public.crm_opportunities
  add constraint crm_opportunities_id_organization_unique unique (id, organization_id);

alter table public.crm_contacts
  add constraint crm_contacts_same_org_lead_fk
  foreign key (lead_id, organization_id) references public.crm_leads (id, organization_id);
alter table public.crm_conversations
  add constraint crm_conversations_same_org_lead_fk
  foreign key (lead_id, organization_id) references public.crm_leads (id, organization_id),
  add constraint crm_conversations_same_org_contact_fk
  foreign key (contact_id, organization_id) references public.crm_contacts (id, organization_id),
  add constraint crm_conversations_same_org_connection_fk
  foreign key (integration_connection_id, organization_id) references public.integration_connections (id, organization_id);
alter table public.crm_messages
  add constraint crm_messages_same_org_conversation_fk
  foreign key (conversation_id, organization_id) references public.crm_conversations (id, organization_id);
alter table public.crm_opportunities
  add constraint crm_opportunities_same_org_lead_fk
  foreign key (lead_id, organization_id) references public.crm_leads (id, organization_id);
alter table public.crm_proposals
  add constraint crm_proposals_same_org_opportunity_fk
  foreign key (opportunity_id, organization_id) references public.crm_opportunities (id, organization_id);
alter table public.crm_tasks
  add constraint crm_tasks_same_org_lead_fk
  foreign key (lead_id, organization_id) references public.crm_leads (id, organization_id),
  add constraint crm_tasks_same_org_opportunity_fk
  foreign key (opportunity_id, organization_id) references public.crm_opportunities (id, organization_id);
alter table public.webhook_events
  add constraint webhook_events_same_org_connection_fk
  foreign key (integration_connection_id, organization_id) references public.integration_connections (id, organization_id);
alter table public.outbound_messages
  add constraint outbound_messages_same_org_connection_fk
  foreign key (integration_connection_id, organization_id) references public.integration_connections (id, organization_id);

create index organization_members_user_org_idx on public.organization_members (user_id, organization_id) where status = 'active';
create index organizations_created_by_idx on public.organizations (created_by);
create index organization_settings_updated_by_idx on public.organization_settings (updated_by);
create index integration_connections_org_provider_idx on public.integration_connections (organization_id, provider);
create index integration_connections_connected_by_idx on public.integration_connections (connected_by);
create index crm_leads_org_stage_updated_idx on public.crm_leads (organization_id, lifecycle_stage, updated_at desc);
create index crm_leads_org_owner_updated_idx on public.crm_leads (organization_id, owner_id, updated_at desc);
create index crm_leads_created_by_idx on public.crm_leads (created_by);
create index crm_contacts_org_lead_idx on public.crm_contacts (organization_id, lead_id);
create index crm_conversations_lead_idx on public.crm_conversations (lead_id);
create index crm_conversations_contact_idx on public.crm_conversations (contact_id);
create index crm_conversations_connection_idx on public.crm_conversations (integration_connection_id);
create index crm_conversations_org_status_last_idx on public.crm_conversations (organization_id, status, last_message_at desc nulls last);
create index crm_messages_org_conversation_created_idx on public.crm_messages (organization_id, conversation_id, created_at);
create index crm_messages_sent_by_idx on public.crm_messages (sent_by);
create index crm_opportunities_org_stage_close_idx on public.crm_opportunities (organization_id, stage, expected_close_date);
create index crm_opportunities_lead_idx on public.crm_opportunities (lead_id);
create index crm_opportunities_owner_idx on public.crm_opportunities (owner_id);
create index crm_proposals_org_status_updated_idx on public.crm_proposals (organization_id, status, updated_at desc);
create index crm_proposals_opportunity_idx on public.crm_proposals (opportunity_id);
create index crm_proposals_created_by_idx on public.crm_proposals (created_by);
create index crm_tasks_org_assignee_due_idx on public.crm_tasks (organization_id, assigned_to, due_at) where completed_at is null;
create index crm_tasks_lead_idx on public.crm_tasks (lead_id);
create index crm_tasks_opportunity_idx on public.crm_tasks (opportunity_id);
create index crm_tasks_created_by_idx on public.crm_tasks (created_by);
create index webhook_events_org_received_idx on public.webhook_events (organization_id, received_at desc);
create index webhook_events_connection_idx on public.webhook_events (integration_connection_id);
create index automation_runs_org_status_created_idx on public.automation_runs (organization_id, status, created_at desc);
create index outbound_messages_org_status_scheduled_idx on public.outbound_messages (organization_id, status, scheduled_for);
create index outbound_messages_connection_idx on public.outbound_messages (integration_connection_id);
create index outbound_messages_requested_by_idx on public.outbound_messages (requested_by);
create index audit_logs_org_occurred_idx on public.audit_logs (organization_id, occurred_at desc);

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function app_private.is_organization_member(
  target_organization_id uuid,
  required_roles public.organization_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and (required_roles is null or membership.role = any(required_roles))
  );
$$;

create or replace function public.create_organization(
  organization_legal_name text,
  organization_display_name text,
  organization_slug text,
  organization_timezone text default 'America/Sao_Paulo'
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_organization public.organizations;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  insert into public.organizations (legal_name, display_name, slug, timezone, created_by)
  values (trim(organization_legal_name), trim(organization_display_name), lower(trim(organization_slug)), organization_timezone, current_user_id)
  returning * into new_organization;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (new_organization.id, current_user_id, 'owner', 'active');

  insert into public.organization_settings (organization_id, updated_by)
  values (new_organization.id, current_user_id);

  return new_organization;
end;
$$;

revoke all on function app_private.handle_new_user() from public;
revoke all on function app_private.is_organization_member(uuid, public.organization_role[]) from public;
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_organization_member(uuid, public.organization_role[]) to authenticated;
revoke all on function public.create_organization(text, text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text, text) to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure app_private.handle_new_user();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'organizations', 'organization_members', 'organization_settings', 'integration_connections',
    'crm_leads', 'crm_contacts', 'crm_conversations', 'crm_opportunities', 'crm_proposals', 'crm_tasks',
    'outbound_messages'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'set_' || table_name || '_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute procedure app_private.set_updated_at()',
      'set_' || table_name || '_updated_at', table_name
    );
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations', 'organization_members', 'organization_settings', 'integration_connections',
    'crm_leads', 'crm_contacts', 'crm_conversations', 'crm_messages', 'crm_opportunities',
    'crm_proposals', 'crm_tasks', 'webhook_events', 'automation_runs', 'outbound_messages', 'audit_logs', 'profiles'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create policy "profiles_select_self" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_self" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "organizations_select_members" on public.organizations
  for select to authenticated using ((select app_private.is_organization_member(id)));
create policy "organizations_update_admins" on public.organizations
  for update to authenticated
  using ((select app_private.is_organization_member(id, array['owner', 'admin']::public.organization_role[])))
  with check ((select app_private.is_organization_member(id, array['owner', 'admin']::public.organization_role[])));

create policy "organization_members_select_members" on public.organization_members
  for select to authenticated using ((select app_private.is_organization_member(organization_id)));

create policy "organization_settings_select_members" on public.organization_settings
  for select to authenticated using ((select app_private.is_organization_member(organization_id)));
create policy "organization_settings_manage_admins" on public.organization_settings
  for update to authenticated
  using ((select app_private.is_organization_member(organization_id, array['owner', 'admin', 'manager']::public.organization_role[])))
  with check ((select app_private.is_organization_member(organization_id, array['owner', 'admin', 'manager']::public.organization_role[])));

create policy "integration_connections_select_members" on public.integration_connections
  for select to authenticated using ((select app_private.is_organization_member(organization_id)));
create policy "integration_connections_manage_admins" on public.integration_connections
  for all to authenticated
  using ((select app_private.is_organization_member(organization_id, array['owner', 'admin']::public.organization_role[])))
  with check ((select app_private.is_organization_member(organization_id, array['owner', 'admin']::public.organization_role[])));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'crm_leads', 'crm_contacts', 'crm_conversations', 'crm_messages', 'crm_opportunities',
    'crm_proposals', 'crm_tasks', 'automation_runs'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select app_private.is_organization_member(organization_id)))',
      table_name || '_select_members', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select app_private.is_organization_member(organization_id, array[''owner'', ''admin'', ''manager'', ''seller'']::public.organization_role[])))',
      table_name || '_insert_contributors', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select app_private.is_organization_member(organization_id, array[''owner'', ''admin'', ''manager'', ''seller'']::public.organization_role[]))) with check ((select app_private.is_organization_member(organization_id, array[''owner'', ''admin'', ''manager'', ''seller'']::public.organization_role[])))',
      table_name || '_update_contributors', table_name
    );
  end loop;
end $$;

create policy "audit_logs_select_members" on public.audit_logs
  for select to authenticated using ((select app_private.is_organization_member(organization_id)));
create policy "outbound_messages_select_members" on public.outbound_messages
  for select to authenticated using ((select app_private.is_organization_member(organization_id)));
-- webhook_events and audit_logs are written only by server-side functions using
-- the Supabase secret key. No client insert/update/delete policy is granted.

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant select, update on public.organization_settings to authenticated;
grant select, insert, update on public.integration_connections to authenticated;
grant select, insert, update on public.crm_leads, public.crm_contacts, public.crm_conversations,
  public.crm_messages, public.crm_opportunities, public.crm_proposals, public.crm_tasks,
  public.automation_runs to authenticated;
grant select on public.outbound_messages, public.audit_logs to authenticated;

comment on table public.integration_connections is 'Public metadata only; provider credentials remain in server-managed secrets.';
comment on table public.webhook_events is 'Idempotent inbound provider events; service-role writes only.';
comment on table public.audit_logs is 'Immutable audit trail; service-role writes only.';
