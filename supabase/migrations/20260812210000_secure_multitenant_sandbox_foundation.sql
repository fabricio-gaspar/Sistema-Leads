-- Real foundation for Sistema de Leads / Ana.
-- This migration intentionally supersedes the old, divergent local migrations.
-- It is safe to apply to the current connected project, which has no auth users.

begin;

create extension if not exists pgcrypto;

do $$
begin
  alter type public.app_role add value if not exists 'sdr';
  alter type public.app_role add value if not exists 'cx';
exception when undefined_object then
  create type public.app_role as enum ('administrador', 'vendedor', 'ia', 'sdr', 'cx');
end $$;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Multi-company identity and active workspace
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists active_organization_id uuid references public.organizations(id) on delete set null;

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'vendedor',
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

alter table public.organization_members
  add column if not exists status text not null default 'active' check (status in ('active', 'disabled')),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'vendedor',
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

create index if not exists organization_members_user_idx on public.organization_members(user_id);
create index if not exists organization_invites_email_idx on public.organization_invites(lower(email));

create or replace function private.is_org_member(_organization_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = _organization_id
      and m.user_id = _user_id
      and m.status = 'active'
  );
$$;

create or replace function private.is_org_admin(_organization_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = _organization_id
      and m.user_id = _user_id
      and m.status = 'active'
      and m.role = 'administrador'
  );
$$;

create or replace function private.is_active_org_member(_organization_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select private.is_org_member(_organization_id, _user_id)
     and exists (
       select 1 from public.profiles p
       where p.id = _user_id and p.active_organization_id = _organization_id
     );
$$;

revoke all on function private.is_org_member(uuid, uuid) from public;
revoke all on function private.is_org_admin(uuid, uuid) from public;
revoke all on function private.is_active_org_member(uuid, uuid) from public;
grant execute on function private.is_org_member(uuid, uuid) to authenticated, service_role;
grant execute on function private.is_org_admin(uuid, uuid) to authenticated, service_role;
grant execute on function private.is_active_org_member(uuid, uuid) to authenticated, service_role;

create or replace function public.current_org_id()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_org uuid;
begin
  select p.active_organization_id into v_org
  from public.profiles p
  where p.id = auth.uid() and p.active = true;

  if v_org is null or not private.is_org_member(v_org, auth.uid()) then
    raise exception 'Nenhuma organização ativa para este usuário';
  end if;
  return v_org;
end;
$$;

revoke all on function public.current_org_id() from public;
grant execute on function public.current_org_id() to authenticated, service_role;

create or replace function public.set_active_organization(_organization_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is null or not private.is_org_member(_organization_id, auth.uid()) then
    raise exception 'Organização não disponível para este usuário';
  end if;
  update public.profiles
     set active_organization_id = _organization_id,
         updated_at = now()
   where id = auth.uid();
  return _organization_id;
end;
$$;

revoke all on function public.set_active_organization(uuid) from public;
grant execute on function public.set_active_organization(uuid) to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_invite public.organization_invites%rowtype;
  v_name text;
begin
  select * into v_invite
  from public.organization_invites i
  where lower(i.email) = lower(coalesce(new.email, ''))
    and i.accepted_at is null
    and i.expires_at > now()
  order by i.created_at
  limit 1;

  if v_invite.id is null then
    raise exception 'Seu e-mail ainda não possui convite para esta organização';
  end if;

  v_name := coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, 'Usuário'), '@', 1));
  insert into public.profiles (id, name, email, active, can_use_ia, active_organization_id)
  values (new.id, v_name, new.email, true, true, v_invite.organization_id)
  on conflict (id) do update set
    email = excluded.email,
    active = true,
    active_organization_id = coalesce(public.profiles.active_organization_id, excluded.active_organization_id),
    updated_at = now();

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_invite.organization_id, new.id, v_invite.role, 'active')
  on conflict (organization_id, user_id) do update set status = 'active', updated_at = now();

  insert into public.user_roles (organization_id, user_id, role)
  values (v_invite.organization_id, new.id, v_invite.role)
  on conflict (organization_id, user_id, role) do nothing;

  update public.organization_invites
     set accepted_at = now()
   where id = v_invite.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_fabricio on auth.users;
