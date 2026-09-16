-- Gestão operacional de leads, permissões individuais e entradas do site.
-- Todas as mutações administrativas passam por Edge Functions autenticadas.

create table if not exists public.team_member_permissions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null check (permission in (
    'leads.read_all', 'leads.read_assigned', 'leads.create', 'leads.edit_all',
    'leads.edit_assigned', 'leads.delete', 'conversations.read_all',
    'conversations.reply_all', 'conversations.reply_assigned', 'messages.delete',
    'prospecting.manage', 'proposals.manage', 'configuration.manage',
    'website_entry.manage', 'team.manage', 'audit.view'
  )),
  allowed boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id, permission)
);

create index if not exists team_member_permissions_user_idx
  on public.team_member_permissions (organization_id, user_id);

alter table public.team_member_permissions enable row level security;

create table if not exists public.whatsapp_site_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  name text not null default 'Site institucional' check (char_length(name) between 1 and 120),
  source_label text not null default 'Site / WhatsApp' check (char_length(source_label) between 1 and 120),
  public_phone text not null check (public_phone ~ '^[0-9]{10,15}$'),
  welcome_message text not null check (char_length(welcome_message) between 1 and 500),
  entry_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_site_entries_active_code_idx
  on public.whatsapp_site_entries (entry_code) where active;

alter table public.whatsapp_site_entries enable row level security;

