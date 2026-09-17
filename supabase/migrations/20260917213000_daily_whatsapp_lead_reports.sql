begin;

alter table public.notification_preferences
  add column if not exists daily_lead_report_enabled boolean not null default false,
  add column if not exists daily_lead_report_phone text,
  add column if not exists daily_lead_report_time time without time zone not null default '18:00:00'::time,
  add column if not exists daily_lead_report_last_status text,
  add column if not exists daily_lead_report_last_sent_at timestamptz,
  add column if not exists daily_lead_report_last_error text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'notification_preferences_daily_lead_report_phone_check'
  ) then
    alter table public.notification_preferences
      add constraint notification_preferences_daily_lead_report_phone_check
      check (daily_lead_report_phone is null or daily_lead_report_phone ~ '^[1-9][0-9]{7,14}$');
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'notification_preferences_daily_lead_report_status_check'
  ) then
    alter table public.notification_preferences
      add constraint notification_preferences_daily_lead_report_status_check
      check (daily_lead_report_last_status is null or daily_lead_report_last_status in ('sending', 'sent', 'failed', 'reconciliation_required', 'blocked'));
  end if;
end $$;

create table if not exists public.daily_lead_report_deliveries (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  local_day date not null,
  scheduled_for time without time zone not null,
  message_sha256 text not null check (message_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed', 'reconciliation_required', 'blocked')),
  attempted_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, local_day)
);

create index if not exists daily_lead_report_deliveries_org_status_idx
  on public.daily_lead_report_deliveries (organization_id, status, created_at desc);

alter table public.daily_lead_report_deliveries enable row level security;
revoke all on table public.daily_lead_report_deliveries from public, anon, authenticated;
grant all on table public.daily_lead_report_deliveries to service_role;

comment on table public.daily_lead_report_deliveries is
  'Registro idempotente dos resumos diários enviados pelo servidor. Não armazena o conteúdo ou telefone do WhatsApp.';

commit;
