begin;

create unique index if not exists lead_outreach_org_provider_message_uidx
  on public.lead_outreach (organization_id, channel, provider_message_id)
  where provider_message_id is not null;

create unique index if not exists lead_handoffs_one_open_per_lead_uidx
  on public.lead_handoffs (lead_id)
  where status in ('pending', 'accepted');

create or replace function public.reconcile_whatsapp_receipt(
  p_organization_id uuid,
  p_provider_message_ids text[],
  p_expected_message_count integer,
  p_status text,
  p_occurred_at timestamptz
)
returns table(
  outreach_id uuid,
  lead_id uuid,
  message_id uuid,
  provider_message_id text,
  previous_status text,
  current_status text,
  changed boolean
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_outreach public.lead_outreach%rowtype;
  v_message_id uuid;
  v_previous text;
  v_current text;
  v_changed boolean;
  v_match_count integer;
  v_at timestamptz := pg_catalog.coalesce(p_occurred_at, pg_catalog.now());
begin
  if p_organization_id is null
     or pg_catalog.coalesce(pg_catalog.cardinality(p_provider_message_ids), 0) = 0
     or p_expected_message_count is null
     or p_expected_message_count < 1
     or p_status not in ('sent', 'delivered', 'read', 'failed') then
    raise exception 'receipt_input_invalid';
  end if;

  select pg_catalog.count(distinct o.id)::integer
    into v_match_count
    from public.lead_outreach as o
   where o.organization_id = p_organization_id
     and o.channel = 'whatsapp'
     and pg_catalog.lower(pg_catalog.coalesce(o.provider, '')) in ('zapi', 'z-api')
     and o.provider_message_id = any(p_provider_message_ids);
  if v_match_count > p_expected_message_count then
    raise exception 'receipt_identity_ambiguous';
  end if;

  for v_outreach in
    select o.*
      from public.lead_outreach as o
     where o.organization_id = p_organization_id
       and o.channel = 'whatsapp'
       and pg_catalog.lower(pg_catalog.coalesce(o.provider, '')) in ('zapi', 'z-api')
       and o.provider_message_id = any(p_provider_message_ids)
     order by o.created_at, o.id
     for update
  loop
    v_message_id := null;
    v_changed := false;
    v_previous := v_outreach.status;
    v_current := v_previous;
    if p_status = 'failed' then
      if v_previous not in ('delivered', 'read', 'replied') then
        v_current := 'failed';
        v_changed := v_previous is distinct from v_current or v_outreach.failed_at is null;
      end if;
    elsif (
      case p_status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else -1 end
    ) > (
      case v_previous when 'pending' then 0 when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 when 'replied' then 4 when 'failed' then 4 else -1 end
    ) then
      v_current := p_status;
      v_changed := true;
    end if;

    v_changed := v_changed
      or (v_current in ('sent', 'delivered', 'read') and v_outreach.sent_at is null)
      or (v_current in ('delivered', 'read') and v_outreach.delivered_at is null)
      or (v_current = 'read' and v_outreach.read_at is null)
      or (p_status = 'failed' and v_current = 'failed' and v_outreach.failed_at is null);

    if v_changed then
      update public.lead_outreach as o
         set status = v_current,
             sent_at = case when v_current in ('sent', 'delivered', 'read') then pg_catalog.coalesce(o.sent_at, v_at) else o.sent_at end,
             delivered_at = case when v_current in ('delivered', 'read') then pg_catalog.coalesce(o.delivered_at, v_at) else o.delivered_at end,
             read_at = case when v_current = 'read' then pg_catalog.coalesce(o.read_at, v_at) else o.read_at end,
             failed_at = case when v_current = 'failed' then pg_catalog.coalesce(o.failed_at, v_at) else o.failed_at end,
             error = case when v_current = 'failed' then 'provider_delivery_failed' else null end,
             updated_at = pg_catalog.now()
       where o.id = v_outreach.id and o.organization_id = p_organization_id;
    end if;

    if (v_outreach.metadata ->> 'message_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      v_message_id := (v_outreach.metadata ->> 'message_id')::uuid;
      update public.lead_messages as m
         set type = case when v_current = 'failed' then 'failed' else 'sent' end,
             provider_message_id = pg_catalog.coalesce(m.provider_message_id, v_outreach.provider_message_id)
       where m.id = v_message_id
         and m.organization_id = p_organization_id
         and m.lead_id = v_outreach.lead_id
         and (m.provider_message_id is null or m.provider_message_id = v_outreach.provider_message_id);
      if not found then raise exception 'receipt_message_identity_conflict'; end if;
    end if;

    return query select v_outreach.id, v_outreach.lead_id, v_message_id,
      v_outreach.provider_message_id, v_previous, v_current, v_changed;
  end loop;
end;
$function$;

create or replace function public.record_outreach_provider_acceptance(
  p_organization_id uuid,
  p_job_id uuid,
  p_lead_id uuid,
  p_message_id uuid,
  p_provider text,
  p_provider_message_id text,
  p_sent_at timestamptz,
  p_no_reply_deadline_at timestamptz default null
)
returns table(outreach_status text, job_status text)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_outreach public.lead_outreach%rowtype;
  v_message public.lead_messages%rowtype;
  v_job public.outreach_jobs%rowtype;
  v_status text;
  v_sent_at timestamptz := pg_catalog.coalesce(p_sent_at, pg_catalog.now());
  v_existing_id uuid;
begin
  if p_organization_id is null or p_job_id is null or p_lead_id is null
     or p_message_id is null
     or pg_catalog.nullif(pg_catalog.btrim(p_provider), '') is null
     or pg_catalog.nullif(pg_catalog.btrim(p_provider_message_id), '') is null then
    raise exception 'provider_acceptance_input_invalid';
  end if;

  -- The callback locks outreach before its message. Keep this same order here.
  select o.* into v_outreach
    from public.lead_outreach as o
   where o.id = p_job_id
     and o.organization_id = p_organization_id
     and o.lead_id = p_lead_id
   for update;
  if not found then raise exception 'outreach_not_found'; end if;

  select o.id into v_existing_id
    from public.lead_outreach as o
   where o.organization_id = p_organization_id
     and o.channel = v_outreach.channel
     and o.provider_message_id = p_provider_message_id
     and o.id <> p_job_id
   limit 1
   for update;
  if v_existing_id is not null then raise exception 'provider_message_id_conflict'; end if;
  if v_outreach.provider_message_id is not null
     and v_outreach.provider_message_id <> p_provider_message_id then
    raise exception 'provider_message_id_conflict';
  end if;

  v_status := case
    when v_outreach.status in ('delivered', 'read', 'replied', 'failed') then v_outreach.status
    else 'sent'
  end;
  update public.lead_outreach as o
     set provider = pg_catalog.coalesce(pg_catalog.nullif(pg_catalog.btrim(o.provider), ''), pg_catalog.btrim(p_provider)),
         provider_message_id = p_provider_message_id,
         status = v_status,
         sent_at = pg_catalog.coalesce(o.sent_at, v_sent_at),
         error = case when v_status = 'failed' then o.error else null end,
         updated_at = pg_catalog.now()
   where o.id = p_job_id and o.organization_id = p_organization_id;

  select m.* into v_message
    from public.lead_messages as m
   where m.id = p_message_id
     and m.organization_id = p_organization_id
     and m.lead_id = p_lead_id
   for update;
  if not found then raise exception 'outbound_message_not_found'; end if;
  if v_message.provider_message_id is not null
     and v_message.provider_message_id <> p_provider_message_id then
    raise exception 'provider_message_id_conflict';
  end if;
  update public.lead_messages as m
     set type = case when v_status = 'failed' then 'failed' else 'sent' end,
         sent_at = pg_catalog.coalesce(m.sent_at, v_sent_at),
         provider_message_id = p_provider_message_id
   where m.id = p_message_id
     and m.organization_id = p_organization_id
     and m.lead_id = p_lead_id;

  select j.* into v_job
    from public.outreach_jobs as j
   where j.id = p_job_id
     and j.organization_id = p_organization_id
   for update;
  if not found then raise exception 'outreach_job_not_found'; end if;
  if v_job.lead_id is distinct from p_lead_id
     or v_job.channel is distinct from v_outreach.channel then
    raise exception 'outreach_job_identity_conflict';
  end if;
  update public.outreach_jobs as j
     set status = 'processed',
         processed_at = pg_catalog.coalesce(j.processed_at, v_sent_at),
         locked_at = null,
         locked_by = null,
         error = null,
         payload = pg_catalog.coalesce(j.payload, '{}'::jsonb)
           || pg_catalog.jsonb_build_object('provider_message_id', p_provider_message_id)
   where j.id = p_job_id and j.organization_id = p_organization_id;

  -- A newer inbound must keep its own last_contact and cleared no-reply deadline.
  -- An automatic provider acceptance that races a human handoff is still
  -- recorded, but it must never re-arm a deadline after the human takes over.
  update public.leads as l
     set last_contact = v_sent_at,
         no_reply_deadline_at = case
           when p_no_reply_deadline_at is not null
                and l.modo_atendimento = 'ia'
                and pg_catalog.coalesce(l.ai_paused, false) = false
             then p_no_reply_deadline_at
           else l.no_reply_deadline_at
         end,
         no_reply_processed_at = case
           when p_no_reply_deadline_at is not null
                and l.modo_atendimento = 'ia'
                and pg_catalog.coalesce(l.ai_paused, false) = false
             then null
           else l.no_reply_processed_at
         end,
         updated_at = pg_catalog.now()
   where l.id = p_lead_id
     and l.organization_id = p_organization_id
     and (l.last_contact is null or l.last_contact <= v_sent_at);

  return query select v_status, 'processed'::text;
end;
$function$;

create or replace function public.queue_human_whatsapp_message(
  p_organization_id uuid,
  p_lead_id uuid,
  p_user_id uuid,
  p_sender_name text,
  p_request_id uuid,
  p_recipient text,
  p_message text,
  p_integration_id uuid,
  p_context_last_contact timestamptz,
  p_controlled_test boolean default false,
  p_controlled_test_expires_at timestamptz default null
)
returns table(job_id uuid, message_id uuid, job_status text, duplicate boolean)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_key text := 'human:' || p_organization_id::text || ':' || p_user_id::text || ':' || p_request_id::text;
  v_job public.outreach_jobs%rowtype;
  v_message_id uuid;
  v_lead public.leads%rowtype;
begin
  if p_organization_id is null or p_lead_id is null or p_user_id is null
     or p_request_id is null or p_integration_id is null
     or pg_catalog.nullif(pg_catalog.btrim(p_recipient), '') is null
     or pg_catalog.nullif(pg_catalog.btrim(p_message), '') is null then
    raise exception 'human_message_input_required';
  end if;

  if not private.is_active_org_member(p_organization_id, p_user_id) then
    raise exception 'organization_access_denied';
  end if;

  select l.* into v_lead
    from public.leads as l
   where l.id = p_lead_id
     and l.organization_id = p_organization_id
     and (
       private.has_org_role(
         p_organization_id,
         p_user_id,
         array[
           'administrador'::public.app_role,
           'sdr'::public.app_role,
           'ia'::public.app_role,
           'cx'::public.app_role
         ]
       )
       or l.owner_id = p_user_id
       or l.assigned_to = p_user_id
     )
   for update;
  if not found then raise exception 'lead_not_found_or_access_denied'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key, 0));
  select j.* into v_job
    from public.outreach_jobs as j
   where j.idempotency_key = v_key
   limit 1;
  if found then
    if v_job.organization_id is distinct from p_organization_id
       or v_job.lead_id is distinct from p_lead_id
       or v_job.payload ->> 'requested_by' is distinct from p_user_id::text
       or v_job.payload ->> 'recipient' is distinct from p_recipient
       or v_job.payload ->> 'message' is distinct from pg_catalog.left(pg_catalog.btrim(p_message), 4096)
       or v_job.payload ->> 'integration_id' is distinct from p_integration_id::text
       or pg_catalog.coalesce((v_job.payload ->> 'controlled_test')::boolean, false) is distinct from pg_catalog.coalesce(p_controlled_test, false) then
      raise exception 'idempotency_payload_mismatch';
    end if;
    return query select
      v_job.id,
      case when (v_job.payload ->> 'message_id') ~* '^[0-9a-f-]{36}$'
        then (v_job.payload ->> 'message_id')::uuid else null end,
      pg_catalog.coalesce(v_job.status, 'queued'),
      true;
    return;
  end if;

  insert into public.lead_messages (
    organization_id, lead_id, sender, sender_name, type, text, sent_at
  ) values (
    p_organization_id,
    p_lead_id,
    'human',
    pg_catalog.coalesce(pg_catalog.nullif(pg_catalog.btrim(p_sender_name), ''), 'Atendente'),
    'queued',
    pg_catalog.left(pg_catalog.btrim(p_message), 4096),
    null::timestamptz
  ) returning id into v_message_id;

  insert into public.outreach_jobs (
    organization_id, lead_id, channel, attempt, run_at, status, payload, idempotency_key
  ) values (
    p_organization_id,
    p_lead_id,
    'whatsapp',
    0,
    pg_catalog.now(),
    'queued',
    pg_catalog.jsonb_build_object(
      'recipient', p_recipient,
      'message', pg_catalog.left(pg_catalog.btrim(p_message), 4096),
      'message_id', v_message_id,
      'manual', true,
      'mode', 'humano',
      'provider', 'central_atendimento',
      'requested_by', p_user_id,
      'request_id', p_request_id,
      'integration_id', p_integration_id,
      'context_last_contact', p_context_last_contact,
      'controlled_test', pg_catalog.coalesce(p_controlled_test, false),
      'controlled_test_expires_at', p_controlled_test_expires_at
    ),
    v_key
  ) returning * into v_job;

  insert into public.audit_logs (
    organization_id, actor_id, actor_name, actor_type, action, detail,
    entity_table, entity_id, event_data
  ) values (
    p_organization_id,
    p_user_id,
    pg_catalog.coalesce(pg_catalog.nullif(pg_catalog.btrim(p_sender_name), ''), 'Atendente'),
    'user',
    case when pg_catalog.coalesce(p_controlled_test, false)
      then 'outreach.whatsapp_controlled_test_queued'
      else 'outreach.whatsapp_queued'
    end,
    case when pg_catalog.coalesce(p_controlled_test, false)
      then 'Teste controlado colocado na fila segura.'
      else 'Mensagem colocada na fila segura.'
    end,
    'outreach_jobs',
    v_job.id,
    pg_catalog.jsonb_build_object(
      'lead_id', p_lead_id,
      'message_id', v_message_id,
      'request_id', p_request_id,
      'channel', 'whatsapp',
      'controlled_test', pg_catalog.coalesce(p_controlled_test, false)
    )
  );

  return query select v_job.id, v_message_id, pg_catalog.coalesce(v_job.status, 'queued'), false;
