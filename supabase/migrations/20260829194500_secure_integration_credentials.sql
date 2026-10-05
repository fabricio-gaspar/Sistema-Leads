-- O enum de papéis mantém os nomes históricos em português. A camada de
-- autorização normaliza "administrador" para o papel interno de administrador
-- sem alterar dados existentes.

create or replace function public.store_integration_secret(p_integration uuid, p_secret jsonb)
returns void language plpgsql security definer set search_path = public, vault as $$
declare old_secret uuid; new_secret uuid;
begin
  select nullif(configuration ->> 'secret_ref', '')::uuid into old_secret from public.integrations where id = p_integration for update;
  select vault.create_secret(p_secret::text, 'integration_' || p_integration::text, 'Integration credentials') into new_secret;
  update public.integrations set configuration = coalesce(configuration, '{}'::jsonb) || jsonb_build_object('secret_ref', new_secret::text, 'configured', true), connected = false, enabled = false, paused = false, status_detail = 'Credenciais guardadas. Aguardando validação.', updated_at = now() where id = p_integration;
  if old_secret is not null then delete from vault.secrets where id = old_secret; end if;
end;
$$;
revoke all on function public.store_integration_secret(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.store_integration_secret(uuid, jsonb) to service_role;

create or replace function public.read_integration_secret(p_integration uuid)
returns jsonb language plpgsql security definer set search_path = public, vault as $$
declare secret_id uuid; secret_value text;
begin
  select nullif(configuration ->> 'secret_ref', '')::uuid into secret_id from public.integrations where id = p_integration;
  if secret_id is null then return null; end if;
  select decrypted_secret into secret_value from vault.decrypted_secrets where id = secret_id;
  return secret_value::jsonb;
end;
$$;
revoke all on function public.read_integration_secret(uuid) from public, anon, authenticated;
grant execute on function public.read_integration_secret(uuid) to service_role;
