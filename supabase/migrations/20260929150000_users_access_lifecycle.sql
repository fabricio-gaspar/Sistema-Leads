-- Users access lifecycle: pending invitations are not active memberships and
-- cancelled invitations remain auditable instead of being deleted.
begin;

alter table public.organization_members
  drop constraint if exists organization_members_status_check;

alter table public.organization_members
  add constraint organization_members_status_check
  check (status = any (array['active'::text, 'disabled'::text, 'invited'::text]));

alter table public.organization_invites
  add column if not exists cancelled_at timestamptz;

create index if not exists organization_invites_pending_idx
  on public.organization_invites (organization_id, created_at desc)
  where accepted_at is null and cancelled_at is null;

comment on column public.organization_invites.cancelled_at is
  'Cancellation timestamp; cancelled invitations are retained for auditability.';

commit;