drop trigger if exists tr_force_admin_fabricio on auth.users;
drop function if exists public.auto_assign_admin_fabricio();
drop function if exists public.force_admin_on_login();
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- Bootstrap invitation: the first account chooses its own password through
-- Supabase Auth. No password is stored or generated by this migration.
insert into public.organization_invites (organization_id, email, role, expires_at)
select id, 'fabricio@wfdigital.com.br', 'administrador', now() + interval '365 days'
from public.organizations
where slug = 'wf-digital'
on conflict (organization_id, email) do update
  set role = excluded.role,
      expires_at = greatest(public.organization_invites.expires_at, excluded.expires_at);

-- ---------------------------------------------------------------------------
-- Data model gaps used by the existing UI and server routes
-- ---------------------------------------------------------------------------

alter table public.leads
  add column if not exists active_channel text,
  add column if not exists contact_approval_status text,
  add column if not exists contact_approval_reason text,
  add column if not exists instagram_user_id text;

alter table public.lead_messages add column if not exists provider_message_id text;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='start_at')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='starts_at') then
    alter table public.appointments rename column start_at to starts_at;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='end_at')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='ends_at') then
    alter table public.appointments rename column end_at to ends_at;
  end if;
end $$;

alter table public.appointments
  add column if not exists notes text,
  add column if not exists provider text,
  add column if not exists external_id text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.contact_suppressions
  alter column contact drop not null;

alter table public.outreach_sequences
  add column if not exists description text,
  add column if not exists active boolean not null default true,
  add column if not exists is_default boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.outreach_sequence_steps
  add column if not exists delay_minutes integer not null default 1440,
  add column if not exists template text,
  add column if not exists active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.lead_sequence_enrollments
  add column if not exists current_step_index integer not null default 0,
  add column if not exists pause_reason text,
  add column if not exists started_at timestamptz not null default now(),
  add column if not exists last_step_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists nurture_cycles integer not null default 0;

create table if not exists public.lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid references auth.users(id) on delete set null,
  reason text,
  source text not null default 'system' check (source in ('ia','human','system')),
  created_at timestamptz not null default now()
);

create table if not exists public.lead_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  from_user uuid references auth.users(id) on delete set null,
  to_user uuid references auth.users(id) on delete set null,
  changed_by uuid references auth.users(id) on delete set null,
  reason text,
  source text not null default 'system' check (source in ('ia','human','system')),
  created_at timestamptz not null default now()
);

create table if not exists public.contact_points (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  kind text not null check (kind in ('whatsapp','phone','email','site')),
  value text not null,
  value_normalized text not null,
  value_hash text not null,
  verified boolean not null default false,
  preferred boolean not null default false,
  sandbox boolean not null default false,
  status text not null default 'active' check (status in ('active','opt_out','bounced','invalid')),
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, kind, value_hash)
);