end;
$function$;

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
  if p_lead_id is null or pg_catalog.nullif(pg_catalog.btrim(p_reason), '') is null then
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

  select pg_catalog.coalesce(pg_catalog.nullif(pg_catalog.btrim(p.name), ''), 'Usuário')
    into v_actor_name from public.profiles as p where p.id = v_user_id;
  v_assignee := pg_catalog.coalesce(v_lead.assigned_to, v_lead.owner_id, v_user_id);

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
     and pg_catalog.lower(pg_catalog.coalesce(j.payload ->> 'manual', 'false')) <> 'true'
     and not pg_catalog.coalesce(j.payload ? 'provider_message_id', false)
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
      pg_catalog.left(pg_catalog.coalesce(pg_catalog.nullif(pg_catalog.btrim(p_category), ''), 'operator_request'), 120),
      pg_catalog.left(pg_catalog.btrim(p_reason), 1000),
      pg_catalog.jsonb_build_object('source', 'central_atendimento', 'actor_id', v_user_id, 'cancelled_automatic_jobs', v_cancelled_jobs),
      v_now
    ) returning id into v_handoff_id;
  else
    v_reused := true;
    update public.lead_handoffs as h
       set to_user_id = pg_catalog.coalesce(h.to_user_id, v_assignee),
           assigned_to = pg_catalog.coalesce(h.assigned_to, v_assignee),
           context = pg_catalog.coalesce(h.context, '{}'::jsonb)
             || pg_catalog.jsonb_build_object('last_request_at', v_now, 'last_actor_id', v_user_id, 'cancelled_automatic_jobs', v_cancelled_jobs),
           updated_at = v_now
     where h.id = v_handoff_id and h.organization_id = v_organization_id;
  end if;

  insert into public.audit_logs (
    organization_id, actor_id, actor_name, actor_type, action, detail,
    entity_table, entity_id, event_data
  ) values (
    v_organization_id, v_user_id, pg_catalog.coalesce(v_actor_name, 'Usuário'), 'user',
    'lead.handoff.requested', 'Atendimento transferido para uma pessoa.', 'leads', p_lead_id,
    pg_catalog.jsonb_build_object(
      'handoff_id', v_handoff_id,
      'category', pg_catalog.coalesce(pg_catalog.nullif(pg_catalog.btrim(p_category), ''), 'operator_request'),
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
  if pg_catalog.coalesce(v_lead.opt_out, false) then raise exception 'lead_opt_out'; end if;

  select pg_catalog.coalesce(pg_catalog.nullif(pg_catalog.btrim(p.name), ''), 'Usuário')
    into v_actor_name from public.profiles as p where p.id = v_user_id;

  update public.outreach_jobs as j
     set status = 'cancelled', processed_at = v_now, locked_at = null, locked_by = null,
         error = 'cancelled_before_return_to_ana'
   where j.organization_id = v_organization_id
     and j.lead_id = p_lead_id
     and j.status in ('queued', 'retry', 'reconciliation_required')
     and j.processed_at is null and j.locked_at is null and j.locked_by is null
     and pg_catalog.lower(pg_catalog.coalesce(j.payload ->> 'manual', 'false')) <> 'true'
     and not pg_catalog.coalesce(j.payload ? 'provider_message_id', false)
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
    v_organization_id, v_user_id, pg_catalog.coalesce(v_actor_name, 'Usuário'), 'user',
    'lead.handoff.returned_to_ana', 'Atendimento devolvido para a Ana.', 'leads', p_lead_id,
    pg_catalog.jsonb_build_object('source', 'central_atendimento', 'cancelled_automatic_jobs', v_cancelled_jobs)
  );
  return true;
end;
$function$;

revoke all on function public.queue_human_whatsapp_message(uuid, uuid, uuid, text, uuid, text, text, uuid, timestamptz, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.reconcile_whatsapp_receipt(uuid, text[], integer, text, timestamptz) from public, anon, authenticated;
revoke all on function public.record_outreach_provider_acceptance(uuid, uuid, uuid, uuid, text, text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.request_human_handoff(uuid, text, text) from public, anon;
revoke all on function public.return_handoff_to_ana(uuid) from public, anon;
grant execute on function public.queue_human_whatsapp_message(uuid, uuid, uuid, text, uuid, text, text, uuid, timestamptz, boolean, timestamptz) to service_role;
grant execute on function public.reconcile_whatsapp_receipt(uuid, text[], integer, text, timestamptz) to service_role;
grant execute on function public.record_outreach_provider_acceptance(uuid, uuid, uuid, uuid, text, text, timestamptz, timestamptz) to service_role;
grant execute on function public.request_human_handoff(uuid, text, text) to authenticated, service_role;
grant execute on function public.return_handoff_to_ana(uuid) to authenticated, service_role;

commit;
