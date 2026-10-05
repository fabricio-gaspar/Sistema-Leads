begin;

-- Mantém a RPC existente para automações legadas. A Central usa esta ação
-- explícita para nunca confundir "assumir" com o responsável já atribuído.
create or replace function public.assign_human_handoff(
  p_lead_id uuid,
  p_reason text,
  p_category text default 'operator_takeover',
  p_target_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_organization_id uuid := public.current_org_id();
  v_user_id uuid := auth.uid();
  v_target_user_id uuid := coalesce(p_target_user_id, auth.uid());
  v_target_name text;
  v_handoff_id uuid;
begin
  if v_user_id is null or v_organization_id is null
     or not private.is_active_org_member(v_organization_id, v_user_id) then
    raise exception 'organization_context_required';
  end if;
  if p_lead_id is null or nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'lead_and_reason_required';
  end if;
  if nullif(btrim(coalesce(p_category, '')), '') not in ('operator_takeover', 'operator_transfer') then
    raise exception 'invalid_handoff_category';
  end if;
  if not exists (
    select 1
      from public.leads lead
     where lead.id = p_lead_id
       and lead.organization_id = v_organization_id
       and (
         private.has_org_role(v_organization_id, v_user_id, array[
           'administrador'::public.app_role,
           'sdr'::public.app_role,
           'ia'::public.app_role,
           'cx'::public.app_role
         ])
         or lead.owner_id = v_user_id
         or lead.assigned_to = v_user_id
       )
  ) then
    raise exception 'lead_not_found_or_access_denied';
  end if;
  select profile.name into v_target_name
    from public.organization_members member
    join public.profiles profile on profile.id = member.user_id
   where member.organization_id = v_organization_id
     and member.user_id = v_target_user_id
     and member.status = 'active'
   limit 1;
  if v_target_name is null then raise exception 'handoff_assignee_inactive'; end if;
  if not private.has_org_permission(v_organization_id, v_target_user_id, 'conversations.reply_all')
     and not private.has_org_permission(v_organization_id, v_target_user_id, 'conversations.reply_assigned') then
    raise exception 'handoff_assignee_cannot_reply';
  end if;

  -- Reaproveita a rotina canônica: ela pausa a Ana, cancela somente jobs
  -- automáticos seguros e preserva o histórico/auditoria já existentes.
  v_handoff_id := public.request_human_handoff(p_lead_id, p_reason, p_category);

  update public.leads
     set assigned_to = v_target_user_id,
         owner_id = v_target_user_id,
         owner = left(coalesce(nullif(btrim(v_target_name), ''), 'Responsável'), 160),
         updated_at = now()
   where id = p_lead_id and organization_id = v_organization_id;

  update public.lead_handoffs
     set to_user_id = v_target_user_id,
         assigned_to = v_target_user_id,
         updated_at = now()
   where id = v_handoff_id and organization_id = v_organization_id;

  insert into public.audit_logs (
    organization_id, actor_id, actor_name, actor_type, action, detail,
    entity_table, entity_id, event_data
  )
  select v_organization_id, v_user_id, coalesce(profile.name, 'Usuário'), 'user',
    case when p_category = 'operator_takeover' then 'lead.handoff.taken_over' else 'lead.handoff.transferred' end,
    case when p_category = 'operator_takeover' then 'Atendimento assumido pelo operador atual.' else 'Atendimento transferido para o responsável selecionado.' end,
    'leads', p_lead_id,
    jsonb_build_object('handoff_id', v_handoff_id, 'target_user_id', v_target_user_id, 'category', p_category)
  from public.profiles profile where profile.id = v_user_id;
  return v_handoff_id;
end;
$function$;

revoke all on function public.assign_human_handoff(uuid, text, text, uuid) from public, anon;
grant execute on function public.assign_human_handoff(uuid, text, text, uuid) to authenticated, service_role;

commit;
