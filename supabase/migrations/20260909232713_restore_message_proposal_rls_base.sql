create policy org_active_access on public.proposals
as permissive
for all
to authenticated
using (
  (select private.is_active_org_member(
    proposals.organization_id,
    (select auth.uid())
  ))
)
with check (
  (select private.is_active_org_member(
    proposals.organization_id,
    (select auth.uid())
  ))
);

create policy org_active_access on public.lead_messages
as permissive
for all
to authenticated
using (
  (select private.is_active_org_member(
    lead_messages.organization_id,
    (select auth.uid())
  ))
)
with check (
  (select private.is_active_org_member(
    lead_messages.organization_id,
    (select auth.uid())
  ))
);
