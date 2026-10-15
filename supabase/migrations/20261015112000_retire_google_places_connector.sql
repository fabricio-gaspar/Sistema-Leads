begin;

-- Google Places is retired from the operational product. Keep historical leads,
-- runs and caches intact, but remove the current connector rows and any Vault
-- credential so the source cannot be reactivated by the application.
do $function$
declare
  v_integration record;
begin
  for v_integration in
    select id, organization_id
    from public.integrations
    where key = 'google_places'
    for update
  loop
    insert into public.audit_logs (
      organization_id,
      actor_id,
      actor_name,
      actor_type,
      action,
      detail,
      entity_table,
      entity_id,
      event_data
    ) values (
      v_integration.organization_id,
      null,
      'Sistema',
      'system',
      'integration.google_places_retired',
      'Conector Google Places removido da operação; históricos permanecem somente para consulta.',
      'integrations',
      v_integration.id,
      jsonb_build_object('source_key', 'google_places', 'credentials_deleted', true, 'historical_data_preserved', true)
    );

    perform public.delete_integration_secret(v_integration.id);
  end loop;

  delete from public.lead_source_configs
  where source_key = 'google_places';

  delete from public.integrations
  where key = 'google_places';
end;
$function$;

commit;
