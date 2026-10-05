-- Production readiness phase 2: database-level production activation gate.

create or replace function private.enforce_real_mode_readiness()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  ai_ok boolean;
  wa_ok boolean;
  webhook_ok boolean;
  scheduler_ok boolean;
  reasons text[] := array[]::text[];
begin
  if new.sandbox_mode is not false or old.sandbox_mode is not distinct from new.sandbox_mode then
    return new;
  end if;

  if new.active is not true then reasons := array_append(reasons, 'empresa_inativa'); end if;
  if new.can_use_ia is not true or new.ai_actions_enabled is not true then reasons := array_append(reasons, 'ia_desabilitada_na_empresa'); end if;

  select coalesce(bool_and(connected and enabled and not paused), false)
    into ai_ok
    from public.integrations
   where organization_id = new.organization_id and key = 'ai';

  select coalesce(bool_and(connected and enabled and not paused), false)
    into wa_ok
    from public.integrations
   where organization_id = new.organization_id and key = 'whatsapp';

  select coalesce(bool_and(connected and enabled and not paused), false)
    into webhook_ok
    from public.integrations
   where organization_id = new.organization_id and key = 'zapi_webhook';

  select coalesce(bool_and(connected and enabled and not paused), false)
    into scheduler_ok
    from public.integrations
   where organization_id = new.organization_id and key = 'scheduler';

  if not ai_ok then reasons := array_append(reasons, 'ia_nao_pronta'); end if;
  if not wa_ok then reasons := array_append(reasons, 'whatsapp_saida_nao_pronto'); end if;
  if not webhook_ok then reasons := array_append(reasons, 'whatsapp_entrada_nao_homologada'); end if;
  if not scheduler_ok then reasons := array_append(reasons, 'scheduler_nao_pronto'); end if;

  if cardinality(reasons) > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'real_mode_blocked:' || array_to_string(reasons, ',');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_company_settings_real_mode_gate on public.company_settings;
create trigger trg_company_settings_real_mode_gate
before update of sandbox_mode on public.company_settings
for each row execute function private.enforce_real_mode_readiness();
