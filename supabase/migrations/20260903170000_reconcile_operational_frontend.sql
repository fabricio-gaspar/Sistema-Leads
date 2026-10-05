-- Reconcilia as stores do frontend com a fonte operacional real.
begin;

create table if not exists public.organization_module_data (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key text not null check (module_key ~ '^[a-z0-9_:-]+$'),
  data jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, module_key)
);

alter table public.organization_module_data enable row level security;
drop policy if exists organization_module_data_select_active_org on public.organization_module_data;
create policy organization_module_data_select_active_org
on public.organization_module_data for select to authenticated
using (organization_id = (select public.current_org_id()));
drop policy if exists organization_module_data_insert_active_org on public.organization_module_data;
create policy organization_module_data_insert_active_org
on public.organization_module_data for insert to authenticated
with check (organization_id = (select public.current_org_id()) and updated_by = (select auth.uid()));
drop policy if exists organization_module_data_update_active_org on public.organization_module_data;
create policy organization_module_data_update_active_org
on public.organization_module_data for update to authenticated
using (organization_id = (select public.current_org_id()))
with check (organization_id = (select public.current_org_id()) and updated_by = (select auth.uid()));
revoke all on public.organization_module_data from anon;
grant select, insert, update on public.organization_module_data to authenticated;
grant all on public.organization_module_data to service_role;

alter table public.company_settings
  add column if not exists ui_settings jsonb not null default '{}'::jsonb;

alter table public.lead_tasks
  alter column lead_id drop not null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.services
  add column if not exists code text,
  add column if not exists short_description text,
  add column if not exists quote_enabled boolean not null default true,
  add column if not exists default_lead_time_days integer not null default 0
    check (default_lead_time_days >= 0);

alter table public.outreach_sequences
  add column if not exists trigger_key text not null default 'novo_lead';

create unique index if not exists services_org_code_unique
  on public.services (organization_id, code) where code is not null and code <> '';

create table if not exists public.lead_lists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade default public.current_org_id(),
  name text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'archived')),
  criteria jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_list_members (
  organization_id uuid not null references public.organizations(id) on delete cascade default public.current_org_id(),
  list_id uuid not null references public.lead_lists(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, lead_id)
);

create index if not exists lead_lists_org_status_idx on public.lead_lists (organization_id, status, updated_at desc);
create index if not exists lead_list_members_org_lead_idx on public.lead_list_members (organization_id, lead_id);

alter table public.lead_lists enable row level security;
alter table public.lead_list_members enable row level security;

drop policy if exists lead_lists_active_org on public.lead_lists;
create policy lead_lists_active_org on public.lead_lists for all to authenticated
using (organization_id = (select public.current_org_id()))
with check (organization_id = (select public.current_org_id()));

drop policy if exists lead_list_members_active_org on public.lead_list_members;
create policy lead_list_members_active_org on public.lead_list_members for all to authenticated
using (
  organization_id = (select public.current_org_id())
  and exists (
    select 1 from public.lead_lists list
    where list.id = lead_list_members.list_id
      and list.organization_id = lead_list_members.organization_id
  )
)
with check (
  organization_id = (select public.current_org_id())
  and exists (
    select 1 from public.lead_lists list
    where list.id = lead_list_members.list_id
      and list.organization_id = lead_list_members.organization_id
  )
  and exists (
    select 1 from public.leads lead
    where lead.id = lead_list_members.lead_id
      and lead.organization_id = lead_list_members.organization_id
  )
);

revoke all on public.lead_lists, public.lead_list_members from anon;
grant select, insert, update, delete on public.lead_lists, public.lead_list_members to authenticated;
grant all on public.lead_lists, public.lead_list_members to service_role;

notify pgrst, 'reload schema';
commit;
