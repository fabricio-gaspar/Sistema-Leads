-- Evolution GO seller lifecycle, driven only by the canonical tenant membership.
--
-- This migration deliberately creates no provider credential and performs no HTTP.
-- The trigger only persists a disabled local account/integration plus a durable
-- provisioning job. A separate service-role worker remains responsible for any
-- eventual provider interaction.

begin;

-- The current repository intentionally does not carry the historical migration
-- that introduced the Evolution GO job table in every checkout. Fail before any
-- DDL if this database was not reconciled with that canonical foundation.
do $preflight$
declare
  v_missing text[] := array[]::text[];
  v_table text;
  v_column text;
begin
  if to_regnamespace('private') is null then
    v_missing := array_append(v_missing, 'schema private');
  end if;

  foreach v_table in array array[
    'public.organization_members',
    'public.integrations',
    'public.whatsapp_accounts',
    'public.evolution_go_seller_provisioning_jobs'
  ] loop
    if to_regclass(v_table) is null then
      v_missing := array_append(v_missing, v_table);
    end if;
  end loop;

  if cardinality(v_missing) > 0 then
    raise exception 'evolution_go_tenant_lifecycle_prerequisite_missing: %', array_to_string(v_missing, ', ')
      using errcode = '55000',
            hint = 'Reconcile the Evolution GO seller-provisioning foundation before applying this additive lifecycle migration.';
  end if;

  foreach v_column in array array[
    'organization_members.organization_id', 'organization_members.user_id', 'organization_members.role', 'organization_members.status',
    'integrations.id', 'integrations.organization_id', 'integrations.key', 'integrations.label', 'integrations.provider',
    'integrations.category', 'integrations.connected', 'integrations.enabled', 'integrations.paused', 'integrations.mode',
    'integrations.status_detail', 'integrations.configuration',
    'whatsapp_accounts.id', 'whatsapp_accounts.organization_id', 'whatsapp_accounts.integration_id',
    'whatsapp_accounts.owner_user_id', 'whatsapp_accounts.label', 'whatsapp_accounts.provider',
    'whatsapp_accounts.account_type', 'whatsapp_accounts.is_default', 'whatsapp_accounts.enabled',
    'whatsapp_accounts.connection_status', 'whatsapp_accounts.created_by', 'whatsapp_accounts.provider_metadata',
    'whatsapp_accounts.archived_at',
    'evolution_go_seller_provisioning_jobs.organization_id', 'evolution_go_seller_provisioning_jobs.user_id',
    'evolution_go_seller_provisioning_jobs.created_by', 'evolution_go_seller_provisioning_jobs.whatsapp_account_id',
    'evolution_go_seller_provisioning_jobs.integration_id', 'evolution_go_seller_provisioning_jobs.source',
    'evolution_go_seller_provisioning_jobs.instance_name', 'evolution_go_seller_provisioning_jobs.state',
    'evolution_go_seller_provisioning_jobs.next_attempt_at', 'evolution_go_seller_provisioning_jobs.last_error_code',
    'evolution_go_seller_provisioning_jobs.completed_at', 'evolution_go_seller_provisioning_jobs.updated_at'
  ] loop
    if not exists (
      select 1
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = split_part(v_column, '.', 1)
        and a.attname = split_part(v_column, '.', 2)
        and a.attnum > 0
        and not a.attisdropped
    ) then
      v_missing := array_append(v_missing, 'public.' || v_column);
    end if;
  end loop;

  if cardinality(v_missing) > 0 then
    raise exception 'evolution_go_tenant_lifecycle_prerequisite_missing: %', array_to_string(v_missing, ', ')
      using errcode = '55000',
            hint = 'Apply the canonical WhatsApp account, integrations and Evolution GO provisioning migrations first.';
  end if;

  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.whatsapp_accounts'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%evolution_go%'
  ) then
    raise exception 'evolution_go_tenant_lifecycle_prerequisite_missing: whatsapp_accounts provider must accept evolution_go'
      using errcode = '55000',
            hint = 'Apply the Evolution GO channel foundation before this migration.';
  end if;

  if exists (
    select 1
    from public.whatsapp_accounts a
    where a.provider = 'evolution_go'
      and a.account_type = 'seller'
      and a.owner_user_id is not null
      and a.archived_at is null
    group by a.organization_id, a.owner_user_id
    having count(*) > 1
  ) then
    raise exception 'evolution_go_tenant_lifecycle_prerequisite_invalid: duplicate active seller accounts'
      using errcode = '55000',
            hint = 'Reconcile duplicate Evolution GO seller accounts before enabling lifecycle automation.';
  end if;

  if exists (
    select 1
    from public.evolution_go_seller_provisioning_jobs j
    group by j.organization_id, j.user_id
    having count(*) > 1
  ) then
    raise exception 'evolution_go_tenant_lifecycle_prerequisite_invalid: duplicate seller provisioning jobs'
      using errcode = '55000',
            hint = 'Reconcile duplicate Evolution GO provisioning jobs before enabling lifecycle automation.';
  end if;

  if not exists (
    select 1
    from pg_index i
    where i.indrelid = 'public.evolution_go_seller_provisioning_jobs'::regclass
      and i.indisunique
      and i.indpred is null
      and i.indnkeyatts = 2
      and (
        select array_agg(a.attname::text order by k.ordinality)
        from unnest(i.indkey) with ordinality as k(attnum, ordinality)
        join pg_attribute a
          on a.attrelid = i.indrelid
         and a.attnum = k.attnum
        where k.ordinality <= i.indnkeyatts
      ) = array['organization_id', 'user_id']::text[]
  ) then
    raise exception 'evolution_go_tenant_lifecycle_prerequisite_missing: unique evolution_go seller job key (organization_id, user_id)'
      using errcode = '55000',
            hint = 'Apply or reconcile the canonical Evolution GO seller-provisioning unique key before this migration.';
  end if;
