-- Production readiness phase 1: observable readiness and actionable inbound diagnostics.

create or replace view public.operational_readiness
with (security_invoker = true)
as
select
  cs.organization_id,
  cs.name as company_name,
  cs.sandbox_mode,
  (omd.data->>'modoExecucao') as runtime_mode,
  coalesce(ai.connected and ai.enabled and not ai.paused, false) as ai_ready,
  coalesce(wa.connected and wa.enabled and not wa.paused, false) as whatsapp_outbound_ready,
  coalesce(wh.connected and wh.enabled and not wh.paused, false) as whatsapp_inbound_ready,
  coalesce(sc.connected and sc.enabled and not sc.paused, false) as scheduler_ready,
  coalesce(wh.last_error, '') as whatsapp_inbound_last_error,
  wh.status_detail as whatsapp_inbound_status_detail,
  greatest(
    0,
    (case when not coalesce(ai.connected and ai.enabled and not ai.paused, false) then 1 else 0 end) +
    (case when not coalesce(wa.connected and wa.enabled and not wa.paused, false) then 1 else 0 end) +
    (case when not coalesce(wh.connected and wh.enabled and not wh.paused, false) then 1 else 0 end) +
    (case when not coalesce(sc.connected and sc.enabled and not sc.paused, false) then 1 else 0 end) +
    (case when (omd.data->>'modoExecucao') is distinct from (case when cs.sandbox_mode then 'DEMONSTRACAO' else 'PRODUCAO' end) then 1 else 0 end)
  ) as blocker_count,
  jsonb_strip_nulls(jsonb_build_object(
    'runtime_mismatch', case when (omd.data->>'modoExecucao') is distinct from (case when cs.sandbox_mode then 'DEMONSTRACAO' else 'PRODUCAO' end) then 'Modo visual diverge do backend.' end,
    'ai', case when not coalesce(ai.connected and ai.enabled and not ai.paused, false) then 'IA não está pronta.' end,
    'whatsapp_outbound', case when not coalesce(wa.connected and wa.enabled and not wa.paused, false) then 'Saída do WhatsApp não está pronta.' end,
    'whatsapp_inbound', case when not coalesce(wh.connected and wh.enabled and not wh.paused, false) then coalesce(wh.status_detail, 'Entrada do WhatsApp ainda não foi homologada.') end,
    'scheduler', case when not coalesce(sc.connected and sc.enabled and not sc.paused, false) then 'Agendador server-side não está pronto.' end
  )) as blockers
from public.company_settings cs
left join public.organization_module_data omd
  on omd.organization_id = cs.organization_id and omd.module_key = 'configuracao_runtime'
left join public.integrations ai
  on ai.organization_id = cs.organization_id and ai.key = 'ai'
left join public.integrations wa
  on wa.organization_id = cs.organization_id and wa.key = 'whatsapp'
left join public.integrations wh
  on wh.organization_id = cs.organization_id and wh.key = 'zapi_webhook'
left join public.integrations sc
  on sc.organization_id = cs.organization_id and sc.key = 'scheduler';

create or replace function private.reflect_unmatched_whatsapp_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  suffix text;
begin
  if new.status = 'failed'
     and new.error = 'lead_not_matched'
     and lower(coalesce(new.provider,'')) in ('zapi','z-api','whatsapp') then
    suffix := right(regexp_replace(coalesce(new.payload->>'phone',''), '\D', '', 'g'), 4);
    update public.integrations
       set connected = false,
           enabled = true,
           last_tested_at = coalesce(new.processed_at, now()),
           last_error = 'lead_not_matched',
           status_detail = case
             when suffix <> '' then 'Webhook recebeu uma mensagem real do WhatsApp, mas o número final ' || suffix || ' não pertence a nenhum lead cadastrado. Cadastre/use o mesmo número do lead e responda novamente.'
             else 'Webhook recebeu uma mensagem real do WhatsApp, mas não conseguiu associá-la a um lead cadastrado.'
           end,
           updated_at = now()
     where organization_id = new.organization_id
       and key = 'zapi_webhook';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_webhook_unmatched_diagnostic on public.webhook_events;
create trigger trg_webhook_unmatched_diagnostic
after insert or update of status, error on public.webhook_events
for each row execute function private.reflect_unmatched_whatsapp_webhook();

with latest as (
  select organization_id, processed_at,
         right(regexp_replace(coalesce(payload->>'phone',''), '\D', '', 'g'), 4) as suffix
    from public.webhook_events
   where status='failed' and error='lead_not_matched'
     and lower(coalesce(provider,'')) in ('zapi','z-api','whatsapp')
   order by created_at desc
   limit 1
)
update public.integrations i
   set connected=false,
       enabled=true,
       last_tested_at=coalesce(latest.processed_at, now()),
       last_error='lead_not_matched',
       status_detail=case when latest.suffix<>'' then 'Webhook recebeu uma mensagem real do WhatsApp, mas o número final '||latest.suffix||' não pertence a nenhum lead cadastrado. Cadastre/use o mesmo número do lead e responda novamente.' else 'Webhook recebeu uma mensagem real do WhatsApp, mas não conseguiu associá-la a um lead cadastrado.' end,
       updated_at=now()
  from latest
 where i.organization_id=latest.organization_id and i.key='zapi_webhook';
