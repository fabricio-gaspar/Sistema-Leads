begin;

-- WA-AKG contact identity v2
--
-- This migration makes the contact classification an account-scoped private
-- policy.  A synchronized provider name is useful presentation data, but it is
-- not authorization for Ana or outreach.  Only a contact proven to be in the
-- device agenda is held for an explicit decision; an unknown external inbound
-- contact remains a factual "Novo contato" and follows the normal channel
-- gates without a private-contact popup.
--
-- It performs only a strictly one-to-one factual agenda-name correction and
-- never merges records or joins phone identities except for the narrow
-- Brazilian mobile 8th/9th-digit transition.

do $preflight$
declare
  v_missing text[] := '{}'::text[];
begin
  if to_regclass('public.whatsapp_contact_directory') is null then
    v_missing := array_append(v_missing, 'public.whatsapp_contact_directory');
  end if;
  if to_regclass('public.whatsapp_conversations') is null then
    v_missing := array_append(v_missing, 'public.whatsapp_conversations');
  end if;
  if to_regclass('public.lead_messages') is null then
    v_missing := array_append(v_missing, 'public.lead_messages');
  end if;
  if to_regclass('private.whatsapp_inbound_work') is null then
    v_missing := array_append(v_missing, 'private.whatsapp_inbound_work');
  end if;
  if to_regclass('public.messaging_provider_controls') is null then
    v_missing := array_append(v_missing, 'public.messaging_provider_controls');
  end if;

  if to_regprocedure('public.resolve_or_create_whatsapp_inbound_lead(uuid,uuid,text,text,timestamp with time zone)') is null then
    v_missing := array_append(v_missing, 'resolve_or_create_whatsapp_inbound_lead(uuid,uuid,text,text,timestamptz)');
  end if;
  if to_regprocedure('public.persist_whatsapp_inbound(text,uuid,uuid)') is null then
    v_missing := array_append(v_missing, 'persist_whatsapp_inbound(text,uuid,uuid)');
  end if;
  if to_regprocedure('public.begin_whatsapp_inbound_dispatch(text,uuid,uuid)') is null then
    v_missing := array_append(v_missing, 'begin_whatsapp_inbound_dispatch(text,uuid,uuid)');
  end if;
  if to_regprocedure('public.resolve_whatsapp_lead_for_account(uuid,uuid,text)') is null then
    v_missing := array_append(v_missing, 'resolve_whatsapp_lead_for_account(uuid,uuid,text)');
  end if;
  if to_regprocedure('public.normalize_phone_identity(text)') is null then
    v_missing := array_append(v_missing, 'normalize_phone_identity(text)');
  end if;
  if to_regprocedure('private.has_org_permission(uuid,uuid,text)') is null then
    v_missing := array_append(v_missing, 'private.has_org_permission(uuid,uuid,text)');
  end if;
  if to_regprocedure('private.can_manage_lead(uuid,uuid,uuid)') is null then
    v_missing := array_append(v_missing, 'private.can_manage_lead(uuid,uuid,uuid)');
  end if;
  if to_regprocedure('private.can_access_lead(uuid,uuid,uuid)') is null then
    v_missing := array_append(v_missing, 'private.can_access_lead(uuid,uuid,uuid)');
  end if;
  if to_regprocedure('public.current_org_id()') is null then
    v_missing := array_append(v_missing, 'public.current_org_id()');
  end if;
  if to_regprocedure('public.get_kanban_portfolio(jsonb,integer,integer)') is null then
    v_missing := array_append(v_missing, 'public.get_kanban_portfolio(jsonb,integer,integer)');
  end if;

  if exists (
    select 1
      from (values
        ('public.whatsapp_contact_directory', 'organization_id'),
        ('public.whatsapp_contact_directory', 'whatsapp_account_id'),
        ('public.whatsapp_contact_directory', 'phone'),
        ('public.whatsapp_contact_directory', 'classification_state'),
        ('public.whatsapp_contact_directory', 'evidence_state'),
        ('public.whatsapp_contact_directory', 'decision_revision'),
        ('public.whatsapp_conversations', 'external_conversation_id'),
        ('public.whatsapp_conversations', 'customer_phone_identity'),
        ('public.lead_messages', 'conversation_id'),
        ('public.leads', 'source_metadata'),
        ('public.leads', 'contact_approval_status'),
        ('public.outreach_jobs', 'payload'),
        ('public.messaging_provider_controls', 'capture_only')
      ) as required_columns(table_name, column_name)
      where not exists (
        select 1
          from information_schema.columns c
         where c.table_schema = split_part(required_columns.table_name, '.', 1)
           and c.table_name = split_part(required_columns.table_name, '.', 2)
           and c.column_name = required_columns.column_name
      )
  ) then
    select array_agg(required_columns.table_name || '.' || required_columns.column_name)
      into v_missing
      from (values
        ('public.whatsapp_contact_directory', 'organization_id'),
        ('public.whatsapp_contact_directory', 'whatsapp_account_id'),
        ('public.whatsapp_contact_directory', 'phone'),
        ('public.whatsapp_contact_directory', 'classification_state'),
        ('public.whatsapp_contact_directory', 'evidence_state'),
        ('public.whatsapp_contact_directory', 'decision_revision'),
        ('public.whatsapp_conversations', 'external_conversation_id'),
        ('public.whatsapp_conversations', 'customer_phone_identity'),
        ('public.lead_messages', 'conversation_id'),
        ('public.leads', 'source_metadata'),
        ('public.leads', 'contact_approval_status'),
        ('public.outreach_jobs', 'payload'),
        ('public.messaging_provider_controls', 'capture_only')
      ) as required_columns(table_name, column_name)
      where not exists (
        select 1
          from information_schema.columns c
         where c.table_schema = split_part(required_columns.table_name, '.', 1)
           and c.table_name = split_part(required_columns.table_name, '.', 2)
           and c.column_name = required_columns.column_name
      );
  end if;

  if cardinality(v_missing) > 0 then
    raise exception 'wa_akg_contact_identity_v2_preflight_failed: %', array_to_string(v_missing, ', ');
  end if;
end;
$preflight$;

create table if not exists private.wa_akg_contact_policy (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  whatsapp_account_id uuid not null references public.whatsapp_accounts(id) on delete cascade,
  phone_identity text not null check (phone_identity ~ '^[1-9][0-9]{7,14}$'),
  classification_state text not null default 'unclassified'
    check (classification_state in ('agenda_protected', 'unclassified', 'lead_authorized')),
  evidence_state text not null default 'unverified'
    check (evidence_state in ('provider_verified', 'operator_confirmed', 'unverified')),
  -- This is set only from the synchronized device-agenda field, never from a
  -- WhatsApp display name, photo, observed message, or a browser decision.
  agenda_sync_confirmed boolean not null default false,
  -- Durable server-side fence for an inbound shell that has not been promoted.
  -- Unlike lead.source_metadata, this cannot be cleared by an ordinary lead edit.
  contact_only boolean not null default false,
  -- Distinguishes a lead created by this v2 inbound resolver from a commercial
  -- lead that existed before an agenda snapshot was projected.  It is used only
  -- to avoid auto-authorizing a newly observed inbound when a later device
  -- sync discovers it in the agenda.
  inbound_lead_created boolean not null default false,
  lead_id uuid references public.leads(id) on delete set null,
  decision_revision bigint not null default 0 check (decision_revision >= 0),
  decision_by uuid references auth.users(id) on delete set null,
  decision_at timestamptz,
  decision_reason text,
  first_seen_at timestamptz not null default pg_catalog.now(),
  last_seen_at timestamptz not null default pg_catalog.now(),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  primary key (organization_id, whatsapp_account_id, phone_identity)
);

create index if not exists wa_akg_contact_policy_state_idx
  on private.wa_akg_contact_policy (organization_id, whatsapp_account_id, classification_state, last_seen_at desc);
create index if not exists wa_akg_contact_policy_lead_idx
  on private.wa_akg_contact_policy (lead_id) where lead_id is not null;

alter table private.wa_akg_contact_policy
  add column if not exists agenda_sync_confirmed boolean not null default false;

alter table private.wa_akg_contact_policy
  add column if not exists contact_only boolean not null default false;

alter table private.wa_akg_contact_policy
  add column if not exists inbound_lead_created boolean not null default false;

alter table private.wa_akg_contact_policy enable row level security;
revoke all on table private.wa_akg_contact_policy from public, anon, authenticated;
grant all on table private.wa_akg_contact_policy to service_role;

