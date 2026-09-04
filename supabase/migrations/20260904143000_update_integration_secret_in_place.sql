-- Atualiza o segredo já vinculado à integração em vez de criar outro com o
-- mesmo nome. O Vault exige nomes únicos; recriar a cada salvamento causava
-- falha na segunda configuração da mesma integração.
create or replace function public.store_integration_secret(
  p_integration uuid,
  p_secret jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public', 'vault'
as $$
declare
  current_secret uuid;
begin
  select nullif(configuration ->> 'secret_ref', '')::uuid
    into current_secret
  from public.integrations
  where id = p_integration
  for update;

  if current_secret is not null
     and exists (select 1 from vault.secrets where id = current_secret) then
    perform vault.update_secret(
      current_secret,
      p_secret::text,
      'integration_' || p_integration::text,
      'Integration credentials',
      null
    );
  else
    select vault.create_secret(
      p_secret::text,
      'integration_' || p_integration::text,
      'Integration credentials',
      null
    ) into current_secret;
  end if;

  update public.integrations
  set configuration = coalesce(configuration, '{}'::jsonb)
        || jsonb_build_object('secret_ref', current_secret::text, 'configured', true),
      connected = false,
      enabled = false,
      paused = false,
      status_detail = 'Credenciais guardadas. Aguardando validação.',
      updated_at = now()
  where id = p_integration;
end;
$$;

-- A função é somente para Edge Functions autenticadas com a chave de serviço.
revoke execute on function public.store_integration_secret(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.store_integration_secret(uuid, jsonb) to service_role;
