begin;

do $migration$
declare
  v_oid oid;
  v_definition text;
begin
  for v_oid in
    select p.oid
      from pg_catalog.pg_proc as p
      join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and p.proname in (
         'queue_human_whatsapp_message',
         'reconcile_whatsapp_receipt',
         'record_outreach_provider_acceptance',
         'request_human_handoff',
         'return_handoff_to_ana'
       )
  loop
    v_definition := pg_catalog.pg_get_functiondef(v_oid);
    v_definition := pg_catalog.replace(v_definition, 'pg_catalog.coalesce', 'coalesce');
    v_definition := pg_catalog.replace(v_definition, 'pg_catalog.nullif', 'nullif');
    execute v_definition;
  end loop;
end;
$migration$;

comment on function public.record_outreach_provider_acceptance(uuid, uuid, uuid, uuid, text, text, timestamptz, timestamptz) is
  'Registra atomicamente o aceite do provedor sem deixar o job em reconciliação por erro de persistência.';

commit;
