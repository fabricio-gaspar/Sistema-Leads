begin;

-- These tables are backend queues.  An explicit deny policy documents that
-- browser roles must never read or mutate their contents; service_role keeps
-- its normal RLS bypass for the Edge workers.
create policy wa_akg_webhook_events_backend_only
  on public.wa_akg_webhook_events
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy wa_akg_seller_jobs_backend_only
  on public.wa_akg_seller_provisioning_jobs
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy messaging_send_reservations_backend_only
  on public.messaging_send_reservations
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Cover each foreign-key leading column so account/user deletion and webhook
-- reconciliation do not degrade as the queues grow.
create index wa_akg_webhook_events_whatsapp_account_fk_idx
  on public.wa_akg_webhook_events (whatsapp_account_id);

create index wa_akg_seller_jobs_owner_user_fk_idx
  on public.wa_akg_seller_provisioning_jobs (owner_user_id);

commit;
