-- O painel nunca deve ser o motor da operação. Este agendador chama o worker
-- apenas para empresas que o ativaram e usa um token por organização guardado
-- no Vault. Nenhum segredo é devolvido ao navegador.

begin;

create schema if not exists private;

do $$
declare
  v_secret_id uuid;
begin
  select id
    into v_secret_id
  from vault.secrets
  where name = 'leadai_automation_dispatch_url';

  if v_secret_id is null then
    perform vault.create_secret(
      'https://thgzrkppouoevapjquyu.supabase.co',
      'leadai_automation_dispatch_url',
      'URL interna para o despachante de automações WayFlex',
      null
    );
  else
    perform vault.update_secret(
      v_secret_id,
      'https://thgzrkppouoevapjquyu.supabase.co',
      'URL interna para o despachante de automações WayFlex',
      null
    );
  end if;
end;
$$;

create or replace function private.dispatch_automation_workers(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private, vault, net
as $$
declare
  v_base_url text;
  v_scheduler record;
  v_token text;
  v_dispatched integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'invalid_dispatch_limit';
  end if;

  select decrypted_secret
    into v_base_url
  from vault.decrypted_secrets
  where name = 'leadai_automation_dispatch_url';

  if v_base_url is null or v_base_url !~ '^https://[^/]+$' then
    raise exception 'automation_dispatch_url_missing';
  end if;

  for v_scheduler in
    select
      i.id,
      i.organization_id,
      nullif(i.configuration ->> 'secret_ref', '')::uuid as secret_ref
    from public.integrations i
    join public.company_settings c on c.organization_id = i.organization_id
    where i.key = 'scheduler'
      and i.enabled = true
      and i.paused = false
      and c.active = true
    order by i.updated_at
    limit p_limit
  loop
    if v_scheduler.secret_ref is null then
      update public.integrations
      set connected = false,
          last_error = 'scheduler_secret_missing',
          status_detail = 'Worker aguardando preparação segura.',
          updated_at = now()
      where id = v_scheduler.id;
      continue;
    end if;

    select decrypted_secret::jsonb ->> 'scheduler_token'
      into v_token
    from vault.decrypted_secrets
    where id = v_scheduler.secret_ref;

    if v_token is null or length(v_token) < 48 then
      update public.integrations
      set connected = false,
          last_error = 'scheduler_secret_invalid',
          status_detail = 'Worker aguardando preparação segura.',
          updated_at = now()
      where id = v_scheduler.id;
      continue;
    end if;

    perform net.http_post(
      url := v_base_url || '/functions/v1/automation-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-leadai-scheduler-token', v_token
      ),
      body := jsonb_build_object(
        'run', 'outreach',
        'organization_id', v_scheduler.organization_id,
        'source', 'server_scheduler'
      ),
      timeout_milliseconds := 20000
    );
    v_dispatched := v_dispatched + 1;
  end loop;

  return v_dispatched;
end;
$$;

revoke all on function private.dispatch_automation_workers(integer) from public, anon, authenticated;
grant execute on function private.dispatch_automation_workers(integer) to service_role;

select cron.schedule(
  'leadai-automation-worker-dispatch',
  '* * * * *',
  $$select private.dispatch_automation_workers(100);$$
);

comment on function private.dispatch_automation_workers(integer) is
  'Despacha o automation-worker a cada minuto para organizações que ativaram o worker; autenticação por token no Vault e sem dependência do navegador.';

commit;
