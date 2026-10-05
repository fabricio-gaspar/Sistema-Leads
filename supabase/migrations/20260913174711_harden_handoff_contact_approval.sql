begin;

create or replace function public.request_human_handoff(
  p_lead_id uuid,
  p_reason text,
  p_category text default 'operator_request'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_organization_id uuid := public.current_org_id();
  v_user_id uuid := auth.uid();
  v_actor_name text := 'Usuário';
  v_lead public.leads%rowtype;
  v_handoff_id uuid;
  v_assignee uuid;
  v_cancelled_jobs integer := 0;
  v_reused boolean := false;
  v_now timestamptz := pg_catalog.now();
begin
  if v_user_id is null or v_organization_id is null
     or not private.is_active_org_member(v_organization_id, v_user_id) then
    raise exception 'organization_context_required';
  end if;
  if p_lead_id is null or nullif(pg_catalog.btrim(p_reason), '') is null then
    raise exception 'lead_and_reason_required';
  end if;

  select l.* into v_lead
    from public.leads as l
   where l.id = p_lead_id
     and l.organization_id = v_organization_id
     and (
       private.has_org_role(
         v_organization_id,
         v_user_id,
         array[
           'administrador'::public.app_role,
           'sdr'::public.app_role,
           'ia'::public.app_role,
           'cx'::public.app_role
         ]
       )
       or l.owner_id = v_user_id
       or l.assigned_to = v_user_id
     )
   for update;
  if not found then raise exception 'lead_not_found_or_access_denied'; end if;

  select coalesce(nullif(pg_catalog.btrim(p.name), ''), 'Usuário')
    into v_actor_name from public.profiles as p where p.id = v_user_id;
  v_assignee := coalesce(v_lead.assigned_to, v_lead.owner_id, v_user_id);

  update public.leads
     set modo_atendimento = 'humano',
         ai_paused = true,
         automation_status = 'human',
         automation_error = null,
         automation_updated_at = v_now,
         no_reply_deadline_at = null,
         updated_at = v_now
   where id = p_lead_id and organization_id = v_organization_id;

  update public.outreach_jobs as j
     set status = 'cancelled', processed_at = v_now, locked_at = null, locked_by = null,
         error = 'cancelled_by_human_handoff'
   where j.organization_id = v_organization_id
     and j.lead_id = p_lead_id
     and j.status in ('queued', 'retry', 'reconciliation_required')
     and j.processed_at is null and j.locked_at is null and j.locked_by is null
     and pg_catalog.lower(coalesce(j.payload ->> 'manual', 'false')) <> 'true'
     and not coalesce(j.payload ? 'provider_message_id', false)
     and not exists (
       select 1 from public.lead_outreach as o
        where o.id = j.id
          and o.organization_id = j.organization_id
          and (
            o.provider_message_id is not null
            or o.status in ('sent', 'delivered', 'read', 'replied', 'failed')
          )
     );
  get diagnostics v_cancelled_jobs = row_count;

  select h.id into v_handoff_id
    from public.lead_handoffs as h
   where h.organization_id = v_organization_id
     and h.lead_id = p_lead_id
     and h.status in ('pending', 'accepted')
   order by h.requested_at desc, h.created_at desc
   limit 1 for update;

  if v_handoff_id is null then
    insert into public.lead_handoffs (
      organization_id, lead_id, from_user_id, to_user_id, assigned_to, status,
      requested_at, reason, category, summary, context, updated_at
    ) values (
      v_organization_id, p_lead_id, v_user_id, v_assignee, v_assignee, 'pending', v_now,
      pg_catalog.left(pg_catalog.btrim(p_reason), 1000),
      pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_category), ''), 'operator_request'), 120),
      pg_catalog.left(pg_catalog.btrim(p_reason), 1000),
      pg_catalog.jsonb_build_object('source', 'central_atendimento', 'actor_id', v_user_id, 'cancelled_automatic_jobs', v_cancelled_jobs),
      v_now
    ) returning id into v_handoff_id;
  else
    v_reused := true;
    update public.lead_handoffs as h
       set to_user_id = coalesce(h.to_user_id, v_assignee),
           assigned_to = coalesce(h.assigned_to, v_assignee),
           context = coalesce(h.context, '{}'::jsonb)
             || pg_catalog.jsonb_build_object('last_request_at', v_now, 'last_actor_id', v_user_id, 'cancelled_automatic_jobs', v_cancelled_jobs),
           updated_at = v_now
     where h.id = v_handoff_id and h.organization_id = v_organization_id;
  end if;

  insert into public.audit_logs (
    organization_id, actor_id, actor_name, actor_type, action, detail,
    entity_table, entity_id, event_data
  ) values (
    v_organization_id, v_user_id, coalesce(v_actor_name, 'Usuário'), 'user',
    'lead.handoff.requested', 'Atendimento transferido para uma pessoa.', 'leads', p_lead_id,
    pg_catalog.jsonb_build_object(
      'handoff_id', v_handoff_id,
      'category', coalesce(nullif(pg_catalog.btrim(p_category), ''), 'operator_request'),
      'reused', v_reused,
      'cancelled_automatic_jobs', v_cancelled_jobs
    )
  );
  return v_handoff_id;
