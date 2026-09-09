create or replace function public.normalize_phone_identity(value text)
returns text
language sql
immutable
strict
parallel safe
as $$
  with cleaned as (
    select regexp_replace(value, '\D', '', 'g') as digits,
           left(trim(value), 1) = '+' as explicit_country
  )
  select case
    when digits = '' then null
    when not explicit_country and length(digits) in (10,11) then '55' || digits
    when length(digits) in (12,13) and left(digits,2) = '55' then digits
    when length(digits) between 8 and 15 then digits
    else null
  end
  from cleaned;
$$;

alter table public.leads
  add column if not exists phone_identity text generated always as (public.normalize_phone_identity(phone)) stored,
  add column if not exists whatsapp_identity text generated always as (public.normalize_phone_identity(whatsapp)) stored;

create index if not exists leads_org_phone_identity_idx
  on public.leads(organization_id, phone_identity)
  where phone_identity is not null;

create index if not exists leads_org_whatsapp_identity_idx
  on public.leads(organization_id, whatsapp_identity)
  where whatsapp_identity is not null;

comment on column public.leads.phone_identity is 'Canonical digits used for provider identity matching; display phone remains untouched.';
comment on column public.leads.whatsapp_identity is 'Canonical digits used for WhatsApp provider identity matching; display WhatsApp remains untouched.';
