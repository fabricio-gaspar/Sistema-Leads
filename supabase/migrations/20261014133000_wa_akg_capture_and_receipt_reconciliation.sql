-- Short maintenance capture and account-scoped receipt reconciliation for WA-AKG.
-- This supersedes the account-scoped receipt definition from the legacy R3
-- source. Do not apply that legacy source after this migration; its historical
-- provider branches are intentionally not part of the WA-AKG release.
-- Capture accepts and retains signed callbacks but deliberately leaves them queued.
begin;

alter table public.messaging_provider_controls
  add column if not exists capture_only boolean not null default false;

-- The capture flag is enforced at the database claim boundary as well as in
-- the Edge workers.  This closes the gap where a worker observes an event just
-- before maintenance starts and later tries to claim it after the flag is on.
create or replace function public.claim_whatsapp_webhook_event(
  p_provider text,
  p_event_id uuid
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
  token uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('whatsapp-event:' || p_provider || ':' || p_event_id::text, 0)
  );
  execute pg_catalog.format('select * from public.%I where id=$1 for update', t)
    into e using p_event_id;
  if e.id is null
     or e.processing_status not in ('queued', 'failed', 'processing')
     or (e.processing_status <> 'processing' and e.next_retry_at > pg_catalog.now()) then
    return null;
  end if;
  if not exists (
    select 1
      from public.whatsapp_accounts account_row
      join public.integrations integration_row
        on integration_row.id = account_row.integration_id
       and integration_row.organization_id = account_row.organization_id
     where account_row.id = e.whatsapp_account_id
       and account_row.organization_id = e.organization_id
       and account_row.integration_id = e.integration_id
       and account_row.provider = p_provider
       and account_row.archived_at is null
  ) then
    raise exception 'whatsapp_event_scope_invalid';
  end if;
  if p_provider = 'wa_akg' and exists (
    select 1
      from public.messaging_provider_controls control_row
     where control_row.organization_id = e.organization_id
       and control_row.provider = 'wa_akg'
       and control_row.capture_only
  ) then
    return null;
  end if;
  select * into w
    from private.whatsapp_inbound_work
   where provider = p_provider and event_id = p_event_id
   for update;
  if (w.event_id is null and e.processing_status = 'processing')
     or (w.phase = 'dispatching' and w.lease_expires_at <= pg_catalog.now()) then
    execute pg_catalog.format(
      'update public.%I set processing_status=''needs_review'',error_code=''inbound_effect_unknown'',processed_at=now() where id=$1',
      t
    ) using p_event_id;
    update private.whatsapp_inbound_work
       set phase = 'needs_review', updated_at = pg_catalog.now()
     where provider = p_provider and event_id = p_event_id;
    return null;
  end if;
  if w.phase in ('dispatching', 'completed', 'needs_review') or w.lease_expires_at > pg_catalog.now() then
    return null;
  end if;
  token := pg_catalog.gen_random_uuid();
  insert into private.whatsapp_inbound_work(
    provider, event_id, organization_id, account_id, lease_id, lease_expires_at
  ) values (
    p_provider, p_event_id, e.organization_id, e.whatsapp_account_id,
    token, pg_catalog.now() + interval '2 minutes'
  ) on conflict(provider, event_id) do update
    set lease_id = excluded.lease_id,
        lease_expires_at = excluded.lease_expires_at,
        updated_at = pg_catalog.now()
    returning * into w;
  if w.organization_id <> e.organization_id or w.account_id <> e.whatsapp_account_id then
    raise exception 'whatsapp_event_scope_invalid';
  end if;
  execute pg_catalog.format(
    'update public.%I set processing_status=''processing'',attempt_count=least(attempt_count+1,20),next_retry_at=now()+interval ''2 minutes'',error_code=null where id=$1 returning *',
    t
  ) into e using p_event_id;
  return pg_catalog.to_jsonb(e) || pg_catalog.jsonb_build_object('lease_id', token, 'phase', w.phase);
end;
$function$;

revoke all on function public.claim_whatsapp_webhook_event(text, uuid) from public, anon, authenticated;
grant execute on function public.claim_whatsapp_webhook_event(text, uuid) to service_role;