end;
$preflight$;

-- The index is partial so historical/archived accounts remain auditable, while
-- a live seller can have exactly one active Evolution GO account per tenant.
create unique index if not exists whatsapp_accounts_evolution_go_seller_owner_uidx
  on public.whatsapp_accounts (organization_id, owner_user_id)
  where provider = 'evolution_go'
    and account_type = 'seller'
    and owner_user_id is not null
    and archived_at is null;

-- A durable worker queue must never be readable or mutable from browser roles.
alter table public.evolution_go_seller_provisioning_jobs enable row level security;
revoke all on table public.evolution_go_seller_provisioning_jobs from public, anon, authenticated;
grant all on table public.evolution_go_seller_provisioning_jobs to service_role;

create or replace function private.sync_evolution_go_seller_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_organization_id uuid;
  v_user_id uuid;
  v_actor_id uuid;
  v_should_provision boolean;
  v_account_id uuid;
  v_integration_id uuid;
  v_instance_name text;
  v_existing_instance_name text;
begin
  if tg_op = 'DELETE' then
    v_organization_id := old.organization_id;
    v_user_id := old.user_id;
    v_should_provision := false;
  else
    v_organization_id := new.organization_id;
    v_user_id := new.user_id;
    v_should_provision := new.status = 'active' and new.role::text = 'vendedor';
  end if;

  -- This transaction-local lock serializes writes from an invite acceptance,
  -- role change, reactivation or direct service operation for this tenant/user.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'evolution-go-seller-membership:' || v_organization_id::text || ':' || v_user_id::text,
      0
    )
  );

  if v_should_provision then
    select a.id, a.integration_id
      into v_account_id, v_integration_id
    from public.whatsapp_accounts a
    where a.organization_id = v_organization_id
      and a.owner_user_id = v_user_id
      and a.provider = 'evolution_go'
      and a.account_type = 'seller'
      and a.archived_at is null
    for update;

    select nullif(btrim(j.instance_name), '')
      into v_existing_instance_name
    from public.evolution_go_seller_provisioning_jobs j
    where j.organization_id = v_organization_id
      and j.user_id = v_user_id
    for update;

    v_instance_name := coalesce(
      v_existing_instance_name,
      'wf-' || left(replace(v_organization_id::text, '-', ''), 12)
        || '-' || left(replace(v_user_id::text, '-', ''), 12)
    );
    v_actor_id := coalesce(auth.uid(), v_user_id);

    if v_account_id is null then
      v_account_id := pg_catalog.gen_random_uuid();
      v_integration_id := pg_catalog.gen_random_uuid();

      insert into public.integrations (
        id, organization_id, key, label, provider, category, connected, enabled, paused, mode,
        status_detail, configuration
      ) values (
        v_integration_id,
        v_organization_id,
        'whatsapp_evolution_go:' || v_account_id::text,
        'WhatsApp individual',
        'Evolution GO',
        'communication',
        false,
        false,
        true,
        'real',
        'Canal individual criado; aguardando provisionamento seguro do Evolution GO.',
        pg_catalog.jsonb_build_object(
          'configured', false,
          'provisioning_state', 'queued',
          'instance_name', v_instance_name,
          'provider_version', '0.7.2'
        )
      );

      insert into public.whatsapp_accounts (
        id, organization_id, integration_id, owner_user_id, label, provider, account_type,
        is_default, enabled, connection_status, created_by, provider_metadata
      ) values (
        v_account_id,
        v_organization_id,
        v_integration_id,
        v_user_id,
        'WhatsApp individual',
        'evolution_go',
        'seller',
        false,
        false,
        'unconfigured',
        v_actor_id,
        pg_catalog.jsonb_build_object(
          'instance_name', v_instance_name,
          'provider_version', '0.7.2'
        )
      );
    else
      -- Never repair a cross-tenant or missing integration by silently creating
      -- another account. A human reconciliation is safer than an orphan route.
      if v_integration_id is null or not exists (
        select 1
        from public.integrations i
        where i.id = v_integration_id
          and i.organization_id = v_organization_id
      ) then
        raise exception 'evolution_go_seller_integration_missing'
          using errcode = '55000',
                hint = 'Reconcile the existing seller account before reactivating this membership.';
      end if;
    end if;

    insert into public.evolution_go_seller_provisioning_jobs (
      organization_id,
      user_id,
      created_by,
      whatsapp_account_id,
      integration_id,
      source,
      instance_name,
      state,
      next_attempt_at,
      last_error_code,
      completed_at,
      updated_at
    ) values (
      v_organization_id,
      v_user_id,
      v_actor_id,
      v_account_id,
      v_integration_id,
      'direct_create',
      v_instance_name,
      'queued',
      pg_catalog.now(),
      null,
      null,
      pg_catalog.now()
    )
    on conflict (organization_id, user_id) do update
      set created_by = excluded.created_by,
          whatsapp_account_id = excluded.whatsapp_account_id,
          integration_id = excluded.integration_id,
          source = excluded.source,
          instance_name = coalesce(
            nullif(btrim(evolution_go_seller_provisioning_jobs.instance_name), ''),
            excluded.instance_name
          ),
          state = case
            when evolution_go_seller_provisioning_jobs.state in ('completed', 'processing', 'awaiting_qr', 'needs_review')
              then evolution_go_seller_provisioning_jobs.state
            else 'queued'
          end,
          next_attempt_at = case
            when evolution_go_seller_provisioning_jobs.state in ('completed', 'processing', 'awaiting_qr', 'needs_review')
              then evolution_go_seller_provisioning_jobs.next_attempt_at
            else pg_catalog.now()
          end,
          last_error_code = case
            when evolution_go_seller_provisioning_jobs.state in ('completed', 'processing', 'awaiting_qr', 'needs_review')
              then evolution_go_seller_provisioning_jobs.last_error_code
            else null
          end,
          completed_at = case
            when evolution_go_seller_provisioning_jobs.state in ('completed', 'awaiting_qr', 'needs_review')
              then evolution_go_seller_provisioning_jobs.completed_at
            else null
          end,
          updated_at = pg_catalog.now();
  else
    -- Access changes fence only the local route and durable queue. They do not
    -- delete the account, provider metadata, messages, conversations or leads,
    -- and they do not claim to disconnect a phone without provider confirmation.
    update public.evolution_go_seller_provisioning_jobs j
       set state = 'cancelled',
           completed_at = pg_catalog.now(),
           last_error_code = 'seller_membership_inactive',
           updated_at = pg_catalog.now()
     where j.organization_id = v_organization_id
       and j.user_id = v_user_id
       and j.state in ('queued', 'failed', 'processing', 'awaiting_qr');

    update public.whatsapp_accounts a
       set enabled = false,
           is_default = false,
           updated_at = pg_catalog.now()
     where a.organization_id = v_organization_id
       and a.owner_user_id = v_user_id
       and a.provider = 'evolution_go'
       and a.account_type = 'seller'
       and a.archived_at is null;

    update public.integrations i
       set enabled = false,
           paused = true,
           status_detail = 'Canal individual desativado porque o vínculo do vendedor não está ativo.',
           updated_at = pg_catalog.now()
     where i.organization_id = v_organization_id
       and i.id in (
         select a.integration_id
         from public.whatsapp_accounts a
         where a.organization_id = v_organization_id
           and a.owner_user_id = v_user_id
           and a.provider = 'evolution_go'
           and a.account_type = 'seller'
           and a.archived_at is null
       );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

revoke all on function private.sync_evolution_go_seller_membership() from public, anon, authenticated;

drop trigger if exists evolution_go_seller_membership_lifecycle on public.organization_members;
create trigger evolution_go_seller_membership_lifecycle
after insert or update of role, status on public.organization_members
for each row execute function private.sync_evolution_go_seller_membership();

drop trigger if exists evolution_go_seller_membership_delete on public.organization_members;
create trigger evolution_go_seller_membership_delete
after delete on public.organization_members
for each row execute function private.sync_evolution_go_seller_membership();

comment on function private.sync_evolution_go_seller_membership() is
  'Creates/cancels only the local Evolution GO seller account, disabled integration and durable job from organization_members; never calls the provider or deletes conversation history.';

commit;
