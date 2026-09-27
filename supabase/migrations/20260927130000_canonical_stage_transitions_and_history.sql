-- Canonical, audited human transitions for the operational lead aggregate.
--
-- The existing legacy `leads.stage` enum remains a compatibility projection.
-- `ana_stage`/`ana_outcome` are the canonical values used by this command.

create or replace function private.canonical_lead_stage_key(
  p_ana_stage text,
  p_ana_outcome text
)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_ana_stage = 'fechado' and p_ana_outcome = 'ganho' then 'ganho'
    when p_ana_stage = 'fechado' and p_ana_outcome = 'perdido' then 'perdido'
    when p_ana_stage in ('novo', 'apresentado', 'qualificando', 'reuniao', 'orcamento') then p_ana_stage
    else 'novo'
  end;
$$;

create or replace function private.record_lead_stage_history()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_from_stage text;
  v_to_stage text;
  v_source text;
  v_reason text;
begin
  v_from_stage := private.canonical_lead_stage_key(old.ana_stage, old.ana_outcome);
  v_to_stage := private.canonical_lead_stage_key(new.ana_stage, new.ana_outcome);

  if v_from_stage = v_to_stage then
    return new;
  end if;

  v_source := coalesce(nullif(current_setting('wayflex.stage_change_source', true), ''),
    case when auth.uid() is not null then 'human'
         when new.ana_stage is distinct from old.ana_stage then 'ia'
         else 'system'
    end
  );
  v_reason := nullif(current_setting('wayflex.stage_change_reason', true), '');

  insert into public.lead_stage_history (
    organization_id, lead_id, from_stage, to_stage, changed_by, reason, source
  ) values (
    new.organization_id,
    new.id,
    v_from_stage,
    v_to_stage,
    auth.uid(),
    v_reason,
    case when v_source in ('ia', 'human', 'system') then v_source else 'system' end
  );

  return new;
end;
$$;

drop trigger if exists z_record_lead_stage_history on public.leads;
create trigger z_record_lead_stage_history
after update of ana_stage, ana_outcome, pipeline_stage_id, stage on public.leads
for each row execute function private.record_lead_stage_history();

