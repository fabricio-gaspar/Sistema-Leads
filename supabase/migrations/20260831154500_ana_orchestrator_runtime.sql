-- Ana: orquestrador comercial no domínio operacional já publicado.
-- Não cria um segundo agente e não altera nem remove registros existentes.

begin;

alter table public.leads
  add column if not exists modo_atendimento text,
  add column if not exists ana_stage text,
  add column if not exists ana_outcome text;

alter table public.leads
  drop constraint if exists leads_modo_atendimento_check,
  add constraint leads_modo_atendimento_check
    check (modo_atendimento is null or modo_atendimento in ('ia', 'humano')),
  drop constraint if exists leads_ana_stage_check,
  add constraint leads_ana_stage_check
    check (ana_stage is null or ana_stage in ('novo', 'apresentado', 'qualificando', 'reuniao', 'orcamento', 'fechado')),
  drop constraint if exists leads_ana_outcome_check,
  add constraint leads_ana_outcome_check
    check (ana_outcome is null or ana_outcome in ('ganho', 'perdido'));

create index if not exists leads_org_ana_stage_updated_idx
  on public.leads (organization_id, ana_stage, updated_at desc)
  where ana_stage is not null;
create index if not exists leads_org_timeout_idx
  on public.leads (organization_id, no_reply_deadline_at)
  where no_reply_deadline_at is not null and ai_paused = false;

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event text not null check (event in ('lead.created', 'message.received', 'stage.changed', 'meeting.done', 'timeout.48h', 'manual.run')),
  modo text not null check (modo in ('ia', 'humano')),
  status text not null check (status in ('running', 'completed', 'failed', 'skipped')),
  input_context jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  idempotency_key text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists agent_runs_org_idempotency_key_uq
  on public.agent_runs (organization_id, idempotency_key);
create index if not exists agent_runs_lead_created_idx
  on public.agent_runs (lead_id, created_at desc);

alter table public.agent_runs enable row level security;
revoke all on table public.agent_runs from anon;
grant select on table public.agent_runs to authenticated;

drop policy if exists agent_runs_select_assigned_lead on public.agent_runs;
create policy agent_runs_select_assigned_lead on public.agent_runs
  for select to authenticated
  using (
    organization_id = (select public.current_org_id())
    and exists (
      select 1
      from public.leads lead
      where lead.id = agent_runs.lead_id
        and lead.organization_id = agent_runs.organization_id
        and (
          private.has_org_role(lead.organization_id, (select auth.uid()), array['administrador'::app_role, 'sdr'::app_role, 'ia'::app_role])
          or lead.owner_id = (select auth.uid())
          or lead.assigned_to = (select auth.uid())
        )
    )
  );

-- Configuração padrão só ocupa campos vazios. A personalização existente da
-- empresa continua tendo precedência e pode ser alterada na tela atual.
update public.company_settings
set
  ai_provider = 'openai',
  ai_actions_enabled = true,
  ai_prompt = coalesce(nullif(trim(ai_prompt), ''), $$Você é a Ana deste CRM. Responda em pt-BR, de forma direta, em JSON válido.
Funil rígido: Novo → Apresentado → Qualificando → Reunião → Orçamento → Ganho/Perdido.
Faça uma pergunta e um CTA por vez. Não invente preço, prazo ou desconto fora do catálogo aprovado.
Em 48h sem resposta, sugira Perdido e notifique o responsável. Faça handoff quando houver pedido de humano, reclamação, jurídico ou valor fora da faixa.
No primeiro contato, apresente a empresa e um serviço do ICP. Qualifique dor, prazo, orçamento e decisor.
Ofereça 2 ou 3 horários e só agende após confirmação. Orçamento sempre nasce como rascunho; allow_auto_quote é falso por padrão.$$),
  autonomy = coalesce(autonomy, '{}'::jsonb) || jsonb_build_object('allow_auto_quote', false, 'ana_orchestrator', true),
  updated_at = now()
where ai_prompt is null or trim(ai_prompt) = '' or ai_provider is distinct from 'openai' or ai_actions_enabled is distinct from true;

commit;
