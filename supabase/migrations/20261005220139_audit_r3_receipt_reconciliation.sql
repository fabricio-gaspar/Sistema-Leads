-- R3: historical receipts remain reconcilable with transport paused.
-- This migration is local-only until a separately authorized deployment.
begin;

-- Preserve the five-argument service-only API for existing deployed consumers.
-- COALESCE is SQL syntax, not a pg_catalog function.
create or replace function public.reconcile_whatsapp_receipt(
  p_organization_id uuid,
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
  v_at timestamptz := coalesce(p_occurred_at, pg_catalog.now());
begin
  if p_organization_id is null
     or coalesce(pg_catalog.cardinality(p_provider_message_ids), 0) = 0
     or p_expected_message_count is null
     or p_expected_message_count < 1
     or p_status is null
     or p_status not in ('sent', 'delivered', 'read', 'failed') then
    raise exception 'receipt_input_invalid';
  end if;

  select pg_catalog.count(distinct o.id)::integer into v_match_count
  from public.lead_outreach o
  where o.organization_id = p_organization_id
    and o.channel = 'whatsapp'
    and pg_catalog.lower(coalesce(o.provider, '')) in ('zapi', 'z-api', 'meta_cloud', 'evolution_go', 'wa_akg')
    and o.provider_message_id = any(p_provider_message_ids);
  if v_match_count > p_expected_message_count then raise exception 'receipt_identity_ambiguous'; end if;

  for v_outreach in
    select o.* from public.lead_outreach o
    where o.organization_id = p_organization_id
      and o.channel = 'whatsapp'
      and pg_catalog.lower(coalesce(o.provider, '')) in ('zapi', 'z-api', 'meta_cloud', 'evolution_go', 'wa_akg')
      and o.provider_message_id = any(p_provider_message_ids)
    order by o.created_at, o.id
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
      update public.lead_outreach o set
        status = v_current,
        sent_at = case when v_current in ('sent', 'delivered', 'read') then coalesce(o.sent_at, v_at) else o.sent_at end,
        delivered_at = case when v_current in ('delivered', 'read') then coalesce(o.delivered_at, v_at) else o.delivered_at end,
        read_at = case when v_current = 'read' then coalesce(o.read_at, v_at) else o.read_at end,
        failed_at = case when v_current = 'failed' then coalesce(o.failed_at, v_at) else o.failed_at end,
        error = case when v_current = 'failed' then 'provider_delivery_failed' else null end,
        updated_at = pg_catalog.now()
      where o.id = v_outreach.id and o.organization_id = p_organization_id;
    end if;

    if (v_outreach.metadata ->> 'message_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      v_message_id := (v_outreach.metadata ->> 'message_id')::uuid;
      update public.lead_messages m set
        type = case when v_current = 'failed' then 'failed' else 'sent' end,
        provider_message_id = coalesce(m.provider_message_id, v_outreach.provider_message_id)
      where m.id = v_message_id
        and m.organization_id = p_organization_id
        and m.lead_id = v_outreach.lead_id
        and (m.provider_message_id is null or m.provider_message_id = v_outreach.provider_message_id);
      if not found then raise exception 'receipt_message_identity_conflict'; end if;
    end if;

    return query select v_outreach.id, v_outreach.lead_id, v_message_id,
      v_outreach.provider_message_id, v_previous, v_current, v_changed;
  end loop;
end;
$function$;

-- New callbacks MUST use the account-scoped API; no fallback to organization-only.
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
  v_account_provider text;
  v_message_id uuid;
  v_previous text;
  v_current text;
  v_changed boolean;
  v_match_count integer;
  v_at timestamptz := coalesce(p_occurred_at, pg_catalog.now());
begin
  if p_organization_id is null or p_whatsapp_account_id is null
     or coalesce(pg_catalog.cardinality(p_provider_message_ids), 0) = 0
     or p_expected_message_count is null
     or p_expected_message_count < 1
     or p_status is null
     or p_status not in ('sent', 'delivered', 'read', 'failed') then
    raise exception 'receipt_input_invalid';
  end if;

  -- Only service_role may call this API. Ownership is mandatory even when all
  -- transport gates are closed; no transport/automation state is modified.
  select case when a.provider = 'z-api' then 'zapi' else a.provider end
    into v_account_provider
  from public.whatsapp_accounts a
  where a.id = p_whatsapp_account_id and a.organization_id = p_organization_id;
  if not found then raise exception 'receipt_account_not_owned'; end if;

  select pg_catalog.count(distinct o.id)::integer into v_match_count
  from public.lead_outreach o
  where o.organization_id = p_organization_id
    and o.whatsapp_account_id = p_whatsapp_account_id
    and (case when pg_catalog.lower(o.provider) = 'z-api' then 'zapi' else pg_catalog.lower(o.provider) end) = v_account_provider
    and o.channel = 'whatsapp'
    and pg_catalog.lower(coalesce(o.provider, '')) in ('zapi', 'z-api', 'meta_cloud', 'evolution_go', 'wa_akg')
    and o.provider_message_id = any(p_provider_message_ids);
  if v_match_count > p_expected_message_count then raise exception 'receipt_identity_ambiguous'; end if;

  for v_outreach in
    select o.* from public.lead_outreach o
    where o.organization_id = p_organization_id
      and o.whatsapp_account_id = p_whatsapp_account_id
      and (case when pg_catalog.lower(o.provider) = 'z-api' then 'zapi' else pg_catalog.lower(o.provider) end) = v_account_provider
      and o.channel = 'whatsapp'
      and pg_catalog.lower(coalesce(o.provider, '')) in ('zapi', 'z-api', 'meta_cloud', 'evolution_go', 'wa_akg')
      and o.provider_message_id = any(p_provider_message_ids)
    order by o.created_at, o.id
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
      update public.lead_outreach o set
        status = v_current,
        sent_at = case when v_current in ('sent', 'delivered', 'read') then coalesce(o.sent_at, v_at) else o.sent_at end,
        delivered_at = case when v_current in ('delivered', 'read') then coalesce(o.delivered_at, v_at) else o.delivered_at end,
        read_at = case when v_current = 'read' then coalesce(o.read_at, v_at) else o.read_at end,
        failed_at = case when v_current = 'failed' then coalesce(o.failed_at, v_at) else o.failed_at end,
        error = case when v_current = 'failed' then 'provider_delivery_failed' else null end,
        updated_at = pg_catalog.now()
      where o.id = v_outreach.id and o.organization_id = p_organization_id;
    end if;

    if (v_outreach.metadata ->> 'message_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      v_message_id := (v_outreach.metadata ->> 'message_id')::uuid;
      update public.lead_messages m set
        type = case when v_current = 'failed' then 'failed' else 'sent' end,
        provider_message_id = coalesce(m.provider_message_id, v_outreach.provider_message_id)
      where m.id = v_message_id
        and m.organization_id = p_organization_id
        and m.lead_id = v_outreach.lead_id
        and (m.whatsapp_account_id is null or m.whatsapp_account_id = p_whatsapp_account_id)
        and (m.provider_message_id is null or m.provider_message_id = v_outreach.provider_message_id);
      if not found then raise exception 'receipt_message_identity_conflict'; end if;
    end if;

    return query select v_outreach.id, v_outreach.lead_id, v_message_id,
      v_outreach.provider_message_id, v_previous, v_current, v_changed;
  end loop;
end;
$function$;

revoke all on function public.reconcile_whatsapp_receipt(uuid, text[], integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.reconcile_whatsapp_receipt(uuid, text[], integer, text, timestamptz) to service_role;
revoke all on function public.reconcile_whatsapp_receipt_for_account(uuid, uuid, text[], integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.reconcile_whatsapp_receipt_for_account(uuid, uuid, text[], integer, text, timestamptz) to service_role;

comment on function public.reconcile_whatsapp_receipt_for_account(uuid, uuid, text[], integer, text, timestamptz) is
  'Service-only authenticated receipt reconciliation, scoped to original organization/account/provider. Does not change gates or enqueue messages.';

commit;
