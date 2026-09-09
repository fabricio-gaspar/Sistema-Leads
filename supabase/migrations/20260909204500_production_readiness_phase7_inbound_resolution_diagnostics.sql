create or replace function private.reflect_whatsapp_resolution_failure()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  suffix text;
  detail text;
begin
  if new.status = 'failed'
     and new.error in ('lead_not_matched','lead_identity_ambiguous')
     and lower(coalesce(new.provider,'')) in ('zapi','z-api','whatsapp') then
    suffix := right(regexp_replace(coalesce(new.payload->>'phone',''), '\D', '', 'g'), 4);
    detail := case new.error
      when 'lead_identity_ambiguous' then
        case when suffix <> '' then
          'Webhook recebeu uma mensagem do número final ' || suffix || ', mas mais de um lead compartilha essa identidade e não existe vínculo de conversa suficiente para escolher com segurança.'
        else
          'Webhook recebeu uma mensagem, mas mais de um lead compartilha a identidade e não existe vínculo de conversa suficiente para escolher com segurança.'
        end
      else
        case when suffix <> '' then
          'Webhook recebeu uma mensagem real do WhatsApp, mas o número final ' || suffix || ' não pertence a nenhum lead cadastrado. Cadastre/use o mesmo número do lead e responda novamente.'
        else
          'Webhook recebeu uma mensagem real do WhatsApp, mas não conseguiu associá-la a um lead cadastrado.'
        end
    end;

    update public.integrations
       set connected = false,
           enabled = true,
           last_tested_at = coalesce(new.processed_at, now()),
           last_error = new.error,
           status_detail = detail,
           updated_at = now()
     where organization_id = new.organization_id
       and key = 'zapi_webhook';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_webhook_unmatched_diagnostic on public.webhook_events;
drop trigger if exists trg_webhook_resolution_diagnostic on public.webhook_events;
create trigger trg_webhook_resolution_diagnostic
after insert or update of status, error on public.webhook_events
for each row execute function private.reflect_whatsapp_resolution_failure();
