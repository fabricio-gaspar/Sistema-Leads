-- Ana autonomous operation and auditable commercial alerts.
-- Extends the existing scheduler, qualification, event and notification models.

alter table public.company_settings
  add column if not exists ana_operation_enabled boolean not null default false,
  add column if not exists ana_operation_mode text not null default 'simulation';

alter table public.company_settings
  drop constraint if exists company_settings_ana_operation_mode_check;
alter table public.company_settings
  add constraint company_settings_ana_operation_mode_check
  check (ana_operation_mode in ('simulation', 'supervised', 'automatic'));

alter table public.prospecting_schedules
  alter column filters set default '{}'::jsonb,
  add column if not exists name text not null default 'Operação diária da Ana',
  add column if not exists source_key text not null default 'apify',
  add column if not exists timezone text not null default 'America/Sao_Paulo',
  add column if not exists weekdays smallint[] not null default array[1,2,3,4,5]::smallint[],
  add column if not exists run_time time without time zone not null default '09:00',
  add column if not exists next_run_at timestamp with time zone,
  add column if not exists last_run_at timestamp with time zone,
  add column if not exists locked_at timestamp with time zone,
  add column if not exists locked_by text,
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamp with time zone not null default now(),
  add column if not exists paid_prospecting_approved boolean not null default false,
  add column if not exists notify_immediate boolean not null default true,
  add column if not exists notify_progress boolean not null default true,
  add column if not exists digest_enabled boolean not null default true,
  add column if not exists digest_time time without time zone not null default '18:00';

update public.prospecting_schedules
   set filters = coalesce(filters, '{}'::jsonb),
       name = coalesce(nullif(name, ''), 'Operação diária da Ana'),
       updated_at = coalesce(updated_at, now());

alter table public.prospecting_schedules
  drop constraint if exists prospecting_schedules_source_key_check,
  drop constraint if exists prospecting_schedules_quantity_check,
  drop constraint if exists prospecting_schedules_score_check,
  drop constraint if exists prospecting_schedules_caps_check,
  drop constraint if exists prospecting_schedules_weekdays_check,
  drop constraint if exists prospecting_schedules_assignment_strategy_check;
alter table public.prospecting_schedules
  add constraint prospecting_schedules_source_key_check check (source_key = 'apify'),
  add constraint prospecting_schedules_quantity_check check (quantity between 1 and 100),
  add constraint prospecting_schedules_score_check check (auto_approve_min_score between 0 and 100),
  add constraint prospecting_schedules_caps_check check (daily_cap > 0 and monthly_cap >= daily_cap),
  add constraint prospecting_schedules_weekdays_check check (
    cardinality(weekdays) between 1 and 7
    and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
  ),
  add constraint prospecting_schedules_assignment_strategy_check
    check (assignment_strategy in ('owner', 'round_robin', 'existing_owner', 'manual'));

update public.prospecting_schedule_runs set status = 'completed' where status = 'success';
alter table public.prospecting_schedule_runs
  add column if not exists prospecting_run_id uuid references public.prospecting_runs(id) on delete set null,
  add column if not exists result_cache_id uuid references public.prospecting_cache(id) on delete set null,
  add column if not exists operation_mode text not null default 'simulation',
  add column if not exists idempotency_key text,
  add column if not exists scheduled_local_date date,
  add column if not exists candidate_count integer not null default 0,
  add column if not exists approved_count integer not null default 0,
  add column if not exists rejected_count integer not null default 0,
  add column if not exists started_at timestamp with time zone,
  add column if not exists completed_at timestamp with time zone,
  add column if not exists next_run_at timestamp with time zone,
  add column if not exists locked_at timestamp with time zone,
  add column if not exists locked_by text,
  add column if not exists error_code text,
  add column if not exists result jsonb not null default '{}'::jsonb,
  add column if not exists requested_by uuid references auth.users(id),
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamp with time zone;

update public.prospecting_schedule_runs
   set idempotency_key = coalesce(idempotency_key, 'legacy:' || id::text),
       scheduled_local_date = coalesce(scheduled_local_date, created_at::date),
       completed_at = case when status = 'completed' then coalesce(completed_at, created_at) else completed_at end;