create or replace function public.reconcile_whatsapp_receipt_for_account(
  p_organization_id uuid,
  p_whatsapp_account_id uuid,
  p_provider_message_ids text[],
  p_expected_message_count integer,
  p_status text,
  p_occurred_at timestamptz
)
returns table(
  outreach_id uuid,
  lead_id uuid,
  message_id uuid,
  provider_message_id text,
  previous_status text,
  current_status text,
  changed boolean
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_outreach public.lead_outreach%rowtype;
  v_message_id uuid;
  v_previous text;
  v_current text;
  v_changed boolean;
  v_match_count integer;
  v_id_count integer;
  v_normalized_ids text[];
  v_at timestamptz := coalesce(p_occurred_at, pg_catalog.now());
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'receipt_access_denied';
  end if;

  if p_organization_id is null
     or p_whatsapp_account_id is null
     or coalesce(pg_catalog.cardinality(p_provider_message_ids), 0) = 0
     or coalesce(pg_catalog.cardinality(p_provider_message_ids), 0) > 100
     or p_expected_message_count is null
     or p_expected_message_count < 1
     or p_expected_message_count > 100
     or p_status is null
     or p_status not in ('sent', 'delivered', 'read', 'failed') then
    raise exception 'receipt_input_invalid';
  end if;

  select array_agg(normalized.value order by normalized.value), count(*)::integer
    into v_normalized_ids, v_id_count
    from (
      select distinct btrim(raw.value) as value
        from unnest(p_provider_message_ids) as raw(value)
       where raw.value is not null
         and btrim(raw.value) <> ''
         and length(btrim(raw.value)) <= 300
    ) normalized;
  if v_id_count < 1
     or v_id_count > 100
     or v_id_count <> pg_catalog.cardinality(p_provider_message_ids)
     or p_expected_message_count <> v_id_count then
    raise exception 'receipt_input_invalid';
  end if;

  perform 1
    from public.whatsapp_accounts a
   where a.id = p_whatsapp_account_id
     and a.organization_id = p_organization_id
     and a.provider = 'wa_akg'
     and a.archived_at is null;
  if not found then
    raise exception 'receipt_account_not_owned';
  end if;

  -- Every submitted provider ID must identify exactly one scoped outreach.
  -- A total row count alone is unsafe: duplicate rows for one ID could mask a
  -- missing row for another ID in the same receipt callback.
  if exists (
    select 1
      from unnest(v_normalized_ids) as submitted(provider_message_id)
      left join public.lead_outreach job
        on job.organization_id = p_organization_id
       and job.whatsapp_account_id = p_whatsapp_account_id
       and job.channel = 'whatsapp'
       and job.provider = 'wa_akg'
       and job.provider_message_id = submitted.provider_message_id
     group by submitted.provider_message_id
    having pg_catalog.count(job.id) <> 1
  ) then
    raise exception 'receipt_identity_ambiguous';
  end if;

  select pg_catalog.count(*)::integer
    into v_match_count
    from public.lead_outreach job
   where job.organization_id = p_organization_id
     and job.whatsapp_account_id = p_whatsapp_account_id
     and job.channel = 'whatsapp'
     and job.provider = 'wa_akg'
     and job.provider_message_id = any(v_normalized_ids);
  if v_match_count <> p_expected_message_count then
    raise exception 'receipt_identity_ambiguous';
  end if;

  for v_outreach in
    select job.*
      from public.lead_outreach job
     where job.organization_id = p_organization_id
       and job.whatsapp_account_id = p_whatsapp_account_id
       and job.channel = 'whatsapp'
       and job.provider = 'wa_akg'
       and job.provider_message_id = any(v_normalized_ids)
     order by job.created_at, job.id
     for update
  loop
    v_message_id := null;
    v_changed := false;
    v_previous := v_outreach.status;
    v_current := v_previous;

    if p_status = 'failed' then
      if v_previous not in ('delivered', 'read', 'replied') then
        v_current := 'failed';
        v_changed := v_previous is distinct from v_current or v_outreach.failed_at is null;
      end if;
    elsif (case p_status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else -1 end)
      > (case v_previous when 'pending' then 0 when 'sent' then 1 when 'delivered' then 2
          when 'read' then 3 when 'replied' then 4 when 'failed' then 4 else -1 end) then
      v_current := p_status;
      v_changed := true;
    end if;

    v_changed := v_changed
      or (v_current in ('sent', 'delivered', 'read') and v_outreach.sent_at is null)
      or (v_current in ('delivered', 'read') and v_outreach.delivered_at is null)
      or (v_current = 'read' and v_outreach.read_at is null)
      or (p_status = 'failed' and v_current = 'failed' and v_outreach.failed_at is null);

    if v_changed then
      update public.lead_outreach job
         set status = v_current,
             sent_at = case when v_current in ('sent', 'delivered', 'read') then coalesce(job.sent_at, v_at) else job.sent_at end,
             delivered_at = case when v_current in ('delivered', 'read') then coalesce(job.delivered_at, v_at) else job.delivered_at end,
             read_at = case when v_current = 'read' then coalesce(job.read_at, v_at) else job.read_at end,
             failed_at = case when v_current = 'failed' then coalesce(job.failed_at, v_at) else job.failed_at end,
             error = case when v_current = 'failed' then 'provider_delivery_failed' else null end,
             updated_at = pg_catalog.now()
       where job.id = v_outreach.id
         and job.organization_id = p_organization_id;
    end if;

    if (v_outreach.metadata ->> 'message_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      v_message_id := (v_outreach.metadata ->> 'message_id')::uuid;
      update public.lead_messages message_row
         set type = case when v_current = 'failed' then 'failed' else 'sent' end,
             provider = coalesce(message_row.provider, 'wa_akg'),
             provider_message_id = coalesce(message_row.provider_message_id, v_outreach.provider_message_id)
       where message_row.id = v_message_id
         and message_row.organization_id = p_organization_id
         and message_row.lead_id = v_outreach.lead_id
         and message_row.whatsapp_account_id = p_whatsapp_account_id
         and (message_row.provider is null or message_row.provider = 'wa_akg')
         and (message_row.provider_message_id is null or message_row.provider_message_id = v_outreach.provider_message_id);
      if not found then
        raise exception 'receipt_message_identity_conflict';
      end if;
    end if;

    return query select v_outreach.id, v_outreach.lead_id, v_message_id,
      v_outreach.provider_message_id, v_previous, v_current, v_changed;
  end loop;
end;
$function$;

revoke all on function public.reconcile_whatsapp_receipt_for_account(uuid, uuid, text[], integer, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.reconcile_whatsapp_receipt_for_account(uuid, uuid, text[], integer, text, timestamptz)
  to service_role;

-- The former organization-scoped receipt RPC can reconcile a WA-AKG receipt
-- without proving which seller account emitted it.  Keep its definition for
-- audit compatibility, but remove every executable grant so only the scoped
-- RPC above is usable by runtime workers.
revoke all on function public.reconcile_whatsapp_receipt(uuid, text[], integer, text, timestamptz)
  from public, anon, authenticated, service_role;

commit;
