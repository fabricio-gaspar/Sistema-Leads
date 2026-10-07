-- Evolution GO is the sole active WhatsApp transport. This decommissions
-- legacy routes without deleting accounts, credentials, conversations,
-- messages, receipts, or audit history.

update public.messaging_provider_controls
set
  inbound_enabled = false,
  send_enabled = false,
  automation_enabled = false,
  kill_switch = true,
  reason = 'Canal legado desativado: Evolution GO é o único canal ativo do WayFlex. Histórico e configuração foram preservados.',
  updated_at = now()
where provider in ('zapi', 'meta_cloud', 'wa_akg');

update public.whatsapp_accounts
set
  enabled = false,
  is_default = false,
  updated_at = now()
where provider in ('zapi', 'meta_cloud', 'wa_akg')
  and archived_at is null;

update public.integrations
set
  enabled = false,
  paused = true,
  status_detail = 'Canal legado desativado. Evolution GO é o único canal ativo; histórico e configuração foram preservados.',
  updated_at = now()
where lower(coalesce(provider, '')) in ('z-api', 'zapi', 'meta', 'meta cloud', 'meta_cloud', 'wa-akg', 'wa_akg')
   or key in ('whatsapp', 'zapi_webhook');
