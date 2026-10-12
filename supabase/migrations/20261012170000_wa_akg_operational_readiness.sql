create or replace view public.operational_readiness as
select cs.organization_id, cs.name as company_name, cs.sandbox_mode,
  case when coalesce(cs.sandbox_mode,true) then 'DEMONSTRACAO' else 'PRODUCAO' end as runtime_mode,
  coalesce(ai.connected and ai.enabled and not ai.paused,false) as ai_ready,
  coalesce(wa.ready,false) as whatsapp_outbound_ready,
  coalesce(wa.ready,false) as whatsapp_inbound_ready,
  coalesce(sc.connected and sc.enabled and not sc.paused,false) as scheduler_ready,
  coalesce(wa.last_error,'') as whatsapp_inbound_last_error,
  coalesce(wa.status_detail, 'WA-AKG ainda não está conectado para esta organização.') as whatsapp_inbound_status_detail,
  greatest(0,
    case when not coalesce(ai.connected and ai.enabled and not ai.paused,false) then 1 else 0 end +
    case when not coalesce(wa.ready,false) then 1 else 0 end +
    case when not coalesce(wa.ready,false) then 1 else 0 end +
    case when not coalesce(sc.connected and sc.enabled and not sc.paused,false) then 1 else 0 end
  ) as blocker_count,
  jsonb_strip_nulls(jsonb_build_object(
    'ai', case when not coalesce(ai.connected and ai.enabled and not ai.paused,false) then 'IA não está pronta.' end,
    'whatsapp_outbound', case when not coalesce(wa.ready,false) then 'Saída do WA-AKG não está pronta.' end,
    'whatsapp_inbound', case when not coalesce(wa.ready,false) then coalesce(wa.status_detail,'Entrada do WA-AKG ainda não foi homologada.') end,
    'scheduler', case when not coalesce(sc.connected and sc.enabled and not sc.paused,false) then 'Agendador server-side não está pronto.' end
  )) as blockers
from public.company_settings cs
left join public.integrations ai on ai.organization_id=cs.organization_id and ai.key='ai'
left join lateral (
  select candidate.ready, candidate.last_error, candidate.status_detail
  from (
    select
      (
        a.connection_status = 'connected'
        and a.enabled = true
        and i.connected = true
        and i.enabled = true
        and i.paused = false
        and c.inbound_enabled = true
        and c.send_enabled = true
        and c.automation_enabled = true
        and c.kill_switch = false
        and i.last_error is null
      ) as ready,
      i.last_error,
      i.status_detail,
      a.updated_at
    from public.whatsapp_accounts a
    left join public.integrations i
      on i.organization_id = a.organization_id
     and (i.id = a.integration_id or i.key = 'whatsapp_wa_akg:' || a.id::text)
    left join public.messaging_provider_controls c
      on c.organization_id = a.organization_id and c.provider = 'wa_akg'
    where a.organization_id = cs.organization_id
      and a.provider = 'wa_akg'
      and a.archived_at is null
  ) candidate
  order by candidate.ready desc, candidate.updated_at desc nulls last
  limit 1
) wa on true
left join public.integrations sc on sc.organization_id=cs.organization_id and sc.key='scheduler';

alter view public.operational_readiness set (security_invoker = true);
