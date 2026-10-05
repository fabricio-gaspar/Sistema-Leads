-- LeadAI Phase 6 — sales and receivables operational core
--
-- A proposal acceptance produces exactly one sale and one initial receivable
-- in the same transaction. Financial state changes are controlled RPCs; the
-- browser has read-only access to these commercial records.

create table public.crm_sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  proposal_id uuid not null references public.crm_proposals(id) on delete restrict,
  opportunity_id uuid not null references public.crm_opportunities(id) on delete restrict,
  lead_id uuid not null references public.crm_leads(id) on delete restrict,
  amount numeric(14, 2) not null check (amount >= 0),
  currency char(3) not null default 'BRL',
  payment_method text not null default 'PIX' check (char_length(trim(payment_method)) between 1 and 80),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'processing', 'paid', 'refunded', 'cancelled')),
  receipt_number text,
  paid_at timestamptz,
  is_archived boolean not null default false,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, proposal_id),
  unique (id, organization_id)
);

alter table public.crm_sales
  add constraint crm_sales_same_org_proposal_fk
    foreign key (proposal_id, organization_id) references public.crm_proposals(id, organization_id),
  add constraint crm_sales_same_org_opportunity_fk
    foreign key (opportunity_id, organization_id) references public.crm_opportunities(id, organization_id),
  add constraint crm_sales_same_org_lead_fk
    foreign key (lead_id, organization_id) references public.crm_leads(id, organization_id);

create table public.crm_receivables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null references public.crm_sales(id) on delete restrict,
  amount numeric(14, 2) not null check (amount >= 0),
  amount_paid numeric(14, 2) not null default 0 check (amount_paid between 0 and amount),
  currency char(3) not null default 'BRL',
  due_date date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'processing', 'paid', 'refunded', 'cancelled')),
  paid_at timestamptz,
  receipt_number text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sale_id),
  unique (id, organization_id)
);

alter table public.crm_receivables
  add constraint crm_receivables_same_org_sale_fk
    foreign key (sale_id, organization_id) references public.crm_sales(id, organization_id);

create index crm_sales_org_active_status_updated_idx
  on public.crm_sales (organization_id, payment_status, updated_at desc)
  where not is_archived;
create index crm_sales_lead_idx on public.crm_sales (lead_id);
create index crm_receivables_org_status_due_idx
  on public.crm_receivables (organization_id, status, due_date)
  where status in ('pending', 'processing');

alter table public.crm_sales enable row level security;
alter table public.crm_receivables enable row level security;

create policy crm_sales_select_members on public.crm_sales
  for select to authenticated
  using ((select app_private.is_organization_member(organization_id)));
create policy crm_receivables_select_members on public.crm_receivables
  for select to authenticated
  using ((select app_private.is_organization_member(organization_id)));

grant select on public.crm_sales, public.crm_receivables to authenticated;

create trigger set_crm_sales_updated_at
  before update on public.crm_sales
  for each row execute procedure app_private.set_updated_at();
create trigger set_crm_receivables_updated_at
  before update on public.crm_receivables
  for each row execute procedure app_private.set_updated_at();

create or replace function public.accept_crm_proposal_and_create_sale(
  target_proposal_id uuid,
  initial_payment_method text default 'PIX'
)
returns public.crm_sales
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  proposal_record public.crm_proposals;
  opportunity_record public.crm_opportunities;
  new_sale public.crm_sales;
  payment_method_normalized text := trim(initial_payment_method);
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if char_length(payment_method_normalized) not between 1 and 80 then
    raise exception 'invalid_payment_method' using errcode = '22023';
  end if;

  select * into proposal_record
  from public.crm_proposals
  where id = target_proposal_id and not is_archived
  for update;
  if proposal_record.id is null then
    raise exception 'proposal_not_found' using errcode = 'P0002';
  end if;
  if proposal_record.status not in ('sent', 'viewed') then
    raise exception 'proposal_not_eligible_for_acceptance' using errcode = '55000';
  end if;
  if not (select app_private.is_organization_member(
    proposal_record.organization_id,
    array['owner', 'admin', 'manager', 'seller']::public.organization_role[]
  )) then
    raise exception 'organization_access_denied' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.crm_sales
    where organization_id = proposal_record.organization_id
      and proposal_id = proposal_record.id
  ) then
    raise exception 'sale_already_exists_for_proposal' using errcode = '23505';
  end if;

  select * into opportunity_record
  from public.crm_opportunities
  where id = proposal_record.opportunity_id
    and organization_id = proposal_record.organization_id;
  if opportunity_record.id is null then
    raise exception 'opportunity_not_found' using errcode = '23503';
  end if;

  update public.crm_proposals set status = 'accepted'
  where id = proposal_record.id and organization_id = proposal_record.organization_id;
  update public.crm_opportunities set stage = 'closed_won', amount = proposal_record.total_amount
  where id = opportunity_record.id and organization_id = proposal_record.organization_id;

  insert into public.crm_sales (
    organization_id, proposal_id, opportunity_id, lead_id, amount, currency,
    payment_method, payment_status, created_by, metadata
  ) values (
    proposal_record.organization_id, proposal_record.id, opportunity_record.id, opportunity_record.lead_id,
    proposal_record.total_amount, proposal_record.currency,
    payment_method_normalized, 'pending', current_user_id,
    jsonb_build_object('origin', 'proposal_acceptance', 'proposal_number', proposal_record.number)
  ) returning * into new_sale;

  insert into public.crm_receivables (
    organization_id, sale_id, amount, amount_paid, currency, due_date, status, metadata
  ) values (
    new_sale.organization_id, new_sale.id, new_sale.amount, 0, new_sale.currency,
    current_date, 'pending', jsonb_build_object('origin', 'proposal_acceptance')
  );

  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    new_sale.organization_id, current_user_id, 'SALE_CREATED_FROM_PROPOSAL', 'crm_sale', new_sale.id,
    jsonb_build_object('proposal_id', proposal_record.id, 'proposal_number', proposal_record.number)
  );
  return new_sale;
