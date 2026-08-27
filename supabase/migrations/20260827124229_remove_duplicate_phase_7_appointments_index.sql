-- Aplicada no projeto remoto "Sistema de Leads" em 2026-08-27.
-- A tabela já possuía índice equivalente para (organization_id, starts_at).

drop index if exists public.appointments_organization_starts_at_idx;
