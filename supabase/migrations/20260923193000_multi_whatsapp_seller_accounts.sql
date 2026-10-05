-- Contas operacionais de WhatsApp por usuário, sem substituir a instância
-- corporativa existente. Credenciais continuam no Vault, vinculadas à tabela
-- integrations; esta tabela contém apenas metadados públicos e auditáveis.

alter table public.team_member_permissions
  drop constraint if exists team_member_permissions_permission_check;

alter table public.team_member_permissions
  add constraint team_member_permissions_permission_check check (permission in (
    'leads.read_all', 'leads.read_assigned', 'leads.create', 'leads.edit_all',
    'leads.edit_assigned', 'leads.delete', 'conversations.read_all',
    'conversations.reply_all', 'conversations.reply_assigned', 'messages.delete',
    'prospecting.manage', 'proposals.manage', 'configuration.manage',
    'website_entry.manage', 'team.manage', 'audit.view',
    'channels.view_own', 'channels.connect_own', 'channels.manage_all'
  ));

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
          when 'channels.view_own' then exists (select 1 from member where role = 'vendedor')
          when 'channels.connect_own' then exists (select 1 from member where role = 'vendedor')
          else false
        end
      )
    );
$$;

create table public.whatsapp_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid not null unique references public.integrations(id) on delete restrict,
  owner_user_id uuid references auth.users(id) on delete set null,
  label text not null check (char_length(btrim(label)) between 1 and 120),
  provider text not null default 'zapi' check (provider = 'zapi'),
  account_type text not null default 'seller' check (account_type in ('corporate', 'seller')),
  is_default boolean not null default false,
  enabled boolean not null default false,
  connection_status text not null default 'unconfigured'
    check (connection_status in ('unconfigured', 'configured', 'qr', 'connected', 'disconnected', 'expired', 'error')),
  connected_phone_suffix text check (connected_phone_suffix is null or connected_phone_suffix ~ '^[0-9]{4}$'),
  connected_at timestamptz,
  status_checked_at timestamptz,
  webhook_registered_at timestamptz,
  expires_at timestamptz,
  last_error_code text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint whatsapp_accounts_default_corporate check (not is_default or account_type = 'corporate'),
  constraint whatsapp_accounts_seller_owner check (
    account_type <> 'seller' or owner_user_id is not null or archived_at is not null
  )
);

create unique index whatsapp_accounts_org_default_uidx
  on public.whatsapp_accounts (organization_id)
  where is_default and archived_at is null;

create unique index whatsapp_accounts_org_owner_uidx
  on public.whatsapp_accounts (organization_id, owner_user_id)
  where account_type = 'seller' and owner_user_id is not null and archived_at is null;

create index whatsapp_accounts_org_status_idx
  on public.whatsapp_accounts (organization_id, enabled, connection_status)
  where archived_at is null;

create index whatsapp_accounts_owner_idx
  on public.whatsapp_accounts (owner_user_id)
  where owner_user_id is not null and archived_at is null;

alter table public.whatsapp_accounts enable row level security;

revoke all on table public.whatsapp_accounts from public, anon, authenticated;
grant select on table public.whatsapp_accounts to authenticated;
grant all on table public.whatsapp_accounts to service_role;

create policy whatsapp_accounts_read
  on public.whatsapp_accounts for select to authenticated
  using (
    private.has_org_permission(organization_id, (select auth.uid()), 'channels.manage_all')
    or private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage')
    or (is_default and private.is_active_org_member(organization_id, (select auth.uid())))
    or (
      owner_user_id = (select auth.uid())
      and private.has_org_permission(organization_id, (select auth.uid()), 'channels.view_own')
    )
  );

drop trigger if exists whatsapp_accounts_set_updated_at on public.whatsapp_accounts;
create trigger whatsapp_accounts_set_updated_at
before update on public.whatsapp_accounts
for each row execute procedure public.set_updated_at();

