-- Mantém o status de entrega projetado na mensagem alinhado com a fila.
-- A Central já traduz esses estados; a correção evita que uma mensagem Ana
-- em `outreach_jobs` permaneça sem status e apareça apenas como "Registrada".

begin;

create or replace function private.project_outreach_job_delivery_status()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_message_id uuid;
  v_delivery_status text;
begin
  if new.organization_id is null
     or new.status not in ('queued', 'retry', 'processing', 'processed', 'failed')
     or not ((new.payload ->> 'message_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
    return new;
  end if;

  v_message_id := (new.payload ->> 'message_id')::uuid;
  v_delivery_status := case
    when new.status in ('queued', 'retry', 'processing') then 'queued'
    when new.status = 'processed' then 'sent'
    when new.status = 'failed' then 'failed'
    else null
  end;

  update public.lead_messages as message
     set delivery_status = v_delivery_status
   where message.id = v_message_id
     and message.organization_id = new.organization_id
     and (
       message.delivery_status is null
       or (v_delivery_status = 'failed' and message.delivery_status not in ('delivered', 'read'))
       or (v_delivery_status = 'sent' and message.delivery_status = 'queued')
     );

  return new;
end;
$function$;

revoke all on function private.project_outreach_job_delivery_status() from public, anon, authenticated;

drop trigger if exists outreach_jobs_project_delivery_status on public.outreach_jobs;
create trigger outreach_jobs_project_delivery_status
after insert or update of status, payload on public.outreach_jobs
for each row execute function private.project_outreach_job_delivery_status();

-- Corrige mensagens já enfileiradas antes do trigger existir, sem tocar em
-- mensagens sem uma referência explícita à fila.
with queue_projection as (
  select distinct on (j.organization_id, (j.payload ->> 'message_id'))
    j.organization_id,
    (j.payload ->> 'message_id')::uuid as message_id,
    case
      when j.status in ('queued', 'retry', 'processing') then 'queued'
      when j.status = 'processed' then 'sent'
      when j.status = 'failed' then 'failed'
      else null
    end as delivery_status
  from public.outreach_jobs as j
  where j.status in ('queued', 'retry', 'processing', 'processed', 'failed')
    and (j.payload ->> 'message_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  order by j.organization_id, (j.payload ->> 'message_id'), j.run_at desc, j.id desc
)
update public.lead_messages as message
   set delivery_status = projection.delivery_status
  from queue_projection as projection
 where message.id = projection.message_id
   and message.organization_id = projection.organization_id
   and projection.delivery_status is not null
   and (
     message.delivery_status is null
     or (projection.delivery_status = 'failed' and message.delivery_status not in ('delivered', 'read'))
     or (projection.delivery_status = 'sent' and message.delivery_status = 'queued')
   );

comment on function private.project_outreach_job_delivery_status() is
  'Projects internal outreach queue state into lead_messages.delivery_status for the Central de Atendimento.';

commit;
