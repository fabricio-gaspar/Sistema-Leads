-- Mantém o contrato do banco alinhado aos estados usados pelas funções seguras:
-- configurada (aguarda teste), conectada, degradada/falha e desativada.
alter table public.lead_source_configs
  drop constraint if exists lead_source_configs_connection_status_check;

alter table public.lead_source_configs
  add constraint lead_source_configs_connection_status_check
  check (
    connection_status = any (
      array[
        'not_configured'::text,
        'configured'::text,
        'connected'::text,
        'degraded'::text,
        'error'::text,
        'disabled'::text
      ]
    )
  );
