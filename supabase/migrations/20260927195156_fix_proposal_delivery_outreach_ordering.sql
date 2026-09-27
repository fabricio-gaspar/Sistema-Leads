-- Provider acceptance updates every lead message, not only proposal messages.
-- The proposal projection trigger must therefore be safe for ordinary Ana
-- outreach. outreach_jobs has run_at (not created_at), so the previous ORDER
-- BY aborted the acceptance transaction after Z-API had already accepted it.
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
    from public.outreach_jobs as j
   where j.organization_id = new.organization_id
     and j.lead_id = new.lead_id
     and j.payload ->> 'message_id' = new.id::text
   order by j.run_at desc, j.id desc
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
       select 1 from public.lead_qualifications as q
        where q.organization_id = new.organization_id
          and q.lead_id = new.lead_id
     ) then
    select ps.id into v_pipeline_stage_id
      from public.pipeline_stages as ps
     where ps.organization_id = new.organization_id
       and ps.pipeline_id = v_lead.pipeline_id
       and ps.ana_stage_key = 'orcamento'
       and ps.active
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
