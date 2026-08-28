-- Fase 12: reconciliação do domínio operacional publicado.
-- Esta migration preserva dados legados, fecha acesso excessivo e define as
-- tabelas que o cliente pode acessar diretamente. Processamento de fila,
-- webhooks e telemetria são exclusivamente do servidor.

begin;

-- O Data API não deve aceitar chamadas anônimas para dados comerciais.
revoke all on table public.leads, public.lead_messages, public.proposals,
  public.orders, public.outreach_jobs, public.webhook_events,
  public.channel_health_samples, public.channel_policy_events
  from anon;

-- Apenas o mínimo necessário para a interface autenticada.
grant select, insert, update on table public.leads, public.lead_messages,
  public.proposals to authenticated;
grant select on table public.channel_health_samples,
  public.channel_policy_events to authenticated;

-- Pedidos e filas permanecem como histórico/processamento interno. Não há
-- venda, recebimento ou manipulação de webhooks pelo navegador.
revoke all on table public.orders, public.outreach_jobs, public.webhook_events
  from authenticated;

-- As políticas genéricas tornavam permissões específicas ineficazes porque
-- políticas permissivas são combinadas por OR no Postgres RLS.
drop policy if exists org_active_access on public.leads;
drop policy if exists org_active_access on public.lead_messages;
drop policy if exists org_active_access on public.proposals;
drop policy if exists org_active_access on public.orders;
drop policy if exists org_active_access on public.outreach_jobs;
drop policy if exists org_active_access on public.webhook_events;

-- Idempotência por organização e provedor: repetição de webhook não cria
-- uma segunda automação nem uma segunda mensagem.
create unique index if not exists webhook_events_org_provider_external_id_uq
  on public.webhook_events (organization_id, provider, external_id)
  where external_id is not null;
create unique index if not exists webhook_events_org_provider_payload_sha_uq
  on public.webhook_events (organization_id, provider, payload_sha)
  where external_id is null and payload_sha is not null;
create unique index if not exists outreach_jobs_org_idempotency_key_uq
  on public.outreach_jobs (organization_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists outreach_jobs_ready_idx
  on public.outreach_jobs (status, run_at)
  where status in ('queued', 'retry');

-- Índices recomendados pelo advisor para o núcleo recém-criado.
create index if not exists ai_agents_active_version_idx
  on public.ai_agents (active_version_id);
create index if not exists ai_agent_versions_org_idx
  on public.ai_agent_versions (organization_id);
create index if not exists ai_agent_versions_published_by_idx
  on public.ai_agent_versions (published_by);
create index if not exists channel_health_samples_integration_idx
  on public.channel_health_samples (integration_id);
create index if not exists channel_policy_events_integration_idx
  on public.channel_policy_events (integration_id);
create index if not exists crm_opportunities_lead_idx
  on public.crm_opportunities (lead_id);

commit;