create table if not exists private.wa_akg_contact_decision_dismissals (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  whatsapp_account_id uuid not null references public.whatsapp_accounts(id) on delete cascade,
  phone_identity text not null check (phone_identity ~ '^[1-9][0-9]{7,14}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_message_id uuid not null references public.lead_messages(id) on delete cascade,
  dismissed_at timestamptz not null default pg_catalog.now(),
  primary key (organization_id, whatsapp_account_id, phone_identity, user_id, source_message_id)
);

alter table private.wa_akg_contact_decision_dismissals enable row level security;
revoke all on table private.wa_akg_contact_decision_dismissals from public, anon, authenticated;
grant all on table private.wa_akg_contact_decision_dismissals to service_role;

create table if not exists private.wa_akg_contact_decision_requests (
  request_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  response jsonb not null,
  created_at timestamptz not null default pg_catalog.now()
);

alter table private.wa_akg_contact_decision_requests enable row level security;
revoke all on table private.wa_akg_contact_decision_requests from public, anon, authenticated;
grant all on table private.wa_akg_contact_decision_requests to service_role;

-- Exact identity always wins.  Only a Brazilian mobile number with the old/new
-- 8th/9th digit shape may use one alternate spelling; landlines and all other
-- country formats are never aliased.
create or replace function private.wa_akg_phone_identity_variants(p_phone text)
returns table(phone_identity text, match_kind text, priority smallint)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_phone text := public.normalize_phone_identity(p_phone);
begin
  if v_phone is null or v_phone !~ '^[1-9][0-9]{7,14}$' then
    return;
  end if;

  return query select v_phone, 'exact'::text, 0::smallint;

  if v_phone ~ '^55[1-9][0-9]9[6-9][0-9]{7}$' then
    return query select
      substr(v_phone, 1, 4) || substr(v_phone, 6),
      'brazil_mobile_8_9_equivalent'::text,
      1::smallint;
  elsif v_phone ~ '^55[1-9][0-9][6-9][0-9]{7}$' then
    return query select
      substr(v_phone, 1, 4) || '9' || substr(v_phone, 5),
      'brazil_mobile_8_9_equivalent'::text,
      1::smallint;
  end if;
end;
$function$;

revoke all on function private.wa_akg_phone_identity_variants(text) from public, anon, authenticated;
grant execute on function private.wa_akg_phone_identity_variants(text) to service_role;

create or replace function private.wa_akg_contact_policy_lock_key(p_phone text)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_phone text := public.normalize_phone_identity(p_phone);
begin
  if v_phone is null then
    return null;
  end if;

  if v_phone ~ '^55[1-9][0-9][6-9][0-9]{7}$' then
    return substr(v_phone, 1, 4) || '9' || substr(v_phone, 5);
  end if;
  return v_phone;
end;
$function$;

revoke all on function private.wa_akg_contact_policy_lock_key(text) from public, anon, authenticated;
grant execute on function private.wa_akg_contact_policy_lock_key(text) to service_role;

create or replace function private.wa_akg_resolve_contact_policy_identity(
  p_organization_id uuid,
  p_account_id uuid,
  p_phone text
)
returns table(phone_identity text, match_kind text, ambiguous boolean)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_phone text := public.normalize_phone_identity(p_phone);
  v_exact boolean := false;
  v_count integer := 0;
  v_identity text;
begin
  if p_organization_id is null or p_account_id is null or v_phone is null then
    return query select null::text, 'invalid'::text, false;
    return;
  end if;

  select exists(
    select 1
      from private.wa_akg_contact_policy p
     where p.organization_id = p_organization_id
       and p.whatsapp_account_id = p_account_id
       and p.phone_identity = v_phone
  ) into v_exact;

  if v_exact then
    return query select v_phone, 'exact'::text, false;
    return;
  end if;

  select count(*), min(p.phone_identity)
    into v_count, v_identity
    from private.wa_akg_contact_policy p
    join private.wa_akg_phone_identity_variants(v_phone) variant
      on variant.phone_identity = p.phone_identity
     and variant.priority = 1
   where p.organization_id = p_organization_id
     and p.whatsapp_account_id = p_account_id;

  if v_count = 1 then
    return query select v_identity, 'brazil_mobile_8_9_equivalent'::text, false;
  elsif v_count > 1 then
    return query select null::text, 'ambiguous'::text, true;
  else
    return query select null::text, 'not_found'::text, false;
  end if;
end;
$function$;

revoke all on function private.wa_akg_resolve_contact_policy_identity(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.wa_akg_resolve_contact_policy_identity(uuid, uuid, text) to service_role;

create or replace function private.wa_akg_format_contact_phone(p_phone text)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_phone text := public.normalize_phone_identity(p_phone);
begin
  if v_phone ~ '^55[1-9][0-9]9[0-9]{8}$' then
    return '+' || substr(v_phone, 1, 2) || ' (' || substr(v_phone, 3, 2) || ') ' || substr(v_phone, 5, 5) || '-' || substr(v_phone, 10, 4);
  elsif v_phone ~ '^55[1-9][0-9][0-9]{8}$' then
    return '+' || substr(v_phone, 1, 2) || ' (' || substr(v_phone, 3, 2) || ') ' || substr(v_phone, 5, 4) || '-' || substr(v_phone, 9, 4);
  end if;
  return coalesce(v_phone, p_phone);
end;
$function$;

revoke all on function private.wa_akg_format_contact_phone(text) from public, anon, authenticated;
grant execute on function private.wa_akg_format_contact_phone(text) to service_role;

create or replace function private.wa_akg_preferred_contact_name(
  p_organization_id uuid,
  p_account_id uuid,
  p_phone text,
  p_observed_name text default null
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_phone text := public.normalize_phone_identity(p_phone);
  v_name text;
  v_observed text := nullif(btrim(coalesce(p_observed_name, '')), '');
begin
  if v_phone is null then
    return null;
  end if;

  select candidate.name
    into v_name
    from (
      select nullif(btrim(d.agenda_name), '') as name, 1 as name_priority, variant.priority as match_priority,
             d.last_synced_at, d.updated_at
        from public.whatsapp_contact_directory d
        join private.wa_akg_phone_identity_variants(v_phone) variant
          on variant.phone_identity = public.normalize_phone_identity(d.phone)
       where d.organization_id = p_organization_id
         and d.whatsapp_account_id = p_account_id
      union all
      select nullif(btrim(d.whatsapp_name), '') as name, 2 as name_priority, variant.priority as match_priority,
             d.last_synced_at, d.updated_at
        from public.whatsapp_contact_directory d
        join private.wa_akg_phone_identity_variants(v_phone) variant
          on variant.phone_identity = public.normalize_phone_identity(d.phone)
       where d.organization_id = p_organization_id
         and d.whatsapp_account_id = p_account_id
      union all
      select nullif(btrim(d.public_name), '') as name, 3 as name_priority, variant.priority as match_priority,
             d.last_synced_at, d.updated_at
        from public.whatsapp_contact_directory d
        join private.wa_akg_phone_identity_variants(v_phone) variant
          on variant.phone_identity = public.normalize_phone_identity(d.phone)
       where d.organization_id = p_organization_id
         and d.whatsapp_account_id = p_account_id
    ) candidate
   where candidate.name is not null
     and lower(candidate.name) not in ('lead', 'contato não identificado', 'contato nao identificado', 'contato whatsapp', 'novo contato', 'contato não informado', 'contato nao informado')
   order by candidate.name_priority, candidate.match_priority,
            candidate.last_synced_at desc nulls last, candidate.updated_at desc nulls last
   limit 1;

  if v_name is not null then
    return v_name;
  end if;
  if v_observed is not null
     and lower(v_observed) not in ('lead', 'contato não identificado', 'contato nao identificado', 'contato whatsapp', 'novo contato', 'contato não informado', 'contato nao informado') then
    return v_observed;
  end if;
  return private.wa_akg_format_contact_phone(v_phone);
end;
$function$;

revoke all on function private.wa_akg_preferred_contact_name(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function private.wa_akg_preferred_contact_name(uuid, uuid, text, text) to service_role;

-- Keep the legacy resolver contract, but make its answer canonical and private.
-- Existing lead/outreach trigger call sites therefore gain the safer policy without
-- depending on a browser-side classification cache.
create or replace function private.resolve_wa_akg_contact_policy(
  p_organization_id uuid,
  p_account_id uuid,
  p_phone text
)
returns table(state text, evidence_state text, lead_id uuid, reason text)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_resolved record;
  v_policy private.wa_akg_contact_policy%rowtype;
begin
  if p_organization_id is null or p_account_id is null or public.normalize_phone_identity(p_phone) is null then
    return query select 'unknown'::text, 'unverified'::text, null::uuid, 'identity_unresolved'::text;
    return;
  end if;

  select * into v_resolved
    from private.wa_akg_resolve_contact_policy_identity(p_organization_id, p_account_id, p_phone)
   limit 1;

  if coalesce(v_resolved.ambiguous, false) then
    return query select 'unknown'::text, 'unverified'::text, null::uuid, 'identity_ambiguous'::text;
    return;
  end if;
  if v_resolved.phone_identity is null then
    return query select 'unknown'::text, 'unverified'::text, null::uuid, 'policy_not_found'::text;
    return;
  end if;

  select * into v_policy
    from private.wa_akg_contact_policy p
   where p.organization_id = p_organization_id
     and p.whatsapp_account_id = p_account_id
     and p.phone_identity = v_resolved.phone_identity;

  if not found then
    return query select 'unknown'::text, 'unverified'::text, null::uuid, 'policy_not_found'::text;
    return;
  end if;

  return query select
    v_policy.classification_state,
    v_policy.evidence_state,
    v_policy.lead_id,
    case v_policy.classification_state
      when 'agenda_protected' then 'contact_protection_required'
      when 'unclassified' then 'explicit_operator_decision_required'
      when 'lead_authorized' then 'lead_authorized_by_operator'
      else 'unknown'
    end;
end;
$function$;

revoke all on function private.resolve_wa_akg_contact_policy(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.resolve_wa_akg_contact_policy(uuid, uuid, text) to service_role;

-- An observed inbound number is not proof that the number belongs to the
-- device agenda.  Only a confirmed agenda sync, an explicit keep decision, or
-- an already-created protected shell may stop an otherwise normal lead.
create or replace function private.wa_akg_contact_requires_protection(
  p_organization_id uuid,
  p_account_id uuid,
  p_phone text,
  p_source_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_resolved record;
  v_policy private.wa_akg_contact_policy%rowtype;
begin
  -- `p_source_metadata` remains in the compatibility signature, but is not
  -- authoritative: a lead editor must not be able to remove a protection fence
  -- by changing JSON metadata.  The private canonical policy decides instead.
  if p_organization_id is null or p_account_id is null or public.normalize_phone_identity(p_phone) is null then
    return false;
  end if;

  select * into v_resolved
    from private.wa_akg_resolve_contact_policy_identity(p_organization_id, p_account_id, p_phone)
   limit 1;
  if coalesce(v_resolved.ambiguous, false) then
    -- Never let a known identity collision release automation.
    return true;
  end if;
  if v_resolved.phone_identity is null then
    return false;
  end if;

  select * into v_policy
    from private.wa_akg_contact_policy policy
   where policy.organization_id = p_organization_id
     and policy.whatsapp_account_id = p_account_id
     and policy.phone_identity = v_resolved.phone_identity;
  if not found then
    return false;
  end if;

  return v_policy.contact_only
      or v_policy.classification_state = 'agenda_protected'
      or (v_policy.classification_state = 'unclassified' and v_policy.agenda_sync_confirmed);
end;
$function$;

revoke all on function private.wa_akg_contact_requires_protection(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function private.wa_akg_contact_requires_protection(uuid, uuid, text, jsonb) to service_role;

-- Lead-bound policy rows remain authoritative even if an ordinary lead edit
-- attempts to clear or replace the public account/phone fields.
create or replace function private.wa_akg_bound_lead_requires_protection(
  p_organization_id uuid,
  p_lead_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select exists (
    select 1
      from private.wa_akg_contact_policy policy
     where policy.organization_id = p_organization_id
       and policy.lead_id = p_lead_id
       and (
         policy.contact_only
         or policy.classification_state = 'agenda_protected'
         or (policy.classification_state = 'unclassified' and policy.agenda_sync_confirmed)
       )
  );
$function$;

revoke all on function private.wa_akg_bound_lead_requires_protection(uuid, uuid) from public, anon, authenticated;
grant execute on function private.wa_akg_bound_lead_requires_protection(uuid, uuid) to service_role;

-- `get_kanban_portfolio` is SECURITY INVOKER.  It may call this narrow public
-- wrapper, but it must never receive EXECUTE on the private policy helper or
-- use it as a cross-organization policy probe.  A caller can ask only about a
-- lead it may already read in its current organization; all other contexts
-- fail closed and merely omit the row.
create or replace function public.wa_akg_contact_protected_for_kanban(p_lead_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_organization_id uuid := public.current_org_id();
  v_user_id uuid := auth.uid();
  v_lead public.leads%rowtype;
begin
  if p_lead_id is null or v_organization_id is null then
    return true;
  end if;
  if v_user_id is null
     and coalesce(pg_catalog.current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    return true;
  end if;
  if v_user_id is not null
     and not private.can_access_lead(v_organization_id, p_lead_id, v_user_id) then
    return true;
  end if;

  select * into v_lead
    from public.leads lead
   where lead.id = p_lead_id
     and lead.organization_id = v_organization_id;
  if not found then
    return true;
  end if;

  return private.wa_akg_bound_lead_requires_protection(v_lead.organization_id, v_lead.id)
      or private.wa_akg_contact_requires_protection(
        v_lead.organization_id,
        v_lead.whatsapp_account_id,
        coalesce(v_lead.whatsapp_identity, v_lead.phone_identity, v_lead.whatsapp, v_lead.phone),
        v_lead.source_metadata
      );
end;
$function$;

revoke all on function public.wa_akg_contact_protected_for_kanban(uuid) from public, anon;
grant execute on function public.wa_akg_contact_protected_for_kanban(uuid) to authenticated, service_role;

-- The Kanban is for actionable commercial work, never for device-agenda
-- contacts awaiting an explicit decision.  Preserve the deployed function
-- verbatim except for this guarded server-side filter; a changed remote
-- definition fails the migration instead of silently publishing a stale copy.
do $kanban_visibility_guard$
declare
  v_definition text;
  v_anchor constant text := '      and prepared.modo_atendimento is not null';
  v_filter constant text := '      and not public.wa_akg_contact_protected_for_kanban(prepared.id)';
begin
  select pg_catalog.pg_get_functiondef('public.get_kanban_portfolio(jsonb,integer,integer)'::regprocedure)
    into v_definition;
  if v_definition is null then
    raise exception 'wa_akg_contact_identity_v2_kanban_contract_missing';
  end if;
  if position('public.wa_akg_contact_protected_for_kanban(' in v_definition) > 0 then
    return;
  end if;
  if position('private.wa_akg_contact_requires_protection(' in v_definition) > 0 then
    raise exception 'wa_akg_contact_identity_v2_kanban_legacy_filter_present';
  end if;
  if position(v_anchor in v_definition) = 0 then
    raise exception 'wa_akg_contact_identity_v2_kanban_contract_changed';
  end if;

  execute replace(v_definition, v_anchor, v_anchor || E'\n' || v_filter);
end;
$kanban_visibility_guard$;

-- A pre-existing commercial lead must not become contact-only merely because a
-- later device sync also contains its number. This is deliberately narrow: an
-- exact/allowed-alias one-to-one match, an already approved lead, no legacy
-- contact-only marker, and no v2-created inbound lead. It preserves an
-- existing commercial authorization; it never manufactures one for a new or
-- ambiguous contact.
create or replace function private.wa_akg_preserve_existing_commercial_policy_v2(
  p_organization_id uuid,
  p_account_id uuid,
  p_phone text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_resolved record;
  v_policy private.wa_akg_contact_policy%rowtype;
  v_lead_id uuid;
  v_candidate_count integer := 0;
begin
  if p_organization_id is null
     or p_account_id is null
     or public.normalize_phone_identity(p_phone) is null then
    return;
  end if;

  select * into v_resolved
    from private.wa_akg_resolve_contact_policy_identity(
      p_organization_id, p_account_id, p_phone
    )
   limit 1;
  if coalesce(v_resolved.ambiguous, false)
     or v_resolved.phone_identity is null then
    return;
  end if;

  select * into v_policy
    from private.wa_akg_contact_policy policy
   where policy.organization_id = p_organization_id
     and policy.whatsapp_account_id = p_account_id
     and policy.phone_identity = v_resolved.phone_identity
   for update;
  if not found then
    return;
  end if;
  if not (
    v_policy.agenda_sync_confirmed
    and v_policy.classification_state = 'unclassified'
    and not v_policy.contact_only
    and not v_policy.inbound_lead_created
  ) then
    return;
  end if;

  select count(*) into v_candidate_count
    from public.leads lead
   where lead.organization_id = p_organization_id
     and lead.whatsapp_account_id = p_account_id
     and lead.archived_at is null
     and lead.contact_approval_status = 'approved'
     and coalesce(lead.source_metadata ->> 'wa_akg_contact_only', 'false') <> 'true'
     and (v_policy.lead_id is null or v_policy.lead_id = lead.id)
     and public.normalize_phone_identity(
       coalesce(lead.whatsapp_identity, lead.phone_identity, lead.whatsapp, lead.phone)
     ) in (
       select variant.phone_identity
         from private.wa_akg_phone_identity_variants(v_policy.phone_identity) variant
     );
  if v_candidate_count <> 1 then
    return;
  end if;

  select lead.id into v_lead_id
    from public.leads lead
   where lead.organization_id = p_organization_id
     and lead.whatsapp_account_id = p_account_id
     and lead.archived_at is null
     and lead.contact_approval_status = 'approved'
     and coalesce(lead.source_metadata ->> 'wa_akg_contact_only', 'false') <> 'true'
     and (v_policy.lead_id is null or v_policy.lead_id = lead.id)
     and public.normalize_phone_identity(
       coalesce(lead.whatsapp_identity, lead.phone_identity, lead.whatsapp, lead.phone)
     ) in (
       select variant.phone_identity
         from private.wa_akg_phone_identity_variants(v_policy.phone_identity) variant
     )
   limit 1
   for update;

  update private.wa_akg_contact_policy policy
     set classification_state = 'lead_authorized',
         lead_id = v_lead_id,
         -- Do not falsify operator attribution or decision timestamps. This
         -- records why v2 kept an already commercial lead active.
         decision_reason = coalesce(
           policy.decision_reason,
           'Autorização comercial existente preservada pela migração v2.'
         ),
         updated_at = pg_catalog.now()
   where policy.organization_id = p_organization_id
     and policy.whatsapp_account_id = p_account_id
     and policy.phone_identity = v_policy.phone_identity
     and policy.classification_state = 'unclassified'
     and not policy.contact_only
     and not policy.inbound_lead_created;
end;
$function$;

revoke all on function private.wa_akg_preserve_existing_commercial_policy_v2(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.wa_akg_preserve_existing_commercial_policy_v2(uuid, uuid, text) to service_role;

-- The directory is provider evidence, not an operator-authority surface.  Its
-- legacy classification column is projected once for compatibility, so a
-- browser must never be able to seed `lead_authorized` and bypass the private
-- v2 decision policy.  Reads remain available only through the scoped
-- SECURITY DEFINER Central RPC; the WA-AKG worker writes through service_role.
alter table public.whatsapp_contact_directory enable row level security;
revoke all on table public.whatsapp_contact_directory from public, anon, authenticated;
grant select, insert, update, delete on table public.whatsapp_contact_directory to service_role;

-- Project directory snapshots into a canonical policy, but never use a name or
-- photo as classification proof and never overwrite an operator decision.
create or replace function private.project_wa_akg_contact_directory_policy_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_phone text := public.normalize_phone_identity(new.phone);
  v_resolved record;
  v_state text;
  v_evidence text;
begin
  if v_phone is null or not exists (
    select 1
      from public.whatsapp_accounts a
     where a.id = new.whatsapp_account_id
       and a.organization_id = new.organization_id
       and a.provider = 'wa_akg'
       and a.archived_at is null
  ) then
    return new;
  end if;

  select * into v_resolved
    from private.wa_akg_resolve_contact_policy_identity(new.organization_id, new.whatsapp_account_id, v_phone)
   limit 1;

  if coalesce(v_resolved.ambiguous, false) then
    return new;
  end if;

  if v_resolved.phone_identity is null then
    v_state := case when new.classification_state in ('agenda_protected', 'unclassified', 'lead_authorized')
                    then new.classification_state else 'unclassified' end;
    v_evidence := case when new.evidence_state in ('provider_verified', 'operator_confirmed', 'unverified')
                       then new.evidence_state
                       when nullif(btrim(new.agenda_name), '') is not null then 'provider_verified'
                       else 'unverified' end;
    insert into private.wa_akg_contact_policy (
      organization_id, whatsapp_account_id, phone_identity, classification_state,
      evidence_state, agenda_sync_confirmed, contact_only, lead_id, decision_revision, decision_by, decision_at,
      decision_reason, first_seen_at, last_seen_at
    ) values (
      new.organization_id, new.whatsapp_account_id, v_phone, v_state,
      v_evidence, nullif(btrim(new.agenda_name), '') is not null, false, new.lead_id, coalesce(new.decision_revision, 0), new.decision_by,
      new.decision_at, new.decision_reason, pg_catalog.now(), pg_catalog.now()
    ) on conflict do nothing;
  else
    update private.wa_akg_contact_policy p
       set lead_id = coalesce(p.lead_id, new.lead_id),
           agenda_sync_confirmed = p.agenda_sync_confirmed or nullif(btrim(new.agenda_name), '') is not null,
           last_seen_at = pg_catalog.now(),
           updated_at = pg_catalog.now()
     where p.organization_id = new.organization_id
       and p.whatsapp_account_id = new.whatsapp_account_id
       and p.phone_identity = v_resolved.phone_identity;
  end if;

  -- Preserve a commercial approval only when it pre-dated this v2 inbound
  -- resolver and has a strict one-to-one identity match. All other confirmed
  -- agenda contacts become durably contact-only; the pending popup still
  -- filters on agenda evidence and therefore never appears for an observed
  -- external number.
  perform private.wa_akg_preserve_existing_commercial_policy_v2(
    new.organization_id, new.whatsapp_account_id, v_phone
  );
  update private.wa_akg_contact_policy policy
     set contact_only = true,
         updated_at = pg_catalog.now()
   where policy.organization_id = new.organization_id
     and policy.whatsapp_account_id = new.whatsapp_account_id
     and policy.phone_identity = coalesce(v_resolved.phone_identity, v_phone)
     and policy.agenda_sync_confirmed
     and policy.classification_state <> 'lead_authorized';

  return new;
end;
$function$;

drop trigger if exists whatsapp_contact_directory_project_contact_policy_v2 on public.whatsapp_contact_directory;
create trigger whatsapp_contact_directory_project_contact_policy_v2
after insert or update of phone, agenda_name, whatsapp_name, public_name, classification_state,
  evidence_state, decision_revision, decision_by, decision_at, decision_reason, lead_id,
  whatsapp_account_id, organization_id
on public.whatsapp_contact_directory
for each row execute function private.project_wa_akg_contact_directory_policy_v2();

-- One-time projection is deliberately exact-identity only.  It preserves the
-- newest directory state as evidence but does not merge historical contacts.
insert into private.wa_akg_contact_policy (
  organization_id, whatsapp_account_id, phone_identity, classification_state,
  evidence_state, agenda_sync_confirmed, contact_only, lead_id, decision_revision, decision_by, decision_at,
  decision_reason, first_seen_at, last_seen_at
)
select distinct on (d.organization_id, d.whatsapp_account_id, public.normalize_phone_identity(d.phone))
  d.organization_id,
  d.whatsapp_account_id,
  public.normalize_phone_identity(d.phone),
  case when d.classification_state in ('agenda_protected', 'unclassified', 'lead_authorized') then d.classification_state else 'unclassified' end,
  case when d.evidence_state in ('provider_verified', 'operator_confirmed', 'unverified') then d.evidence_state
       when nullif(btrim(d.agenda_name), '') is not null then 'provider_verified'
       else 'unverified' end,
  nullif(btrim(d.agenda_name), '') is not null,
  false,
  d.lead_id,
  coalesce(d.decision_revision, 0),
  d.decision_by,
  d.decision_at,
  d.decision_reason,
  pg_catalog.now(),
  pg_catalog.now()
from public.whatsapp_contact_directory d
join public.whatsapp_accounts a
  on a.id = d.whatsapp_account_id
 and a.organization_id = d.organization_id
 and a.provider = 'wa_akg'
 and a.archived_at is null
where public.normalize_phone_identity(d.phone) is not null
order by d.organization_id, d.whatsapp_account_id, public.normalize_phone_identity(d.phone),
         d.last_synced_at desc nulls last, d.updated_at desc nulls last
on conflict (organization_id, whatsapp_account_id, phone_identity) do update
  set agenda_sync_confirmed = private.wa_akg_contact_policy.agenda_sync_confirmed
        or excluded.agenda_sync_confirmed,
      lead_id = coalesce(private.wa_akg_contact_policy.lead_id, excluded.lead_id),
      last_seen_at = greatest(private.wa_akg_contact_policy.last_seen_at, excluded.last_seen_at),
      updated_at = pg_catalog.now();

-- Projecting a confirmed agenda entry may coincide with a legitimate lead that
-- already existed before v2. Preserve only the safe 1:1 commercial case, then
-- make every remaining confirmed-agenda policy durably contact-only. Unknown
-- external inbound policies have agenda_sync_confirmed = false and are not
-- included here.
do $preserve_existing_commercial_leads$
declare
  v_candidate record;
begin
  for v_candidate in
    select policy.organization_id, policy.whatsapp_account_id, policy.phone_identity
      from private.wa_akg_contact_policy policy
     where policy.agenda_sync_confirmed
       and policy.classification_state = 'unclassified'
       and not policy.contact_only
       and not policy.inbound_lead_created
  loop
    perform private.wa_akg_preserve_existing_commercial_policy_v2(
      v_candidate.organization_id,
      v_candidate.whatsapp_account_id,
      v_candidate.phone_identity
    );
  end loop;

  update private.wa_akg_contact_policy policy
     set contact_only = true,
         updated_at = pg_catalog.now()
   where policy.agenda_sync_confirmed
     and policy.classification_state <> 'lead_authorized';
end;
$preserve_existing_commercial_leads$;

-- Preserve durable protection for legacy human-only shells.  The historical
-- JSON marker is read exactly once by this migration and only through a
-- one-to-one account/phone match; after this point the private policy flag,
-- not mutable lead metadata, is the authority.
with shell_candidates as (
  select
    policy.organization_id,
    policy.whatsapp_account_id,
    policy.phone_identity,
    lead.id as lead_id
  from private.wa_akg_contact_policy policy
  join private.wa_akg_phone_identity_variants(policy.phone_identity) variant on true
  join public.leads lead
    on lead.organization_id = policy.organization_id
   and lead.whatsapp_account_id = policy.whatsapp_account_id
   and public.normalize_phone_identity(coalesce(lead.whatsapp_identity, lead.phone_identity, lead.whatsapp, lead.phone)) = variant.phone_identity
  where policy.classification_state <> 'lead_authorized'
    and coalesce(lead.source_metadata ->> 'wa_akg_contact_only', 'false') = 'true'
    and (policy.lead_id is null or policy.lead_id = lead.id)
), one_shell_per_policy as (
  select organization_id, whatsapp_account_id, phone_identity
  from shell_candidates
  group by organization_id, whatsapp_account_id, phone_identity
  having count(distinct lead_id) = 1
), one_policy_per_shell as (
  select organization_id, whatsapp_account_id, lead_id
  from shell_candidates
  group by organization_id, whatsapp_account_id, lead_id
  having count(distinct phone_identity) = 1
), unambiguous_shells as (
  select candidate.organization_id, candidate.whatsapp_account_id,
         candidate.phone_identity, candidate.lead_id
  from shell_candidates candidate
  join one_shell_per_policy policy_count
    on policy_count.organization_id = candidate.organization_id
   and policy_count.whatsapp_account_id = candidate.whatsapp_account_id
   and policy_count.phone_identity = candidate.phone_identity
  join one_policy_per_shell lead_count
    on lead_count.organization_id = candidate.organization_id
   and lead_count.whatsapp_account_id = candidate.whatsapp_account_id
   and lead_count.lead_id = candidate.lead_id
)
update private.wa_akg_contact_policy policy
   set contact_only = true,
       lead_id = coalesce(policy.lead_id, shell.lead_id),
       updated_at = pg_catalog.now()
  from unambiguous_shells shell
 where policy.organization_id = shell.organization_id
   and policy.whatsapp_account_id = shell.whatsapp_account_id
   and policy.phone_identity = shell.phone_identity;

-- Repair only factual agenda names, and bind only an unambiguous existing lead
-- to its canonical policy.  This neither creates/merges leads nor changes an
-- observed-only commercial record; aliases are limited to the same Brazilian
-- 8th/9th-digit rule used everywhere else in this migration.
with agenda_names as (
  select
    policy.organization_id,
    policy.whatsapp_account_id,
    policy.phone_identity,
    min(nullif(btrim(directory.agenda_name), '')) as agenda_name
  from private.wa_akg_contact_policy policy
  join private.wa_akg_phone_identity_variants(policy.phone_identity) variant on true
  join public.whatsapp_contact_directory directory
    on directory.organization_id = policy.organization_id
   and directory.whatsapp_account_id = policy.whatsapp_account_id
   and public.normalize_phone_identity(directory.phone) = variant.phone_identity
  where policy.agenda_sync_confirmed
    and nullif(btrim(directory.agenda_name), '') is not null
  group by policy.organization_id, policy.whatsapp_account_id, policy.phone_identity
  having count(distinct nullif(btrim(directory.agenda_name), '')) = 1
), policy_lead_matches as (
  select
    agenda.organization_id,
    agenda.whatsapp_account_id,
    agenda.phone_identity,
    agenda.agenda_name,
    lead.id as lead_id
  from agenda_names agenda
  join private.wa_akg_phone_identity_variants(agenda.phone_identity) variant on true
  join public.leads lead
    on lead.organization_id = agenda.organization_id
   and lead.whatsapp_account_id = agenda.whatsapp_account_id
   and lead.archived_at is null
   and public.normalize_phone_identity(coalesce(lead.whatsapp_identity, lead.phone_identity, lead.whatsapp, lead.phone)) = variant.phone_identity
  join private.wa_akg_contact_policy policy
    on policy.organization_id = agenda.organization_id
   and policy.whatsapp_account_id = agenda.whatsapp_account_id
   and policy.phone_identity = agenda.phone_identity
   and (policy.lead_id is null or policy.lead_id = lead.id)
), one_policy_per_lead as (
  select organization_id, whatsapp_account_id, lead_id
  from policy_lead_matches
  group by organization_id, whatsapp_account_id, lead_id
  having count(distinct phone_identity) = 1
), one_lead_per_policy as (
  select organization_id, whatsapp_account_id, phone_identity
  from policy_lead_matches
  group by organization_id, whatsapp_account_id, phone_identity
  having count(distinct lead_id) = 1
), unambiguous_matches as (
  select match.organization_id, match.whatsapp_account_id, match.phone_identity,
         match.lead_id, match.agenda_name
  from policy_lead_matches match
  join one_policy_per_lead lead_count
    on lead_count.organization_id = match.organization_id
   and lead_count.whatsapp_account_id = match.whatsapp_account_id
   and lead_count.lead_id = match.lead_id
  join one_lead_per_policy policy_count
    on policy_count.organization_id = match.organization_id
   and policy_count.whatsapp_account_id = match.whatsapp_account_id
   and policy_count.phone_identity = match.phone_identity
), bound_policies as (
  update private.wa_akg_contact_policy policy
     set lead_id = coalesce(policy.lead_id, matched.lead_id),
         updated_at = pg_catalog.now()
    from unambiguous_matches matched
   where policy.organization_id = matched.organization_id
     and policy.whatsapp_account_id = matched.whatsapp_account_id
     and policy.phone_identity = matched.phone_identity
  returning policy.organization_id, policy.whatsapp_account_id,
            policy.phone_identity, policy.lead_id
)
update public.leads lead
   set contact = matched.agenda_name,
       updated_at = pg_catalog.now()
  from unambiguous_matches matched
  join bound_policies bound
    on bound.organization_id = matched.organization_id
   and bound.whatsapp_account_id = matched.whatsapp_account_id
   and bound.phone_identity = matched.phone_identity
   and bound.lead_id = matched.lead_id
 where lead.id = matched.lead_id
   and lead.organization_id = matched.organization_id
   and coalesce(lower(btrim(lead.contact)), '') in (
     '', 'lead', 'contato não identificado', 'contato nao identificado',
     'contato whatsapp', 'novo contato', 'contato não informado', 'contato nao informado'
   );

create or replace function private.enforce_wa_akg_contact_identity_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_policy record;
  v_name text;
  v_phone text;
  v_bound_protected boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_bound_protected := private.wa_akg_bound_lead_requires_protection(old.organization_id, old.id);
    if v_bound_protected then
      -- A pending shell cannot detach itself from its private policy by
      -- changing public account/identity fields.  The decision RPC flips the
      -- policy first, so an explicit promotion is not affected.
      new.whatsapp_account_id := old.whatsapp_account_id;
      new.whatsapp_identity := old.whatsapp_identity;
      new.phone_identity := old.phone_identity;
      new.whatsapp := old.whatsapp;
      new.phone := old.phone;
    end if;
  end if;

  if new.whatsapp_account_id is null or not exists (
    select 1 from public.whatsapp_accounts a
     where a.id = new.whatsapp_account_id
       and a.organization_id = new.organization_id
       and a.provider = 'wa_akg'
       and a.archived_at is null
  ) then
    return new;
  end if;

  v_phone := public.normalize_phone_identity(coalesce(new.whatsapp_identity, new.phone_identity, new.whatsapp, new.phone));
  if v_phone is null then
    return new;
  end if;

  select * into v_policy
    from private.resolve_wa_akg_contact_policy(new.organization_id, new.whatsapp_account_id, v_phone)
   limit 1;

  if not v_bound_protected
     and not private.wa_akg_contact_requires_protection(
       new.organization_id,
       new.whatsapp_account_id,
       v_phone,
       new.source_metadata
     ) then
    return new;
  end if;

  v_name := private.wa_akg_preferred_contact_name(new.organization_id, new.whatsapp_account_id, v_phone, new.contact);
  if coalesce(lower(btrim(new.contact)), '') in ('', 'lead', 'contato não identificado', 'contato nao identificado', 'contato whatsapp', 'novo contato', 'contato não informado', 'contato nao informado') then
    new.contact := v_name;
  end if;
  if coalesce(lower(btrim(new.company)), '') in ('', 'contato whatsapp', 'contato não identificado', 'contato nao identificado') then
    new.company := case when v_bound_protected or v_policy.state in ('agenda_protected', 'unclassified')
                        then 'Contato da agenda' else 'Novo contato' end;
  end if;

  new.modo_atendimento := 'humano';
  new.ai_paused := true;
  new.automation_status := 'human';
  new.contact_approval_status := 'pending';
  new.contact_approval_reason := 'Contato protegido; aguarda classificação explícita.';
  new.contact_approved_at := null;
  new.contact_approved_by := null;
  new.source_metadata := coalesce(new.source_metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object(
    'wa_akg_contact_only', true,
    'wa_akg_contact_state', coalesce(v_policy.state, 'unclassified'),
    'wa_akg_contact_identity', v_phone
  );
  return new;
end;
$function$;

-- The v1 trigger reads the mutable public directory directly.  Keep only the
-- v2 canonical-policy trigger; otherwise a legacy unclassified directory row
-- could overwrite a v2 `lead_authorized` decision on a later lead update.
drop trigger if exists leads_wa_akg_contact_protection on public.leads;
drop trigger if exists leads_wa_akg_contact_identity_v2 on public.leads;
create trigger leads_wa_akg_contact_identity_v2
before insert or update of contact, company, whatsapp_account_id, whatsapp_identity,
  phone_identity, whatsapp, phone, source_metadata, modo_atendimento, ai_paused,
  automation_status, contact_approval_status
on public.leads
for each row execute function private.enforce_wa_akg_contact_identity_v2();

create or replace function private.enforce_wa_akg_contact_identity_outreach_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_lead public.leads%rowtype;
begin
  if coalesce(new.channel, '') <> 'whatsapp' or coalesce(new.payload ->> 'manual', 'false') = 'true' then
    return new;
  end if;

  select * into v_lead
    from public.leads l
   where l.id = new.lead_id
     and l.organization_id = new.organization_id;
  if not found then
    return new;
  end if;

  if private.wa_akg_bound_lead_requires_protection(new.organization_id, v_lead.id)
     or private.wa_akg_contact_requires_protection(
    new.organization_id,
    v_lead.whatsapp_account_id,
    coalesce(v_lead.whatsapp_identity, v_lead.phone_identity, v_lead.whatsapp, v_lead.phone),
    v_lead.source_metadata
  ) then
    new.status := 'cancelled';
    new.processed_at := coalesce(new.processed_at, pg_catalog.now());
    new.error := 'contact_protection_required';
  end if;
  return new;
end;
$function$;

-- Same replacement for the v1 outreach guard: its source is the legacy public
-- directory, while v2 decisions live in the private canonical policy.
drop trigger if exists outreach_jobs_wa_akg_contact_protection on public.outreach_jobs;
drop trigger if exists outreach_jobs_wa_akg_contact_identity_v2 on public.outreach_jobs;
create trigger outreach_jobs_wa_akg_contact_identity_v2
before insert or update on public.outreach_jobs
for each row execute function private.enforce_wa_akg_contact_identity_outreach_v2();

-- The durable Ana queue is server-side and can be called by a service role.
-- Put the same contact fence at the table boundary so a caller cannot bypass
-- `begin_whatsapp_inbound_dispatch` merely by inserting a job directly.
create or replace function private.enforce_wa_akg_contact_identity_ana_job_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_lead public.leads%rowtype;
begin
  if coalesce(new.modo, '') <> 'ia' then
    return new;
  end if;

  select * into v_lead
    from public.leads l
   where l.id = new.lead_id
     and l.organization_id = new.organization_id;
  if not found then
    raise exception 'ana_job_lead_not_found';
  end if;

  if v_lead.ai_paused
     or v_lead.modo_atendimento = 'humano'
     or v_lead.automation_status = 'human'
     or coalesce(v_lead.contact_approval_status, '') <> 'approved'
     or private.wa_akg_bound_lead_requires_protection(new.organization_id, v_lead.id)
     or private.wa_akg_contact_requires_protection(
       new.organization_id,
       v_lead.whatsapp_account_id,
       coalesce(v_lead.whatsapp_identity, v_lead.phone_identity, v_lead.whatsapp, v_lead.phone),
       v_lead.source_metadata
     ) then
    new.status := 'cancelled';
    new.lease_id := null;
    new.lease_expires_at := null;
    new.completed_at := coalesce(new.completed_at, pg_catalog.now());
    new.last_error_code := 'ana_contact_protection_required';
    new.last_error_message := 'A automação foi bloqueada até a classificação explícita do contato.';
    return new;
  end if;

  return new;
end;
$function$;

do $ana_queue_guard$
begin
  if to_regclass('public.ana_jobs') is not null then
    execute 'drop trigger if exists ana_jobs_wa_akg_contact_identity_v2 on public.ana_jobs';
    execute $trigger$
      create trigger ana_jobs_wa_akg_contact_identity_v2
      before insert or update of lead_id, modo, status on public.ana_jobs
      for each row execute function private.enforce_wa_akg_contact_identity_ana_job_v2()
    $trigger$;
  else
    raise notice 'wa_akg_contact_identity_v2: ana_jobs is absent; queue fence will be installed when the durable Ana queue migration is applied first';
  end if;
end;
$ana_queue_guard$;

-- Current remote resolver contract, redefined from the deployed signature.  It
-- does not read stale local persist logic: policy creation, locking and name
-- resolution happen here before confirmed-agenda protection is evaluated.
create or replace function public.resolve_or_create_whatsapp_inbound_lead(
  p_organization_id uuid,
  p_account_id uuid,
  p_phone text,
  p_message text,
  p_occurred_at timestamptz
)
returns table(lead_id uuid, reason text, created boolean)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  resolved record;
  policy_row private.wa_akg_contact_policy%rowtype;
  created_lead public.leads%rowtype;
  account_owner uuid;
  site_entry_id uuid;
  site_source_label text;
  identity text;
  canonical_phone text := public.normalize_phone_identity(p_phone);
  lock_identity text := private.wa_akg_contact_policy_lock_key(p_phone);
  site_entry_code text;
  occurred_at timestamptz := coalesce(p_occurred_at, pg_catalog.now());
  contact_name text;
  v_alias_lead_id uuid;
  v_alias_lead_count integer := 0;
  v_legacy_shell_marker boolean := false;
  v_protection_required boolean := false;
  v_resolved_lead_id uuid;
  v_resolution_reason text := 'not_found';
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'whatsapp_inbound_contact_access_denied';
  end if;
  if canonical_phone is null or canonical_phone !~ '^[1-9][0-9]{7,14}$' then
    return query select null::uuid, 'invalid_phone'::text, false;
    return;
  end if;

  select owner_user_id into account_owner
    from public.whatsapp_accounts
   where id = p_account_id
     and organization_id = p_organization_id
     and provider = 'wa_akg'
     and archived_at is null;
  if not found then
    return query select null::uuid, 'account_not_found'::text, false;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'wa-akg-contact-policy:' || p_organization_id::text || ':' || p_account_id::text || ':' || coalesce(lock_identity, canonical_phone),
    0
  ));

  select * into resolved
    from private.wa_akg_resolve_contact_policy_identity(p_organization_id, p_account_id, canonical_phone)
   limit 1;
  if coalesce(resolved.ambiguous, false) then
    return query select null::uuid, 'ambiguous_identity'::text, false;
    return;
  end if;

  if resolved.phone_identity is null then
    insert into private.wa_akg_contact_policy (
      organization_id, whatsapp_account_id, phone_identity, classification_state,
      evidence_state, first_seen_at, last_seen_at
    ) values (
      p_organization_id, p_account_id, canonical_phone, 'unclassified',
      'unverified', occurred_at, occurred_at
    ) on conflict do nothing;
    resolved.phone_identity := canonical_phone;
  end if;

  select * into policy_row
    from private.wa_akg_contact_policy p
   where p.organization_id = p_organization_id
     and p.whatsapp_account_id = p_account_id
     and p.phone_identity = resolved.phone_identity
   for update;
  if not found then
    return query select null::uuid, 'policy_not_found'::text, false;
    return;
  end if;

  update private.wa_akg_contact_policy
     set last_seen_at = greatest(last_seen_at, occurred_at), updated_at = pg_catalog.now()
   where organization_id = p_organization_id
     and whatsapp_account_id = p_account_id
     and phone_identity = policy_row.phone_identity;

  -- A canonical policy binding is stronger than a legacy lead lookup.  In
  -- particular, an 8/9-digit alias must reuse this lead before the generic
  -- resolver gets an opportunity to create a second shell.
  if policy_row.lead_id is not null then
    -- A historical directory binding is reusable only when it still proves
    -- this account-scoped identity. Do not carry a stale or cross-account
    -- policy reference into a new conversation.
    select l.id
      into v_resolved_lead_id
      from public.leads l
     where l.id = policy_row.lead_id
       and l.organization_id = p_organization_id
       and l.archived_at is null
       and l.whatsapp_account_id = p_account_id
       and public.normalize_phone_identity(
         coalesce(l.whatsapp_identity, l.phone_identity, l.whatsapp, l.phone)
       ) in (
         select variant.phone_identity
           from private.wa_akg_phone_identity_variants(policy_row.phone_identity) variant
       )
     limit 1;
    if not found then
      return query select null::uuid, 'policy_lead_invalid'::text, false;
      return;
    end if;
    v_resolution_reason := 'policy_identity';
  else
    select count(*) into v_alias_lead_count
      from public.leads lead
     where lead.organization_id = p_organization_id
       and lead.whatsapp_account_id = p_account_id
       and lead.archived_at is null
       and public.normalize_phone_identity(coalesce(lead.whatsapp_identity, lead.phone_identity, lead.whatsapp, lead.phone)) in (
         select variant.phone_identity
           from private.wa_akg_phone_identity_variants(policy_row.phone_identity) variant
       );
    if v_alias_lead_count > 1 then
      return query select null::uuid, 'ambiguous_identity'::text, false;
      return;
    elsif v_alias_lead_count = 1 then
      select lead.id into v_alias_lead_id
        from public.leads lead
       where lead.organization_id = p_organization_id
         and lead.whatsapp_account_id = p_account_id
         and lead.archived_at is null
         and public.normalize_phone_identity(coalesce(lead.whatsapp_identity, lead.phone_identity, lead.whatsapp, lead.phone)) in (
           select variant.phone_identity
             from private.wa_akg_phone_identity_variants(policy_row.phone_identity) variant
         )
       limit 1;
      select v_alias_lead_id as lead_id, 'policy_alias_identity'::text as reason
        into v_resolved_lead_id, v_resolution_reason;
    else
      select candidate.lead_id, candidate.reason
        into v_resolved_lead_id, v_resolution_reason
        from public.resolve_whatsapp_lead_for_account(p_organization_id, p_account_id, policy_row.phone_identity)
          as candidate
       limit 1;
    end if;
  end if;
  if coalesce(v_resolution_reason, 'not_found') not in ('not_found', 'account_history_identity') and v_resolved_lead_id is null then
    return query select null::uuid, coalesce(v_resolution_reason, 'not_found')::text, false;
    return;
  end if;

  if v_resolved_lead_id is not null then
    select coalesce(lead.source_metadata ->> 'wa_akg_contact_only', 'false') = 'true'
      into v_legacy_shell_marker
      from public.leads lead
     where lead.id = v_resolved_lead_id
       and lead.organization_id = p_organization_id;
    if policy_row.contact_only
       or policy_row.classification_state = 'agenda_protected'
       or (policy_row.classification_state = 'unclassified' and policy_row.agenda_sync_confirmed)
       or (policy_row.classification_state <> 'lead_authorized' and v_legacy_shell_marker) then
      update public.leads
         set contact = case
               when coalesce(lower(btrim(contact)), '') in ('', 'lead', 'contato não identificado', 'contato nao identificado', 'contato whatsapp', 'novo contato', 'contato não informado', 'contato nao informado')
                 then private.wa_akg_preferred_contact_name(p_organization_id, p_account_id, policy_row.phone_identity, contact)
               else contact end,
             modo_atendimento = 'humano',
             ai_paused = true,
             automation_status = 'human',
             contact_approval_status = 'pending',
             contact_approval_reason = 'Contato protegido; aguarda classificação explícita.',
             contact_approved_at = null,
             contact_approved_by = null,
             source_metadata = coalesce(source_metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object(
               'wa_akg_contact_only', true,
               'wa_akg_contact_state', policy_row.classification_state,
               'wa_akg_contact_identity', policy_row.phone_identity
             ),
             updated_at = pg_catalog.now()
       where id = v_resolved_lead_id
         and organization_id = p_organization_id;
    end if;
    update private.wa_akg_contact_policy
       set lead_id = coalesce(lead_id, v_resolved_lead_id),
           contact_only = contact_only or (
             classification_state <> 'lead_authorized' and v_legacy_shell_marker
           ),
           updated_at = pg_catalog.now()
     where organization_id = p_organization_id
       and whatsapp_account_id = p_account_id
       and phone_identity = policy_row.phone_identity;
    return query select v_resolved_lead_id, coalesce(v_resolution_reason, 'existing_lead')::text, false;
    return;
  end if;

  if policy_row.classification_state = 'lead_authorized' then
    return query select null::uuid, 'authorized_policy_lead_missing'::text, false;
    return;
  end if;

  -- Only a confirmed agenda identity (or an explicit historical keep) becomes
  -- contact-only. An unknown external inbound is factual "Novo contato": it
  -- has no popup and follows the normal inbound/automation gates. Marking it
  -- contact-only here would permanently suppress valid commercial automation.
  v_protection_required := policy_row.contact_only
    or policy_row.classification_state = 'agenda_protected'
    or (policy_row.classification_state = 'unclassified' and policy_row.agenda_sync_confirmed);
  if v_protection_required then
    update private.wa_akg_contact_policy
       set contact_only = true,
           updated_at = pg_catalog.now()
     where organization_id = p_organization_id
       and whatsapp_account_id = p_account_id
       and phone_identity = policy_row.phone_identity
     returning * into policy_row;
  end if;

  site_entry_code := pg_catalog.upper((pg_catalog.regexp_match(
    coalesce(p_message, ''), '\[WF:([a-z0-9]{8,32})\]', 'i'
  ))[1]);
  if site_entry_code is not null then
    select entry.id, entry.source_label into site_entry_id, site_source_label
      from public.whatsapp_site_entries as entry
     where entry.organization_id = p_organization_id
       and entry.entry_code = site_entry_code
       and entry.active = true
     limit 1;
  end if;

  contact_name := private.wa_akg_preferred_contact_name(p_organization_id, p_account_id, policy_row.phone_identity, null);
  identity := 'whatsapp:' || policy_row.phone_identity;
  insert into public.leads (
    organization_id, company, contact, phone, whatsapp, segment, score, temp,
    owner, owner_id, assigned_to, origin, active_channel, whatsapp_account_id,
    contact_approval_status, contact_approval_reason, contact_approved_at,
    first_inbound_at, last_contact, modo_atendimento, ai_paused,
    automation_status, source_record_id, source_metadata,
    deduplication_key, prospect_identity
  ) values (
    p_organization_id,
    case when v_protection_required then 'Contato da agenda'
         when site_entry_id is not null then 'Contato do site'
         else 'Novo contato' end,
    contact_name, policy_row.phone_identity, policy_row.phone_identity, 'WhatsApp', 0, 'warm',
    case when v_protection_required then 'humano' else 'ia' end, account_owner, account_owner,
    coalesce(site_source_label, 'WhatsApp recebido'), 'whatsapp', p_account_id,
    case when v_protection_required then 'pending' else 'approved' end,
    case when v_protection_required
      then 'Contato protegido; aguarda classificação explícita.'
      else 'Contato iniciou uma conversa individual pelo WhatsApp.' end,
    case when v_protection_required then null else occurred_at end,
    occurred_at, occurred_at,
    case when v_protection_required then 'humano' else 'ia' end,
    v_protection_required,
    case when v_protection_required then 'human' else 'running' end,
    case when v_protection_required
      then 'wa_akg-contact-shell:' || p_account_id::text || ':' || policy_row.phone_identity
      else 'wa_akg-inbound:' || p_account_id::text || ':' || policy_row.phone_identity end,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'source', case
        when v_protection_required then 'wa_akg_contact_shell'
        when site_entry_id is not null then 'website_whatsapp'
        else 'wa_akg_inbound' end,
      'website_entry_id', site_entry_id,
      'receiving_whatsapp_account_id', p_account_id,
      'wa_akg_contact_only', case when v_protection_required then true else null end,
      'wa_akg_contact_state', case when v_protection_required then policy_row.classification_state else null end,
      'wa_akg_contact_identity', case when v_protection_required then policy_row.phone_identity else null end
    )),
    case when v_protection_required
      then 'wa_akg-contact-shell:' || p_account_id::text || ':' || policy_row.phone_identity
      else 'wa_akg-inbound:' || p_account_id::text || ':' || policy_row.phone_identity end,
    identity
  ) returning * into created_lead;

  insert into public.lead_whatsapp_account_bindings (
    organization_id, lead_id, whatsapp_account_id, reason
  ) values (
    p_organization_id, created_lead.id, p_account_id,
    case when v_protection_required then 'wa_akg_contact_policy_shell' else 'wa_akg_inbound_lead' end
  ) on conflict do nothing;

  update private.wa_akg_contact_policy
     set lead_id = created_lead.id,
         contact_only = case when v_protection_required then true else contact_only end,
         inbound_lead_created = inbound_lead_created or not v_protection_required,
         updated_at = pg_catalog.now()
   where organization_id = p_organization_id
     and whatsapp_account_id = p_account_id
     and phone_identity = policy_row.phone_identity;

  return query select created_lead.id,
    case when v_protection_required then 'agenda_contact_shell_created' else 'external_inbound_lead_created' end,
    true;
end;
$function$;

revoke all on function public.resolve_or_create_whatsapp_inbound_lead(uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.resolve_or_create_whatsapp_inbound_lead(uuid, uuid, text, text, timestamptz) to service_role;

-- Current remote persist contract, now with a durable conversation and factual
-- sender name.  The inbound worker still owns the lease and idempotency; this
-- function merely persists inside that already-locked transaction.
create or replace function public.persist_whatsapp_inbound(
  p_provider text,
  p_event_id uuid,
  p_lease_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  t text := private.whatsapp_event_table(p_provider);
  e record;
  w private.whatsapp_inbound_work%rowtype;
  r record;
  l public.leads%rowtype;
  policy_result record;
  identity_result record;
  p jsonb;
  phone text;
  canonical_phone text;
  mid text;
  raw_body text;
  body text;
  at timestamptz;
  ext text;
  external_conversation text;
  inbound uuid;
  message uuid;
  conversation uuid;
  existing_inbound public.channel_inbound_events%rowtype;
  existing_message public.lead_messages%rowtype;
  existing_conversation public.whatsapp_conversations%rowtype;
  conversation_candidate_count integer := 0;
  message_inserted boolean := false;
  media jsonb;
  display_name text;
  protection_required boolean := false;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('whatsapp-event:' || p_provider || ':' || p_event_id::text, 0));
  select * into w from private.whatsapp_inbound_work where provider = p_provider and event_id = p_event_id for update;
  if w.event_id is null or p_lease_id is null or w.lease_id is distinct from p_lease_id
     or w.lease_expires_at <= pg_catalog.now() or w.phase not in ('received', 'persisted') then
    raise exception 'whatsapp_event_lease_lost';
  end if;
  execute pg_catalog.format('select * from public.%I where id=$1 and organization_id=$2 and processing_status=''processing''', t)
    into e using p_event_id, w.organization_id;
  if e.id is null or e.event_kind <> 'inbound' or e.whatsapp_account_id <> w.account_id then
    raise exception 'whatsapp_inbound_scope_invalid';
  end if;

  p := e.sanitized_payload;
  phone := p ->> 'phone';
  mid := p ->> 'message_id';
  raw_body := p ->> 'text';
  media := p -> 'media';
  if coalesce(phone, '') !~ '^[1-9][0-9]{7,14}$'
     or coalesce(p ->> 'remote_jid', '') !~ '^[1-9][0-9]{7,14}(:[0-9]{1,5})?@(s\.whatsapp\.net|c\.us)$'
     or pg_catalog.split_part(pg_catalog.split_part(p ->> 'remote_jid', '@', 1), ':', 1) <> phone then
    perform public.finish_whatsapp_webhook_event(p_provider, p_event_id, p_lease_id, 'needs_review', 'sender_identity_unresolved');
    return pg_catalog.jsonb_build_object('review', true, 'reason', 'sender_identity_unresolved');
  end if;
  if coalesce(mid, '') = '' or pg_catalog.length(mid) > 300 or coalesce(raw_body, '') = '' then
    raise exception 'whatsapp_inbound_payload_invalid';
  end if;
  -- A maintenance capture may start after a worker has claimed the event.
  -- Do not persist that in-flight callback or let it reach Ana; surface it for
  -- review rather than retrying it automatically after the maintenance window.
  if p_provider = 'wa_akg' and exists (
    select 1
      from public.messaging_provider_controls control_row
     where control_row.organization_id = w.organization_id
       and control_row.provider = 'wa_akg'
       and control_row.capture_only
  ) then
    perform public.finish_whatsapp_webhook_event(
      p_provider, p_event_id, p_lease_id, 'needs_review', 'wa_akg_capture_only'
    );
    return pg_catalog.jsonb_build_object('review', true, 'reason', 'wa_akg_capture_only');
  end if;
  if not exists (
    select 1
      from public.whatsapp_accounts a
      join public.integrations i on i.id = a.integration_id and i.organization_id = a.organization_id
      join public.messaging_provider_controls c on c.organization_id = a.organization_id and c.provider = a.provider
     where a.id = w.account_id
       and a.organization_id = w.organization_id
       and a.provider = p_provider
       and a.enabled
       and a.archived_at is null
       and a.connection_status = 'connected'
       and i.enabled and i.connected and not i.paused
       and c.inbound_enabled and not c.kill_switch
  ) then
    perform public.finish_whatsapp_webhook_event(p_provider, p_event_id, p_lease_id, 'ignored', 'whatsapp_inbound_route_disabled');
    return pg_catalog.jsonb_build_object('review', true, 'reason', 'whatsapp_inbound_route_disabled');
  end if;
  if w.phase = 'persisted' then
    return pg_catalog.jsonb_build_object('lead_id', w.lead_id, 'inbound_id', w.inbound_id, 'message_id', w.message_id, 'persisted', true);
  end if;

  at := coalesce(nullif(p ->> 'occurred_at', '')::timestamptz, nullif(p ->> 'timestamp', '')::timestamptz, e.occurred_at, pg_catalog.now());
  select * into r from public.resolve_or_create_whatsapp_inbound_lead(w.organization_id, w.account_id, phone, raw_body, at) limit 1;
  if r.lead_id is null then
    perform public.finish_whatsapp_webhook_event(
      p_provider, p_event_id, p_lease_id, 'needs_review',
      case when r.reason = 'ambiguous_identity' then 'lead_identity_ambiguous' else 'lead_not_matched' end
    );
    return pg_catalog.jsonb_build_object('review', true, 'reason', coalesce(r.reason, 'lead_not_matched'));
  end if;
  select * into strict l from public.leads where id = r.lead_id and organization_id = w.organization_id for update;

  select * into identity_result
    from private.wa_akg_resolve_contact_policy_identity(w.organization_id, w.account_id, phone)
   limit 1;
  canonical_phone := coalesce(identity_result.phone_identity, public.normalize_phone_identity(phone));
  if canonical_phone is null or coalesce(identity_result.ambiguous, false) then
    perform public.finish_whatsapp_webhook_event(p_provider, p_event_id, p_lease_id, 'needs_review', 'lead_identity_ambiguous');
    return pg_catalog.jsonb_build_object('review', true, 'reason', 'ambiguous_identity');
  end if;
  select * into policy_result
    from private.resolve_wa_akg_contact_policy(w.organization_id, w.account_id, canonical_phone)
   limit 1;
  protection_required := private.wa_akg_bound_lead_requires_protection(w.organization_id, l.id)
    or private.wa_akg_contact_requires_protection(
      w.organization_id,
      w.account_id,
      canonical_phone,
      l.source_metadata
    );
  display_name := private.wa_akg_preferred_contact_name(
    w.organization_id,
    w.account_id,
    canonical_phone,
    coalesce(p ->> 'sender_name', p ->> 'push_name', p ->> 'pushName')
  );

  body := pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.regexp_replace(raw_body, '\s*\[WF:[a-z0-9]{8,32}\]\s*', ' ', 'gi'), '\s{2,}', ' ', 'g'));
  if body = '' then body := raw_body; end if;
  p := pg_catalog.jsonb_set(p, '{text}', pg_catalog.to_jsonb(body), true);
  ext := 'message:' || w.account_id::text || ':' || mid;

  insert into public.channel_inbound_events(organization_id, whatsapp_account_id, provider, event_type, external_id, lead_id, payload, status, error, processed_at)
    values(w.organization_id, w.account_id, p_provider, 'message', ext, l.id, p, 'received', null, null)
    on conflict do nothing returning id into inbound;
  if inbound is null then
    select * into existing_inbound
      from public.channel_inbound_events event
     where organization_id = w.organization_id and whatsapp_account_id = w.account_id
       and provider = p_provider and external_id = ext
     for update;
    if not found or existing_inbound.lead_id is distinct from l.id then
      perform public.finish_whatsapp_webhook_event(p_provider, p_event_id, p_lease_id, 'needs_review', 'inbound_lead_conflict');
      return pg_catalog.jsonb_build_object('review', true, 'reason', 'inbound_lead_conflict');
    end if;
    inbound := existing_inbound.id;
  end if;

  -- Check the natural provider-message key before creating or mutating a
  -- conversation.  A historical collision must be reviewed, never allowed to
  -- create an orphan conversation for a different lead on retry.
  select * into existing_message
    from public.lead_messages existing
   where existing.organization_id = w.organization_id
     and existing.whatsapp_account_id = w.account_id
     and existing.provider = p_provider
     and existing.provider_message_id = mid
   for update;
  if found then
    if existing_message.lead_id is distinct from l.id
       or existing_message.sender is distinct from 'lead' then
      perform public.finish_whatsapp_webhook_event(p_provider, p_event_id, p_lease_id, 'needs_review', 'message_lead_conflict');
      return pg_catalog.jsonb_build_object('review', true, 'reason', 'message_lead_conflict');
    end if;
    if existing_message.conversation_id is not null then
      select * into existing_conversation
        from public.whatsapp_conversations conversation_row
       where conversation_row.id = existing_message.conversation_id
         and conversation_row.organization_id = w.organization_id
         and conversation_row.whatsapp_account_id = w.account_id
       for update;
      if not found
         or not (
           existing_conversation.external_conversation_id in (
             select 'wa_akg:' || variant.phone_identity
               from private.wa_akg_phone_identity_variants(canonical_phone) variant
           )
           or existing_conversation.customer_phone_identity in (
             select variant.phone_identity
               from private.wa_akg_phone_identity_variants(canonical_phone) variant
           )
         ) then
        perform public.finish_whatsapp_webhook_event(p_provider, p_event_id, p_lease_id, 'needs_review', 'message_conversation_conflict');
        return pg_catalog.jsonb_build_object('review', true, 'reason', 'message_conversation_conflict');
      end if;
    end if;
  end if;

  external_conversation := 'wa_akg:' || canonical_phone;
  -- Serialize both 8/9-digit representations to the same conversation key.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'wa-akg-conversation:' || w.organization_id::text || ':' || w.account_id::text || ':' || private.wa_akg_contact_policy_lock_key(canonical_phone),
    0
  ));
  select count(*)
    into conversation_candidate_count
    from public.whatsapp_conversations c
   where c.organization_id = w.organization_id
     and c.whatsapp_account_id = w.account_id
     and (
       c.external_conversation_id in (
         select 'wa_akg:' || variant.phone_identity
           from private.wa_akg_phone_identity_variants(canonical_phone) variant
       )
       or c.customer_phone_identity in (
         select variant.phone_identity
           from private.wa_akg_phone_identity_variants(canonical_phone) variant
       )
     );
  if conversation_candidate_count > 1 then
    perform public.finish_whatsapp_webhook_event(p_provider, p_event_id, p_lease_id, 'needs_review', 'conversation_identity_ambiguous');
    return pg_catalog.jsonb_build_object('review', true, 'reason', 'conversation_identity_ambiguous');
  end if;
  if conversation_candidate_count = 1 then
    select c.id into strict conversation
      from public.whatsapp_conversations c
     where c.organization_id = w.organization_id
       and c.whatsapp_account_id = w.account_id
       and (
         c.external_conversation_id in (
           select 'wa_akg:' || variant.phone_identity
             from private.wa_akg_phone_identity_variants(canonical_phone) variant
         )
         or c.customer_phone_identity in (
           select variant.phone_identity
             from private.wa_akg_phone_identity_variants(canonical_phone) variant
         )
       );
    select * into strict existing_conversation
      from public.whatsapp_conversations c
     where c.id = conversation
       and c.organization_id = w.organization_id
       and c.whatsapp_account_id = w.account_id
     for update;
    if existing_conversation.lead_id is not null and existing_conversation.lead_id <> l.id then
      perform public.finish_whatsapp_webhook_event(p_provider, p_event_id, p_lease_id, 'needs_review', 'conversation_lead_conflict');
      return pg_catalog.jsonb_build_object('review', true, 'reason', 'conversation_lead_conflict');
    end if;
  else
    insert into public.whatsapp_conversations(
      organization_id, whatsapp_account_id, lead_id, owner_user_id,
      external_conversation_id, customer_phone_identity, status,
      unread_count, metadata
    ) values (
      w.organization_id, w.account_id, l.id, coalesce(l.assigned_to, l.owner_id),
      external_conversation, canonical_phone,
      case when protection_required then 'waiting_human' else 'open' end,
      0,
      pg_catalog.jsonb_build_object('provider', 'wa_akg', 'display_name', display_name, 'contact_policy_state', policy_result.state)
    ) on conflict do nothing returning id into conversation;
    if conversation is null then
      select count(*)
        into conversation_candidate_count
        from public.whatsapp_conversations c
       where c.organization_id = w.organization_id
         and c.whatsapp_account_id = w.account_id
         and (
           c.external_conversation_id in (
             select 'wa_akg:' || variant.phone_identity
               from private.wa_akg_phone_identity_variants(canonical_phone) variant
           )
           or c.customer_phone_identity in (
             select variant.phone_identity
               from private.wa_akg_phone_identity_variants(canonical_phone) variant
           )
         );
      if conversation_candidate_count <> 1 then
        perform public.finish_whatsapp_webhook_event(p_provider, p_event_id, p_lease_id, 'needs_review', 'conversation_identity_ambiguous');
        return pg_catalog.jsonb_build_object('review', true, 'reason', 'conversation_identity_ambiguous');
      end if;
      select c.id into strict conversation
        from public.whatsapp_conversations c
       where c.organization_id = w.organization_id
         and c.whatsapp_account_id = w.account_id
         and (
           c.external_conversation_id in (
             select 'wa_akg:' || variant.phone_identity
               from private.wa_akg_phone_identity_variants(canonical_phone) variant
           )
           or c.customer_phone_identity in (
             select variant.phone_identity
               from private.wa_akg_phone_identity_variants(canonical_phone) variant
           )
         );
      select * into strict existing_conversation
        from public.whatsapp_conversations c
       where c.id = conversation
         and c.organization_id = w.organization_id
         and c.whatsapp_account_id = w.account_id
       for update;
      if existing_conversation.lead_id is not null and existing_conversation.lead_id <> l.id then
        perform public.finish_whatsapp_webhook_event(p_provider, p_event_id, p_lease_id, 'needs_review', 'conversation_lead_conflict');
        return pg_catalog.jsonb_build_object('review', true, 'reason', 'conversation_lead_conflict');
      end if;
    end if;
  end if;

  insert into public.lead_messages(
    organization_id, lead_id, conversation_id, whatsapp_account_id, sender, sender_name,
    type, text, sent_at, provider, message_origin, provider_message_id, provider_occurred_at
  ) values (
    w.organization_id, l.id, conversation, w.account_id, 'lead', display_name,
    'received', body, at, p_provider, 'customer', mid, at
  ) on conflict do nothing returning id into message;
  if message is null then
    select * into existing_message
      from public.lead_messages existing
     where organization_id = w.organization_id and whatsapp_account_id = w.account_id
       and provider = p_provider and provider_message_id = mid
     for update;
    if not found
       or existing_message.lead_id is distinct from l.id
       or existing_message.sender is distinct from 'lead'
       or (existing_message.conversation_id is not null and existing_message.conversation_id <> conversation) then
      perform public.finish_whatsapp_webhook_event(p_provider, p_event_id, p_lease_id, 'needs_review', 'message_lead_conflict');
      return pg_catalog.jsonb_build_object('review', true, 'reason', 'message_lead_conflict');
    end if;
    message := existing_message.id;
    update public.lead_messages
       set conversation_id = coalesce(conversation_id, conversation),
           sender_name = case when coalesce(lower(btrim(sender_name)), '') in ('', 'lead', 'contato não identificado', 'contato nao identificado') then display_name else sender_name end
     where id = message and organization_id = w.organization_id;
  else
    message_inserted := true;
  end if;

  -- Only a newly inserted provider message changes unread state or conversation
  -- timestamps.  A webhook retry that hits the unique message key is a no-op.
  if message_inserted then
    update public.whatsapp_conversations
       set lead_id = coalesce(lead_id, l.id),
           owner_user_id = coalesce(owner_user_id, l.assigned_to, l.owner_id),
           customer_phone_identity = canonical_phone,
           status = case when protection_required then 'waiting_human' else status end,
           last_inbound_at = greatest(coalesce(last_inbound_at, at), at),
           last_message_at = greatest(coalesce(last_message_at, at), at),
           unread_count = unread_count + 1,
           metadata = coalesce(metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object(
             'provider', 'wa_akg', 'display_name', display_name, 'contact_policy_state', policy_result.state
           ),
           updated_at = pg_catalog.now()
     where id = conversation
       and organization_id = w.organization_id
       and whatsapp_account_id = w.account_id;
  end if;

  if media ->> 'kind' in ('image', 'audio', 'video', 'document') and media ->> 'url' like 'https://%' then
    insert into public.message_attachments(organization_id, lead_id, message_id, media_type, mime_type, file_name, external_url)
      values(w.organization_id, l.id, message, media ->> 'kind', media ->> 'mimeType', media ->> 'fileName', media ->> 'url')
      on conflict do nothing;
  end if;

  if protection_required then
    update public.leads
       set first_inbound_at = coalesce(first_inbound_at, at),
           last_contact = greatest(last_contact, at),
           no_reply_deadline_at = null,
           no_reply_processed_at = null,
           contact = case when coalesce(lower(btrim(contact)), '') in ('', 'lead', 'contato não identificado', 'contato nao identificado', 'contato whatsapp', 'novo contato', 'contato não informado', 'contato nao informado') then display_name else contact end,
           modo_atendimento = 'humano',
           ai_paused = true,
           automation_status = 'human',
           contact_approval_status = 'pending',
           contact_approval_reason = 'Contato protegido; aguarda classificação explícita.',
           contact_approved_at = null,
           contact_approved_by = null,
           whatsapp_account_id = w.account_id,
           source_metadata = coalesce(source_metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object(
             'wa_akg_contact_only', true,
             'wa_akg_contact_state', coalesce(policy_result.state, 'unclassified'),
             'wa_akg_contact_identity', canonical_phone
           ),
           updated_at = pg_catalog.now()
     where id = l.id and organization_id = w.organization_id;
  else
    update public.leads
       set first_inbound_at = coalesce(first_inbound_at, at),
           last_contact = greatest(last_contact, at),
           no_reply_deadline_at = null,
           no_reply_processed_at = null,
           contact = case when coalesce(lower(btrim(contact)), '') in ('', 'lead', 'contato não identificado', 'contato nao identificado', 'contato whatsapp', 'novo contato', 'contato não informado', 'contato nao informado') then display_name else contact end,
           whatsapp_account_id = case when r.reason = 'account_history_identity' then whatsapp_account_id else w.account_id end,
           updated_at = pg_catalog.now()
     where id = l.id and organization_id = w.organization_id;
  end if;

  update public.outreach_jobs
     set status = 'cancelled', processed_at = at,
         error = case when protection_required then 'contact_protection_required' else 'cancelled_by_inbound_reply' end
   where organization_id = w.organization_id and lead_id = l.id and status in ('queued', 'retry')
     and coalesce(payload ->> 'manual', 'false') <> 'true';

  update private.whatsapp_inbound_work
     set phase = 'persisted', inbound_id = inbound, lead_id = l.id, message_id = message, updated_at = pg_catalog.now()
   where provider = p_provider and event_id = p_event_id;
  return pg_catalog.jsonb_build_object(
    'lead_id', l.id, 'conversation_id', conversation, 'inbound_id', inbound,
    'message_id', message, 'persisted', true, 'contact_protection_required', protection_required
  );
end;
$function$;

revoke all on function public.persist_whatsapp_inbound(text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.persist_whatsapp_inbound(text, uuid, uuid) to service_role;

-- Dispatch remains explicitly opt-in.  This is a second, backend-side fence so
-- a stale queue or a closed browser cannot cause Ana to act on a protected
-- contact after persistence.
create or replace function public.begin_whatsapp_inbound_dispatch(
  p_provider text,
  p_event_id uuid,
  p_lease_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  w private.whatsapp_inbound_work%rowtype;
  l public.leads%rowtype;
begin
  perform private.whatsapp_event_table(p_provider);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('whatsapp-event:' || p_provider || ':' || p_event_id::text, 0));
  select * into w from private.whatsapp_inbound_work where provider = p_provider and event_id = p_event_id for update;
  if w.event_id is null or p_lease_id is null or w.lease_id is distinct from p_lease_id
     or w.lease_expires_at <= pg_catalog.now() or w.phase <> 'persisted' then
    raise exception 'whatsapp_event_lease_lost';
  end if;
  select * into strict l from public.leads where id = w.lead_id and organization_id = w.organization_id;

  -- A callback may have been persisted immediately before capture was enabled.
  -- It remains visible to an operator, but no automated dispatch is permitted.
  if p_provider = 'wa_akg' and exists (
    select 1
      from public.messaging_provider_controls control_row
     where control_row.organization_id = w.organization_id
       and control_row.provider = 'wa_akg'
       and control_row.capture_only
  ) then
    return pg_catalog.jsonb_build_object('dispatch', false, 'reason', 'wa_akg_capture_only', 'lead_id', l.id);
  end if;

  if private.wa_akg_bound_lead_requires_protection(w.organization_id, l.id)
     or private.wa_akg_contact_requires_protection(
       w.organization_id,
       w.account_id,
       coalesce(l.whatsapp_identity, l.phone_identity, l.whatsapp, l.phone),
       l.source_metadata
     ) then
    return pg_catalog.jsonb_build_object('dispatch', false, 'reason', 'contact_protection_required', 'lead_id', l.id);
  end if;

  if l.opt_out or l.ai_paused or l.modo_atendimento = 'humano' or l.automation_status = 'human' or not exists(
    select 1
      from public.whatsapp_accounts a
      join public.integrations i on i.id = a.integration_id and i.organization_id = a.organization_id
      join public.messaging_provider_controls c on c.organization_id = a.organization_id and c.provider = a.provider
     where a.id = w.account_id and a.organization_id = w.organization_id and a.provider = p_provider
       and a.archived_at is null and a.enabled and a.connection_status = 'connected'
       and i.enabled and i.connected and not i.paused and not c.kill_switch
       and c.inbound_enabled and c.send_enabled and c.automation_enabled
  ) then
    return pg_catalog.jsonb_build_object('dispatch', false);
  end if;

  update private.whatsapp_inbound_work
     set phase = 'dispatching', updated_at = pg_catalog.now()
   where provider = p_provider and event_id = p_event_id;
  return pg_catalog.jsonb_build_object('dispatch', true, 'lead_id', l.id, 'mode', l.modo_atendimento);
end;
$function$;

revoke all on function public.begin_whatsapp_inbound_dispatch(text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.begin_whatsapp_inbound_dispatch(text, uuid, uuid) to service_role;

create or replace function public.central_get_pending_wa_akg_contact_decision()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_organization_id uuid := public.current_org_id();
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_organization_id is null or v_user_id is null then
    raise exception 'wa_akg_contact_decision_context_required';
  end if;

  select pg_catalog.jsonb_build_object(
    'pending', true,
    'account_id', candidate.whatsapp_account_id,
    'phone', candidate.phone_identity,
    'name', private.wa_akg_preferred_contact_name(v_organization_id, candidate.whatsapp_account_id, candidate.phone_identity, candidate.contact),
    'lead_id', candidate.lead_id,
    'message_id', candidate.message_id,
    'message_text', candidate.message_text,
    'latest_inbound_text', candidate.message_text,
    'received_at', candidate.sent_at,
    'state', candidate.classification_state,
    'decision_revision', candidate.decision_revision,
    'can_enable_ai', candidate.can_enable_ai
  ) into v_result
  from (
    select p.whatsapp_account_id, p.phone_identity, p.classification_state,
           p.decision_revision, l.id as lead_id, l.contact,
           m.id as message_id, m.text as message_text, m.sent_at,
           exists(
             select 1
               from public.whatsapp_accounts a
               join public.integrations i on i.id = a.integration_id and i.organization_id = a.organization_id
               join public.messaging_provider_controls c on c.organization_id = a.organization_id and c.provider = a.provider
               join public.company_settings cs on cs.organization_id = a.organization_id
              where a.id = p.whatsapp_account_id and a.organization_id = p.organization_id
                and a.provider = 'wa_akg' and a.enabled and a.archived_at is null
                and a.connection_status = 'connected'
                and i.enabled and i.connected and not i.paused
                and c.inbound_enabled and c.send_enabled and c.automation_enabled and not c.kill_switch
                and cs.active and cs.can_use_ia and cs.ai_actions_enabled
           ) and exists(
             select 1 from public.profiles profile
              where profile.id = coalesce(l.assigned_to, l.owner_id)
                and profile.active and profile.can_use_ia
           ) as can_enable_ai
      from private.wa_akg_contact_policy p
      join public.leads l on l.id = p.lead_id and l.organization_id = p.organization_id
      cross join lateral (
        select message.id, message.text, message.sent_at
          from public.lead_messages message
          join public.whatsapp_conversations conversation_row
            on conversation_row.id = message.conversation_id
           and conversation_row.organization_id = message.organization_id
           and conversation_row.whatsapp_account_id = message.whatsapp_account_id
         where message.organization_id = p.organization_id
           and message.lead_id = l.id
           and message.whatsapp_account_id = p.whatsapp_account_id
           and message.sender = 'lead'
           and (
             conversation_row.external_conversation_id in (
               select 'wa_akg:' || variant.phone_identity
                 from private.wa_akg_phone_identity_variants(p.phone_identity) variant
             )
             or conversation_row.customer_phone_identity in (
               select variant.phone_identity
                 from private.wa_akg_phone_identity_variants(p.phone_identity) variant
             )
           )
         order by message.sent_at desc nulls last, message.created_at desc
         limit 1
      ) m
     where p.organization_id = v_organization_id
       and p.classification_state = 'unclassified'
       and p.agenda_sync_confirmed is true
       and private.can_read_wa_akg_contact_directory(p.organization_id, p.whatsapp_account_id, v_user_id)
       and not exists (
         select 1
           from private.wa_akg_contact_decision_dismissals d
          where d.organization_id = p.organization_id
            and d.whatsapp_account_id = p.whatsapp_account_id
            and d.phone_identity = p.phone_identity
            and d.user_id = v_user_id
            and d.source_message_id = m.id
       )
     order by m.sent_at desc nulls last, p.last_seen_at desc
     limit 1
  ) candidate;

  return coalesce(v_result, pg_catalog.jsonb_build_object('pending', false));
end;
$function$;

revoke all on function public.central_get_pending_wa_akg_contact_decision() from public, anon;
grant execute on function public.central_get_pending_wa_akg_contact_decision() to authenticated, service_role;

create or replace function public.central_dismiss_wa_akg_contact_decision_prompt(
  p_account_id uuid,
  p_phone text,
  p_message_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_organization_id uuid := public.current_org_id();
  v_user_id uuid := auth.uid();
  v_resolved record;
  v_policy private.wa_akg_contact_policy%rowtype;
begin
  if v_organization_id is null or v_user_id is null or p_account_id is null or p_message_id is null then
    raise exception 'wa_akg_contact_decision_context_required';
  end if;
  if not private.can_read_wa_akg_contact_directory(v_organization_id, p_account_id, v_user_id) then
    raise exception 'wa_akg_contact_decision_access_denied';
  end if;
  select * into v_resolved
    from private.wa_akg_resolve_contact_policy_identity(v_organization_id, p_account_id, p_phone)
   limit 1;
  if coalesce(v_resolved.ambiguous, false) then
    raise exception 'wa_akg_contact_identity_ambiguous';
  end if;
  if v_resolved.phone_identity is null then
    raise exception 'wa_akg_contact_policy_not_found';
  end if;
  select * into v_policy
    from private.wa_akg_contact_policy p
   where p.organization_id = v_organization_id
     and p.whatsapp_account_id = p_account_id
     and p.phone_identity = v_resolved.phone_identity;
  if not found or v_policy.classification_state <> 'unclassified' or v_policy.agenda_sync_confirmed is not true then
    raise exception 'wa_akg_contact_decision_not_pending';
  end if;
  if not exists (
    select 1
      from public.lead_messages m
      join public.whatsapp_conversations conversation_row
        on conversation_row.id = m.conversation_id
       and conversation_row.organization_id = m.organization_id
       and conversation_row.whatsapp_account_id = m.whatsapp_account_id
     where m.id = p_message_id
       and m.organization_id = v_organization_id
       and m.lead_id = v_policy.lead_id
       and m.whatsapp_account_id = p_account_id
       and m.sender = 'lead'
       and (
         conversation_row.external_conversation_id in (
           select 'wa_akg:' || variant.phone_identity
             from private.wa_akg_phone_identity_variants(v_policy.phone_identity) variant
         )
         or conversation_row.customer_phone_identity in (
           select variant.phone_identity
             from private.wa_akg_phone_identity_variants(v_policy.phone_identity) variant
         )
       )
       and m.id = (
         select latest.id
           from public.lead_messages latest
           join public.whatsapp_conversations latest_conversation
             on latest_conversation.id = latest.conversation_id
            and latest_conversation.organization_id = latest.organization_id
            and latest_conversation.whatsapp_account_id = latest.whatsapp_account_id
          where latest.organization_id = v_organization_id
            and latest.lead_id = v_policy.lead_id
            and latest.whatsapp_account_id = p_account_id
            and latest.sender = 'lead'
            and (
              latest_conversation.external_conversation_id in (
                select 'wa_akg:' || variant.phone_identity
                  from private.wa_akg_phone_identity_variants(v_policy.phone_identity) variant
              )
              or latest_conversation.customer_phone_identity in (
                select variant.phone_identity
                  from private.wa_akg_phone_identity_variants(v_policy.phone_identity) variant
            )
            )
          order by latest.sent_at desc nulls last, latest.created_at desc
          limit 1
       )
  ) then
    raise exception 'wa_akg_contact_message_invalid';
  end if;

  insert into private.wa_akg_contact_decision_dismissals(
    organization_id, whatsapp_account_id, phone_identity, user_id, source_message_id
  ) values (
    v_organization_id, p_account_id, v_resolved.phone_identity, v_user_id, p_message_id
  ) on conflict do nothing;
  return pg_catalog.jsonb_build_object('dismissed', true, 'phone', v_resolved.phone_identity, 'message_id', p_message_id);
end;
$function$;

revoke all on function public.central_dismiss_wa_akg_contact_decision_prompt(uuid, text, uuid) from public, anon;
grant execute on function public.central_dismiss_wa_akg_contact_decision_prompt(uuid, text, uuid) to authenticated, service_role;

create or replace function public.decide_wa_akg_contact_v2(
  p_account_id uuid,
  p_phone text,
  p_decision text,
  p_owner_user_id uuid,
  p_initial_mode text,
  p_expected_revision bigint,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_organization_id uuid := public.current_org_id();
  v_user_id uuid := auth.uid();
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_initial_mode text := lower(btrim(coalesce(p_initial_mode, 'humano')));
  v_existing private.wa_akg_contact_decision_requests%rowtype;
  v_resolved record;
  v_policy private.wa_akg_contact_policy%rowtype;
  v_lead public.leads%rowtype;
  v_lead_id uuid;
  v_owner uuid;
  v_account_owner uuid;
  v_name text;
  v_ia_ready boolean := false;
  v_has_existing_lead boolean := false;
  v_alias_lead_id uuid;
  v_alias_lead_count integer := 0;
  v_response jsonb;
  v_actor_name text;
begin
  if v_organization_id is null or v_user_id is null or p_account_id is null or p_request_id is null then
    raise exception 'wa_akg_contact_decision_context_required';
  end if;
  if v_decision not in ('keep', 'promote') then
    raise exception 'wa_akg_contact_decision_invalid';
  end if;
  if v_initial_mode not in ('humano', 'ia') then
    raise exception 'wa_akg_contact_initial_mode_invalid';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'wa_akg_contact_decision_revision_required';
  end if;
  if not private.can_read_wa_akg_contact_directory(v_organization_id, p_account_id, v_user_id) then
    raise exception 'wa_akg_contact_decision_access_denied';
  end if;

  -- The request lock makes a retry idempotent even when it races a decision on
  -- a different policy row.  The policy lock below still serializes revisions
  -- for the same contact.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'wa-akg-contact-decision-request:' || p_request_id::text,
    0
  ));
  select * into v_existing
    from private.wa_akg_contact_decision_requests request
   where request.request_id = p_request_id;
  if found then
    if v_existing.organization_id <> v_organization_id or v_existing.actor_id <> v_user_id then
      raise exception 'wa_akg_contact_request_reused';
    end if;
    return v_existing.response;
  end if;

  select * into v_resolved
    from private.wa_akg_resolve_contact_policy_identity(v_organization_id, p_account_id, p_phone)
   limit 1;
  if coalesce(v_resolved.ambiguous, false) then
    raise exception 'wa_akg_contact_identity_ambiguous';
  end if;
  if v_resolved.phone_identity is null then
    raise exception 'wa_akg_contact_policy_not_found';
  end if;

  select * into v_policy
    from private.wa_akg_contact_policy policy
   where policy.organization_id = v_organization_id
     and policy.whatsapp_account_id = p_account_id
     and policy.phone_identity = v_resolved.phone_identity
   for update;
  if not found then
    raise exception 'wa_akg_contact_policy_not_found';
  end if;

  -- Re-read after FOR UPDATE.  A concurrent same-contact request may have
  -- committed while this call waited on the policy lock; return its persisted
  -- answer rather than turning a safe retry into a stale-revision error.
  select * into v_existing
    from private.wa_akg_contact_decision_requests request
   where request.request_id = p_request_id;
  if found then
    if v_existing.organization_id <> v_organization_id or v_existing.actor_id <> v_user_id then
      raise exception 'wa_akg_contact_request_reused';
    end if;
    return v_existing.response;
  end if;
  if v_policy.decision_revision <> p_expected_revision then
    raise exception 'wa_akg_contact_decision_stale_revision';
  end if;

  select owner_user_id into v_account_owner
    from public.whatsapp_accounts
   where id = p_account_id and organization_id = v_organization_id
     and provider = 'wa_akg' and archived_at is null;
  if v_account_owner is null then
    raise exception 'wa_akg_contact_account_not_found';
  end if;

  if v_decision = 'promote' then
    if p_owner_user_id is null or not exists (
      select 1
        from public.organization_members member
       where member.organization_id = v_organization_id
         and member.user_id = p_owner_user_id
         and member.status = 'active'
    ) then
      raise exception 'wa_akg_contact_owner_invalid';
    end if;
    v_owner := p_owner_user_id;
  else
    v_owner := coalesce(v_policy.decision_by, v_account_owner);
  end if;

  if v_decision = 'promote' and v_initial_mode = 'ia' then
    select exists(
      select 1
        from public.whatsapp_accounts a
        join public.integrations i on i.id = a.integration_id and i.organization_id = a.organization_id
        join public.messaging_provider_controls c on c.organization_id = a.organization_id and c.provider = a.provider
        join public.company_settings cs on cs.organization_id = a.organization_id
        join public.profiles profile on profile.id = v_owner
       where a.id = p_account_id and a.organization_id = v_organization_id
         and a.provider = 'wa_akg' and a.enabled and a.archived_at is null
         and a.connection_status = 'connected'
         and i.enabled and i.connected and not i.paused
         and c.inbound_enabled and c.send_enabled and c.automation_enabled and not c.kill_switch
         and cs.active and cs.can_use_ia and cs.ai_actions_enabled
         and profile.active and profile.can_use_ia
    ) into v_ia_ready;
    if not v_ia_ready then
      raise exception 'wa_akg_contact_ai_not_ready';
    end if;
  end if;

  v_lead_id := v_policy.lead_id;
  if v_lead_id is null then
    select count(*) into v_alias_lead_count
      from public.leads lead
     where lead.organization_id = v_organization_id
       and lead.whatsapp_account_id = p_account_id
       and lead.archived_at is null
       and public.normalize_phone_identity(coalesce(lead.whatsapp_identity, lead.phone_identity, lead.whatsapp, lead.phone)) in (
         select variant.phone_identity
           from private.wa_akg_phone_identity_variants(v_policy.phone_identity) variant
       );
    if v_alias_lead_count > 1 then
      raise exception 'wa_akg_contact_identity_ambiguous';
    elsif v_alias_lead_count = 1 then
      select lead.id into v_alias_lead_id
        from public.leads lead
       where lead.organization_id = v_organization_id
         and lead.whatsapp_account_id = p_account_id
         and lead.archived_at is null
         and public.normalize_phone_identity(coalesce(lead.whatsapp_identity, lead.phone_identity, lead.whatsapp, lead.phone)) in (
           select variant.phone_identity
             from private.wa_akg_phone_identity_variants(v_policy.phone_identity) variant
         )
       limit 1;
      select * into v_lead
        from public.leads lead
       where lead.id = v_alias_lead_id
         and lead.organization_id = v_organization_id
       for update;
      v_lead_id := v_lead.id;
      v_has_existing_lead := true;
    end if;
  else
    select * into v_lead from public.leads where id = v_lead_id and organization_id = v_organization_id for update;
    if not found then
      raise exception 'wa_akg_contact_policy_lead_invalid';
    end if;
    v_has_existing_lead := true;
  end if;

  -- Directory visibility alone is intentionally insufficient: this action
  -- writes a private policy, creates or changes a lead, and can cancel work.
  if v_lead_id is null then
    if not private.has_org_permission(v_organization_id, v_user_id, 'leads.create') then
      raise exception 'wa_akg_contact_lead_create_denied';
    end if;
  elsif not private.can_manage_lead(v_organization_id, v_lead_id, v_user_id) then
    raise exception 'wa_akg_contact_lead_manage_denied';
  end if;

  -- A creator may route a newly created contact to themselves.  Assigning a
  -- different owner, or changing an existing owner, requires the broader
  -- organization-level lead assignment privilege.
  if v_decision = 'promote'
     and v_owner is distinct from v_user_id
     and not private.has_org_permission(v_organization_id, v_user_id, 'leads.edit_all') then
    raise exception 'wa_akg_contact_owner_assignment_denied';
  end if;

  -- Publish under the locked policy row before changing the lead. The lead
  -- protection trigger consults this canonical row, so it cannot undo a v2
  -- promotion while the decision transaction is still in progress.
  update private.wa_akg_contact_policy
     set classification_state = case when v_decision = 'promote' then 'lead_authorized' else 'agenda_protected' end,
         evidence_state = 'operator_confirmed',
         contact_only = (v_decision <> 'promote'),
         lead_id = coalesce(v_lead_id, lead_id),
         decision_revision = decision_revision + 1,
         decision_by = v_user_id,
         decision_at = pg_catalog.now(),
         decision_reason = case when v_decision = 'promote' then 'Tornar lead' else 'Manter como contato' end,
         updated_at = pg_catalog.now()
   where organization_id = v_organization_id
     and whatsapp_account_id = p_account_id
     and phone_identity = v_policy.phone_identity
   returning decision_revision into v_policy.decision_revision;

  v_name := private.wa_akg_preferred_contact_name(
    v_organization_id,
    p_account_id,
    v_policy.phone_identity,
    case when v_has_existing_lead then v_lead.contact else null end
  );
  if v_lead_id is null then
    insert into public.leads(
      organization_id, company, contact, phone, whatsapp, owner, owner_id, assigned_to,
      active_channel, whatsapp_account_id, modo_atendimento, ai_paused, automation_status,
      contact_approval_status, contact_approval_reason, contact_approved_at,
      contact_approved_by, source_record_id, deduplication_key, prospect_identity, source_metadata
    ) values (
      v_organization_id,
      case when v_decision = 'keep' then 'Contato da agenda' else 'Novo contato' end,
      v_name, v_policy.phone_identity, v_policy.phone_identity, 'humano', v_owner, v_owner,
      'whatsapp', p_account_id,
      case when v_decision = 'promote' and v_initial_mode = 'ia' then 'ia' else 'humano' end,
      not (v_decision = 'promote' and v_initial_mode = 'ia'),
      case when v_decision = 'promote' and v_initial_mode = 'ia' then 'running' else 'human' end,
      case when v_decision = 'promote' then 'approved' else 'pending' end,
      case when v_decision = 'promote' then 'Lead autorizado manualmente a partir do contato.' else 'Contato protegido da agenda; atendimento humano.' end,
      case when v_decision = 'promote' then pg_catalog.now() else null end,
      case when v_decision = 'promote' then v_user_id else null end,
      'wa_akg-contact-shell:' || p_account_id::text || ':' || v_policy.phone_identity,
      'wa_akg-contact-shell:' || p_account_id::text || ':' || v_policy.phone_identity,
      'whatsapp:' || v_policy.phone_identity,
      case when v_decision = 'promote' then
        pg_catalog.jsonb_build_object('source', 'wa_akg_contact_decision', 'receiving_whatsapp_account_id', p_account_id)
      else
        pg_catalog.jsonb_build_object('source', 'wa_akg_contact_decision', 'receiving_whatsapp_account_id', p_account_id, 'wa_akg_contact_only', true, 'wa_akg_contact_state', 'agenda_protected', 'wa_akg_contact_identity', v_policy.phone_identity)
      end
    ) returning * into v_lead;
    v_lead_id := v_lead.id;
  end if;

  if v_decision = 'keep' then
    update public.leads
       set contact = case when coalesce(lower(btrim(contact)), '') in ('', 'lead', 'contato não identificado', 'contato nao identificado', 'contato whatsapp', 'novo contato', 'contato não informado', 'contato nao informado') then v_name else contact end,
           modo_atendimento = 'humano', ai_paused = true, automation_status = 'human',
           contact_approval_status = 'pending',
           contact_approval_reason = 'Contato protegido da agenda; atendimento humano.',
           contact_approved_at = null, contact_approved_by = null,
           source_metadata = coalesce(source_metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object(
             'wa_akg_contact_only', true, 'wa_akg_contact_state', 'agenda_protected',
             'wa_akg_contact_identity', v_policy.phone_identity
           ),
           updated_at = pg_catalog.now()
     where id = v_lead_id and organization_id = v_organization_id;
    update public.outreach_jobs
       set status = 'cancelled', processed_at = pg_catalog.now(), error = 'contact_protection_required'
     where organization_id = v_organization_id and lead_id = v_lead_id
       and status in ('queued', 'retry') and coalesce(payload ->> 'manual', 'false') <> 'true';
  else
    update public.leads
       set contact = case when coalesce(lower(btrim(contact)), '') in ('', 'lead', 'contato não identificado', 'contato nao identificado', 'contato whatsapp', 'novo contato', 'contato não informado', 'contato nao informado') then v_name else contact end,
           owner_id = v_owner, assigned_to = v_owner,
           modo_atendimento = case when v_initial_mode = 'ia' then 'ia' else 'humano' end,
           ai_paused = (v_initial_mode <> 'ia'),
           automation_status = case when v_initial_mode = 'ia' then 'running' else 'human' end,
           contact_approval_status = 'approved',
           contact_approval_reason = 'Lead autorizado manualmente a partir do contato.',
           contact_approved_at = coalesce(contact_approved_at, pg_catalog.now()),
           contact_approved_by = v_user_id,
           source_metadata = (coalesce(source_metadata, '{}'::jsonb) - 'wa_akg_contact_only' - 'wa_akg_contact_state' - 'wa_akg_contact_identity') || pg_catalog.jsonb_build_object(
             'source', 'wa_akg_contact_decision', 'receiving_whatsapp_account_id', p_account_id
           ),
           updated_at = pg_catalog.now()
     where id = v_lead_id and organization_id = v_organization_id;
  end if;

  update private.wa_akg_contact_policy
     set lead_id = v_lead_id,
         updated_at = pg_catalog.now()
   where organization_id = v_organization_id
     and whatsapp_account_id = p_account_id
     and phone_identity = v_policy.phone_identity;

  select coalesce(nullif(btrim(profile.name), ''), 'Usuário') into v_actor_name
    from public.profiles profile where profile.id = v_user_id;
  insert into public.audit_logs(
    organization_id, actor_id, actor_name, actor_type, action, detail,
    entity_table, entity_id, event_data
  ) values (
    v_organization_id, v_user_id, coalesce(v_actor_name, 'Usuário'), 'user',
    'wa_akg_contact_decision_v2', case when v_decision = 'promote' then 'Tornar lead' else 'Manter como contato' end,
    'wa_akg_contact_policy', v_lead_id,
    pg_catalog.jsonb_build_object(
      'account_id', p_account_id, 'phone', v_policy.phone_identity,
      'decision', v_decision, 'initial_mode', v_initial_mode,
      'lead_id', v_lead_id, 'decision_revision', v_policy.decision_revision
    )
  );

  v_response := pg_catalog.jsonb_build_object(
    'state', case when v_decision = 'promote' then 'lead_authorized' else 'agenda_protected' end,
    'evidence_state', 'operator_confirmed', 'lead_id', v_lead_id,
    'decision_revision', v_policy.decision_revision,
    'mode', case when v_decision = 'promote' then v_initial_mode else 'humano' end,
    'request_id', p_request_id
  );
  insert into private.wa_akg_contact_decision_requests(request_id, organization_id, actor_id, response)
    values(p_request_id, v_organization_id, v_user_id, v_response);
  return v_response;
end;
$function$;

revoke all on function public.decide_wa_akg_contact_v2(uuid, text, text, uuid, text, bigint, uuid) from public, anon;
grant execute on function public.decide_wa_akg_contact_v2(uuid, text, text, uuid, text, bigint, uuid) to authenticated, service_role;

-- The directory remains a read-only presentation surface.  Decisions are
-- canonical in the private policy, so overlay them here instead of giving the
-- browser a second write path or waiting for the next provider sync.
create or replace function public.central_list_wa_akg_contact_directory(
  p_account_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_organization_id uuid := public.current_org_id();
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 250);
begin
  if v_organization_id is null or v_user_id is null
    or not private.can_read_wa_akg_contact_directory(v_organization_id, p_account_id, v_user_id) then
    raise exception 'wa_akg_contact_directory_access_denied';
  end if;

  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'phone', directory.phone,
      'name', coalesce(nullif(btrim(directory.agenda_name), ''), nullif(btrim(directory.whatsapp_name), ''), nullif(btrim(directory.public_name), ''), 'Contato sem nome'),
      'last_synced_at', directory.last_synced_at,
      'state', coalesce(policy.classification_state, directory.classification_state),
      'evidence_state', coalesce(policy.evidence_state, directory.evidence_state),
      'lead_id', coalesce(policy.lead_id, directory.lead_id),
      'decision_revision', coalesce(policy.decision_revision, directory.decision_revision)
    ) order by coalesce(nullif(btrim(directory.agenda_name), ''), nullif(btrim(directory.whatsapp_name), ''), nullif(btrim(directory.public_name), ''), directory.phone) asc)
      from (
        select *
          from public.whatsapp_contact_directory
         where organization_id = v_organization_id
           and whatsapp_account_id = p_account_id
         order by last_synced_at desc, phone asc
         limit v_limit
      ) directory
      left join lateral (
        select policy.classification_state, policy.evidence_state, policy.lead_id, policy.decision_revision
          from private.wa_akg_resolve_contact_policy_identity(v_organization_id, p_account_id, directory.phone) resolved
          join private.wa_akg_contact_policy policy
            on policy.organization_id = v_organization_id
           and policy.whatsapp_account_id = p_account_id
           and policy.phone_identity = resolved.phone_identity
         where resolved.phone_identity is not null
           and resolved.ambiguous is false
      ) policy on true
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.central_list_wa_akg_contact_directory(uuid, integer) from public, anon;
grant execute on function public.central_list_wa_akg_contact_directory(uuid, integer) to authenticated, service_role;

-- The legacy SECURITY DEFINER decision RPC has weaker authorization and no
-- request/revision contract.  Retire its executable surface instead of
-- leaving an alternate path around the v2 canonical policy.
do $legacy_decision_rpc_guard$
begin
  if to_regprocedure('public.decide_wa_akg_contact(uuid,text,text,uuid)') is not null then
    execute 'revoke all on function public.decide_wa_akg_contact(uuid,text,text,uuid) from public, anon, authenticated, service_role';
  end if;
end;
$legacy_decision_rpc_guard$;

commit;
