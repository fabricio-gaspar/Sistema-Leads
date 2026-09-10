-- Remove apenas o grafo operacional dos leads de teste selecionados por um
-- administrador autenticado. A função não é exposta a anon/authenticated;
-- ela é chamada exclusivamente pela Edge Function com service role depois da
-- confirmação explícita da lista apresentada no painel.
create or replace function public.purge_selected_test_leads(
  p_organization_id uuid,
  p_lead_ids uuid[]
)
returns table (lead_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  select array_agg(id order by id)
  into v_ids
  from public.leads
  where organization_id = p_organization_id
    and id = any(p_lead_ids);

  if coalesce(cardinality(v_ids), 0) = 0 then
    return;
  end if;

  -- Dependências de mensagens, atendimento e automação.
  delete from public.message_attachments where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.crm_stage_events where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.ai_decisions where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.webhook_events where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.channel_inbound_events where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.lead_outreach where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.outreach_jobs where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.lead_messages where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.agent_runs where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.automation_dead_letters letter
  using public.automation_runs run
  where letter.organization_id = p_organization_id
    and run.organization_id = p_organization_id
    and letter.run_id = run.id
    and run.lead_id = any(v_ids);
  delete from public.automation_run_steps step
  using public.automation_runs run
  where step.organization_id = p_organization_id
    and run.organization_id = p_organization_id
    and step.run_id = run.id
    and run.lead_id = any(v_ids);
  delete from public.automation_runs where organization_id = p_organization_id and lead_id = any(v_ids);

  -- Agenda, atendimento humano, Kanban e comercial.
  delete from public.appointment_reminders where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.appointment_reminders reminder
  using public.appointments appointment
  where reminder.organization_id = p_organization_id
    and appointment.organization_id = p_organization_id
    and reminder.appointment_id = appointment.id
    and appointment.lead_id = any(v_ids);
  delete from public.appointments where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.call_records where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.ticket_notes note
  using public.tickets ticket
  where note.organization_id = p_organization_id
    and ticket.organization_id = p_organization_id
    and note.ticket_id = ticket.id
    and ticket.lead_id = any(v_ids);
  delete from public.ticket_tags tag
  using public.tickets ticket
  where tag.organization_id = p_organization_id
    and ticket.organization_id = p_organization_id
    and tag.ticket_id = ticket.id
    and ticket.lead_id = any(v_ids);
  delete from public.tickets where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.lead_handoffs where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.lead_tasks where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.lead_stage_history where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.lead_assignments where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.lead_notes where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.lead_qualifications where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.lead_sequence_enrollments where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.lead_list_members where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.proposals where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.crm_opportunities where organization_id = p_organization_id and lead_id = any(v_ids);

  -- Identidades, consentimentos e vínculos do canal usados pelo matching.
  delete from public.channel_contact_bindings where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.contact_points where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.consent_events where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.contact_suppressions where organization_id = p_organization_id and lead_id = any(v_ids);
  delete from public.privacy_requests where organization_id = p_organization_id and lead_id = any(v_ids);

  -- Eventos genéricos que apontam para o lead não possuem FK, portanto são
  -- removidos explicitamente para não poluir o Registro do Sistema.
  delete from public.audit_logs
  where organization_id = p_organization_id
    and (
      entity_id = any(v_ids)
      or event_data ->> 'lead_id' in (select id::text from unnest(v_ids) as id)
    );
  delete from public.domain_events
  where organization_id = p_organization_id
    and entity_id = any(v_ids);

  delete from public.leads
  where organization_id = p_organization_id
    and id = any(v_ids);

  return query select id from unnest(v_ids) as id;
end;
$$;

revoke all on function public.purge_selected_test_leads(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.purge_selected_test_leads(uuid, uuid[]) to service_role;
