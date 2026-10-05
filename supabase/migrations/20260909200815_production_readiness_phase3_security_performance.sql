-- Production readiness phase 3: deterministic security/performance hardening only.

drop policy if exists outreach_jobs_service_only on public.outreach_jobs;
create policy outreach_jobs_service_only on public.outreach_jobs
  as restrictive for all to authenticated
  using (false) with check (false);

drop policy if exists webhook_events_service_only on public.webhook_events;
create policy webhook_events_service_only on public.webhook_events
  as restrictive for all to authenticated
  using (false) with check (false);

create index if not exists crm_stage_events_actor_id_idx on public.crm_stage_events(actor_id);
create index if not exists crm_stage_events_ai_decision_id_idx on public.crm_stage_events(ai_decision_id);
create index if not exists crm_stage_events_evidence_message_id_idx on public.crm_stage_events(evidence_message_id);
create index if not exists crm_stage_events_lead_id_idx on public.crm_stage_events(lead_id);
create index if not exists crm_stage_events_organization_id_idx on public.crm_stage_events(organization_id);

drop index if exists public.idx_prospecting_cache_org_user_created;

drop policy if exists prospecting_cache_isolation on public.prospecting_cache;

drop policy if exists notifications_owner_access on public.notifications;

drop policy if exists notifications_owner_select on public.notifications;
create policy notifications_owner_select on public.notifications
  for select to authenticated
  using ((user_id = (select auth.uid())) and (organization_id = (select current_org_id())));

drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update on public.notifications
  for update to authenticated
  using ((user_id = (select auth.uid())) and (organization_id = (select current_org_id())))
  with check ((user_id = (select auth.uid())) and (organization_id = (select current_org_id())));

drop policy if exists notifications_owner_delete on public.notifications;
create policy notifications_owner_delete on public.notifications
  for delete to authenticated
  using ((user_id = (select auth.uid())) and (organization_id = (select current_org_id())));

drop policy if exists notifications_org_member_insert on public.notifications;
create policy notifications_org_member_insert on public.notifications
  for insert to authenticated
  with check (
    private.is_active_org_member(organization_id, (select auth.uid()))
    and private.is_active_org_member(organization_id, user_id)
  );
