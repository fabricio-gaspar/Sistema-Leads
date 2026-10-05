-- Finaliza a fonte de verdade multiempresa e remove domínios fora do produto.
begin;

create or replace function public.current_org_id()
returns uuid
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  select p.active_organization_id
  from public.profiles p
  where p.id = (select auth.uid())
    and p.active_organization_id is not null
    and private.is_org_member(p.active_organization_id, (select auth.uid()))
  limit 1
$$;

revoke all on function public.current_org_id() from public, anon;
grant execute on function public.current_org_id() to authenticated, service_role;

drop policy if exists phase2_leads_select on public.leads;
create policy phase2_leads_select on public.leads
for select to authenticated
using (
  organization_id = (select public.current_org_id())
  and (
    private.has_org_role(organization_id, (select auth.uid()), array['administrador'::app_role, 'sdr'::app_role, 'ia'::app_role])
    or owner_id = (select auth.uid())
    or assigned_to = (select auth.uid())
  )
);

drop policy if exists phase2_leads_insert on public.leads;
create policy phase2_leads_insert on public.leads
for insert to authenticated
with check (
  organization_id = (select public.current_org_id())
  and (
    private.has_org_role(organization_id, (select auth.uid()), array['administrador'::app_role, 'sdr'::app_role, 'ia'::app_role])
    or owner_id = (select auth.uid())
    or assigned_to = (select auth.uid())
  )
);

drop policy if exists phase2_leads_update on public.leads;
create policy phase2_leads_update on public.leads
for update to authenticated
using (
  organization_id = (select public.current_org_id())
  and (
    private.has_org_role(organization_id, (select auth.uid()), array['administrador'::app_role, 'sdr'::app_role, 'ia'::app_role])
    or owner_id = (select auth.uid())
    or assigned_to = (select auth.uid())
  )
)
with check (
  organization_id = (select public.current_org_id())
  and (
    private.has_org_role(organization_id, (select auth.uid()), array['administrador'::app_role, 'sdr'::app_role, 'ia'::app_role])
    or owner_id = (select auth.uid())
    or assigned_to = (select auth.uid())
  )
);

-- Tabelas exclusivamente server-side: nenhuma exposição pela Data API.
revoke all on table public.agent_runs, public.outreach_jobs, public.webhook_events from anon;
revoke insert, update, delete on table public.agent_runs from authenticated;
revoke all on table public.outreach_jobs, public.webhook_events from authenticated;

-- O produto termina em orçamento. Não há vendas, pedidos, recebimentos ou campanhas de voz.
drop table if exists public.voice_campaign_members;
drop table if exists public.voice_campaigns;
drop table if exists public.orders;
drop table if exists public.sales_goals;

commit;
