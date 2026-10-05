# Fase 7 — Agenda operacional no Supabase

## Resultado

A Agenda passou a usar `public.appointments` no projeto Supabase **Sistema de Leads**. A tabela já existia, possui RLS e faz o isolamento pela organização ativa do usuário.

## Reconciliação aplicada

- Migration remota: `20260827124047_reconcile_phase_7_appointments_metadata`.
- Campo `metadata` para `tipo`, `canal`, `responsavel`, `origem` e lembretes.
- O índice preexistente `(organization_id, starts_at)` foi preservado para consultas por empresa e período.
- Nenhuma tabela paralela ou dado de agenda foi recriado.

## Contrato operacional

- `starts_at` e `ends_at` armazenam o horário real do compromisso.
- `lead_id`, `organization_id` e `user_id` continuam obrigatórios no banco.
- Status da interface são normalizados para `scheduled`, `completed`, `cancelled` e `no_show`.
- Exclusão permanece definitiva, respeitando a política RLS existente.

## Validação remota

- Coluna `metadata`: presente e `jsonb`.
- Índice preexistente da agenda: preservado; nenhum índice duplicado permaneceu.
- Política `org_active_access`: ativa para o papel `authenticated`.

Uma prova ponta a ponta com duas contas distintas deve ser executada antes da produção, quando a segunda empresa tiver um usuário de homologação próprio.
