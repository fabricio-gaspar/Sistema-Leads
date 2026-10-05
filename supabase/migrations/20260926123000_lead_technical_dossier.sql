-- Dossiê técnico é um complemento estruturado da qualificação já existente.
-- Não cria uma segunda conversa, uma nova fila ou uma rota de despacho.
alter table public.lead_qualifications
  add column if not exists technical_context jsonb not null default '{}'::jsonb,
  add column if not exists missing_fields text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'lead_qualifications_technical_context_object_chk'
      and conrelid = 'public.lead_qualifications'::regclass
  ) then
    alter table public.lead_qualifications
      add constraint lead_qualifications_technical_context_object_chk
      check (jsonb_typeof(technical_context) = 'object');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'lead_qualifications_missing_fields_limit_chk'
      and conrelid = 'public.lead_qualifications'::regclass
  ) then
    alter table public.lead_qualifications
      add constraint lead_qualifications_missing_fields_limit_chk
      check (cardinality(missing_fields) <= 8);
  end if;
end $$;