end;
$$;

create or replace function public.update_crm_sale_payment(
  target_sale_id uuid,
  requested_payment_method text,
  requested_payment_status text,
  requested_receipt_number text default null
)
returns public.crm_sales
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_sale public.crm_sales;
  current_role public.organization_role;
  normalized_method text := trim(requested_payment_method);
  normalized_receipt text := nullif(trim(coalesce(requested_receipt_number, '')), '');
  payment_time timestamptz;
  updated_sale public.crm_sales;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if char_length(normalized_method) not between 1 and 80
    or char_length(coalesce(normalized_receipt, '')) > 120
    or requested_payment_status not in ('pending', 'processing', 'paid', 'refunded', 'cancelled') then
    raise exception 'invalid_sale_payment_payload' using errcode = '22023';
  end if;
  select * into current_sale from public.crm_sales
  where id = target_sale_id and not is_archived
  for update;
  if current_sale.id is null then
    raise exception 'sale_not_found' using errcode = 'P0002';
  end if;
  select role into current_role from public.organization_members
  where organization_id = current_sale.organization_id and user_id = current_user_id and status = 'active';
  if current_role is null then
    raise exception 'organization_access_denied' using errcode = '42501';
  end if;
  if current_sale.payment_status <> requested_payment_status
    and current_role not in ('owner', 'admin', 'manager') then
    raise exception 'payment_status_requires_manager' using errcode = '42501';
  end if;
  if requested_payment_status = 'paid' then payment_time := now(); end if;

  update public.crm_sales set
    payment_method = normalized_method,
    payment_status = requested_payment_status,
    receipt_number = normalized_receipt,
    paid_at = payment_time
  where id = current_sale.id and organization_id = current_sale.organization_id
  returning * into updated_sale;

  update public.crm_receivables set
    status = requested_payment_status,
    amount_paid = case when requested_payment_status = 'paid' then amount else 0 end,
    receipt_number = normalized_receipt,
    paid_at = payment_time
  where sale_id = current_sale.id and organization_id = current_sale.organization_id;

  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    current_sale.organization_id, current_user_id, 'SALE_PAYMENT_UPDATED', 'crm_sale', current_sale.id,
    jsonb_build_object('from_status', current_sale.payment_status, 'to_status', requested_payment_status)
  );
  return updated_sale;
end;
$$;

create or replace function public.archive_crm_sale(target_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_sale public.crm_sales;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  select * into current_sale from public.crm_sales
  where id = target_sale_id and not is_archived
  for update;
  if current_sale.id is null then
    raise exception 'sale_not_found' using errcode = 'P0002';
  end if;
  if not (select app_private.is_organization_member(
    current_sale.organization_id,
    array['owner', 'admin', 'manager']::public.organization_role[]
  )) then
    raise exception 'sale_archive_requires_manager' using errcode = '42501';
  end if;
  if current_sale.payment_status = 'paid' then
    raise exception 'paid_sale_cannot_be_archived' using errcode = '55000';
  end if;
  update public.crm_sales set is_archived = true
  where id = current_sale.id and organization_id = current_sale.organization_id;
  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id)
  values (current_sale.organization_id, current_user_id, 'SALE_ARCHIVED', 'crm_sale', current_sale.id);
end;
$$;

revoke all on function public.accept_crm_proposal_and_create_sale(uuid, text) from public, anon;
revoke all on function public.update_crm_sale_payment(uuid, text, text, text) from public, anon;
revoke all on function public.archive_crm_sale(uuid) from public, anon;
grant execute on function public.accept_crm_proposal_and_create_sale(uuid, text) to authenticated;
grant execute on function public.update_crm_sale_payment(uuid, text, text, text) to authenticated;
grant execute on function public.archive_crm_sale(uuid) to authenticated;
