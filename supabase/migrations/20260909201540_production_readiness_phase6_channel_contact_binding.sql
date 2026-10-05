create table if not exists public.channel_contact_bindings (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null,
  contact_identity text not null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  source text not null default 'outbound',
  bound_at timestamptz not null default now(),
  last_outbound_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (organization_id, channel, contact_identity)
);

alter table public.channel_contact_bindings enable row level security;
drop policy if exists channel_contact_bindings_service_only on public.channel_contact_bindings;
create policy channel_contact_bindings_service_only on public.channel_contact_bindings
  as restrictive for all to authenticated using (false) with check (false);
create index if not exists channel_contact_bindings_lead_idx on public.channel_contact_bindings(organization_id, lead_id);

create or replace function private.bind_whatsapp_contact_after_outbound()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  identity_value text;
begin
  if new.channel = 'whatsapp' and new.status in ('sent','delivered','read','replied')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    select coalesce(l.whatsapp_identity, l.phone_identity)
      into identity_value
      from public.leads l
     where l.id = new.lead_id and l.organization_id = new.organization_id;

    if identity_value is not null then
      insert into public.channel_contact_bindings(
        organization_id, channel, contact_identity, lead_id, source,
        bound_at, last_outbound_at, updated_at
      ) values (
        new.organization_id, 'whatsapp', identity_value, new.lead_id, 'lead_outreach',
        coalesce(new.sent_at, now()), coalesce(new.sent_at, now()), now()
      )
      on conflict (organization_id, channel, contact_identity)
      do update set
        lead_id = excluded.lead_id,
        source = excluded.source,
        bound_at = excluded.bound_at,
        last_outbound_at = excluded.last_outbound_at,
        updated_at = now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bind_whatsapp_contact_after_outbound on public.lead_outreach;
create trigger trg_bind_whatsapp_contact_after_outbound
after insert or update of status on public.lead_outreach
for each row execute function private.bind_whatsapp_contact_after_outbound();

create or replace function public.resolve_whatsapp_lead(p_organization_id uuid, p_phone text)
returns table(lead_id uuid, reason text)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  identity_value text;
  bound_lead uuid;
  candidate_lead uuid;
  candidate_count integer;
begin
  identity_value := public.normalize_phone_identity(p_phone);
  if identity_value is null then
    return query select null::uuid, 'invalid_phone'::text;
    return;
  end if;

  select b.lead_id
    into bound_lead
    from public.channel_contact_bindings b
    join public.leads l on l.id = b.lead_id and l.organization_id = b.organization_id
   where b.organization_id = p_organization_id
     and b.channel = 'whatsapp'
     and b.contact_identity = identity_value
     and (l.whatsapp_identity = identity_value or l.phone_identity = identity_value)
   limit 1;

  if bound_lead is not null then
    return query select bound_lead, 'active_binding'::text;
    return;
  end if;

  select count(*)::int into candidate_count
    from public.leads l
   where l.organization_id = p_organization_id
     and (l.whatsapp_identity = identity_value or l.phone_identity = identity_value);

  if candidate_count = 1 then
    select l.id into candidate_lead
      from public.leads l
     where l.organization_id = p_organization_id
       and (l.whatsapp_identity = identity_value or l.phone_identity = identity_value)
     limit 1;
    return query select candidate_lead, 'unique_identity'::text;
  elsif candidate_count > 1 then
    return query select null::uuid, 'ambiguous_identity'::text;
  else
    return query select null::uuid, 'not_found'::text;
  end if;
end;
$$;

revoke all on function public.resolve_whatsapp_lead(uuid,text) from public, anon, authenticated;
grant execute on function public.resolve_whatsapp_lead(uuid,text) to service_role;
