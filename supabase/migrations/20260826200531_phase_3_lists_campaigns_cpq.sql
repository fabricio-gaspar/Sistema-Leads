-- LeadAI Phase 3 — lists, controlled cadences and CPQ relations

create table public.crm_lead_lists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 160),
  status text not null default 'pending' check (status in ('pending', 'active', 'archived')),
  criteria jsonb not null default '{}'::jsonb check (jsonb_typeof(criteria) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);
alter table public.crm_lead_lists add constraint crm_lead_lists_id_organization_unique unique (id, organization_id);

create table public.crm_lead_list_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  list_id uuid not null references public.crm_lead_lists(id) on delete cascade,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, lead_id),
  foreign key (list_id, organization_id) references public.crm_lead_lists(id, organization_id),
  foreign key (lead_id, organization_id) references public.crm_leads(id, organization_id)
);

create table public.crm_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  list_id uuid references public.crm_lead_lists(id) on delete set null,
  name text not null check (char_length(trim(name)) between 2 and 160),
  status text not null default 'draft' check (status in ('draft', 'pilot', 'active', 'paused', 'archived')),
  channel text not null check (channel in ('whatsapp', 'email', 'mixed')),
  cadence jsonb not null default '[]'::jsonb check (jsonb_typeof(cadence) = 'array'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (list_id, organization_id) references public.crm_lead_lists(id, organization_id)
);

alter table public.crm_opportunities
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add constraint crm_opportunities_metadata_object check (jsonb_typeof(metadata) = 'object');
alter table public.crm_proposals
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add constraint crm_proposals_metadata_object check (jsonb_typeof(metadata) = 'object');
create table public.crm_proposal_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  proposal_id uuid not null references public.crm_proposals(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);
alter table public.crm_proposals add constraint crm_proposals_id_organization_unique unique (id, organization_id);
alter table public.crm_proposal_lines
  add constraint crm_proposal_lines_same_org_proposal_fk
  foreign key (proposal_id, organization_id) references public.crm_proposals(id, organization_id);

create index crm_lead_lists_org_status_updated_idx on public.crm_lead_lists (organization_id, status, updated_at desc);
create index crm_campaigns_org_status_updated_idx on public.crm_campaigns (organization_id, status, updated_at desc);
create index crm_list_members_lead_idx on public.crm_lead_list_members (lead_id);
create index crm_proposal_lines_proposal_idx on public.crm_proposal_lines (proposal_id);

alter table public.crm_lead_lists enable row level security;
alter table public.crm_lead_list_members enable row level security;
alter table public.crm_campaigns enable row level security;
alter table public.crm_proposal_lines enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['crm_lead_lists', 'crm_lead_list_members', 'crm_campaigns', 'crm_proposal_lines'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select app_private.is_organization_member(organization_id)))', table_name || '_select_members', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select app_private.is_organization_member(organization_id, array[''owner'', ''admin'', ''manager'', ''seller'']::public.organization_role[])))', table_name || '_insert_contributors', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select app_private.is_organization_member(organization_id, array[''owner'', ''admin'', ''manager'', ''seller'']::public.organization_role[]))) with check ((select app_private.is_organization_member(organization_id, array[''owner'', ''admin'', ''manager'', ''seller'']::public.organization_role[])))', table_name || '_update_contributors', table_name);
  end loop;
end $$;

grant select, insert, update on public.crm_lead_lists, public.crm_lead_list_members, public.crm_campaigns, public.crm_proposal_lines to authenticated;
