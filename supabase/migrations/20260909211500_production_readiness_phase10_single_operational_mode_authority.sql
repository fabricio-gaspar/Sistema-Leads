create or replace function private.force_runtime_mode_from_company_settings()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_sandbox boolean;
  v_mode text;
begin
  if new.module_key <> 'configuracao_runtime' then return new; end if;
  select sandbox_mode into v_sandbox from public.company_settings where organization_id = new.organization_id;
  if found then
    v_mode := case when coalesce(v_sandbox,true) then 'DEMONSTRACAO' else 'PRODUCAO' end;
    new.data := jsonb_set(coalesce(new.data,'{}'::jsonb), '{modoExecucao}', to_jsonb(v_mode), true);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_force_runtime_mode_from_company_settings on public.organization_module_data;
create trigger trg_force_runtime_mode_from_company_settings
before insert or update of data on public.organization_module_data
for each row execute function private.force_runtime_mode_from_company_settings();

create or replace function private.sync_runtime_mode_after_company_change()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare v_mode text;
begin
  if new.sandbox_mode is not distinct from old.sandbox_mode then return new; end if;
  v_mode := case when coalesce(new.sandbox_mode,true) then 'DEMONSTRACAO' else 'PRODUCAO' end;
  update public.organization_module_data
     set data = jsonb_set(coalesce(data,'{}'::jsonb), '{modoExecucao}', to_jsonb(v_mode), true), updated_at = now()
   where organization_id = new.organization_id and module_key = 'configuracao_runtime';
  return new;
end;
$function$;

drop trigger if exists trg_sync_runtime_mode_after_company_change on public.company_settings;
create trigger trg_sync_runtime_mode_after_company_change
after update of sandbox_mode on public.company_settings
for each row execute function private.sync_runtime_mode_after_company_change();

update public.organization_module_data omd
set data = jsonb_set(coalesce(omd.data,'{}'::jsonb), '{modoExecucao}', to_jsonb(case when coalesce(cs.sandbox_mode,true) then 'DEMONSTRACAO' else 'PRODUCAO' end), true),
    updated_at = now()
from public.company_settings cs
where cs.organization_id=omd.organization_id and omd.module_key='configuracao_runtime';

create or replace view public.operational_readiness as
select cs.organization_id, cs.name as company_name, cs.sandbox_mode,
  case when coalesce(cs.sandbox_mode,true) then 'DEMONSTRACAO' else 'PRODUCAO' end as runtime_mode,
  coalesce(ai.connected and ai.enabled and not ai.paused,false) as ai_ready,
  coalesce(wa.connected and wa.enabled and not wa.paused,false) as whatsapp_outbound_ready,
  coalesce(wh.connected and wh.enabled and not wh.paused,false) as whatsapp_inbound_ready,
  coalesce(sc.connected and sc.enabled and not sc.paused,false) as scheduler_ready,
  coalesce(wh.last_error,'') as whatsapp_inbound_last_error,
  wh.status_detail as whatsapp_inbound_status_detail,
  greatest(0,
    case when not coalesce(ai.connected and ai.enabled and not ai.paused,false) then 1 else 0 end +
    case when not coalesce(wa.connected and wa.enabled and not wa.paused,false) then 1 else 0 end +
    case when not coalesce(wh.connected and wh.enabled and not wh.paused,false) then 1 else 0 end +
    case when not coalesce(sc.connected and sc.enabled and not sc.paused,false) then 1 else 0 end
  ) as blocker_count,
  jsonb_strip_nulls(jsonb_build_object(
    'ai', case when not coalesce(ai.connected and ai.enabled and not ai.paused,false) then 'IA não está pronta.' end,
    'whatsapp_outbound', case when not coalesce(wa.connected and wa.enabled and not wa.paused,false) then 'Saída do WhatsApp não está pronta.' end,
    'whatsapp_inbound', case when not coalesce(wh.connected and wh.enabled and not wh.paused,false) then coalesce(wh.status_detail,'Entrada do WhatsApp ainda não foi homologada.') end,
    'scheduler', case when not coalesce(sc.connected and sc.enabled and not sc.paused,false) then 'Agendador server-side não está pronto.' end
  )) as blockers
from public.company_settings cs
left join public.integrations ai on ai.organization_id=cs.organization_id and ai.key='ai'
left join public.integrations wa on wa.organization_id=cs.organization_id and wa.key='whatsapp'
left join public.integrations wh on wh.organization_id=cs.organization_id and wh.key='zapi_webhook'
left join public.integrations sc on sc.organization_id=cs.organization_id and sc.key='scheduler';
