-- LeadAI Phase 5 — operational proposals / CPQ
--
-- This migration completes the relational proposal flow. Proposal creation and
-- line replacement are intentionally transactional RPCs, so the browser never
-- leaves partial opportunities or proposal lines behind on a failed request.

alter table public.crm_catalog_items
  add column if not exists base_unit_price numeric(14, 2) not null default 0
    check (base_unit_price >= 0);

alter table public.crm_proposals
  add column if not exists subtotal_amount numeric(14, 2) not null default 0
    check (subtotal_amount >= 0),
  add column if not exists discount_pct numeric(5, 2) not null default 0
    check (discount_pct between 0 and 100),
  add column if not exists version integer not null default 1
    check (version >= 1),
  add column if not exists parent_proposal_id uuid,
  add column if not exists is_archived boolean not null default false;

alter table public.crm_proposals
  drop constraint if exists crm_proposals_status_check,
  add constraint crm_proposals_status_check
    check (status in ('draft', 'pending_approval', 'sent', 'viewed', 'accepted', 'rejected', 'expired')),
  add constraint crm_proposals_same_org_parent_fk
    foreign key (parent_proposal_id, organization_id)
    references public.crm_proposals(id, organization_id);

create unique index if not exists crm_proposals_opportunity_version_unique_idx
  on public.crm_proposals (opportunity_id, version)
  where not is_archived;
create index if not exists crm_proposals_org_active_updated_idx
  on public.crm_proposals (organization_id, status, updated_at desc)
  where not is_archived;
create index if not exists crm_catalog_items_org_quote_enabled_idx
  on public.crm_catalog_items (organization_id, updated_at desc)
  where is_active and not is_archived and quote_enabled;

-- Quote rows and line items are commercial records. They are archived instead
-- of deleted, keeping the business history available for reports and audits.
create or replace function public.create_crm_proposal(
  target_proposal_id uuid,
  target_organization_id uuid,
  target_lead_id uuid,
  proposal_number text,
  proposal_valid_until date,
  proposal_subtotal_amount numeric,
  proposal_discount_pct numeric,
  proposal_status text,
  proposal_parent_id uuid,
  proposal_metadata jsonb,
  proposal_lines jsonb
)
returns public.crm_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_opportunity_id uuid;
  new_proposal public.crm_proposals;
  new_version integer := 1;
  normalized_number text := upper(trim(proposal_number));
  line_item jsonb;
  line_quantity numeric;
  line_unit_price numeric;
  line_description text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not (select app_private.is_organization_member(
    target_organization_id,
    array['owner', 'admin', 'manager', 'seller']::public.organization_role[]
  )) then
    raise exception 'organization_access_denied' using errcode = '42501';
  end if;

  if normalized_number !~ '^PRP-[0-9]{8}-[A-Z0-9]{6}$' then
    raise exception 'invalid_proposal_number' using errcode = '22023';
  end if;
  if target_proposal_id is null then
    raise exception 'proposal_id_required' using errcode = '22023';
  end if;
  if proposal_status not in ('draft', 'pending_approval') then
    raise exception 'invalid_initial_proposal_status' using errcode = '22023';
  end if;
  if proposal_subtotal_amount < 0 or proposal_discount_pct < 0 or proposal_discount_pct > 100 then
    raise exception 'invalid_proposal_amount' using errcode = '22023';
  end if;
  if jsonb_typeof(proposal_metadata) <> 'object' or jsonb_typeof(proposal_lines) <> 'array'
    or jsonb_array_length(proposal_lines) = 0 then
    raise exception 'invalid_proposal_payload' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.crm_leads
    where id = target_lead_id and organization_id = target_organization_id and not is_archived
  ) then
    raise exception 'lead_not_found_in_organization' using errcode = '23503';
  end if;

  if proposal_parent_id is not null then
    select opportunity_id, version + 1
      into target_opportunity_id, new_version
    from public.crm_proposals
    where id = proposal_parent_id
      and organization_id = target_organization_id
      and not is_archived;
    if target_opportunity_id is null then
      raise exception 'parent_proposal_not_found_in_organization' using errcode = '23503';
    end if;
  else
    insert into public.crm_opportunities (
      organization_id, lead_id, owner_id, name, stage, amount, currency, metadata
    ) values (
      target_organization_id, target_lead_id, current_user_id,
      'Proposta ' || normalized_number, 'proposal',
      round(proposal_subtotal_amount * (1 - proposal_discount_pct / 100), 2), 'BRL',
      jsonb_build_object('origin', 'cpq')
    ) returning id into target_opportunity_id;
  end if;

  insert into public.crm_proposals (
    id, organization_id, opportunity_id, number, status, valid_until,
    subtotal_amount, total_amount, discount_pct, version, parent_proposal_id,
    currency, metadata, created_by
  ) values (
    target_proposal_id, target_organization_id, target_opportunity_id, normalized_number, proposal_status, proposal_valid_until,
    proposal_subtotal_amount, round(proposal_subtotal_amount * (1 - proposal_discount_pct / 100), 2),
    proposal_discount_pct, new_version, proposal_parent_id,
    'BRL', proposal_metadata, current_user_id
  ) returning * into new_proposal;

  for line_item in select value from jsonb_array_elements(proposal_lines) loop
    line_description := trim(coalesce(line_item ->> 'description', ''));
    line_quantity := nullif(line_item ->> 'quantity', '')::numeric;
    line_unit_price := nullif(line_item ->> 'unit_price', '')::numeric;
    if char_length(line_description) = 0 or line_quantity is null or line_quantity <= 0
      or line_unit_price is null or line_unit_price < 0 then
      raise exception 'invalid_proposal_line' using errcode = '22023';
    end if;
    insert into public.crm_proposal_lines (organization_id, proposal_id, description, quantity, unit_price)
    values (target_organization_id, new_proposal.id, line_description, line_quantity, line_unit_price);
  end loop;

  return new_proposal;