alter table public.prospecting_schedule_runs
  alter column idempotency_key set not null,
  drop constraint if exists prospecting_schedule_runs_status_check,
  drop constraint if exists prospecting_schedule_runs_operation_mode_check,
  drop constraint if exists prospecting_schedule_runs_counts_check;
alter table public.prospecting_schedule_runs
  add constraint prospecting_schedule_runs_status_check
    check (status in ('queued','running','awaiting_approval','simulated','completed','failed','cancelled')),
  add constraint prospecting_schedule_runs_operation_mode_check
    check (operation_mode in ('simulation','supervised','automatic')),
  add constraint prospecting_schedule_runs_counts_check
    check (candidate_count >= 0 and approved_count >= 0 and rejected_count >= 0 and imported_count >= 0);

alter table public.lead_qualifications
  add column if not exists source_agent_run_id uuid references public.agent_runs(id) on delete set null,
  add column if not exists source_message_id uuid references public.lead_messages(id) on delete set null,
  add column if not exists interest_level text not null default 'neutral',
  add column if not exists requested_action text not null default 'none',
  add column if not exists confidence integer not null default 0,
  add column if not exists next_action_due_at timestamp with time zone;

alter table public.lead_qualifications
  drop constraint if exists lead_qualifications_interest_level_check,
  drop constraint if exists lead_qualifications_requested_action_check,
  drop constraint if exists lead_qualifications_confidence_check;
alter table public.lead_qualifications
  add constraint lead_qualifications_interest_level_check
    check (interest_level in ('negative','neutral','positive','hot')),
  add constraint lead_qualifications_requested_action_check
    check (requested_action in ('none','follow_up','meeting','quote','human')),
  add constraint lead_qualifications_confidence_check check (confidence between 0 and 100);

alter table public.notifications
  add column if not exists lead_id uuid references public.leads(id) on delete cascade,
  add column if not exists event_id uuid references public.domain_events(id) on delete set null,
  add column if not exists priority text not null default 'normal',
  add column if not exists status text not null default 'open',
  add column if not exists action_required boolean not null default false,
  add column if not exists recommended_action text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists deduplication_key text,
  add column if not exists due_at timestamp with time zone,
  add column if not exists acknowledged_at timestamp with time zone,
  add column if not exists resolved_at timestamp with time zone,
  add column if not exists read_at timestamp with time zone;

alter table public.notifications
  drop constraint if exists notifications_organization_id_fkey,
  drop constraint if exists notifications_priority_check,
  drop constraint if exists notifications_status_check;
alter table public.notifications
  add constraint notifications_organization_id_fkey
    foreign key (organization_id) references public.organizations(id) on delete cascade,
  add constraint notifications_priority_check check (priority in ('low','normal','high','urgent')),
  add constraint notifications_status_check check (status in ('open','acknowledged','resolved'));

create table if not exists public.notification_preferences (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  immediate_in_app boolean not null default true,
  immediate_whatsapp boolean not null default false,
  digest_enabled boolean not null default true,
  digest_time time without time zone not null default '18:00',
  timezone text not null default 'America/Sao_Paulo',
  minimum_priority text not null default 'normal' check (minimum_priority in ('low','normal','high','urgent')),
  quiet_hours jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamp with time zone not null default now(),
  primary key (organization_id, user_id),
  foreign key (organization_id, user_id)
    references public.organization_members(organization_id, user_id) on delete cascade
);

create unique index if not exists prospecting_schedule_runs_org_idempotency_uq
  on public.prospecting_schedule_runs (organization_id, idempotency_key);
create index if not exists prospecting_schedules_due_idx
  on public.prospecting_schedules (organization_id, next_run_at)
  where active = true and next_run_at is not null;
create index if not exists prospecting_schedule_runs_ready_idx
  on public.prospecting_schedule_runs (organization_id, status, next_run_at, created_at)
  where status in ('queued','running');
create index if not exists lead_qualifications_org_interest_idx
  on public.lead_qualifications (organization_id, interest_level, updated_at desc);
create index if not exists lead_qualifications_org_due_idx
  on public.lead_qualifications (organization_id, next_action_due_at)
  where next_action_due_at is not null;