-- A integração corporativa já homologada passa a ser a conta padrão. Nenhuma
-- credencial é copiada ou alterada; a conta somente referencia a integração.
insert into public.whatsapp_accounts (
  organization_id, integration_id, label, account_type, is_default, enabled,
  connection_status, status_checked_at, connected_at
)
select
  i.organization_id,
  i.id,
  coalesce(nullif(btrim(i.label), ''), 'WhatsApp corporativo'),
  'corporate',
  true,
  i.enabled,
  case
    when i.connected and i.enabled and not i.paused then 'connected'
    when coalesce((i.configuration ->> 'configured')::boolean, false) then 'configured'
    else 'unconfigured'
  end,
  i.last_tested_at,
  i.last_success_at
from public.integrations i
where i.key = 'whatsapp'
on conflict (integration_id) do nothing;

alter table public.leads
  add column if not exists whatsapp_account_id uuid references public.whatsapp_accounts(id) on delete set null;
alter table public.lead_messages
  add column if not exists whatsapp_account_id uuid references public.whatsapp_accounts(id) on delete set null;
alter table public.outreach_jobs
  add column if not exists whatsapp_account_id uuid references public.whatsapp_accounts(id) on delete set null;
alter table public.lead_outreach
  add column if not exists whatsapp_account_id uuid references public.whatsapp_accounts(id) on delete set null;
alter table public.webhook_events
  add column if not exists whatsapp_account_id uuid references public.whatsapp_accounts(id) on delete set null;
alter table public.channel_inbound_events
  add column if not exists whatsapp_account_id uuid references public.whatsapp_accounts(id) on delete set null;

create index if not exists leads_whatsapp_account_idx on public.leads (organization_id, whatsapp_account_id)
  where whatsapp_account_id is not null;
create index if not exists lead_messages_whatsapp_account_idx on public.lead_messages (organization_id, whatsapp_account_id, created_at desc)
  where whatsapp_account_id is not null;
create index if not exists outreach_jobs_whatsapp_account_idx on public.outreach_jobs (organization_id, whatsapp_account_id, run_at desc)
  where whatsapp_account_id is not null;
create index if not exists lead_outreach_whatsapp_account_idx on public.lead_outreach (organization_id, whatsapp_account_id, created_at desc)
  where whatsapp_account_id is not null;
create index if not exists webhook_events_whatsapp_account_idx on public.webhook_events (organization_id, whatsapp_account_id, created_at desc)
  where whatsapp_account_id is not null;
create index if not exists channel_inbound_whatsapp_account_idx on public.channel_inbound_events (organization_id, whatsapp_account_id, created_at desc)
  where whatsapp_account_id is not null;

update public.leads l
set whatsapp_account_id = a.id
from public.whatsapp_accounts a
where a.organization_id = l.organization_id
  and a.is_default
  and a.archived_at is null
  and l.whatsapp_account_id is null
  and lower(coalesce(l.active_channel, '')) = 'whatsapp';

update public.outreach_jobs j
set whatsapp_account_id = a.id
from public.whatsapp_accounts a
where a.organization_id = j.organization_id
  and a.is_default
  and a.archived_at is null
  and j.whatsapp_account_id is null
  and lower(coalesce(j.channel, '')) = 'whatsapp';

update public.outreach_jobs j
set payload = coalesce(j.payload, '{}'::jsonb) || jsonb_build_object(
  'whatsapp_account_id', a.id,
  'integration_id', a.integration_id
)
from public.whatsapp_accounts a
where a.id = j.whatsapp_account_id
  and j.organization_id = a.organization_id
  and lower(coalesce(j.channel, '')) = 'whatsapp'
  and (
    nullif(j.payload ->> 'whatsapp_account_id', '') is null
    or nullif(j.payload ->> 'integration_id', '') is null
  );

