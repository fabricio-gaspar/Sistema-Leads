create or replace function public.request_human_handoff(
  p_lead_id uuid,
  p_reason text,
  p_category text default 'operator_request'
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_organization_id uuid := public.current_org_id();
  v_user_id uuid := auth.uid();
  v_handoff_id uuid;
  v_now timestamptz := now();
begin
  if v_user_id is null or v_organization_id is null then
    raise exception 'organization_context_required';
  end if;
  if p_lead_id is null or nullif(btrim(p_reason), '') is null then
    raise exception 'lead_and_reason_required';
  end if;

  update public.leads
     set ai_paused = true,
         automation_status = 'human',
         automation_updated_at = v_now
   where id = p_lead_id
     and organization_id = v_organization_id;

  if not found then
    raise exception 'lead_not_found_or_access_denied';
  end if;

  insert into public.lead_handoffs (
    organization_id, lead_id, from_user_id, status, requested_at,
    reason, category, summary, context
  )
  values (
    v_organization_id, p_lead_id, v_user_id, 'pending', v_now,
    left(btrim(p_reason), 1000),
    left(coalesce(nullif(btrim(p_category), ''), 'operator_request'), 120),
    left(btrim(p_reason), 1000),
    jsonb_build_object('source', 'central_atendimento', 'actor_id', v_user_id)
  )
  returning id into v_handoff_id;

  insert into public.audit_logs (
    organization_id, actor_id, actor_type, action, detail,
    entity_table, entity_id, event_data
  )
  values (
    v_organization_id, v_user_id, 'user', 'lead.handoff.requested',
    'Atendimento transferido para uma pessoa.', 'leads', p_lead_id,
    jsonb_build_object('handoff_id', v_handoff_id, 'category', coalesce(nullif(btrim(p_category), ''), 'operator_request'))
  );

  return v_handoff_id;
end;
$$;

create or replace function public.return_handoff_to_ana(p_lead_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_organization_id uuid := public.current_org_id();
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
begin
  if v_user_id is null or v_organization_id is null then
    raise exception 'organization_context_required';
  end if;

  update public.leads
     set ai_paused = false,
         automation_status = 'running',
         automation_updated_at = v_now
   where id = p_lead_id
     and organization_id = v_organization_id;

  if not found then
    raise exception 'lead_not_found_or_access_denied';
  end if;

  update public.lead_handoffs
     set status = 'closed', closed_at = v_now, updated_at = v_now
   where organization_id = v_organization_id
     and lead_id = p_lead_id
     and status in ('pending', 'accepted');

  insert into public.audit_logs (
    organization_id, actor_id, actor_type, action, detail,
    entity_table, entity_id, event_data
  )
  values (
    v_organization_id, v_user_id, 'user', 'lead.handoff.returned_to_ana',
    'Atendimento devolvido para a Ana.', 'leads', p_lead_id,
    jsonb_build_object('source', 'central_atendimento')
  );

  return true;
end;
$$;

revoke all on function public.request_human_handoff(uuid, text, text) from public, anon;
revoke all on function public.return_handoff_to_ana(uuid) from public, anon;
grant execute on function public.request_human_handoff(uuid, text, text) to authenticated;
grant execute on function public.return_handoff_to_ana(uuid) to authenticated;
