begin;

drop index if exists public.prospecting_schedules_initial_assignee_idx;
drop index if exists public.prospecting_schedules_handoff_assignee_idx;

create index if not exists prospecting_schedules_initial_assignee_user_id_idx
  on public.prospecting_schedules (initial_assignee_user_id);

create index if not exists prospecting_schedules_handoff_assignee_user_id_idx
  on public.prospecting_schedules (handoff_assignee_user_id);

commit;
