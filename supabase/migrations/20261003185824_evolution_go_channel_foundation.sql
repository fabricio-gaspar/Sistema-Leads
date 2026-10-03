-- Evolution GO is an additive WhatsApp provider. Existing Z-API and Meta
-- accounts remain untouched and Evolution starts disabled until a privileged
-- operator validates the instance and explicitly makes it the default channel.

begin;

alter table public.whatsapp_accounts
  drop constraint if exists whatsapp_accounts_provider_check,
  drop constraint if exists whatsapp_accounts_zapi_integration_check;

alter table public.whatsapp_accounts
  add constraint whatsapp_accounts_provider_check
    check (provider in ('zapi', 'meta_cloud', 'evolution_go')),
  add constraint whatsapp_accounts_provider_integration_check
    check (provider not in ('zapi', 'evolution_go') or integration_id is not null);

alter table public.messaging_provider_controls
  drop constraint if exists messaging_provider_controls_provider_check;

alter table public.messaging_provider_controls
  add constraint messaging_provider_controls_provider_check
    check (provider in ('zapi', 'meta_cloud', 'evolution_go'));

alter table public.messaging_outbox
  drop constraint if exists messaging_outbox_message_kind_check;

alter table public.messaging_outbox
  add constraint messaging_outbox_message_kind_check
    check (message_kind in ('text', 'template', 'image', 'audio', 'video', 'document'));

create unique index if not exists lead_messages_evolution_go_provider_message_uidx
  on public.lead_messages (organization_id, provider_message_id)
  where provider = 'evolution_go' and provider_message_id is not null;

-- The raw provider callback is intentionally not made readable through the
-- Data API. It is persisted only for idempotency and asynchronous processing by
-- service-role workers; secrets and QR/pairing values are removed before insert.
create table public.evolution_go_webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  whatsapp_account_id uuid not null references public.whatsapp_accounts(id) on delete cascade,
  integration_id uuid not null references public.integrations(id) on delete cascade,
  external_event_id text not null check (char_length(external_event_id) between 1 and 300),
  event_kind text not null check (event_kind in ('inbound', 'receipt', 'connection', 'media', 'unknown')),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  sanitized_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(sanitized_payload) = 'object'),
  processing_status text not null default 'queued'
    check (processing_status in ('queued', 'processing', 'processed', 'ignored', 'needs_review', 'failed', 'dead_letter')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  next_retry_at timestamptz not null default now(),
  occurred_at timestamptz,
  processed_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, whatsapp_account_id, external_event_id)
);

create index evolution_go_webhook_events_queue_idx
  on public.evolution_go_webhook_events (next_retry_at, created_at)
  where processing_status in ('queued', 'failed');
create index evolution_go_webhook_events_account_idx
  on public.evolution_go_webhook_events (organization_id, whatsapp_account_id, created_at desc);

alter table public.evolution_go_webhook_events enable row level security;
revoke all on table public.evolution_go_webhook_events from public, anon, authenticated;
grant all on table public.evolution_go_webhook_events to service_role;

drop trigger if exists evolution_go_webhook_events_set_updated_at on public.evolution_go_webhook_events;
create trigger evolution_go_webhook_events_set_updated_at
before update on public.evolution_go_webhook_events
for each row execute procedure public.set_updated_at();

-- Controls are explicit and fail closed for every existing organization.
insert into public.messaging_provider_controls (
  organization_id, provider, inbound_enabled, send_enabled, automation_enabled, kill_switch, reason
)
select id, 'evolution_go', false, false, false, true, 'provider_not_validated'
from public.organizations
on conflict (organization_id, provider) do nothing;

create or replace function public.central_get_conversation_channel_provider(p_lead_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select case
    when account.provider in ('zapi', 'meta_cloud', 'evolution_go') then account.provider
    else null
  end
    from public.leads as lead
    left join public.whatsapp_accounts as account
      on account.id = lead.whatsapp_account_id
     and account.organization_id = lead.organization_id
   where lead.id = p_lead_id
     and lead.organization_id = public.current_org_id()
     and lead.archived_at is null
     and private.can_access_lead(lead.organization_id, lead.id, auth.uid())
   limit 1
$function$;

revoke all on function public.central_get_conversation_channel_provider(uuid) from public, anon;
grant execute on function public.central_get_conversation_channel_provider(uuid) to authenticated, service_role;

comment on table public.evolution_go_webhook_events is
  'Evolution GO callbacks, idempotent and service-role only. Sanitized payloads never contain provider credentials, QR codes, or pairing codes.';

commit;
