-- Fase 8.1: núcleo operacional da Ana e do Kanban comercial.
-- Mantém tabelas legadas intactas; esta migration só cria o domínio novo.

create table if not exists public.crm_opportunities (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete restrict,
  stage_code text not null default 'entered' check (stage_code in ('entered', 'engaging', 'qualified', 'quote_sent', 'decision')),
  outcome text not null default 'open' check (outcome in ('open', 'won', 'lost')),
  stage_changed_at timestamptz not null default now(),
  stage_source text not null default 'human' check (stage_source in ('human', 'rule', 'ai_suggestion')),
  stage_confidence numeric(4,3) check (stage_confidence is null or (stage_confidence >= 0 and stage_confidence <= 1)),
  closed_at timestamptz,
  lost_reason text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, lead_id),
  check ((outcome = 'lost') = (lost_reason is not null))
);

create table if not exists public.crm_stage_events (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid not null references public.crm_opportunities(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete restrict,
  from_stage_code text,
  to_stage_code text not null check (to_stage_code in ('entered', 'engaging', 'qualified', 'quote_sent', 'decision')),
  outcome text not null default 'open' check (outcome in ('open', 'won', 'lost')),
  source text not null check (source in ('human', 'rule', 'ai_suggestion')),
  reason_code text,
  evidence_message_id uuid references public.lead_messages(id) on delete set null,
  ai_decision_id uuid references public.ai_decisions(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  occurred_at timestamptz not null default now(),
  check (from_stage_code is null or from_stage_code in ('entered', 'engaging', 'qualified', 'quote_sent', 'decision'))
);

create table if not exists public.ai_agents (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null default 'ana',
  name text not null default 'Ana',
  active_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table if not exists public.ai_agent_versions (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  configuration jsonb not null default '{}'::jsonb,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (agent_id, version_number),
  check ((status = 'published') = (published_at is not null))
);

alter table public.ai_agents
  drop constraint if exists ai_agents_active_version_id_fkey,
  add constraint ai_agents_active_version_id_fkey
    foreign key (active_version_id) references public.ai_agent_versions(id) on delete set null;

create table if not exists public.channel_health_samples (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid references public.integrations(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'email', 'voice')),
  source text not null check (source in ('meta', 'provider', 'derived')),
  sampled_at timestamptz not null default now(),
  sent_count integer not null default 0 check (sent_count >= 0),
  delivered_count integer not null default 0 check (delivered_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  opt_out_count integer not null default 0 check (opt_out_count >= 0),
  complaint_count integer not null default 0 check (complaint_count >= 0),
  quality_rating text,
  raw_metrics jsonb not null default '{}'::jsonb
);

create table if not exists public.channel_policy_events (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid references public.integrations(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'email', 'voice')),
  risk_level text not null check (risk_level in ('normal', 'attention', 'high', 'critical')),
  action text not null check (action in ('warn', 'throttle', 'pause', 'resume')),
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists crm_opportunities_org_open_idx on public.crm_opportunities (organization_id, outcome, stage_code) where not is_archived;
create index if not exists crm_stage_events_opportunity_occurred_idx on public.crm_stage_events (opportunity_id, occurred_at desc);
create index if not exists channel_health_samples_org_channel_sampled_idx on public.channel_health_samples (organization_id, channel, sampled_at desc);
create index if not exists channel_policy_events_org_open_idx on public.channel_policy_events (organization_id, channel, created_at desc) where resolved_at is null;

alter table public.crm_opportunities enable row level security;
alter table public.crm_stage_events enable row level security;
alter table public.ai_agents enable row level security;
alter table public.ai_agent_versions enable row level security;
alter table public.channel_health_samples enable row level security;
alter table public.channel_policy_events enable row level security;

grant select, insert, update, delete on public.crm_opportunities, public.crm_stage_events, public.ai_agents, public.ai_agent_versions, public.channel_health_samples, public.channel_policy_events to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['crm_opportunities','crm_stage_events','ai_agents','ai_agent_versions','channel_health_samples','channel_policy_events']
  loop
    execute format('drop policy if exists phase8_org_access on public.%I', table_name);
    execute format(
      'create policy phase8_org_access on public.%I for all to authenticated using ((select private.is_active_org_member(organization_id, (select auth.uid())))) with check ((select private.is_active_org_member(organization_id, (select auth.uid()))))',
      table_name
    );
  end loop;
end $$;
