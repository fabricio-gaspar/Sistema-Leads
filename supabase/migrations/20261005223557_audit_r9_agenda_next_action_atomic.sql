-- R9: one idempotent transaction, with caller RLS and no external calendar effect.
-- The deployed legacy policy allowed every active member to edit every appointment.
-- Preserve the existing lead/portfolio authority, including direct REST consumers.
-- An advisory lock alone is insufficient at REPEATABLE READ for two different
-- parents: a waiter could keep a pre-lock snapshot and miss the other's child.
create table private.agenda_responsible_revision (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  responsible_user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  primary key(organization_id,responsible_user_id)
);
alter table private.agenda_responsible_revision enable row level security;
revoke all on private.agenda_responsible_revision from public,anon,authenticated;

create function private.r9_lock_agenda_responsible(p_org uuid,p_lead uuid,p_responsible uuid) returns void
language plpgsql volatile security definer set search_path='' as $$
begin
  if auth.uid() is null or p_org is distinct from public.current_org_id()
    or not private.is_active_org_member(p_org,auth.uid())
    or not private.can_reply_to_lead(p_org,p_lead,auth.uid())
    or not exists(select 1 from public.organization_members where organization_id=p_org
      and user_id=p_responsible and status='active') then
    raise exception 'appointment_responsible_forbidden' using errcode='42501';
  end if;
  insert into private.agenda_responsible_revision(organization_id,responsible_user_id,revision)
    values(p_org,p_responsible,1)
    on conflict(organization_id,responsible_user_id) do update
      set revision=private.agenda_responsible_revision.revision+1;
end;
$$;
revoke all on function private.r9_lock_agenda_responsible(uuid,uuid,uuid) from public,anon;
grant execute on function private.r9_lock_agenda_responsible(uuid,uuid,uuid) to authenticated;

drop policy if exists org_active_access on public.appointments;
create policy agenda_portfolio_select on public.appointments for select to authenticated
  using (organization_id = (select public.current_org_id())
    and private.can_access_lead(organization_id, lead_id, (select auth.uid())));
create policy agenda_portfolio_insert on public.appointments for insert to authenticated
  with check (organization_id = (select public.current_org_id()) and user_id = (select auth.uid())
    and private.can_reply_to_lead(organization_id, lead_id, (select auth.uid())));
create policy agenda_portfolio_update on public.appointments for update to authenticated
  using (organization_id = (select public.current_org_id())
    and private.can_reply_to_lead(organization_id, lead_id, (select auth.uid())))
  with check (organization_id = (select public.current_org_id())
    and private.can_reply_to_lead(organization_id, lead_id, (select auth.uid())));
create policy agenda_portfolio_delete on public.appointments for delete to authenticated
  using (organization_id = (select public.current_org_id())
    and private.can_reply_to_lead(organization_id, lead_id, (select auth.uid())));

create or replace function public.create_agenda_next_action(
  p_parent_id uuid, p_request_id uuid, p_expected_updated_at timestamptz,
  p_title text, p_starts_at timestamptz, p_duration_minutes integer,
  p_allow_conflict boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_org uuid := public.current_org_id();
  v_user uuid := auth.uid();
  v_parent public.appointments%rowtype;
  v_next public.appointments%rowtype;
  v_end timestamptz;
  v_intent jsonb;
  v_metadata jsonb;
  v_responsible text;
begin
  if v_user is null or v_org is null or not private.is_active_org_member(v_org, v_user) then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_parent_id is null or p_request_id is null or p_parent_id = p_request_id
     or p_expected_updated_at is null or p_starts_at is null or not isfinite(p_starts_at)
     or p_duration_minutes is null or p_duration_minutes not between 1 and 1440
     or p_title is null or length(btrim(p_title)) not between 1 and 240 then
    raise exception 'appointment_next_action_invalid' using errcode = '22023';
  end if;
  select * into v_parent from public.appointments
   where id = p_parent_id and organization_id = v_org for update;
  if not found or not private.can_reply_to_lead(v_org, v_parent.lead_id, v_user) then
    raise exception 'appointment_not_found_or_forbidden' using errcode = '42501';
  end if;
  v_end := p_starts_at + make_interval(mins => p_duration_minutes);
  v_intent := jsonb_build_object('parent_id', p_parent_id, 'expected_updated_at', p_expected_updated_at,
    'title', btrim(p_title), 'starts_at', p_starts_at, 'duration_minutes', p_duration_minutes,
    'allow_conflict', coalesce(p_allow_conflict, false), 'actor_id', v_user);
  select * into v_next from public.appointments where id = p_request_id and organization_id = v_org;
  if found then
    if v_next.metadata -> 'next_action_request' is distinct from v_intent then
      raise exception 'appointment_idempotency_conflict' using errcode = '22023';
    end if;
    return to_jsonb(v_next);
  end if;
  if v_parent.updated_at is distinct from p_expected_updated_at then
    raise exception 'appointment_concurrent_update' using errcode = '40001';
  end if;
  v_responsible := nullif(v_parent.metadata ->> 'responsible_user_id', '');
  if v_responsible is not null then
    if not exists (select 1 from public.organization_members where organization_id = v_org
                   and user_id::text = v_responsible and status = 'active') then
      raise exception 'appointment_responsible_inactive' using errcode = '22023';
    end if;
    -- Serializes next-action requests for this person; normal Agenda edits retain
    -- their existing explicit overlap-override workflow (not an exclusive calendar).
    -- A physical write barrier makes stale RR/Serializable transactions abort.
    perform private.r9_lock_agenda_responsible(v_org,v_parent.lead_id,v_responsible::uuid);
    -- Conflict detection intentionally observes only caller-visible appointments
    -- under RLS; this is not a global/exclusive calendar or an information oracle.
    if not coalesce(p_allow_conflict, false) and exists (
      select 1 from public.appointments where organization_id = v_org
       and metadata ->> 'responsible_user_id' = v_responsible
       and status in ('scheduled', 'confirmed', 'pending') and starts_at < v_end and ends_at > p_starts_at
    ) then
      raise exception 'appointment_time_conflict' using errcode = '23P01';
    end if;
  end if;
  v_metadata := coalesce(v_parent.metadata, '{}'::jsonb) || jsonb_build_object(
    'origin', 'manual', 'confirmation_status', 'pending', 'result', '', 'cancel_reason', '',
    'no_show_reason', '', 'next_action_at', null, 'next_action_title', null, 'next_action_id', null,
    'reminder_status', 'not_scheduled', 'previous_appointment_id', p_parent_id,
    'next_action_request', v_intent);
  insert into public.appointments(id, organization_id, user_id, lead_id, title, starts_at, ends_at,
    status, notes, meeting_url, provider, external_id, metadata)
  values (p_request_id, v_org, v_user, v_parent.lead_id, btrim(p_title), p_starts_at, v_end,
    'pending', null, v_parent.meeting_url, null, null, v_metadata) returning * into v_next;
  update public.appointments set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'next_action_id', v_next.id, 'next_action_at', v_next.starts_at, 'next_action_title', v_next.title)
   where id = v_parent.id and organization_id = v_org and updated_at = p_expected_updated_at;
  if not found then
    raise exception 'appointment_concurrent_update' using errcode = '40001';
  end if;
  return to_jsonb(v_next);
end;
$$;
revoke all on function public.create_agenda_next_action(uuid, uuid, timestamptz, text, timestamptz, integer, boolean)
  from public, anon;
grant execute on function public.create_agenda_next_action(uuid, uuid, timestamptz, text, timestamptz, integer, boolean)
  to authenticated;
