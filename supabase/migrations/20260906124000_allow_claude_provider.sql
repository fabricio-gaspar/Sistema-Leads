-- A configuração da empresa pode identificar corretamente o provedor que a
-- Edge Function já chama no backend. A chave continua fora do banco público.
begin;

alter table public.company_settings
  drop constraint if exists company_settings_ai_provider_check;

alter table public.company_settings
  add constraint company_settings_ai_provider_check
  check (ai_provider is null or ai_provider in ('openai', 'claude'));

commit;
