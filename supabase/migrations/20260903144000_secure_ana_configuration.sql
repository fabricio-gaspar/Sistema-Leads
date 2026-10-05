begin;

grant select on table public.ai_agents, public.ai_agent_versions to authenticated;
revoke insert, update, delete on table public.ai_agents, public.ai_agent_versions from authenticated;

drop policy if exists ai_agents_read_active_org on public.ai_agents;
create policy ai_agents_read_active_org on public.ai_agents
for select to authenticated
using (
  organization_id = (select public.current_org_id())
  and private.is_active_org_member(organization_id, (select auth.uid()))
);

drop policy if exists ai_agent_versions_read_active_org on public.ai_agent_versions;
create policy ai_agent_versions_read_active_org on public.ai_agent_versions
for select to authenticated
using (
  organization_id = (select public.current_org_id())
  and private.is_active_org_member(organization_id, (select auth.uid()))
);

create index if not exists agent_runs_actor_id_idx on public.agent_runs(actor_id);

commit;