create or replace function public.transition_lead_stage(
  p_lead_id uuid,
  p_to_stage text,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid := public.current_org_id();
  v_lead public.leads%rowtype;
  v_current_stage text;
  v_target_stage text := lower(btrim(coalesce(p_to_stage, '')));
  v_current_position integer;
  v_target_position integer;
  v_target_pipeline_stage uuid;
begin
  if v_user_id is null or v_organization_id is null then
    raise exception 'authentication_required';
  end if;
  if v_target_stage not in ('novo', 'apresentado', 'qualificando', 'reuniao', 'orcamento', 'ganho', 'perdido') then
    raise exception 'invalid_pipeline_stage';
  end if;

  select * into v_lead
    from public.leads
   where id = p_lead_id
     and organization_id = v_organization_id
   for update;
  if not found then
    raise exception 'lead_not_found_or_forbidden';
  end if;

  if not (
    private.has_org_permission(v_organization_id, v_user_id, 'leads.edit_all')
    or (
      private.has_org_permission(v_organization_id, v_user_id, 'leads.edit_assigned')
      and (v_lead.owner_id = v_user_id or v_lead.assigned_to = v_user_id)
    )
  ) then
    raise exception 'lead_stage_transition_forbidden';
  end if;

  v_current_stage := private.canonical_lead_stage_key(v_lead.ana_stage, v_lead.ana_outcome);
  v_current_position := array_position(array['novo','apresentado','qualificando','reuniao','orcamento','ganho','perdido'], v_current_stage);
  v_target_position := array_position(array['novo','apresentado','qualificando','reuniao','orcamento','ganho','perdido'], v_target_stage);

  if v_current_stage = v_target_stage then
    return jsonb_build_object('lead_id', v_lead.id, 'stage', v_current_stage, 'changed', false);
  end if;
  if v_current_stage in ('ganho', 'perdido') then
    raise exception 'terminal_stage_cannot_be_reopened';
  end if;
  if v_target_position <= v_current_position or v_target_position > v_current_position + 1 then
    raise exception 'invalid_pipeline_transition';
  end if;
  if v_target_stage in ('ganho', 'perdido') and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'outcome_reason_required';
  end if;

  if v_target_stage = 'apresentado' and not exists (
    select 1 from public.lead_messages m
     where m.organization_id = v_organization_id and m.lead_id = v_lead.id
  ) then
    raise exception 'persisted_message_required';
  end if;
  if v_target_stage in ('qualificando', 'reuniao') and not exists (
    select 1 from public.lead_qualifications q
     where q.organization_id = v_organization_id and q.lead_id = v_lead.id
  ) then
    raise exception 'qualification_required';
  end if;
  if v_target_stage = 'orcamento' and not exists (
    select 1 from public.proposals p
     where p.organization_id = v_organization_id
       and p.lead_id = v_lead.id
       and p.status in ('sent', 'viewed', 'accepted')
  ) then
    raise exception 'sent_proposal_required';
  end if;
  if v_target_stage = 'ganho' and not exists (
    select 1 from public.proposals p
     where p.organization_id = v_organization_id
       and p.lead_id = v_lead.id
       and p.status = 'accepted'
  ) then
    raise exception 'accepted_proposal_required';
  end if;

  select id into v_target_pipeline_stage
    from public.pipeline_stages
   where organization_id = v_organization_id
     and pipeline_id = v_lead.pipeline_id
     and ana_stage_key = v_target_stage
     and active
   limit 1;
  if v_target_pipeline_stage is null then
    raise exception 'canonical_pipeline_stage_not_found';
  end if;

  perform set_config('wayflex.stage_change_source', 'human', true);
  perform set_config('wayflex.stage_change_reason', coalesce(nullif(btrim(p_reason), ''), ''), true);

  update public.leads
     set pipeline_stage_id = v_target_pipeline_stage,
         ana_stage = case when v_target_stage in ('ganho', 'perdido') then 'fechado' else v_target_stage end,
         ana_outcome = case when v_target_stage = 'ganho' then 'ganho'
                            when v_target_stage = 'perdido' then 'perdido'
                            else null end,
         automation_status = case when v_target_stage in ('ganho', 'perdido') then 'completed' else automation_status end,
         updated_at = now()
   where id = v_lead.id
     and organization_id = v_organization_id;

  return jsonb_build_object('lead_id', v_lead.id, 'stage', v_target_stage, 'changed', true);
end;
$$;

create or replace function public.resolve_proposal_outcome(
  p_proposal_id uuid,
  p_outcome text,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid := public.current_org_id();
  v_proposal public.proposals%rowtype;
  v_outcome text := lower(btrim(coalesce(p_outcome, '')));
  v_transition jsonb;
begin
  if v_user_id is null or v_organization_id is null then
    raise exception 'authentication_required';
  end if;
  if v_outcome not in ('accepted', 'rejected') then
    raise exception 'invalid_proposal_outcome';
  end if;
  if not private.has_org_permission(v_organization_id, v_user_id, 'proposals.manage') then
    raise exception 'proposal_outcome_forbidden';
  end if;

  select * into v_proposal
    from public.proposals
   where id = p_proposal_id
     and organization_id = v_organization_id
   for update;
  if not found or v_proposal.lead_id is null then
    raise exception 'proposal_not_found_or_unlinked';
  end if;
  if v_proposal.status in ('archived', 'cancelled', 'expired') then
    raise exception 'proposal_not_open';
  end if;
  if v_outcome = 'rejected' and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'outcome_reason_required';
  end if;

  update public.proposals
     set status = v_outcome,
         updated_at = now()
   where id = v_proposal.id
     and organization_id = v_organization_id;

  select public.transition_lead_stage(
    v_proposal.lead_id,
    case when v_outcome = 'accepted' then 'ganho' else 'perdido' end,
    coalesce(nullif(btrim(p_reason), ''), 'Confirmação humana do resultado do orçamento')
  ) into v_transition;

  return jsonb_build_object('proposal_id', v_proposal.id, 'outcome', v_outcome, 'transition', v_transition);
end;
$$;

revoke all on function public.transition_lead_stage(uuid, text, text) from public;
revoke all on function public.resolve_proposal_outcome(uuid, text, text) from public;
grant execute on function public.transition_lead_stage(uuid, text, text) to authenticated;
grant execute on function public.resolve_proposal_outcome(uuid, text, text) to authenticated;
