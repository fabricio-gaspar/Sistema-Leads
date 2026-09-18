begin;

create table if not exists public.lead_handoff_policies (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  assignee_user_id uuid not null references auth.users(id) on delete cascade,
  handoff_stage text not null check (handoff_stage in ('novo','apresentado','qualificando','reuniao','orcamento')),
  notify_whatsapp boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, lead_id)
);

create index if not exists lead_handoff_policies_assignee_idx
  on public.lead_handoff_policies (organization_id, assignee_user_id);

alter table public.lead_handoff_policies enable row level security;
revoke all on public.lead_handoff_policies from public, anon, authenticated;
grant select on public.lead_handoff_policies to authenticated;

create policy lead_handoff_policies_read
  on public.lead_handoff_policies for select to authenticated
  using (private.can_access_lead(organization_id, lead_id, (select auth.uid())));

alter table public.notification_preferences
  add column if not exists handoff_whatsapp_enabled boolean not null default false,
  add column if not exists handoff_whatsapp_phone text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'notification_preferences_handoff_whatsapp_phone_check'
  ) then
    alter table public.notification_preferences
      add constraint notification_preferences_handoff_whatsapp_phone_check
      check (handoff_whatsapp_phone is null or handoff_whatsapp_phone ~ '^[1-9][0-9]{7,14}$');
  end if;
end $$;

