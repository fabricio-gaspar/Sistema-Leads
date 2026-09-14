-- Removing a team member permits hard deletion of the Auth identity while
-- keeping organization-owned commercial history available for reassignment.

alter table public.prospecting_runs
  alter column requested_by drop not null;

alter table public.audit_logs drop constraint if exists audit_logs_actor_id_fkey;
alter table public.lead_handoffs drop constraint if exists lead_handoffs_from_user_id_fkey;
alter table public.lead_handoffs drop constraint if exists lead_handoffs_to_user_id_fkey;
alter table public.lead_tasks drop constraint if exists lead_tasks_owner_id_fkey;
alter table public.leads drop constraint if exists leads_assigned_to_fkey;
alter table public.leads drop constraint if exists leads_owner_id_fkey;
alter table public.notification_preferences drop constraint if exists notification_preferences_updated_by_fkey;
alter table public.proposals drop constraint if exists proposals_owner_id_fkey;
alter table public.prospecting_runs drop constraint if exists prospecting_runs_requested_by_fkey;
alter table public.prospecting_schedule_runs drop constraint if exists prospecting_schedule_runs_approved_by_fkey;
alter table public.prospecting_schedule_runs drop constraint if exists prospecting_schedule_runs_requested_by_fkey;
alter table public.prospecting_schedules drop constraint if exists prospecting_schedules_owner_id_fkey;
alter table public.prospecting_schedules drop constraint if exists prospecting_schedules_updated_by_fkey;

alter table public.audit_logs add constraint audit_logs_actor_id_fkey foreign key (actor_id) references auth.users(id) on delete set null;
alter table public.lead_handoffs add constraint lead_handoffs_from_user_id_fkey foreign key (from_user_id) references auth.users(id) on delete set null;
alter table public.lead_handoffs add constraint lead_handoffs_to_user_id_fkey foreign key (to_user_id) references auth.users(id) on delete set null;
alter table public.lead_tasks add constraint lead_tasks_owner_id_fkey foreign key (owner_id) references auth.users(id) on delete set null;
alter table public.leads add constraint leads_assigned_to_fkey foreign key (assigned_to) references auth.users(id) on delete set null;
alter table public.leads add constraint leads_owner_id_fkey foreign key (owner_id) references auth.users(id) on delete set null;
alter table public.notification_preferences add constraint notification_preferences_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;
alter table public.proposals add constraint proposals_owner_id_fkey foreign key (owner_id) references auth.users(id) on delete set null;
alter table public.prospecting_runs add constraint prospecting_runs_requested_by_fkey foreign key (requested_by) references auth.users(id) on delete set null;
alter table public.prospecting_schedule_runs add constraint prospecting_schedule_runs_approved_by_fkey foreign key (approved_by) references auth.users(id) on delete set null;
alter table public.prospecting_schedule_runs add constraint prospecting_schedule_runs_requested_by_fkey foreign key (requested_by) references auth.users(id) on delete set null;
alter table public.prospecting_schedules add constraint prospecting_schedules_owner_id_fkey foreign key (owner_id) references auth.users(id) on delete set null;
alter table public.prospecting_schedules add constraint prospecting_schedules_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;
