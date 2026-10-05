-- Human lead ownership must reference an active member of the same organization.
-- A signed-in member may assign another member only with full lead-edit access.
create or replace function private.validate_active_lead_assignee()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_target uuid;
begin
  if tg_op = 'UPDATE'
     and new.owner_id is not distinct from old.owner_id
     and new.assigned_to is not distinct from old.assigned_to
     and new.organization_id is not distinct from old.organization_id then
    return new;
  end if;

  for v_target in select distinct assignee.id from unnest(array[new.owner_id, new.assigned_to]) as assignee(id) where assignee.id is not null loop
    if not exists (
      select 1 from public.organization_members member
      where member.organization_id = new.organization_id
        and member.user_id = v_target
        and member.status = 'active'
    ) then
      raise exception 'lead_assignee_not_active_member' using errcode = '23514';
    end if;

    if v_actor is not null and v_target <> v_actor
       and not private.has_org_permission(new.organization_id, v_actor, 'leads.edit_all') then
      raise exception 'lead_assignment_permission_denied' using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function private.validate_active_lead_assignee() from public, anon, authenticated;

drop trigger if exists z_validate_active_lead_assignee on public.leads;
create trigger z_validate_active_lead_assignee
  before insert or update of owner_id, assigned_to, organization_id on public.leads
  for each row execute function private.validate_active_lead_assignee();
