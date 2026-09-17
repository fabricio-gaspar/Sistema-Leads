begin;

-- COALESCE and NULLIF are PostgreSQL special forms, not pg_catalog
-- functions. Schema-qualifying them makes the direct Z-API test fail before
-- it can reserve its idempotency record or contact the provider.
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

  v_actor_name := coalesce(
    nullif(pg_catalog.left(pg_catalog.btrim(p_actor_name), 160), ''::text),
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

revoke all on function public.reserve_whatsapp_direct_test(uuid, uuid, text, uuid, uuid, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.reserve_whatsapp_direct_test(uuid, uuid, text, uuid, uuid, text, integer, text)
  to service_role;

commit;
