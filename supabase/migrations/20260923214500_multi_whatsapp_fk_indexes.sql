-- Índices com a FK como primeira coluna aceleram exclusões/arquivamentos de
-- contas e eliminam varreduras integrais durante a verificação referencial.
create index if not exists leads_whatsapp_account_fk_idx
  on public.leads (whatsapp_account_id) where whatsapp_account_id is not null;
create index if not exists lead_messages_whatsapp_account_fk_idx
  on public.lead_messages (whatsapp_account_id) where whatsapp_account_id is not null;
create index if not exists outreach_jobs_whatsapp_account_fk_idx
  on public.outreach_jobs (whatsapp_account_id) where whatsapp_account_id is not null;
create index if not exists lead_outreach_whatsapp_account_fk_idx
  on public.lead_outreach (whatsapp_account_id) where whatsapp_account_id is not null;
create index if not exists webhook_events_whatsapp_account_fk_idx
  on public.webhook_events (whatsapp_account_id) where whatsapp_account_id is not null;
create index if not exists channel_inbound_whatsapp_account_fk_idx
  on public.channel_inbound_events (whatsapp_account_id) where whatsapp_account_id is not null;
create index if not exists whatsapp_accounts_created_by_fk_idx
  on public.whatsapp_accounts (created_by) where created_by is not null;
