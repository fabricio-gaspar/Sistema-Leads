-- Aplicada no projeto remoto "Sistema de Leads" em 2026-08-27.
-- Reconcilia a agenda do frontend com a tabela public.appointments já existente.

alter table public.appointments
  add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on column public.appointments.metadata is
  'Dados operacionais da agenda: tipo, canal, responsável, origem e lembretes.';

create index if not exists appointments_organization_starts_at_idx
  on public.appointments (organization_id, starts_at);
