-- Cover every foreign key introduced by the Ana operation and alert model.
create index if not exists lead_qualifications_source_agent_run_idx on public.lead_qualifications(source_agent_run_id);
create index if not exists lead_qualifications_source_message_idx on public.lead_qualifications(source_message_id);
create index if not exists notification_preferences_updated_by_idx on public.notification_preferences(updated_by);
create index if not exists notification_preferences_user_idx on public.notification_preferences(user_id);
create index if not exists notifications_event_idx on public.notifications(event_id);
create index if not exists notifications_lead_idx on public.notifications(lead_id);
create index if not exists prospecting_schedule_runs_approved_by_idx on public.prospecting_schedule_runs(approved_by);
create index if not exists prospecting_schedule_runs_prospecting_run_idx on public.prospecting_schedule_runs(prospecting_run_id);
create index if not exists prospecting_schedule_runs_requested_by_idx on public.prospecting_schedule_runs(requested_by);
create index if not exists prospecting_schedule_runs_result_cache_idx on public.prospecting_schedule_runs(result_cache_id);
create index if not exists prospecting_schedules_updated_by_idx on public.prospecting_schedules(updated_by);
