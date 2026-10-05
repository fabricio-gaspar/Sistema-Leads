-- Personalização da Ana é uma ação administrativa auditada no servidor.
-- A API de dados não expõe mais escrita direta de agentes ou versões.
begin;

revoke all on table public.ai_agents from anon, authenticated;
revoke all on table public.ai_agent_versions from anon, authenticated;

drop policy if exists phase8_org_access on public.ai_agents;
drop policy if exists phase8_org_access on public.ai_agent_versions;

commit;
