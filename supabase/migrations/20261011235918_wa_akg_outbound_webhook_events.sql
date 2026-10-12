alter table public.wa_akg_webhook_events
  drop constraint if exists wa_akg_webhook_events_event_kind_check;

alter table public.wa_akg_webhook_events
  add constraint wa_akg_webhook_events_event_kind_check
  check (event_kind in ('inbound', 'outbound', 'receipt', 'connection', 'ignored'));
