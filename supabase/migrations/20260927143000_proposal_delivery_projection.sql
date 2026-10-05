-- Links a human quote message to exactly one proposal and changes commercial
-- state only after the provider acceptance is persisted. The browser never
-- writes `sent` directly.

create function public.queue_human_whatsapp_proposal_message(
  p_organization_id uuid,
  p_lead_id uuid,
  p_user_id uuid,
  p_sender_name text,
  p_request_id uuid,
  p_recipient text,
  p_message text,
  p_integration_id uuid,
  p_context_last_contact timestamptz,
  p_proposal_id uuid,
  p_controlled_test boolean default false,
  p_controlled_test_expires_at timestamptz default null
)
returns table(job_id uuid, message_id uuid, job_status text, duplicate boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_proposal public.proposals%rowtype;
  v_queue record;
  v_payload jsonb;
begin
  if p_proposal_id is null then
    raise exception 'proposal_id_required';
  end if;

  select * into v_proposal
    from public.proposals
   where id = p_proposal_id
     and organization_id = p_organization_id
     and lead_id = p_lead_id
   for update;
  if not found then
    raise exception 'proposal_not_found_or_unlinked';
  end if;
  if v_proposal.status not in ('draft', 'pending', 'rascunho')
     or coalesce(v_proposal.need_approval, false) then
    raise exception 'proposal_not_ready_for_delivery';
  end if;

  select * into v_queue
    from public.queue_human_whatsapp_message(
      p_organization_id,
      p_lead_id,
      p_user_id,
      p_sender_name,
      p_request_id,
      p_recipient,
      p_message,
      p_integration_id,
      p_context_last_contact,
      p_controlled_test,
      p_controlled_test_expires_at
    );

  select payload into v_payload
    from public.outreach_jobs
   where id = v_queue.job_id
     and organization_id = p_organization_id
   for update;
  if not found then
    raise exception 'outreach_job_not_created';
  end if;
  if v_queue.duplicate
     and v_payload ->> 'proposal_id' is distinct from p_proposal_id::text then
    raise exception 'idempotency_payload_mismatch';
  end if;

  update public.outreach_jobs
     set payload = coalesce(payload, '{}'::jsonb)
       || jsonb_build_object('proposal_id', p_proposal_id)
   where id = v_queue.job_id
     and organization_id = p_organization_id;

  if not v_queue.duplicate then
    insert into public.audit_logs (
      organization_id, actor_id, actor_name, actor_type, action, detail,
      entity_table, entity_id, event_data
    ) values (
      p_organization_id,
      p_user_id,
      coalesce(nullif(btrim(p_sender_name), ''), 'Atendente'),
      'user',
      'proposal.delivery_queued',
      'Proposta vinculada à mensagem humana aguardando aceite do provedor.',
      'proposals',
      p_proposal_id,
      jsonb_build_object('lead_id', p_lead_id, 'message_id', v_queue.message_id, 'job_id', v_queue.job_id)
    );
  end if;

  return query select v_queue.job_id, v_queue.message_id, v_queue.job_status, v_queue.duplicate;
end;
$$;

revoke all on function public.queue_human_whatsapp_proposal_message(
  uuid, uuid, uuid, text, uuid, text, text, uuid, timestamptz, uuid, boolean, timestamptz
) from public, anon, authenticated;
grant execute on function public.queue_human_whatsapp_proposal_message(
  uuid, uuid, uuid, text, uuid, text, text, uuid, timestamptz, uuid, boolean, timestamptz
) to service_role;

create or replace function private.project_proposal_delivery_after_message()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_proposal_id uuid;
  v_lead public.leads%rowtype;
  v_pipeline_stage_id uuid;
  v_stage_advanced boolean := false;
begin
  if new.type <> 'sent' or old.type = 'sent' then
    return new;
  end if;

  select case
    when (j.payload ->> 'proposal_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (j.payload ->> 'proposal_id')::uuid
    else null
  end
    into v_proposal_id
    from public.outreach_jobs j
   where j.organization_id = new.organization_id
     and j.lead_id = new.lead_id
     and j.payload ->> 'message_id' = new.id::text
   order by j.created_at desc
   limit 1;

  if v_proposal_id is null then
    return new;
  end if;

  update public.proposals
     set status = 'sent',
         updated_at = now()
   where id = v_proposal_id
     and organization_id = new.organization_id
     and lead_id = new.lead_id
     and status in ('draft', 'pending', 'rascunho');
  if not found then
    return new;
  end if;

  select * into v_lead
    from public.leads
   where id = new.lead_id
     and organization_id = new.organization_id
   for update;

  if found
     and private.canonical_lead_stage_key(v_lead.ana_stage, v_lead.ana_outcome) = 'reuniao'
     and exists (
       select 1 from public.lead_qualifications q
        where q.organization_id = new.organization_id
          and q.lead_id = new.lead_id
     ) then
    select id into v_pipeline_stage_id
      from public.pipeline_stages
     where organization_id = new.organization_id
       and pipeline_id = v_lead.pipeline_id
       and ana_stage_key = 'orcamento'
       and active
     limit 1;

    if v_pipeline_stage_id is not null then
      perform set_config('wayflex.stage_change_source', 'system', true);
      perform set_config('wayflex.stage_change_reason', 'Orçamento enviado com aceite confirmado do provedor.', true);
      update public.leads
         set pipeline_stage_id = v_pipeline_stage_id,
             ana_stage = 'orcamento',
             ana_outcome = null,
             updated_at = now()
       where id = v_lead.id
         and organization_id = new.organization_id;
      v_stage_advanced := true;
    end if;
  end if;

  insert into public.audit_logs (
    organization_id, actor_name, actor_type, action, detail,
    entity_table, entity_id, event_data
  ) values (
    new.organization_id,
    'Sistema',
    'system',
    'proposal.delivery_accepted',
    'Proposta marcada como enviada após aceite comprovado do provedor.',
    'proposals',
    v_proposal_id,
    jsonb_build_object('lead_id', new.lead_id, 'message_id', new.id, 'stage_advanced', v_stage_advanced)
  );

  return new;
end;
$$;

drop trigger if exists z_project_proposal_delivery_after_message on public.lead_messages;
create trigger z_project_proposal_delivery_after_message
after update of type on public.lead_messages
for each row execute function private.project_proposal_delivery_after_message();