create unique index if not exists notifications_org_user_dedupe_uq
  on public.notifications (organization_id, user_id, deduplication_key)
  where deduplication_key is not null;
create index if not exists notifications_inbox_idx
  on public.notifications (organization_id, user_id, status, priority, created_at desc);
create index if not exists notifications_lead_created_idx
  on public.notifications (organization_id, lead_id, created_at desc)
  where lead_id is not null;

alter table public.notification_preferences enable row level security;

drop policy if exists org_active_access on public.prospecting_schedules;
drop policy if exists prospecting_schedules_member_select on public.prospecting_schedules;
create policy prospecting_schedules_member_select on public.prospecting_schedules
for select to authenticated
using ((select private.is_active_org_member(organization_id, (select auth.uid()))));

drop policy if exists org_active_access on public.prospecting_schedule_runs;
drop policy if exists prospecting_schedule_runs_member_select on public.prospecting_schedule_runs;
create policy prospecting_schedule_runs_member_select on public.prospecting_schedule_runs
for select to authenticated
using ((select private.is_active_org_member(organization_id, (select auth.uid()))));

drop policy if exists org_active_access on public.lead_qualifications;
drop policy if exists lead_qualifications_accessible_select on public.lead_qualifications;
create policy lead_qualifications_accessible_select on public.lead_qualifications
for select to authenticated
using ((select private.can_access_lead(organization_id, lead_id, (select auth.uid()))));

drop policy if exists notifications_org_member_insert on public.notifications;
drop policy if exists notifications_owner_select on public.notifications;
create policy notifications_owner_select on public.notifications
for select to authenticated
using (
  user_id = (select auth.uid())
  and organization_id = (select public.current_org_id())
  and (select private.is_active_org_member(organization_id, (select auth.uid())))
);
drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update on public.notifications
for update to authenticated
using (user_id = (select auth.uid()) and organization_id = (select public.current_org_id()))
with check (user_id = (select auth.uid()) and organization_id = (select public.current_org_id()));

drop policy if exists notification_preferences_owner_select on public.notification_preferences;
create policy notification_preferences_owner_select on public.notification_preferences
for select to authenticated
using (user_id = (select auth.uid()) and organization_id = (select public.current_org_id()));
drop policy if exists notification_preferences_owner_insert on public.notification_preferences;
create policy notification_preferences_owner_insert on public.notification_preferences
for insert to authenticated
with check (user_id = (select auth.uid()) and organization_id = (select public.current_org_id()));
drop policy if exists notification_preferences_owner_update on public.notification_preferences;
create policy notification_preferences_owner_update on public.notification_preferences
for update to authenticated
using (user_id = (select auth.uid()) and organization_id = (select public.current_org_id()))
with check (user_id = (select auth.uid()) and organization_id = (select public.current_org_id()));

revoke insert, delete on public.notifications from authenticated;
revoke update on public.notifications from authenticated;
grant select on public.notifications to authenticated;
grant update (read, read_at, status, acknowledged_at, resolved_at) on public.notifications to authenticated;
grant select on public.prospecting_schedules, public.prospecting_schedule_runs, public.lead_qualifications to authenticated;
revoke insert, update, delete on public.prospecting_schedules, public.prospecting_schedule_runs, public.lead_qualifications from authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;

create or replace function private.route_commercial_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_kind text;
  v_title text;
  v_description text;
  v_priority text := 'normal';
  v_action_required boolean := false;
  v_recommended text;
  v_user_id uuid;
  v_lead public.leads%rowtype;
