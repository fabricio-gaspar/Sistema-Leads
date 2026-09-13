-- organization_members.role is the canonical app_role enum in Portuguese.
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
  select * into v_lead from public.leads where id = new.entity_id and organization_id = new.organization_id;
  if not found then return new; end if;
  v_action_required := new.event_name in ('lead.meeting.requested','lead.quote.requested','lead.human.requested','lead.hot.detected','lead.analysis.failed','lead.handoff.requested');
  if v_action_required and exists (select 1 from public.prospecting_schedules where organization_id = new.organization_id and active = true and notify_immediate = false) then return new; end if;
  if not v_action_required and exists (select 1 from public.prospecting_schedules where organization_id = new.organization_id and active = true and notify_progress = false) then return new; end if;
  v_kind := case new.event_name when 'lead.reply.received' then 'REPLY' when 'lead.interaction.positive' then 'PROGRESS' when 'lead.interest.detected' then 'INTEREST' when 'lead.meeting.requested' then 'MEETING' when 'lead.quote.requested' then 'QUOTE' when 'lead.hot.detected' then 'HOT' when 'lead.analysis.failed' then 'ALERT' else 'HANDOFF' end;
  v_priority := case when new.event_name in ('lead.human.requested','lead.handoff.requested') then 'urgent' when new.event_name in ('lead.meeting.requested','lead.quote.requested','lead.hot.detected','lead.analysis.failed') then 'high' else 'normal' end;
  v_title := case new.event_name when 'lead.reply.received' then 'Lead respondeu ao contato' when 'lead.interaction.positive' then 'Interação positiva' when 'lead.interest.detected' then 'Interesse comercial identificado' when 'lead.meeting.requested' then 'Lead pediu uma reunião' when 'lead.quote.requested' then 'Lead pediu um orçamento' when 'lead.human.requested' then 'Lead pediu atendimento humano' when 'lead.hot.detected' then 'Lead quente identificado' when 'lead.analysis.failed' then 'Resposta requer análise humana' else 'Atendimento transferido para humano' end;
  v_description := coalesce(nullif(new.payload->>'summary',''),nullif(new.payload->>'reason',''),coalesce(nullif(v_lead.contact,''),nullif(v_lead.company,''),'Lead') || ' possui uma nova atualização comercial.');
  v_recommended := coalesce(nullif(new.payload->>'next_action',''),case when new.event_name = 'lead.meeting.requested' then 'Confirmar data e horário' when new.event_name = 'lead.quote.requested' then 'Revisar escopo e preparar orçamento' when new.event_name in ('lead.human.requested','lead.handoff.requested') then 'Assumir o atendimento' when new.event_name = 'lead.hot.detected' then 'Contatar o lead hoje' else 'Abrir a conversa' end);
  for v_user_id in
    select distinct recipient.user_id from (
      select coalesce(v_lead.assigned_to,v_lead.owner_id) as user_id where coalesce(v_lead.assigned_to,v_lead.owner_id) is not null
      union all
      select om.user_id from public.organization_members om where om.organization_id = new.organization_id and om.status = 'active' and om.role = 'administrador' and coalesce(v_lead.assigned_to,v_lead.owner_id) is null
    ) recipient
    join public.organization_members active_member on active_member.organization_id = new.organization_id and active_member.user_id = recipient.user_id and active_member.status = 'active'
  loop
    if not exists (select 1 from public.notification_preferences preference where preference.organization_id = new.organization_id and preference.user_id = v_user_id and preference.immediate_in_app = false) then
      insert into public.notifications (organization_id,user_id,kind,title,description,read,link,lead_id,event_id,priority,status,action_required,recommended_action,metadata,deduplication_key,due_at)
      values (new.organization_id,v_user_id,v_kind,v_title,left(v_description,500),false,'/dashboard/atendimento?leadId=' || new.entity_id::text,new.entity_id,new.id,v_priority,'open',v_action_required,left(v_recommended,240),jsonb_build_object('event_name',new.event_name,'evidence',coalesce(new.payload->'evidence','{}'::jsonb)),'event:' || new.id::text,case when v_action_required then now() else null end)
      on conflict (organization_id,user_id,deduplication_key) where deduplication_key is not null do nothing;
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function private.route_commercial_notification() from public, anon, authenticated;
grant execute on function private.route_commercial_notification() to service_role;
