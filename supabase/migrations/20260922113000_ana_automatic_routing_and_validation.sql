-- Makes the automatic prospecting route explicit without changing the
-- per-lead handoff policy already used by the manual Kanban flow.

begin;

alter table public.prospecting_schedules
  add column if not exists initial_assignment_mode text not null default 'ana',
  add column if not exists initial_assignee_user_id uuid references auth.users(id) on delete set null,
  add column if not exists team_member_ids uuid[] not null default '{}'::uuid[],
  add column if not exists handoff_stage text,
  add column if not exists handoff_assignee_user_id uuid references auth.users(id) on delete set null,
  add column if not exists handoff_notify_whatsapp boolean not null default false;

alter table public.prospecting_schedules
  drop constraint if exists prospecting_schedules_initial_assignment_mode_check,
  drop constraint if exists prospecting_schedules_handoff_stage_check;

alter table public.prospecting_schedules
  add constraint prospecting_schedules_initial_assignment_mode_check
    check (initial_assignment_mode in ('ana', 'human', 'team')),
  add constraint prospecting_schedules_handoff_stage_check
    check (handoff_stage is null or handoff_stage in ('novo', 'apresentado', 'qualificando', 'reuniao', 'orcamento'));

create index if not exists prospecting_schedules_initial_assignee_idx
  on public.prospecting_schedules (organization_id, initial_assignee_user_id)
  where initial_assignee_user_id is not null;

create index if not exists prospecting_schedules_handoff_assignee_idx
  on public.prospecting_schedules (organization_id, handoff_assignee_user_id)
  where handoff_assignee_user_id is not null;

commit;
