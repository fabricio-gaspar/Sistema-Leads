-- A categoria é a fonte de verdade para a organização das integrações.
-- Ela não contém credenciais e permite que o painel separe prospecção de atendimento.
alter table public.integrations
  add column if not exists category text not null default 'system';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'integrations_category_check'
      and conrelid = 'public.integrations'::regclass
  ) then
    alter table public.integrations
      add constraint integrations_category_check
      check (category in ('prospecting', 'communication', 'intelligence', 'scheduling', 'system'));
  end if;
end $$;

update public.integrations
set category = case key
  when 'apify' then 'prospecting'
  when 'google_places' then 'prospecting'
  when 'cnpj_ws' then 'prospecting'
  when 'whatsapp' then 'communication'
  when 'zapi_webhook' then 'communication'
  when 'email' then 'communication'
  when 'resend_webhook' then 'communication'
  when 'google_calendar' then 'communication'
  when 'ai' then 'intelligence'
  when 'scheduler' then 'scheduling'
  else 'system'
end
where category = 'system';

create index if not exists integrations_organization_category_idx
  on public.integrations (organization_id, category);