create table if not exists public.handoff_whatsapp_deliveries (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  handoff_id uuid not null unique references public.lead_handoffs(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_phone text not null check (recipient_phone ~ '^[1-9][0-9]{7,14}$'),
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','reconciliation_required','blocked')),
  provider_message_id text,
  attempted_at timestamptz,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists handoff_whatsapp_deliveries_dispatch_idx
  on public.handoff_whatsapp_deliveries (organization_id, status, created_at asc);

alter table public.handoff_whatsapp_deliveries enable row level security;
revoke all on public.handoff_whatsapp_deliveries from public, anon, authenticated;
grant all on public.handoff_whatsapp_deliveries to service_role;

create or replace function private.queue_handoff_whatsapp_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_phone text;
begin
  if new.to_user_id is null then return new; end if;

  select nullif(regexp_replace(preference.handoff_whatsapp_phone, '[^0-9]', '', 'g'), '')
    into v_phone
    from public.lead_handoff_policies policy
    join public.notification_preferences preference
      on preference.organization_id = policy.organization_id
     and preference.user_id = policy.assignee_user_id
   where policy.organization_id = new.organization_id
     and policy.lead_id = new.lead_id
     and policy.assignee_user_id = new.to_user_id
     and policy.notify_whatsapp = true
     and preference.handoff_whatsapp_enabled = true
   limit 1;

  if v_phone is null or v_phone !~ '^[1-9][0-9]{7,14}$' then return new; end if;

  insert into public.handoff_whatsapp_deliveries (
    organization_id, handoff_id, lead_id, recipient_user_id, recipient_phone, status
  ) values (
    new.organization_id, new.id, new.lead_id, new.to_user_id, v_phone, 'queued'
  ) on conflict (handoff_id) do nothing;
  return new;
end;
$$;

revoke all on function private.queue_handoff_whatsapp_notification() from public, anon, authenticated;

drop trigger if exists lead_handoffs_queue_whatsapp_notification on public.lead_handoffs;
create trigger lead_handoffs_queue_whatsapp_notification
after insert on public.lead_handoffs
for each row execute function private.queue_handoff_whatsapp_notification();

create or replace function public.configure_lead_handoff_policy(
  p_lead_ids uuid[],
  p_assignee_user_id uuid default null,
  p_handoff_stage text default null,
  p_notify_whatsapp boolean default false
)
returns table (lead_id uuid, assignee_user_id uuid, handoff_stage text, notify_whatsapp boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_organization_id uuid := public.current_org_id();
  v_user_id uuid := auth.uid();
  v_stage text := nullif(lower(trim(coalesce(p_handoff_stage, ''))), '');
  v_assignee_name text;
  v_expected integer;
begin
  if v_organization_id is null or v_user_id is null
     or not private.is_active_org_member(v_organization_id, v_user_id) then
    raise exception 'organization_context_required';
  end if;
  if p_lead_ids is null or cardinality(p_lead_ids) is null or cardinality(p_lead_ids) = 0
     or cardinality(p_lead_ids) > 100 then
    raise exception 'lead_selection_required';
  end if;
  if cardinality(array(select distinct value from unnest(p_lead_ids) as value)) <> cardinality(p_lead_ids) then
    raise exception 'duplicate_lead_selection';
  end if;

  v_expected := cardinality(p_lead_ids);
  if (select count(*) from public.leads lead
      where lead.organization_id = v_organization_id
        and lead.id = any(p_lead_ids)
        and private.can_manage_lead(v_organization_id, lead.id, v_user_id)) <> v_expected then
    raise exception 'lead_not_found_or_access_denied';
  end if;

  if v_stage is null then
    if p_assignee_user_id is not null then raise exception 'handoff_stage_required'; end if;
    delete from public.lead_handoff_policies
      where organization_id = v_organization_id and lead_id = any(p_lead_ids);
    return;
  end if;
  if v_stage not in ('novo','apresentado','qualificando','reuniao','orcamento') then
    raise exception 'invalid_handoff_stage';
  end if;
  if p_assignee_user_id is null then raise exception 'handoff_assignee_required'; end if;

  select profile.name into v_assignee_name
    from public.organization_members member
    join public.profiles profile on profile.id = member.user_id
   where member.organization_id = v_organization_id
     and member.user_id = p_assignee_user_id
     and member.status = 'active'
   limit 1;
  if v_assignee_name is null then raise exception 'handoff_assignee_inactive'; end if;
  if not private.has_org_permission(v_organization_id, p_assignee_user_id, 'conversations.reply_all')
     and not private.has_org_permission(v_organization_id, p_assignee_user_id, 'conversations.reply_assigned') then
    raise exception 'handoff_assignee_cannot_reply';
  end if;
  if p_notify_whatsapp and not exists (
    select 1 from public.notification_preferences preference
     where preference.organization_id = v_organization_id
       and preference.user_id = p_assignee_user_id
       and preference.handoff_whatsapp_enabled = true
       and preference.handoff_whatsapp_phone ~ '^[1-9][0-9]{7,14}$'
  ) then
    raise exception 'handoff_whatsapp_not_configured';
  end if;

  insert into public.lead_handoff_policies (
    organization_id, lead_id, assignee_user_id, handoff_stage, notify_whatsapp, created_by, updated_at
  )
  select v_organization_id, item.lead_id, p_assignee_user_id, v_stage, p_notify_whatsapp, v_user_id, now()
    from unnest(p_lead_ids) as item(lead_id)
  on conflict (organization_id, lead_id) do update set
    assignee_user_id = excluded.assignee_user_id,
    handoff_stage = excluded.handoff_stage,
    notify_whatsapp = excluded.notify_whatsapp,
    created_by = excluded.created_by,
    updated_at = now();

  update public.leads
     set owner_id = p_assignee_user_id,
         assigned_to = p_assignee_user_id,
         owner = left(coalesce(nullif(trim(v_assignee_name), ''), 'Responsável'), 160),
         updated_at = now()
   where organization_id = v_organization_id and id = any(p_lead_ids);

  insert into public.audit_logs (
    organization_id, actor_id, actor_name, actor_type, action, detail, entity_table, entity_id, event_data
  )
  select v_organization_id, v_user_id, coalesce(profile.name, 'Usuário'), 'user',
    'lead.handoff_policy.configured', 'Responsável e etapa de transferência automática configurados.',
    'leads', item.lead_id,
    jsonb_build_object('assignee_user_id', p_assignee_user_id, 'handoff_stage', v_stage, 'notify_whatsapp', p_notify_whatsapp)
  from unnest(p_lead_ids) as item(lead_id)
  left join public.profiles profile on profile.id = v_user_id;

  return query
    select policy.lead_id, policy.assignee_user_id, policy.handoff_stage, policy.notify_whatsapp
      from public.lead_handoff_policies policy
     where policy.organization_id = v_organization_id and policy.lead_id = any(p_lead_ids);
end;
$$;

revoke all on function public.configure_lead_handoff_policy(uuid[], uuid, text, boolean) from public, anon;
grant execute on function public.configure_lead_handoff_policy(uuid[], uuid, text, boolean) to authenticated, service_role;

commit;