create or replace function private.has_org_permission(
  p_organization_id uuid,
  p_user_id uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  with member as (
    select m.role
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = p_user_id
      and m.status = 'active'
    limit 1
  ), explicit_permission as (
    select p.allowed
    from public.team_member_permissions p
    where p.organization_id = p_organization_id
      and p.user_id = p_user_id
      and p.permission = p_permission
  )
  select exists (select 1 from member)
    and (
      exists (select 1 from member where role = 'administrador')
      or coalesce(
        (select allowed from explicit_permission),
        case p_permission
          when 'leads.read_all' then exists (select 1 from member where role in ('sdr', 'cx'))
          when 'leads.read_assigned' then exists (select 1 from member where role in ('vendedor', 'sdr', 'cx'))
          when 'leads.create' then exists (select 1 from member where role in ('vendedor', 'sdr'))
          when 'leads.edit_all' then exists (select 1 from member where role = 'sdr')
          when 'leads.edit_assigned' then exists (select 1 from member where role in ('vendedor', 'sdr', 'cx'))
          when 'conversations.read_all' then exists (select 1 from member where role in ('sdr', 'cx'))
          when 'conversations.reply_all' then exists (select 1 from member where role in ('sdr', 'cx'))
          when 'conversations.reply_assigned' then exists (select 1 from member where role = 'vendedor')
          when 'prospecting.manage' then exists (select 1 from member where role = 'sdr')
          when 'proposals.manage' then exists (select 1 from member where role in ('vendedor', 'sdr'))
          else false
        end
      )
    );
$$;

create or replace function private.can_access_lead(
  _organization_id uuid,
  _lead_id uuid,
  _user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select private.is_active_org_member(_organization_id, _user_id)
     and exists (
       select 1
       from public.leads l
       where l.id = _lead_id
         and l.organization_id = _organization_id
         and (
           private.has_org_permission(_organization_id, _user_id, 'leads.read_all')
           or (
             private.has_org_permission(_organization_id, _user_id, 'leads.read_assigned')
             and (l.owner_id = _user_id or l.assigned_to = _user_id)
           )
         )
     );
$$;

create or replace function private.can_manage_lead(
  _organization_id uuid,
  _lead_id uuid,
  _user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select private.is_active_org_member(_organization_id, _user_id)
     and exists (
       select 1
       from public.leads l
       where l.id = _lead_id
         and l.organization_id = _organization_id
         and (
           private.has_org_permission(_organization_id, _user_id, 'leads.edit_all')
           or (
             private.has_org_permission(_organization_id, _user_id, 'leads.edit_assigned')
             and (l.owner_id = _user_id or l.assigned_to = _user_id)
           )
         )
     );
$$;

create or replace function private.can_reply_to_lead(
  _organization_id uuid,
  _lead_id uuid,
  _user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select private.is_active_org_member(_organization_id, _user_id)
     and exists (
       select 1
       from public.leads l
       where l.id = _lead_id
         and l.organization_id = _organization_id
         and (
           private.has_org_permission(_organization_id, _user_id, 'conversations.reply_all')
           or (
             private.has_org_permission(_organization_id, _user_id, 'conversations.reply_assigned')
             and (l.owner_id = _user_id or l.assigned_to = _user_id)
           )
         )
     );
$$;

alter policy phase2_leads_select on public.leads
  using (private.can_access_lead(organization_id, id, (select auth.uid())));

alter policy phase2_leads_insert on public.leads
  with check (
    organization_id = (select current_org_id())
    and private.has_org_permission(organization_id, (select auth.uid()), 'leads.create')
  );

alter policy phase2_leads_update on public.leads
  using (private.can_manage_lead(organization_id, id, (select auth.uid())))
  with check (private.can_manage_lead(organization_id, id, (select auth.uid())));

alter policy phase2_leads_delete on public.leads
  using (private.has_org_permission(organization_id, (select auth.uid()), 'leads.delete'));

alter policy phase2_messages_select on public.lead_messages
  using (private.can_access_lead(organization_id, lead_id, (select auth.uid())));

alter policy phase2_messages_insert on public.lead_messages
  with check (private.can_reply_to_lead(organization_id, lead_id, (select auth.uid())));

alter policy phase2_messages_update on public.lead_messages
  using (private.can_reply_to_lead(organization_id, lead_id, (select auth.uid())))
  with check (private.can_reply_to_lead(organization_id, lead_id, (select auth.uid())));

alter policy phase2_messages_delete on public.lead_messages
  using (private.has_org_permission(organization_id, (select auth.uid()), 'messages.delete'));

alter policy configuration_admin_delete on public.integrations
  using (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'));

alter policy configuration_admin_update on public.integrations
  using (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'))
  with check (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'));

alter policy configuration_admin_write on public.integrations
  with check (
    private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage')
    and organization_id = current_org_id()
  );

create policy team_member_permissions_read
  on public.team_member_permissions for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_org_permission(organization_id, (select auth.uid()), 'team.manage')
  );

create policy team_member_permissions_manage
  on public.team_member_permissions for all to authenticated
  using (private.has_org_permission(organization_id, (select auth.uid()), 'team.manage'))
  with check (private.has_org_permission(organization_id, (select auth.uid()), 'team.manage'));

create policy whatsapp_site_entries_manage
  on public.whatsapp_site_entries for all to authenticated
  using (private.has_org_permission(organization_id, (select auth.uid()), 'website_entry.manage'))
  with check (private.has_org_permission(organization_id, (select auth.uid()), 'website_entry.manage'));

create or replace function public.lead_governance_snapshot(p_organization_id uuid)
returns table (
  id uuid,
  company text,
  contact text,
  stage text,
  owner text,
  origin text,
  created_at timestamptz,
  last_activity_at timestamptz,
  message_count bigint,
  lifecycle_status text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with messages as (
    select m.lead_id,
      count(*)::bigint as message_count,
      max(coalesce(m.sent_at, m.created_at)) as last_message_at
    from public.lead_messages m
    where m.organization_id = p_organization_id
    group by m.lead_id
  )
  select l.id, l.company, l.contact, l.stage::text, l.owner, l.origin, l.created_at,
    nullif(greatest(
      coalesce(l.last_contact, '-infinity'::timestamptz),
      coalesce(l.first_inbound_at, '-infinity'::timestamptz),
      coalesce(l.first_outreach_at, '-infinity'::timestamptz),
      coalesce(messages.last_message_at, '-infinity'::timestamptz)
    ), '-infinity'::timestamptz) as last_activity_at,
    coalesce(messages.message_count, 0) as message_count,
    case
      when l.ana_outcome = 'ganho' or l.stage::text in ('Ganho', 'Fechado') then 'Ganho'
      when l.ana_outcome = 'perdido' or l.stage::text = 'Perdido' then 'Perdido'
      when messages.last_message_at >= now() - interval '7 days' then 'Em conversa'
      when messages.last_message_at is null and l.first_inbound_at is null and l.first_outreach_at is null then 'Sem interação'
      when greatest(
        coalesce(l.last_contact, '-infinity'::timestamptz),
        coalesce(l.first_inbound_at, '-infinity'::timestamptz),
        coalesce(l.first_outreach_at, '-infinity'::timestamptz),
        coalesce(messages.last_message_at, '-infinity'::timestamptz)
      ) >= now() - interval '30 days' then 'Ativo'
      else 'Inativo'
    end as lifecycle_status
  from public.leads l
  left join messages on messages.lead_id = l.id
  where l.organization_id = p_organization_id
  order by last_activity_at desc nulls last, l.created_at desc;
$$;

revoke all on function public.lead_governance_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.lead_governance_snapshot(uuid) to service_role;

create or replace function public.purge_selected_operational_leads(
  p_organization_id uuid,
  p_lead_ids uuid[]
)
returns table (lead_id uuid)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select * from public.purge_selected_test_leads(p_organization_id, p_lead_ids);
$$;

revoke all on function public.purge_selected_operational_leads(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.purge_selected_operational_leads(uuid, uuid[]) to service_role;

create index if not exists lead_messages_governance_idx
  on public.lead_messages (organization_id, lead_id, sent_at desc);