create table if not exists public.lead_outreach (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  channel text not null check (channel in ('whatsapp','email','phone','instagram')),
  status text not null default 'pending' check (status in ('pending','sent','delivered','read','replied','failed','skipped')),
  provider text,
  provider_message_id text,
  content text,
  error text,
  attempt integer not null default 1,
  scheduled_for timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  replied_at timestamptz,
  failed_at timestamptz,
  actor_type text not null default 'ia',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  provider text not null,
  external_id text,
  event_type text,
  payload_sha text,
  payload jsonb,
  status text not null default 'received' check (status in ('received','processed','failed','ignored')),
  processed_at timestamptz,
  error text,
  lead_id uuid references public.leads(id) on delete set null,
  outreach_id uuid references public.lead_outreach(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table if not exists public.consent_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  contact_point_id uuid references public.contact_points(id) on delete set null,
  event text not null check (event in ('opt_in','opt_out','complaint','resubscribe')),
  channel text not null check (channel in ('all','whatsapp','phone','email','instagram')),
  source text not null check (source in ('client_reply','admin','webhook','import','automation')),
  text text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null,
  visibility text not null default 'internal' check (visibility = 'internal'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_qualifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  intent text,
  service_interest text,
  pain text,
  urgency text,
  budget_range text,
  decision_maker text,
  objections jsonb not null default '[]'::jsonb,
  sentiment text,
  next_action text,
  summary text,
  evidence jsonb not null default '[]'::jsonb,
  readiness_score integer check (readiness_score between 0 and 100),
  updated_by text not null default 'ia' check (updated_by in ('ia','human','system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  color text not null default '#2563eb',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.service_queues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  name text not null,
  channel text not null default 'all' check (channel in ('all','whatsapp','email','instagram','phone')),
  assignment_strategy text not null default 'round_robin' check (assignment_strategy in ('manual','round_robin','least_loaded')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  protocol text not null default ('ATD-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  lead_id uuid not null references public.leads(id) on delete cascade,
  queue_id uuid references public.service_queues(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  status text not null default 'open' check (status in ('open','waiting_customer','waiting_agent','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  source_channel text not null default 'whatsapp' check (source_channel in ('whatsapp','email','instagram','phone','manual')),
  first_response_due_at timestamptz,
  resolution_due_at timestamptz,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, protocol)
);

create unique index if not exists tickets_one_open_per_lead_idx on public.tickets(lead_id)
  where status in ('open','waiting_customer','waiting_agent');

create table if not exists public.ticket_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text not null default '#64748b',
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.ticket_tags (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (ticket_id, tag_id)
);

create table if not exists public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shortcut text not null,
  title text not null,
  body text not null,
  channel text not null default 'all' check (channel in ('all','whatsapp','email','instagram')),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, shortcut)
);

create table if not exists public.call_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete set null,
  provider text,
  external_id text,
  direction text not null default 'outbound' check (direction in ('inbound','outbound')),
  status text not null default 'queued' check (status in ('queued','ringing','answered','failed','completed')),
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  recording_url text,
  recording_consent boolean not null default false,
  transcript text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.channel_inbound_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  event_type text not null,
  external_id text not null,
  lead_id uuid references public.leads(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (status in ('received','processed','ignored','failed')),
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (organization_id, provider, external_id)
);

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  message_id uuid references public.lead_messages(id) on delete cascade,
  media_type text not null check (media_type in ('image','audio','document','video')),
  mime_type text,
  file_name text,
  storage_path text,
  external_url text,
  transcript text,
  extracted_text text,
  ai_processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'sistema',
  title text not null,
  description text,
  read boolean not null default false,
  link text,
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text,
  description text,
  price numeric,
  unit text,
  term text,
  max_discount numeric,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.objections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trigger text not null,
  response text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, trigger)
);

create table if not exists public.automation_heartbeats (
  job_name text primary key check (job_name in ('outreach','prospecting')),
  last_started_at timestamptz,
  last_finished_at timestamptz,
  status text not null default 'never' check (status in ('never','running','success','partial','failed')),
  last_error text,
  detail jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.automation_heartbeats(job_name) values ('outreach'), ('prospecting')
on conflict (job_name) do nothing;

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  requester_hash text not null,
  request_type text not null check (request_type in ('access','correction','deletion','portability','objection')),
  status text not null default 'received' check (status in ('received','verifying','in_progress','completed','rejected')),
  notes text,
  received_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);

-- RAG-ready storage: documents remain private and embeddings are optional.
do $$
begin
  create extension if not exists vector with schema extensions;
exception when insufficient_privilege or undefined_file then
  raise notice 'pgvector is unavailable; embeddings will remain disabled until enabled in Supabase.';
end $$;

do $$
begin
  if exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where t.typname='vector' and n.nspname='extensions') then
    alter table public.knowledge_chunks add column if not exists embedding extensions.vector(1536);
    alter table public.knowledge_chunks add column if not exists metadata jsonb not null default '{}'::jsonb;
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('docs', 'docs', false, 26214400, array['application/pdf','text/plain','text/markdown','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('message-media', 'message-media', false, 52428800, array['image/jpeg','image/png','image/webp','audio/mpeg','audio/ogg','audio/wav','application/pdf','video/mp4'])
on conflict (id) do update set public = false;

-- Organization defaults make the existing server functions safe without a
-- client-supplied organization id. The active workspace is enforced by RLS.
do $$
declare r record;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'organization_id'
      and c.table_name not in ('organizations','organization_members','organization_invites','user_roles')
  loop
    execute format('alter table public.%I alter column organization_id set default public.current_org_id()', r.table_name);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Auditing, LGPD helpers, indexes and immutable records
-- ---------------------------------------------------------------------------

alter table public.audit_logs
  add column if not exists entity_table text,
  add column if not exists entity_id uuid,
  add column if not exists event_data jsonb not null default '{}'::jsonb;

create or replace function public.prevent_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Logs de auditoria são imutáveis';
end;
$$;

drop trigger if exists audit_logs_immutable on public.audit_logs;
create trigger audit_logs_immutable
  before update or delete on public.audit_logs
  for each row execute procedure public.prevent_audit_mutation();

create or replace function public.audit_business_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_org uuid;
  v_id uuid;
  v_action text;
begin
  if tg_op = 'DELETE' then
    v_org := old.organization_id;
    v_id := old.id;
  else
    v_org := new.organization_id;
    v_id := new.id;
  end if;
  if v_org is null then return coalesce(new, old); end if;
  v_action := lower(tg_table_name) || '_' || lower(tg_op);
  insert into public.audit_logs (organization_id, actor_id, actor_name, actor_type, action, detail, entity_table, entity_id, event_data)
  values (
    v_org,
    auth.uid(),
    coalesce(auth.jwt() ->> 'email', 'system'),
    case when auth.uid() is null then 'system' else 'human' end,
    v_action,
    format('%s %s', tg_op, tg_table_name),
    tg_table_name,
    v_id,
    jsonb_build_object('operation', tg_op)
  );
  return coalesce(new, old);
end;
$$;

do $$
declare r record;
begin
  for r in select unnest(array[
    'leads','contact_points','lead_outreach','lead_messages','appointments','proposals','orders',
    'lead_tasks','lead_notes','consent_events','contact_suppressions','documents','services',
    'objections','tickets','organization_members','organization_invites','privacy_requests'
  ]) as table_name
  loop
    if to_regclass('public.' || r.table_name) is not null then
      execute format('drop trigger if exists %I on public.%I', 'audit_' || r.table_name, r.table_name);
      execute format('create trigger %I after insert or update or delete on public.%I for each row execute procedure public.audit_business_change()', 'audit_' || r.table_name, r.table_name);
    end if;
  end loop;
end $$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select _user_id = auth.uid()
     and exists (
       select 1 from public.profiles p
       where p.id = _user_id
         and p.active_organization_id is not null
         and private.is_org_admin(p.active_organization_id, _user_id)
         and _role = 'administrador'
     );
$$;

create or replace function public.has_contact_suppression(_lead_id uuid, _hashes text[])
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1
    from public.leads l
    join public.contact_suppressions s on s.organization_id = l.organization_id
    where l.id = _lead_id
      and private.is_active_org_member(l.organization_id, auth.uid())
      and s.contact_hash = any(_hashes)
  );
$$;

create or replace function public.clear_contact_suppressions(_lead_id uuid, _hashes text[])
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.leads where id = _lead_id;
  if v_org is null or not private.is_active_org_member(v_org, auth.uid()) then
    raise exception 'Lead não disponível na organização ativa';
  end if;
  delete from public.contact_suppressions
  where organization_id = v_org and contact_hash = any(_hashes);
end;
$$;

create or replace function public.anonymize_lead_lgpd(_lead_id uuid, _reason text default 'privacy_request')
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.leads where id = _lead_id for update;
  if v_org is null or not private.is_org_admin(v_org, auth.uid()) then
    raise exception 'Apenas administradores da organização podem anonimizar dados';
  end if;
  update public.contact_points set status = 'opt_out', value = '[anonimizado]', value_normalized = '[anonimizado]', updated_at = now()
   where lead_id = _lead_id;
  update public.leads
     set contact = null, title = null, phone = null, whatsapp = null, email = null,
         opt_out = true, ai_paused = true, next_action_at = null, updated_at = now()
   where id = _lead_id;
  insert into public.privacy_requests (organization_id, lead_id, requester_hash, request_type, status, notes, fulfilled_at, handled_by)
  values (v_org, _lead_id, encode(digest(_lead_id::text, 'sha256'), 'hex'), 'deletion', 'completed', _reason, now(), auth.uid());
end;
$$;

revoke all on function public.has_role(uuid, public.app_role) from public;
revoke all on function public.has_contact_suppression(uuid, text[]) from public;
revoke all on function public.clear_contact_suppressions(uuid, text[]) from public;
revoke all on function public.anonymize_lead_lgpd(uuid, text) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.has_contact_suppression(uuid, text[]) to authenticated;
grant execute on function public.clear_contact_suppressions(uuid, text[]) to authenticated;
grant execute on function public.anonymize_lead_lgpd(uuid, text) to authenticated;

create index if not exists leads_org_updated_idx on public.leads(organization_id, updated_at desc);
create index if not exists contact_points_org_lead_idx on public.contact_points(organization_id, lead_id);
create index if not exists lead_outreach_org_lead_idx on public.lead_outreach(organization_id, lead_id, created_at desc);
create index if not exists lead_messages_org_lead_idx on public.lead_messages(organization_id, lead_id, sent_at);
create index if not exists appointments_org_starts_idx on public.appointments(organization_id, starts_at);
create index if not exists consent_events_org_lead_idx on public.consent_events(organization_id, lead_id, created_at desc);
create index if not exists lead_notes_org_lead_idx on public.lead_notes(organization_id, lead_id, created_at desc);
create index if not exists tickets_org_status_idx on public.tickets(organization_id, status, updated_at desc);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists privacy_requests_org_status_idx on public.privacy_requests(organization_id, status, received_at desc);

-- ---------------------------------------------------------------------------
-- RLS: every organization table is scoped to the active organization.
-- The policy loop replaces broad and self-referencing legacy policies.
-- ---------------------------------------------------------------------------

do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

do $$
declare r record;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'organization_id'
      and c.table_name not in ('organizations','organization_members','organization_invites','user_roles','audit_logs','privacy_requests')
  loop
    execute format('alter table public.%I enable row level security', r.table_name);
    execute format(
      'create policy org_active_access on public.%I for all to authenticated using ((select private.is_active_org_member(organization_id, auth.uid()))) with check ((select private.is_active_org_member(organization_id, auth.uid())))',
      r.table_name
    );
  end loop;
end $$;

alter table public.organizations enable row level security;
create policy organizations_active_select on public.organizations for select to authenticated
  using ((select private.is_active_org_member(id, auth.uid())));
create policy organizations_admin_update on public.organizations for update to authenticated
  using ((select private.is_org_admin(id, auth.uid())))
  with check ((select private.is_org_admin(id, auth.uid())));

alter table public.organization_members enable row level security;
create policy organization_members_self_or_admin_select on public.organization_members for select to authenticated
  using (user_id = auth.uid() or (select private.is_org_admin(organization_id, auth.uid())));
create policy organization_members_admin_manage on public.organization_members for all to authenticated
  using ((select private.is_org_admin(organization_id, auth.uid())))
  with check ((select private.is_org_admin(organization_id, auth.uid())));

alter table public.organization_invites enable row level security;
create policy organization_invites_admin_access on public.organization_invites for all to authenticated
  using ((select private.is_org_admin(organization_id, auth.uid())))
  with check ((select private.is_org_admin(organization_id, auth.uid())));

alter table public.profiles enable row level security;
create policy profiles_self_or_team_read on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.organization_members m
      where m.user_id = public.profiles.id
        and private.is_active_org_member(m.organization_id, auth.uid())
    )
  );
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

alter table public.user_roles enable row level security;
create policy user_roles_self_or_admin_read on public.user_roles for select to authenticated
  using (user_id = auth.uid() or (select private.is_org_admin(organization_id, auth.uid())));
create policy user_roles_admin_manage on public.user_roles for all to authenticated
  using ((select private.is_org_admin(organization_id, auth.uid())))
  with check ((select private.is_org_admin(organization_id, auth.uid())));

alter table public.audit_logs enable row level security;
create policy audit_logs_admin_read on public.audit_logs for select to authenticated
  using ((select private.is_org_admin(organization_id, auth.uid())));
create policy audit_logs_member_append on public.audit_logs for insert to authenticated
  with check ((select private.is_active_org_member(organization_id, auth.uid())));

alter table public.privacy_requests enable row level security;
create policy privacy_requests_admin_access on public.privacy_requests for all to authenticated
  using ((select private.is_org_admin(organization_id, auth.uid())))
  with check ((select private.is_org_admin(organization_id, auth.uid())));

alter table public.notifications enable row level security;
create policy notifications_owner_access on public.notifications for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.automation_heartbeats enable row level security;
create policy automation_heartbeats_admin_read on public.automation_heartbeats for select to authenticated
  using (exists (select 1 from public.organization_members m where m.user_id = auth.uid() and m.role = 'administrador' and m.status = 'active'));

-- Configuration is visible to the active organization but only admins mutate it.
do $$
declare r record;
begin
  for r in select unnest(array['company_settings','integrations','outreach_sequences','outreach_sequence_steps','score_weights','services','objections','departments','service_queues','tags','quick_replies']) as table_name
  loop
    if to_regclass('public.' || r.table_name) is not null then
      execute format('drop policy if exists org_active_access on public.%I', r.table_name);
      execute format('create policy configuration_read on public.%I for select to authenticated using ((select private.is_active_org_member(organization_id, auth.uid())))', r.table_name);
      execute format('create policy configuration_admin_write on public.%I for insert to authenticated with check ((select private.is_org_admin(organization_id, auth.uid())) and organization_id = public.current_org_id())', r.table_name);
      execute format('create policy configuration_admin_update on public.%I for update to authenticated using ((select private.is_org_admin(organization_id, auth.uid()))) with check ((select private.is_org_admin(organization_id, auth.uid())))', r.table_name);
      execute format('create policy configuration_admin_delete on public.%I for delete to authenticated using ((select private.is_org_admin(organization_id, auth.uid())))', r.table_name);
    end if;
  end loop;
end $$;

-- Private storage paths are always <organization_id>/<filename>.
drop policy if exists storage_active_org_read on storage.objects;
drop policy if exists storage_active_org_insert on storage.objects;
drop policy if exists storage_active_org_update on storage.objects;
drop policy if exists storage_active_org_delete on storage.objects;

create policy storage_active_org_read on storage.objects for select to authenticated
  using (bucket_id in ('docs','message-media') and (storage.foldername(name))[1] = public.current_org_id()::text);
create policy storage_active_org_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('docs','message-media') and (storage.foldername(name))[1] = public.current_org_id()::text);
create policy storage_active_org_update on storage.objects for update to authenticated
  using (bucket_id in ('docs','message-media') and (storage.foldername(name))[1] = public.current_org_id()::text)
  with check (bucket_id in ('docs','message-media') and (storage.foldername(name))[1] = public.current_org_id()::text);
create policy storage_active_org_delete on storage.objects for delete to authenticated
  using (bucket_id in ('docs','message-media') and (storage.foldername(name))[1] = public.current_org_id()::text);

commit;