end;
$$;

create or replace function public.update_crm_proposal(
  target_proposal_id uuid,
  proposal_valid_until date,
  proposal_subtotal_amount numeric,
  proposal_discount_pct numeric,
  proposal_status text,
  proposal_metadata jsonb,
  proposal_lines jsonb
)
returns public.crm_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_proposal public.crm_proposals;
  updated_proposal public.crm_proposals;
  current_role public.organization_role;
  line_item jsonb;
  line_quantity numeric;
  line_unit_price numeric;
  line_description text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  select * into current_proposal
  from public.crm_proposals
  where id = target_proposal_id and not is_archived
  for update;
  if current_proposal.id is null then
    raise exception 'proposal_not_found' using errcode = 'P0002';
  end if;
  if not (select app_private.is_organization_member(
    current_proposal.organization_id,
    array['owner', 'admin', 'manager', 'seller']::public.organization_role[]
  )) then
    raise exception 'organization_access_denied' using errcode = '42501';
  end if;
  select role into current_role
  from public.organization_members
  where organization_id = current_proposal.organization_id
    and user_id = current_user_id
    and status = 'active';
  if current_proposal.status = 'accepted' then
    raise exception 'accepted_proposal_locked' using errcode = '55000';
  end if;
  if current_proposal.status = 'pending_approval' and proposal_status <> 'pending_approval' then
    if current_role not in ('owner', 'admin', 'manager') then
      raise exception 'discount_approval_requires_manager' using errcode = '42501';
    end if;
    if proposal_status = 'draft' and proposal_discount_pct > 0
      and coalesce((proposal_metadata ->> 'descontoAprovado')::boolean, false) is false then
      raise exception 'discount_approval_required' using errcode = '42501';
    end if;
  end if;
  if proposal_status not in ('draft', 'pending_approval', 'sent', 'viewed', 'accepted', 'rejected', 'expired')
    or proposal_subtotal_amount < 0 or proposal_discount_pct < 0 or proposal_discount_pct > 100
    or jsonb_typeof(proposal_metadata) <> 'object' or jsonb_typeof(proposal_lines) <> 'array'
    or jsonb_array_length(proposal_lines) = 0 then
    raise exception 'invalid_proposal_payload' using errcode = '22023';
  end if;

  update public.crm_proposals set
    valid_until = proposal_valid_until,
    subtotal_amount = proposal_subtotal_amount,
    total_amount = round(proposal_subtotal_amount * (1 - proposal_discount_pct / 100), 2),
    discount_pct = proposal_discount_pct,
    status = proposal_status,
    metadata = proposal_metadata
  where id = target_proposal_id and organization_id = current_proposal.organization_id
  returning * into updated_proposal;

  delete from public.crm_proposal_lines
  where proposal_id = target_proposal_id and organization_id = current_proposal.organization_id;
  for line_item in select value from jsonb_array_elements(proposal_lines) loop
    line_description := trim(coalesce(line_item ->> 'description', ''));
    line_quantity := nullif(line_item ->> 'quantity', '')::numeric;
    line_unit_price := nullif(line_item ->> 'unit_price', '')::numeric;
    if char_length(line_description) = 0 or line_quantity is null or line_quantity <= 0
      or line_unit_price is null or line_unit_price < 0 then
      raise exception 'invalid_proposal_line' using errcode = '22023';
    end if;
    insert into public.crm_proposal_lines (organization_id, proposal_id, description, quantity, unit_price)
    values (current_proposal.organization_id, target_proposal_id, line_description, line_quantity, line_unit_price);
  end loop;
  return updated_proposal;
end;
$$;

create or replace function public.archive_crm_proposal(target_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_organization_id uuid;
  target_status text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  select organization_id, status into target_organization_id, target_status
  from public.crm_proposals where id = target_proposal_id and not is_archived;
  if target_organization_id is null then
    raise exception 'proposal_not_found' using errcode = 'P0002';
  end if;
  if not (select app_private.is_organization_member(
    target_organization_id,
    array['owner', 'admin', 'manager', 'seller']::public.organization_role[]
  )) then
    raise exception 'organization_access_denied' using errcode = '42501';
  end if;
  if target_status = 'accepted' then
    raise exception 'accepted_proposal_cannot_be_archived' using errcode = '55000';
  end if;
  update public.crm_proposals set is_archived = true
  where id = target_proposal_id and organization_id = target_organization_id;
end;
$$;

revoke all on function public.create_crm_proposal(uuid, uuid, uuid, text, date, numeric, numeric, text, uuid, jsonb, jsonb) from public, anon;
revoke all on function public.update_crm_proposal(uuid, date, numeric, numeric, text, jsonb, jsonb) from public, anon;
revoke all on function public.archive_crm_proposal(uuid) from public, anon;
grant execute on function public.create_crm_proposal(uuid, uuid, uuid, text, date, numeric, numeric, text, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.update_crm_proposal(uuid, date, numeric, numeric, text, jsonb, jsonb) to authenticated;
grant execute on function public.archive_crm_proposal(uuid) to authenticated;

comment on function public.create_crm_proposal(uuid, uuid, uuid, text, date, numeric, numeric, text, uuid, jsonb, jsonb)
  is 'Creates a tenant-scoped opportunity, proposal and lines atomically.';
comment on function public.update_crm_proposal(uuid, date, numeric, numeric, text, jsonb, jsonb)
  is 'Replaces proposal lines atomically after tenant membership validation.';
