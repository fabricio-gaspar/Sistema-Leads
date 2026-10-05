-- Uma chamada RPC grava lista, leads e vínculos na mesma transação PostgREST.
-- O ID da lista também é a chave de repetição segura do lote.
create or replace function public.import_prospecting_batch(
  p_batch_id uuid,
  p_leads jsonb,
  p_list_name text,
  p_list_criteria jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid := public.current_org_id();
  v_actor uuid := auth.uid();
  v_count integer;
  v_fingerprint text;
  v_created uuid;
  v_existing public.lead_lists%rowtype;
  v_item jsonb;
  v_lead public.leads%rowtype;
  v_ids uuid[] := array[]::uuid[];
  v_existing_ids uuid[];
begin
  if v_actor is null or v_org is null
    or not private.has_org_permission(v_org, v_actor, 'leads.create') then
    raise exception 'prospecting_import_not_allowed' using errcode = '42501';
  end if;

  if p_batch_id is null or jsonb_typeof(p_leads) is distinct from 'array'
    or jsonb_typeof(p_list_criteria) is distinct from 'object'
    or nullif(btrim(p_list_name), '') is null
    or length(p_list_name) > 160 then
    raise exception 'prospecting_import_invalid_request' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_leads);
  if v_count < 1 or v_count > 100 then
    raise exception 'prospecting_import_invalid_count' using errcode = '22023';
  end if;

  -- JSONB normaliza a ordem das chaves. O hash impede que o mesmo ID de lote
  -- confirme silenciosamente uma seleção, responsável ou lista diferente.
  v_fingerprint := md5(p_leads::text || ':' || btrim(p_list_name) || ':' || p_list_criteria::text);
  insert into public.lead_lists (id, organization_id, name, status, criteria, created_by)
  values (
    p_batch_id, v_org, btrim(p_list_name), 'pending',
    p_list_criteria || jsonb_build_object('total', v_count, 'import_fingerprint', v_fingerprint),
    v_actor
  )
  on conflict (id) do nothing
  returning id into v_created;

  if v_created is null then
    select * into v_existing
    from public.lead_lists
    where id = p_batch_id and organization_id = v_org and created_by = v_actor;
    if not found or v_existing.criteria->>'import_fingerprint' is distinct from v_fingerprint then
      raise exception 'prospecting_import_batch_conflict' using errcode = '23505';
    end if;
    select array_agg(lead_id order by lead_id) into v_existing_ids
    from public.lead_list_members
    where list_id = p_batch_id and organization_id = v_org;
    if coalesce(array_length(v_existing_ids, 1), 0) <> v_count then
      raise exception 'prospecting_import_batch_incomplete' using errcode = '23514';
    end if;
    return jsonb_build_object('listId', p_batch_id, 'leadIds', to_jsonb(v_existing_ids), 'alreadyImported', true);
  end if;

  for v_item in select value from jsonb_array_elements(p_leads)
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or exists (
        select 1 from jsonb_object_keys(v_item) as k(key)
        where k.key <> all (array[
          'id','organization_id','company','contact','email','phone','whatsapp',
          'segment','score','temp','stage','ana_stage','ana_outcome',
          'modo_atendimento','origin','owner','owner_id','assigned_to',
          'opt_out','ai_paused','automation_status','contact_approval_status',
          'contact_approval_reason','contact_approved_at','active_channel',
          'city','size','source_record_id','source_url','deduplication_key',
          'prospect_identity','score_snapshot','score_explanation','score_source',
          'score_verified_at','source_metadata'
        ])
      ) then
      raise exception 'prospecting_import_invalid_lead_fields' using errcode = '22023';
    end if;
    v_lead := jsonb_populate_record(null::public.leads, v_item);
    if v_lead.id is null or v_lead.organization_id is distinct from v_org
      or nullif(btrim(v_lead.company), '') is null
      or v_lead.owner_id is distinct from v_lead.assigned_to then
      raise exception 'prospecting_import_invalid_lead' using errcode = '22023';
    end if;

    -- Colunas não listadas preservam os defaults do schema e seus triggers.
    insert into public.leads (
      id, organization_id, company, contact, email, phone, whatsapp, segment,
      score, temp, stage, ana_stage, ana_outcome, modo_atendimento, origin,
      owner, owner_id, assigned_to, opt_out, ai_paused, automation_status,
      contact_approval_status, contact_approval_reason, contact_approved_at,
      contact_approved_by, active_channel, city, size, source_record_id,
      source_url, deduplication_key, prospect_identity, score_snapshot,
      score_explanation, score_source, score_verified_at, source_metadata
    ) values (
      v_lead.id, v_org, btrim(v_lead.company), v_lead.contact, v_lead.email,
      v_lead.phone, v_lead.whatsapp, v_lead.segment, v_lead.score, v_lead.temp,
      v_lead.stage, v_lead.ana_stage, v_lead.ana_outcome, v_lead.modo_atendimento,
      v_lead.origin, v_lead.owner, v_lead.owner_id, v_lead.assigned_to,
      v_lead.opt_out, v_lead.ai_paused, v_lead.automation_status,
      v_lead.contact_approval_status, v_lead.contact_approval_reason,
      v_lead.contact_approved_at,
      case when v_lead.contact_approval_status = 'approved' then v_actor else null end,
      v_lead.active_channel, v_lead.city, v_lead.size, v_lead.source_record_id,
      v_lead.source_url, v_lead.deduplication_key, v_lead.prospect_identity,
      v_lead.score_snapshot, v_lead.score_explanation, v_lead.score_source,
      v_lead.score_verified_at, coalesce(v_lead.source_metadata, '{}'::jsonb)
    );
    insert into public.lead_list_members (organization_id, list_id, lead_id)
    values (v_org, p_batch_id, v_lead.id);
    v_ids := array_append(v_ids, v_lead.id);
  end loop;

  return jsonb_build_object('listId', p_batch_id, 'leadIds', to_jsonb(v_ids), 'alreadyImported', false);
end;
$$;

revoke all on function public.import_prospecting_batch(uuid, jsonb, text, jsonb) from public, anon;
grant execute on function public.import_prospecting_batch(uuid, jsonb, text, jsonb) to authenticated;