begin
  if new.entity_type <> 'lead' or new.entity_id is null then return new; end if;
  if new.event_name not in (
    'lead.reply.received','lead.interaction.positive','lead.interest.detected',
    'lead.meeting.requested','lead.quote.requested','lead.human.requested',
    'lead.hot.detected','lead.analysis.failed','lead.handoff.requested'
  ) then return new; end if;

  select * into v_lead from public.leads
   where id = new.entity_id and organization_id = new.organization_id;
  if not found then return new; end if;

  v_kind := case new.event_name
    when 'lead.reply.received' then 'REPLY'
    when 'lead.interaction.positive' then 'PROGRESS'
    when 'lead.interest.detected' then 'INTEREST'
    when 'lead.meeting.requested' then 'MEETING'
    when 'lead.quote.requested' then 'QUOTE'
    when 'lead.hot.detected' then 'HOT'
    when 'lead.analysis.failed' then 'ALERT'
    else 'HANDOFF' end;
  v_priority := case
    when new.event_name in ('lead.human.requested','lead.handoff.requested') then 'urgent'
    when new.event_name in ('lead.meeting.requested','lead.quote.requested','lead.hot.detected','lead.analysis.failed') then 'high'
    else 'normal' end;
  v_action_required := new.event_name in (
    'lead.meeting.requested','lead.quote.requested','lead.human.requested',
    'lead.hot.detected','lead.analysis.failed','lead.handoff.requested'
  );
  v_title := case new.event_name
    when 'lead.reply.received' then 'Lead respondeu ao contato'
    when 'lead.interaction.positive' then 'Interação positiva'
    when 'lead.interest.detected' then 'Interesse comercial identificado'
    when 'lead.meeting.requested' then 'Lead pediu uma reunião'
    when 'lead.quote.requested' then 'Lead pediu um orçamento'
    when 'lead.human.requested' then 'Lead pediu atendimento humano'
    when 'lead.hot.detected' then 'Lead quente identificado'
    when 'lead.analysis.failed' then 'Resposta requer análise humana'
    else 'Atendimento transferido para humano' end;
  v_description := coalesce(nullif(new.payload->>'summary',''), nullif(new.payload->>'reason',''),
    coalesce(nullif(v_lead.contact,''), nullif(v_lead.company,''), 'Lead') || ' possui uma nova atualização comercial.');
  v_recommended := coalesce(nullif(new.payload->>'next_action',''), case
    when new.event_name = 'lead.meeting.requested' then 'Confirmar data e horário'
    when new.event_name = 'lead.quote.requested' then 'Revisar escopo e preparar orçamento'
    when new.event_name in ('lead.human.requested','lead.handoff.requested') then 'Assumir o atendimento'
    when new.event_name = 'lead.hot.detected' then 'Contatar o lead hoje'
    else 'Abrir a conversa' end);

  for v_user_id in
    select distinct recipient.user_id from (
      select coalesce(v_lead.assigned_to, v_lead.owner_id) as user_id
      where coalesce(v_lead.assigned_to, v_lead.owner_id) is not null
      union all
      select om.user_id
        from public.organization_members om
       where om.organization_id = new.organization_id
         and om.status = 'active'
         and om.role in ('owner','admin','administrador','manager','gerente')
         and coalesce(v_lead.assigned_to, v_lead.owner_id) is null
    ) recipient
    join public.organization_members active_member
      on active_member.organization_id = new.organization_id
     and active_member.user_id = recipient.user_id
     and active_member.status = 'active'
  loop
    if not exists (
      select 1 from public.notification_preferences preference
       where preference.organization_id = new.organization_id
         and preference.user_id = v_user_id
         and preference.immediate_in_app = false
    ) then
      insert into public.notifications (
        organization_id,user_id,kind,title,description,read,link,lead_id,event_id,
        priority,status,action_required,recommended_action,metadata,deduplication_key,due_at
      ) values (
        new.organization_id,v_user_id,v_kind,v_title,left(v_description,500),false,
        '/dashboard/atendimento?leadId=' || new.entity_id::text,new.entity_id,new.id,
        v_priority,'open',v_action_required,left(v_recommended,240),
        jsonb_build_object('event_name',new.event_name,'evidence',coalesce(new.payload->'evidence','{}'::jsonb)),
        'event:' || new.id::text,case when v_action_required then now() else null end
      ) on conflict (organization_id,user_id,deduplication_key) where deduplication_key is not null do nothing;
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function private.route_commercial_notification() from public, anon, authenticated;
grant execute on function private.route_commercial_notification() to service_role;

drop trigger if exists domain_events_route_commercial_notification on public.domain_events;
create trigger domain_events_route_commercial_notification
after insert on public.domain_events
for each row execute function private.route_commercial_notification();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
