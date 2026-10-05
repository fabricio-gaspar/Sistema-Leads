-- LeadAI Phase 4 — relational catalog and operational campaign management
--
-- This migration extends the commercial domain without enabling any external
-- provider. Browser clients can only operate inside organizations they belong
-- to; sending messages remains a server-side/outbox responsibility.

create table public.crm_catalog_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (char_length(trim(code)) between 1 and 80),
  name text not null check (char_length(trim(name)) between 2 and 160),
  category text not null check (char_length(trim(category)) between 2 and 80),
  unit text not null check (char_length(trim(unit)) between 1 and 80),
  short_description text not null default '',
  full_description text not null default '',
  is_active boolean not null default true,
  is_archived boolean not null default false,
  quote_enabled boolean not null default true,
  maximum_discount numeric(5, 2) not null default 0 check (maximum_discount between 0 and 100),
  default_lead_time_days integer not null default 0 check (default_lead_time_days >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (id, organization_id)
);

alter table public.crm_campaigns
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add constraint crm_campaigns_metadata_object check (jsonb_typeof(metadata) = 'object');

create index crm_catalog_items_org_active_updated_idx
  on public.crm_catalog_items (organization_id, is_active, updated_at desc)
  where is_archived = false;

alter table public.crm_catalog_items enable row level security;

create policy crm_catalog_items_select_members on public.crm_catalog_items
  for select to authenticated
  using ((select app_private.is_organization_member(organization_id)));
create policy crm_catalog_items_insert_contributors on public.crm_catalog_items
  for insert to authenticated
  with check ((select app_private.is_organization_member(organization_id, array['owner', 'admin', 'manager', 'seller']::public.organization_role[])));
create policy crm_catalog_items_update_contributors on public.crm_catalog_items
  for update to authenticated
  using ((select app_private.is_organization_member(organization_id, array['owner', 'admin', 'manager', 'seller']::public.organization_role[])))
  with check ((select app_private.is_organization_member(organization_id, array['owner', 'admin', 'manager', 'seller']::public.organization_role[])));

-- Membership is mutable while a list is being curated. This policy is scoped
-- to the same contributor roles as insert/update and is required for a list
-- edit to faithfully remove a lead from the relation.
create policy crm_lead_list_members_delete_contributors on public.crm_lead_list_members
  for delete to authenticated
  using ((select app_private.is_organization_member(organization_id, array['owner', 'admin', 'manager', 'seller']::public.organization_role[])));

grant select, insert, update on public.crm_catalog_items to authenticated;
grant delete on public.crm_lead_list_members to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['crm_lead_lists', 'crm_campaigns', 'crm_catalog_items'] loop
    execute format('drop trigger if exists %I on public.%I', 'set_' || table_name || '_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute procedure app_private.set_updated_at()',
      'set_' || table_name || '_updated_at', table_name
    );
  end loop;
end $$;
