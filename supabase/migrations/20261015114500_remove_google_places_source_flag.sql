-- Google Places is retired. Remove its source flag from existing settings and
-- prevent new organizations from receiving the retired connector by default.
begin;

alter table public.company_settings
  alter column prospecting_sources set default '{"cnpj_ws": true}'::jsonb;

update public.company_settings
set prospecting_sources = coalesce(prospecting_sources, '{}'::jsonb) - 'google_places',
    updated_at = now()
where prospecting_sources ? 'google_places';

insert into public.audit_logs (
  organization_id,
  actor_id,
  actor_name,
  actor_type,
  action,
  detail,
  entity_table,
  event_data
)
select
  organization_id,
  null,
  'system',
  'system',
  'integration.google_places_source_flag_removed',
  'Google Places foi removido das fontes de prospecção da organização.',
  'company_settings',
  jsonb_build_object('source_key', 'google_places', 'historical_data_preserved', true)
from public.company_settings
where not (prospecting_sources ? 'google_places');

commit;