end;
$function$;

create or replace function public.return_handoff_to_ana(p_lead_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_organization_id uuid := public.current_org_id();
  v_user_id uuid := auth.uid();
  v_actor_name text := 'Usuário';
  v_lead public.leads%rowtype;
  v_cancelled_jobs integer := 0;
  v_now timestamptz := pg_catalog.now();
begin
  if v_user_id is null or v_organization_id is null
     or not private.is_active_org_member(v_organization_id, v_user_id) then
    raise exception 'organization_context_required';
  end if;

  select l.* into v_lead
    from public.leads as l
   where l.id = p_lead_id
     and l.organization_id = v_organization_id
     and (
       private.has_org_role(
         v_organization_id,
         v_user_id,
         array[
           'administrador'::public.app_role,
           'sdr'::public.app_role,
           'ia'::public.app_role,
           'cx'::public.app_role
         ]
       )
       or l.owner_id = v_user_id
       or l.assigned_to = v_user_id
     )
   for update;
  if not found then raise exception 'lead_not_found_or_access_denied'; end if;
  if coalesce(v_lead.opt_out, false) then raise exception 'lead_opt_out'; end if;
  if v_lead.contact_approval_status is distinct from 'approved'
     or v_lead.contact_approved_at is null then
    raise exception 'contact_approval_required';
  end if;

  select coalesce(nullif(pg_catalog.btrim(p.name), ''), 'Usuário')
    into v_actor_name from public.profiles as p where p.id = v_user_id;

  update public.outreach_jobs as j
     set status = 'cancelled', processed_at = v_now, locked_at = null, locked_by = null,
         error = 'cancelled_before_return_to_ana'
   where j.organization_id = v_organization_id
     and j.lead_id = p_lead_id
     and j.status in ('queued', 'retry', 'reconciliation_required')
     and j.processed_at is null and j.locked_at is null and j.locked_by is null
     and pg_catalog.lower(coalesce(j.payload ->> 'manual', 'false')) <> 'true'
     and not coalesce(j.payload ? 'provider_message_id', false)
     and not exists (
       select 1 from public.lead_outreach as o
        where o.id = j.id
          and o.organization_id = j.organization_id
          and (
            o.provider_message_id is not null
            or o.status in ('sent', 'delivered', 'read', 'replied', 'failed')
          )
     );
  get diagnostics v_cancelled_jobs = row_count;

  update public.leads
     set modo_atendimento = 'ia',
         ai_paused = false,
         automation_status = 'running',
         automation_error = null,
         automation_updated_at = v_now,
         no_reply_deadline_at = null,
         no_reply_processed_at = null,
         updated_at = v_now
   where id = p_lead_id and organization_id = v_organization_id;

  update public.lead_handoffs
     set status = 'closed', closed_at = v_now, updated_at = v_now
   where organization_id = v_organization_id
     and lead_id = p_lead_id
     and status in ('pending', 'accepted');

  insert into public.audit_logs (
    organization_id, actor_id, actor_name, actor_type, action, detail,
    entity_table, entity_id, event_data
  ) values (
    v_organization_id, v_user_id, coalesce(v_actor_name, 'Usuário'), 'user',
    'lead.handoff.returned_to_ana', 'Atendimento devolvido para a Ana.', 'leads', p_lead_id,
    pg_catalog.jsonb_build_object('source', 'central_atendimento', 'cancelled_automatic_jobs', v_cancelled_jobs)
  );
  return true;
end;
$function$;

revoke all on function public.request_human_handoff(uuid, text, text) from public, anon;
revoke all on function public.return_handoff_to_ana(uuid) from public, anon;
grant execute on function public.request_human_handoff(uuid, text, text) to authenticated, service_role;
grant execute on function public.return_handoff_to_ana(uuid) to authenticated, service_role;

commit;
