-- Avoid overlapping SELECT policies without widening access: keep the
-- self-or-admin read policy and split administrator writes by command.
drop policy if exists organization_members_admin_manage on public.organization_members;

create policy organization_members_admin_insert
on public.organization_members
as permissive
for insert
to authenticated
with check ((select private.is_org_admin(organization_id, (select auth.uid()))));

create policy organization_members_admin_update
on public.organization_members
as permissive
for update
to authenticated
using ((select private.is_org_admin(organization_id, (select auth.uid()))))
with check ((select private.is_org_admin(organization_id, (select auth.uid()))));

create policy organization_members_admin_delete
on public.organization_members
as permissive
for delete
to authenticated
using ((select private.is_org_admin(organization_id, (select auth.uid()))));

drop policy if exists user_roles_admin_manage on public.user_roles;

create policy user_roles_admin_insert
on public.user_roles
as permissive
for insert
to authenticated
with check ((select private.is_org_admin(organization_id, (select auth.uid()))));

create policy user_roles_admin_update
on public.user_roles
as permissive
for update
to authenticated
using ((select private.is_org_admin(organization_id, (select auth.uid()))))
with check ((select private.is_org_admin(organization_id, (select auth.uid()))));

create policy user_roles_admin_delete
on public.user_roles
as permissive
for delete
to authenticated
using ((select private.is_org_admin(organization_id, (select auth.uid()))));
