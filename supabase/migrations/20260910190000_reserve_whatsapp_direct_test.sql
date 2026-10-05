begin;

-- Direct tests are an external side effect. Audit rows act as the durable
-- idempotency ledger, without introducing a second messages/queue system.
create index if not exists audit_logs_whatsapp_direct_test_request_idx
  on public.audit_logs (organization_id, (event_data ->> 'request_id'), occurred_at desc)
  where action in (
    'outreach.whatsapp_direct_test_reserved',
    'outreach.whatsapp_direct_test_provider_accepted'
  );

create index if not exists audit_logs_whatsapp_direct_test_fingerprint_idx
  on public.audit_logs (organization_id, (event_data ->> 'test_fingerprint'), occurred_at desc)
  where action in (
    'outreach.whatsapp_direct_test_reserved',
    'outreach.whatsapp_direct_test_provider_accepted'
  );

create or replace function public.reserve_whatsapp_direct_test(
  p_organization_id uuid,
  p_actor_id uuid,
  p_actor_name text,
  p_integration_id uuid,
  p_request_id uuid,
  p_phone_suffix text,
  p_message_length integer,
  p_test_fingerprint text
)
returns table(status text)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_existing public.audit_logs%rowtype;
  v_actor_name text;
  v_request_key text;
  v_fingerprint_key text;
begin
  if p_organization_id is null
     or p_actor_id is null
     or p_integration_id is null
     or p_request_id is null
     or p_phone_suffix is null
     or p_phone_suffix !~ '^[0-9]{4}$'
     or p_message_length is null
     or p_message_length not between 1 and 600
     or p_test_fingerprint is null
     or p_test_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'whatsapp_direct_test_reservation_input_invalid';
  end if;

  v_request_key := 'whatsapp-direct-test:request:' || p_organization_id::text || ':' || p_request_id::text;
  v_fingerprint_key := 'whatsapp-direct-test:fingerprint:' || p_organization_id::text || ':' || p_test_fingerprint;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_request_key, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_fingerprint_key, 0));

  -- A repeated request_id is terminal: an accepted request is reported as
  -- accepted, every other state is deliberately held for reconciliation.
  select a.* into v_existing
    from public.audit_logs as a
   where a.organization_id = p_organization_id
     and a.action in (
       'outreach.whatsapp_direct_test_reserved',
       'outreach.whatsapp_direct_test_provider_accepted'
     )
     and a.event_data ->> 'request_id' = p_request_id::text
   order by case when a.action = 'outreach.whatsapp_direct_test_provider_accepted' then 1 else 0 end desc,
            a.occurred_at desc nulls last,
            a.created_at desc nulls last
   limit 1;
  if found then
    return query select case
      when v_existing.action = 'outreach.whatsapp_direct_test_provider_accepted' then 'provider_accepted'::text
      else 'reconciliation_required'::text
    end;
    return;
  end if;

  -- Closing and reopening the dialog generates a new request id. It still
  -- cannot bypass an unresolved attempt with the exact same phone/message.
  select reserved.* into v_existing
    from public.audit_logs as reserved
   where reserved.organization_id = p_organization_id
     and reserved.action = 'outreach.whatsapp_direct_test_reserved'
     and reserved.event_data ->> 'test_fingerprint' = p_test_fingerprint
     and not exists (
       select 1
         from public.audit_logs as accepted
        where accepted.organization_id = reserved.organization_id
          and accepted.action = 'outreach.whatsapp_direct_test_provider_accepted'
          and accepted.event_data ->> 'request_id' = reserved.event_data ->> 'request_id'
     )
   order by reserved.occurred_at desc nulls last, reserved.created_at desc nulls last
   limit 1;
  if found then
    return query select 'reconciliation_required'::text;
    return;
  end if;

  v_actor_name := pg_catalog.coalesce(
    pg_catalog.nullif(pg_catalog.left(pg_catalog.btrim(p_actor_name), 160), ''),
    'Usuário'
  );
  insert into public.audit_logs (
    organization_id, actor_id, actor_name, actor_type, action, detail, rule,
    entity_table, entity_id, event_data
  ) values (
    p_organization_id,
    p_actor_id,
    v_actor_name,
    'user',
    'outreach.whatsapp_direct_test_reserved',
    'Teste direto reservado para envio controlado; não reenviar sem conciliação.',
    'zapi.direct_test.idempotency',
    'integrations',
    p_integration_id,
    pg_catalog.jsonb_build_object(
      'request_id', p_request_id::text,
      'phone_suffix', p_phone_suffix,
      'message_length', p_message_length,
      'test_fingerprint', p_test_fingerprint,
      'provider_receipt_present', false
    )
  );

  return query select 'reserved'::text;
end;
$function$;

create or replace function public.record_whatsapp_direct_test_provider_acceptance(
  p_organization_id uuid,
  p_integration_id uuid,
  p_request_id uuid
)
returns table(status text)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_reservation public.audit_logs%rowtype;
  v_request_key text;
begin
  if p_organization_id is null or p_integration_id is null or p_request_id is null then
    raise exception 'whatsapp_direct_test_acceptance_input_invalid';
  end if;

  v_request_key := 'whatsapp-direct-test:request:' || p_organization_id::text || ':' || p_request_id::text;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_request_key, 0));

  if exists (
    select 1
      from public.audit_logs as accepted
     where accepted.organization_id = p_organization_id
       and accepted.action = 'outreach.whatsapp_direct_test_provider_accepted'
       and accepted.event_data ->> 'request_id' = p_request_id::text
  ) then
    return query select 'provider_accepted'::text;
    return;
  end if;

  select reserved.* into v_reservation
    from public.audit_logs as reserved
   where reserved.organization_id = p_organization_id
     and reserved.action = 'outreach.whatsapp_direct_test_reserved'
     and reserved.entity_table = 'integrations'
     and reserved.entity_id = p_integration_id
     and reserved.event_data ->> 'request_id' = p_request_id::text
   order by reserved.occurred_at desc nulls last, reserved.created_at desc nulls last
   limit 1;
  if not found then
    return query select 'reconciliation_required'::text;
    return;
  end if;

  -- The provider receipt and the message body are intentionally never copied
  -- to audit_logs. The acceptance record preserves only masked evidence.
  insert into public.audit_logs (
    organization_id, actor_id, actor_name, actor_type, action, detail, rule,
    entity_table, entity_id, event_data
  ) values (
    v_reservation.organization_id,
    v_reservation.actor_id,
    v_reservation.actor_name,
    v_reservation.actor_type,
    'outreach.whatsapp_direct_test_provider_accepted',
    'Mensagem de teste aceita pela Z-API; entrega e leitura não foram confirmadas.',
    'zapi.direct_test.idempotency',
    'integrations',
    p_integration_id,
    pg_catalog.jsonb_build_object(
      'request_id', p_request_id::text,
      'phone_suffix', v_reservation.event_data ->> 'phone_suffix',
      'message_length', v_reservation.event_data -> 'message_length',
      'test_fingerprint', v_reservation.event_data ->> 'test_fingerprint',
      'provider_receipt_present', true
    )
  );

  return query select 'provider_accepted'::text;
end;
$function$;

revoke all on function public.reserve_whatsapp_direct_test(uuid, uuid, text, uuid, uuid, text, integer, text)
  from public, anon, authenticated;
revoke all on function public.record_whatsapp_direct_test_provider_acceptance(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_whatsapp_direct_test(uuid, uuid, text, uuid, uuid, text, integer, text)
  to service_role;
grant execute on function public.record_whatsapp_direct_test_provider_acceptance(uuid, uuid, uuid)
  to service_role;

commit;