update public.lead_outreach o
set whatsapp_account_id = a.id
from public.whatsapp_accounts a
where a.organization_id = o.organization_id
  and a.is_default
  and a.archived_at is null
  and o.whatsapp_account_id is null
  and lower(coalesce(o.channel, '')) = 'whatsapp';

update public.lead_messages m
set whatsapp_account_id = l.whatsapp_account_id
from public.leads l
where l.id = m.lead_id
  and l.organization_id = m.organization_id
  and m.whatsapp_account_id is null
  and l.whatsapp_account_id is not null;

update public.webhook_events e
set whatsapp_account_id = a.id
from public.whatsapp_accounts a
where a.organization_id = e.organization_id
  and a.is_default
  and a.archived_at is null
  and e.whatsapp_account_id is null
  and lower(coalesce(e.provider, '')) in ('zapi', 'z-api');

update public.channel_inbound_events e
set whatsapp_account_id = a.id
from public.whatsapp_accounts a
where a.organization_id = e.organization_id
  and a.is_default
  and a.archived_at is null
  and e.whatsapp_account_id is null
  and lower(coalesce(e.provider, '')) in ('zapi', 'z-api');

create or replace function private.sync_whatsapp_account_from_integration()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  update public.whatsapp_accounts
  set enabled = new.enabled,
      connection_status = case
        when new.connected and new.enabled and not new.paused then 'connected'
        when new.paused then 'error'
        when coalesce((new.configuration ->> 'configured')::boolean, false) then 'configured'
        else 'unconfigured'
      end,
      connected_at = case when new.connected and new.enabled and not new.paused then coalesce(connected_at, now()) else connected_at end,
      status_checked_at = coalesce(new.last_tested_at, status_checked_at),
      last_error_code = new.last_error
  where integration_id = new.id
    and archived_at is null;
  return new;
end;
$$;

drop trigger if exists integrations_sync_whatsapp_account on public.integrations;
create trigger integrations_sync_whatsapp_account
after update of connected, enabled, paused, configuration, last_tested_at, last_success_at, last_error
on public.integrations
for each row execute function private.sync_whatsapp_account_from_integration();

create or replace function public.resolve_lead_whatsapp_account(
  p_organization_id uuid,
  p_lead_id uuid
)
returns table (
  account_id uuid,
  integration_id uuid,
  owner_user_id uuid,
  is_default boolean,
  connection_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_lead public.leads%rowtype;
  v_account public.whatsapp_accounts%rowtype;
begin
  select * into v_lead
  from public.leads
  where id = p_lead_id and organization_id = p_organization_id
  for update;
  if not found then raise exception 'lead_not_found'; end if;

  if v_lead.whatsapp_account_id is not null then
    select * into v_account
    from public.whatsapp_accounts
    where id = v_lead.whatsapp_account_id
      and organization_id = p_organization_id
      and archived_at is null;
    if not found then raise exception 'whatsapp_account_unavailable'; end if;
  else
    select * into v_account
    from public.whatsapp_accounts
    where organization_id = p_organization_id
      and archived_at is null
      and enabled
      and account_type = 'seller'
      and owner_user_id is not null
      and owner_user_id in (v_lead.assigned_to, v_lead.owner_id)
    order by
      case when owner_user_id = v_lead.assigned_to then 0 else 1 end,
      case when connection_status = 'connected' then 0 else 1 end,
      updated_at desc
    limit 1;

    if not found then
      select * into v_account
      from public.whatsapp_accounts
      where organization_id = p_organization_id
        and archived_at is null
        and is_default
      limit 1;
    end if;
    if not found then raise exception 'whatsapp_account_not_configured'; end if;

    update public.leads
    set whatsapp_account_id = v_account.id,
        updated_at = now()
    where id = p_lead_id and organization_id = p_organization_id;
  end if;

  return query select v_account.id, v_account.integration_id,
    v_account.owner_user_id, v_account.is_default, v_account.connection_status;
end;
$$;

revoke all on function public.resolve_lead_whatsapp_account(uuid, uuid) from public, anon, authenticated;
grant execute on function public.resolve_lead_whatsapp_account(uuid, uuid) to service_role;

create or replace function public.resolve_whatsapp_lead_for_account(
  p_organization_id uuid,
  p_account_id uuid,
  p_phone text
)
returns table (lead_id uuid, reason text)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_identity text;
  v_lead_id uuid;
  v_count integer;
begin
  if not exists (
    select 1 from public.whatsapp_accounts
    where id = p_account_id and organization_id = p_organization_id and archived_at is null
  ) then
    return query select null::uuid, 'account_not_found'::text;
    return;
  end if;

  v_identity := public.normalize_phone_identity(p_phone);
  if v_identity is null then
    return query select null::uuid, 'invalid_phone'::text;
    return;
  end if;

  select count(*)::int, (array_agg(l.id order by l.id))[1]
  into v_count, v_lead_id
  from public.leads l
  where l.organization_id = p_organization_id
    and l.whatsapp_account_id = p_account_id
    and (l.whatsapp_identity = v_identity or l.phone_identity = v_identity);

  if v_count = 1 then
    return query select v_lead_id, 'account_identity'::text;
    return;
  elsif v_count > 1 then
    select count(*)::int, (array_agg(l.id order by l.id))[1]
    into v_count, v_lead_id
    from public.leads l
    where l.organization_id = p_organization_id
      and l.whatsapp_account_id = p_account_id
      and (l.whatsapp_identity = v_identity or l.phone_identity = v_identity)
      and l.modo_atendimento = 'ia'
      and l.ai_paused = false
      and l.opt_out = false;
    if v_count = 1 then
      return query select v_lead_id, 'account_active_ai_conversation'::text;
      return;
    end if;
    return query select null::uuid, 'ambiguous_identity'::text;
    return;
  end if;

  select count(*)::int, (array_agg(l.id order by l.id))[1]
  into v_count, v_lead_id
  from public.leads l
  where l.organization_id = p_organization_id
    and l.whatsapp_account_id is null
    and (l.whatsapp_identity = v_identity or l.phone_identity = v_identity);

  if v_count > 1 then
    select count(*)::int, (array_agg(l.id order by l.id))[1]
    into v_count, v_lead_id
    from public.leads l
    where l.organization_id = p_organization_id
      and l.whatsapp_account_id is null
      and (l.whatsapp_identity = v_identity or l.phone_identity = v_identity)
      and l.modo_atendimento = 'ia'
      and l.ai_paused = false
      and l.opt_out = false;
  end if;

  if v_count = 1 then
    update public.leads
    set whatsapp_account_id = p_account_id,
        updated_at = now()
    where id = v_lead_id
      and organization_id = p_organization_id
      and whatsapp_account_id is null;
    return query select v_lead_id, 'account_bound'::text;
    return;
  elsif v_count > 1 then
    return query select null::uuid, 'ambiguous_identity'::text;
    return;
  end if;

  if exists (
    select 1 from public.leads l
    where l.organization_id = p_organization_id
      and (l.whatsapp_identity = v_identity or l.phone_identity = v_identity)
      and l.whatsapp_account_id is distinct from p_account_id
  ) then
    return query select null::uuid, 'account_mismatch'::text;
    return;
  end if;

  return query select null::uuid, 'not_found'::text;
end;
$$;

revoke all on function public.resolve_whatsapp_lead_for_account(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.resolve_whatsapp_lead_for_account(uuid, uuid, text) to service_role;

create or replace function public.current_user_access()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  with context as (
    select p.active_organization_id as organization_id, m.role
    from public.profiles p
    join public.organization_members m
      on m.organization_id = p.active_organization_id
     and m.user_id = p.id
     and m.status = 'active'
    where p.id = (select auth.uid())
    limit 1
  ), permission_names(permission) as (
    values
      ('leads.read_all'), ('leads.read_assigned'), ('leads.create'), ('leads.edit_all'),
      ('leads.edit_assigned'), ('leads.delete'), ('conversations.read_all'),
      ('conversations.reply_all'), ('conversations.reply_assigned'), ('messages.delete'),
      ('prospecting.manage'), ('proposals.manage'), ('configuration.manage'),
      ('website_entry.manage'), ('team.manage'), ('audit.view'),
      ('channels.view_own'), ('channels.connect_own'), ('channels.manage_all')
  )
  select case when not exists (select 1 from context) then null else jsonb_build_object(
    'organization_id', (select organization_id from context),
    'role', (select role::text from context),
    'permissions', (
      select jsonb_object_agg(permission, private.has_org_permission(
        (select organization_id from context), (select auth.uid()), permission
      ))
      from permission_names
    )
  ) end;
$$;

revoke all on function public.current_user_access() from public, anon;
grant execute on function public.current_user_access() to authenticated;

-- Mantém a assinatura usada pela Central, mas grava a conta operacional em
-- todas as entidades da fila. A integração recebida já foi resolvida pelo
-- backend e precisa pertencer a uma conta da mesma organização.
create or replace function public.queue_human_whatsapp_message(
  p_organization_id uuid,
  p_lead_id uuid,
  p_user_id uuid,
  p_sender_name text,
  p_request_id uuid,
  p_recipient text,
  p_message text,
  p_integration_id uuid,
  p_context_last_contact timestamptz,
  p_controlled_test boolean default false,
  p_controlled_test_expires_at timestamptz default null
)
returns table(job_id uuid, message_id uuid, job_status text, duplicate boolean)
language plpgsql
set search_path = ''
as $$
declare
  v_key text := 'human:' || p_organization_id::text || ':' || p_user_id::text || ':' || p_request_id::text;
  v_job public.outreach_jobs%rowtype;
  v_message_id uuid;
  v_lead public.leads%rowtype;
  v_account_id uuid;
begin
  if p_organization_id is null or p_lead_id is null or p_user_id is null
     or p_request_id is null or p_integration_id is null
     or nullif(pg_catalog.btrim(p_recipient), '') is null
     or nullif(pg_catalog.btrim(p_message), '') is null then
    raise exception 'human_message_input_required';
  end if;

  if not private.is_active_org_member(p_organization_id, p_user_id) then
    raise exception 'organization_access_denied';
  end if;

  select l.* into v_lead
    from public.leads as l
   where l.id = p_lead_id
     and l.organization_id = p_organization_id
     and (
       private.has_org_role(
         p_organization_id,
         p_user_id,
         array['administrador'::public.app_role, 'sdr'::public.app_role,
           'ia'::public.app_role, 'cx'::public.app_role]
       )
       or l.owner_id = p_user_id
       or l.assigned_to = p_user_id
     )
   for update;
  if not found then raise exception 'lead_not_found_or_access_denied'; end if;

  select a.id into v_account_id
  from public.whatsapp_accounts a
  where a.organization_id = p_organization_id
    and a.integration_id = p_integration_id
    and a.archived_at is null
  limit 1;
  if v_account_id is null then raise exception 'whatsapp_account_not_found'; end if;
  if v_lead.whatsapp_account_id is distinct from v_account_id then
    if v_lead.whatsapp_account_id is not null then raise exception 'whatsapp_account_mismatch'; end if;
    update public.leads set whatsapp_account_id = v_account_id, updated_at = pg_catalog.now()
    where id = p_lead_id and organization_id = p_organization_id;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key, 0));
  select j.* into v_job
    from public.outreach_jobs as j
   where j.idempotency_key = v_key
   limit 1;
  if found then
    if v_job.organization_id is distinct from p_organization_id
       or v_job.lead_id is distinct from p_lead_id
       or v_job.whatsapp_account_id is distinct from v_account_id
       or v_job.payload ->> 'requested_by' is distinct from p_user_id::text
       or v_job.payload ->> 'recipient' is distinct from p_recipient
       or v_job.payload ->> 'message' is distinct from pg_catalog.left(pg_catalog.btrim(p_message), 4096)
       or v_job.payload ->> 'integration_id' is distinct from p_integration_id::text
       or coalesce((v_job.payload ->> 'controlled_test')::boolean, false) is distinct from coalesce(p_controlled_test, false) then
      raise exception 'idempotency_payload_mismatch';
    end if;
    return query select
      v_job.id,
      case when (v_job.payload ->> 'message_id') ~* '^[0-9a-f-]{36}$'
        then (v_job.payload ->> 'message_id')::uuid else null end,
      coalesce(v_job.status, 'queued'),
      true;
    return;
  end if;

  insert into public.lead_messages (
    organization_id, lead_id, whatsapp_account_id, sender, sender_name, type, text, sent_at
  ) values (
    p_organization_id, p_lead_id, v_account_id, 'human',
    coalesce(nullif(pg_catalog.btrim(p_sender_name), ''), 'Atendente'),
    'queued', pg_catalog.left(pg_catalog.btrim(p_message), 4096), null::timestamptz
  ) returning id into v_message_id;

  insert into public.outreach_jobs (
    organization_id, lead_id, whatsapp_account_id, channel, attempt, run_at, status, payload, idempotency_key
  ) values (
    p_organization_id, p_lead_id, v_account_id, 'whatsapp', 0, pg_catalog.now(), 'queued',
    pg_catalog.jsonb_build_object(
      'recipient', p_recipient,
      'message', pg_catalog.left(pg_catalog.btrim(p_message), 4096),
      'message_id', v_message_id,
      'manual', true,
      'mode', 'humano',
      'provider', 'central_atendimento',
      'requested_by', p_user_id,
      'request_id', p_request_id,
      'integration_id', p_integration_id,
      'whatsapp_account_id', v_account_id,
      'context_last_contact', p_context_last_contact,
      'controlled_test', coalesce(p_controlled_test, false),
      'controlled_test_expires_at', p_controlled_test_expires_at
    ),
    v_key
  ) returning * into v_job;

  insert into public.audit_logs (
    organization_id, actor_id, actor_name, actor_type, action, detail,
    entity_table, entity_id, event_data
  ) values (
    p_organization_id,
    p_user_id,
    coalesce(nullif(pg_catalog.btrim(p_sender_name), ''), 'Atendente'),
    'user',
    case when coalesce(p_controlled_test, false)
      then 'outreach.whatsapp_controlled_test_queued'
      else 'outreach.whatsapp_queued'
    end,
    case when coalesce(p_controlled_test, false)
      then 'Teste controlado colocado na fila segura.'
      else 'Mensagem colocada na fila segura.'
    end,
    'outreach_jobs',
    v_job.id,
    pg_catalog.jsonb_build_object(
      'lead_id', p_lead_id,
      'message_id', v_message_id,
      'request_id', p_request_id,
      'channel', 'whatsapp',
      'whatsapp_account_id', v_account_id,
      'controlled_test', coalesce(p_controlled_test, false)
    )
  );

  return query select v_job.id, v_message_id, coalesce(v_job.status, 'queued'), false;
end;
$$;

revoke all on function public.queue_human_whatsapp_message(uuid, uuid, uuid, text, uuid, text, text, uuid, timestamptz, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.queue_human_whatsapp_message(uuid, uuid, uuid, text, uuid, text, text, uuid, timestamptz, boolean, timestamptz) to service_role;

comment on table public.whatsapp_accounts is 'Metadados de contas operacionais Z-API; credenciais permanecem exclusivamente no Vault via integrations.';
comment on column public.leads.whatsapp_account_id is 'Conta de WhatsApp fixada à conversa. Não deve ser trocada implicitamente após o primeiro vínculo.';
