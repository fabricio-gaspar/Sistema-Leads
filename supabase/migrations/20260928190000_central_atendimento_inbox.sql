-- Inbox operacional da Central de Atendimento.
-- A conversa continua vinculada ao lead e às filas já existentes; esta migration
-- apenas acrescenta leitura paginada, estado de leitura por operador e contratos
-- de consulta seguros para a interface.

begin;

create table if not exists public.conversation_read_states (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  last_read_at timestamptz not null default pg_catalog.now(),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  primary key (organization_id, user_id, lead_id)
);

create index if not exists conversation_read_states_user_lead_idx
  on public.conversation_read_states (organization_id, user_id, lead_id, last_read_at desc);

alter table public.conversation_read_states enable row level security;

revoke all on public.conversation_read_states from public, anon;
grant select, insert, update on public.conversation_read_states to authenticated;
grant all on public.conversation_read_states to service_role;

drop policy if exists conversation_read_states_own_access on public.conversation_read_states;
create policy conversation_read_states_own_access
  on public.conversation_read_states
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and private.is_active_org_member(organization_id, (select auth.uid()))
    and private.can_access_lead(organization_id, lead_id, (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    and private.is_active_org_member(organization_id, (select auth.uid()))
    and private.can_access_lead(organization_id, lead_id, (select auth.uid()))
  );

create or replace function public.central_normalize_search(p_value text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select pg_catalog.regexp_replace(
    pg_catalog.translate(
      pg_catalog.lower(coalesce(p_value, '')),
      'àáâãäåèéêëìíîïòóôõöùúûüçñýÿ',
      'aaaaaaeeeeiiiiooooouuuucnyy'
    ),
    '[^a-z0-9]+',
    '',
    'g'
  )
$function$;

create or replace function public.central_list_conversations(
  p_query text default null,
  p_filters jsonb default '{}'::jsonb,
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_organization_id uuid := public.current_org_id();
  v_user_id uuid := auth.uid();
  v_query text := public.central_normalize_search(p_query);
  v_view text := coalesce(nullif(pg_catalog.btrim(p_filters ->> 'view'), ''), 'all');
  v_situation text := coalesce(nullif(pg_catalog.btrim(p_filters ->> 'situation'), ''), 'all');
  v_channel text := coalesce(nullif(pg_catalog.btrim(p_filters ->> 'channel'), ''), 'all');
  v_mode text := coalesce(nullif(pg_catalog.btrim(p_filters ->> 'mode'), ''), 'all');
  v_stage text := nullif(pg_catalog.btrim(p_filters ->> 'stage'), '');
  v_owner_id uuid;
  v_from date;
  v_to date;
  v_sla_overdue boolean := pg_catalog.lower(coalesce(p_filters ->> 'sla_overdue', 'false')) in ('true', '1');
  v_limit integer := pg_catalog.least(pg_catalog.greatest(coalesce(p_limit, 25), 1), 50);
  v_offset integer := pg_catalog.least(pg_catalog.greatest(coalesce(p_offset, 0), 0), 10000);
begin
  if v_organization_id is null or v_user_id is null then
    raise exception 'organization_context_required';
  end if;

  if (p_filters ->> 'owner_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_owner_id := (p_filters ->> 'owner_id')::uuid;
  end if;
  if (p_filters ->> 'from') ~ '^\d{4}-\d{2}-\d{2}$' then v_from := (p_filters ->> 'from')::date; end if;
  if (p_filters ->> 'to') ~ '^\d{4}-\d{2}-\d{2}$' then v_to := (p_filters ->> 'to')::date; end if;

  if v_view not in ('all', 'unread', 'waiting', 'mine') then v_view := 'all'; end if;
  if v_situation not in ('all', 'waiting', 'ana', 'human', 'transfer', 'failed', 'closed', 'blocked') then v_situation := 'all'; end if;
  if v_channel not in ('all', 'whatsapp', 'email', 'instagram') then v_channel := 'all'; end if;
  if v_mode not in ('all', 'ana', 'human') then v_mode := 'all'; end if;

  return (
    with candidates as (
      select
        l.id as lead_id,
        l.contact,
        l.company,
        l.phone,
        l.email,
        l.whatsapp,
        l.active_channel,
        l.modo_atendimento,
        l.ai_paused,
        l.automation_status,
        l.opt_out,
        l.stage::text as stage,
        coalesce(stage_record.name, l.stage::text) as stage_label,
        l.pipeline_stage_id,
        l.owner_id,
        l.assigned_to,
        coalesce(assignee.name, owner_profile.name, l.owner, 'Ana') as owner_name,
        latest.id as latest_message_id,
        latest.sender as latest_sender,
        latest.sender_name as latest_sender_name,
        latest.type as latest_type,
        latest.text as latest_text,
        latest.delivery_status as latest_delivery_status,
        latest.provider_status_at as latest_provider_status_at,
        coalesce(latest.sent_at, latest.created_at) as latest_at,
        coalesce(outreach.status, latest.delivery_status, latest.type) as delivery_status,
        open_handoff.status as handoff_status,
        open_handoff.assigned_to as handoff_assigned_to,
        coalesce(open_handoff.due_at, open_handoff.sla_expires_at) as sla_due_at,
        read_state.last_read_at,
        whatsapp_conversation.status as whatsapp_conversation_status
      from public.leads as l
      left join public.pipeline_stages as stage_record
        on stage_record.id = l.pipeline_stage_id and stage_record.organization_id = l.organization_id
      left join public.profiles as owner_profile on owner_profile.id = l.owner_id
      left join public.profiles as assignee on assignee.id = l.assigned_to
      left join lateral (
        select m.id, m.sender, m.sender_name, m.type, m.text, m.delivery_status, m.provider_status_at, m.sent_at, m.created_at
          from public.lead_messages as m
         where m.organization_id = l.organization_id and m.lead_id = l.id
         order by coalesce(m.sent_at, m.created_at) desc, m.id desc
         limit 1
      ) as latest on true
      left join lateral (
        select o.status
          from public.lead_outreach as o
         where o.organization_id = l.organization_id
           and o.lead_id = l.id
           and o.metadata ->> 'message_id' = latest.id::text
         order by o.updated_at desc, o.id desc
         limit 1
      ) as outreach on true
      left join lateral (
        select h.status, h.assigned_to, h.due_at, h.sla_expires_at
          from public.lead_handoffs as h
         where h.organization_id = l.organization_id
           and h.lead_id = l.id
           and h.status in ('pending', 'accepted')
         order by h.requested_at desc, h.created_at desc
         limit 1
      ) as open_handoff on true
      left join public.conversation_read_states as read_state
        on read_state.organization_id = l.organization_id
       and read_state.lead_id = l.id
       and read_state.user_id = v_user_id
      left join lateral (
        select c.status
          from public.whatsapp_conversations as c
         where c.organization_id = l.organization_id and c.lead_id = l.id
         order by c.last_message_at desc nulls last, c.updated_at desc
         limit 1
      ) as whatsapp_conversation on true
      where l.organization_id = v_organization_id
        and l.archived_at is null
        and (
          v_query = ''
          or public.central_normalize_search(pg_catalog.concat_ws(' ', l.contact, l.company, l.phone, l.whatsapp, l.email, l.id::text)) like '%' || v_query || '%'
          or exists (
            select 1 from public.lead_messages as searched_message
             where searched_message.organization_id = l.organization_id
               and searched_message.lead_id = l.id
               and public.central_normalize_search(searched_message.text) like '%' || v_query || '%'
          )
        )
        and (v_channel = 'all' or pg_catalog.lower(coalesce(l.active_channel, 'whatsapp')) = v_channel)
        and (v_owner_id is null or coalesce(open_handoff.assigned_to, l.assigned_to, l.owner_id) = v_owner_id)
        and (v_stage is null or l.stage::text = v_stage or l.pipeline_stage_id::text = v_stage)
    ), enriched as (
      select
        candidates.*,
        (
          select pg_catalog.count(*)::integer
            from public.lead_messages as unread_message
           where unread_message.organization_id = v_organization_id
             and unread_message.lead_id = candidates.lead_id
             and pg_catalog.lower(unread_message.sender) in ('lead', 'contact', 'cliente')
             and coalesce(unread_message.sent_at, unread_message.created_at) > coalesce(candidates.last_read_at, '-infinity'::timestamptz)
        ) as unread_count,
        case
          when candidates.whatsapp_conversation_status = 'closed' then 'closed'
          when candidates.opt_out then 'blocked'
          when candidates.latest_type = 'failed' or candidates.delivery_status = 'failed' then 'failed'
          when candidates.handoff_status = 'pending' then 'transfer'
          when pg_catalog.lower(coalesce(candidates.modo_atendimento, 'ia')) = 'humano'
            or coalesce(candidates.ai_paused, false) then 'human'
          when pg_catalog.lower(coalesce(candidates.latest_sender, '')) in ('lead', 'contact', 'cliente') then 'waiting'
          else 'ana'
        end as situation,
        coalesce(candidates.latest_at, candidates.latest_provider_status_at) as last_message_at
      from candidates
    ), filtered as (
      select *
        from enriched
       where (v_view <> 'unread' or unread_count > 0)
         and (v_view <> 'waiting' or situation = 'waiting')
         and (v_view <> 'mine' or coalesce(handoff_assigned_to, assigned_to, owner_id) = v_user_id)
         and (v_situation = 'all' or situation = v_situation)
         and (v_mode = 'all' or (v_mode = 'human' and situation in ('human', 'transfer')) or (v_mode = 'ana' and situation = 'ana'))
         and (not v_sla_overdue or (sla_due_at is not null and sla_due_at < pg_catalog.now() and situation in ('human', 'transfer')))
         and (v_from is null or last_message_at >= v_from::timestamptz)
         and (v_to is null or last_message_at < (v_to + 1)::timestamptz)
    ), paged as (
      select * from filtered
       order by last_message_at desc nulls last, lead_id desc
       offset v_offset limit v_limit
    )
    select pg_catalog.jsonb_build_object(
      'items', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'lead_id', lead_id,
          'protocol', '#CRM-' || pg_catalog.upper(pg_catalog.left(lead_id::text, 8)),
          'contact', coalesce(nullif(pg_catalog.btrim(contact), ''), 'Contato não informado'),
          'company', coalesce(nullif(pg_catalog.btrim(company), ''), 'Empresa não informada'),
          'channel', case when pg_catalog.lower(coalesce(active_channel, 'whatsapp')) in ('email', 'instagram') then pg_catalog.lower(active_channel) else 'whatsapp' end,
          'stage', stage,
          'stage_label', stage_label,
          'owner_id', coalesce(handoff_assigned_to, assigned_to, owner_id),
          'owner_name', owner_name,
          'situation', situation,
          'preview', pg_catalog.left(coalesce(latest_text, 'Sem mensagens ainda.'), 240),
          'latest_at', last_message_at,
          'unread_count', unread_count,
          'sla_due_at', sla_due_at,
          'delivery_status', delivery_status,
          'has_failure', situation = 'failed'
        ) order by last_message_at desc nulls last, lead_id desc)
        from paged
      ), '[]'::jsonb),
      'total', (select pg_catalog.count(*) from filtered),
      'has_more', (v_offset + v_limit) < (select pg_catalog.count(*) from filtered)
    )
  );
end;
$function$;

create or replace function public.central_get_conversation_detail(
  p_lead_id uuid,
  p_before timestamptz default null,
  p_limit integer default 40
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_organization_id uuid := public.current_org_id();
  v_limit integer := pg_catalog.least(pg_catalog.greatest(coalesce(p_limit, 40), 1), 50);
begin
  if v_organization_id is null or p_lead_id is null then
    raise exception 'organization_context_required';
  end if;

  return (
    with scoped_lead as (
      select
        l.id, l.organization_id, l.contact, l.company, l.phone, l.email, l.whatsapp, l.city, l.uf, l.origin,
        l.active_channel, l.stage::text as stage, coalesce(stage_record.name, l.stage::text) as stage_label,
        l.owner_id, l.assigned_to, coalesce(assignee.name, owner_profile.name, l.owner) as owner_name,
        l.modo_atendimento, l.ai_paused, l.automation_status, l.opt_out, l.sla_info
      from public.leads as l
      left join public.pipeline_stages as stage_record
        on stage_record.id = l.pipeline_stage_id and stage_record.organization_id = l.organization_id
      left join public.profiles as owner_profile on owner_profile.id = l.owner_id
      left join public.profiles as assignee on assignee.id = l.assigned_to
      where l.id = p_lead_id and l.organization_id = v_organization_id and l.archived_at is null
    ), messages_source as (
      select
        m.id, m.sender, m.sender_name, m.type, m.text, m.sent_at, m.created_at, m.provider_message_id,
        m.delivery_status, m.provider_status_at,
        coalesce(m.sent_at, m.created_at) as message_at
      from public.lead_messages as m
      join scoped_lead as l on l.id = m.lead_id and l.organization_id = m.organization_id
      where p_before is null or coalesce(m.sent_at, m.created_at) < p_before
      order by coalesce(m.sent_at, m.created_at) desc, m.id desc
    ), message_window as (
      select * from messages_source limit v_limit
    ), open_handoff as (
      select h.*, coalesce(profile.name, 'Atendente') as assigned_name
        from public.lead_handoffs as h
        join scoped_lead as l on l.id = h.lead_id and l.organization_id = h.organization_id
        left join public.profiles as profile on profile.id = h.assigned_to
       where h.status in ('pending', 'accepted')
       order by h.requested_at desc, h.created_at desc
       limit 1
    )
    select case when not exists (select 1 from scoped_lead) then null else pg_catalog.jsonb_build_object(
      'conversation', (
        select pg_catalog.jsonb_build_object(
          'lead_id', l.id,
          'protocol', '#CRM-' || pg_catalog.upper(pg_catalog.left(l.id::text, 8)),
          'contact', coalesce(nullif(pg_catalog.btrim(l.contact), ''), 'Contato não informado'),
          'company', coalesce(nullif(pg_catalog.btrim(l.company), ''), 'Empresa não informada'),
          'phone', l.phone,
          'whatsapp', l.whatsapp,
          'email', l.email,
          'city', l.city,
          'uf', l.uf,
          'origin', l.origin,
          'channel', case when pg_catalog.lower(coalesce(l.active_channel, 'whatsapp')) in ('email', 'instagram') then pg_catalog.lower(l.active_channel) else 'whatsapp' end,
          'stage', l.stage,
          'stage_label', l.stage_label,
          'owner_id', coalesce(h.assigned_to, l.assigned_to, l.owner_id),
          'owner_name', coalesce(h.assigned_name, l.owner_name, 'Ana'),
          'mode', case when h.status = 'pending' then 'waiting_human' when pg_catalog.lower(coalesce(l.modo_atendimento, 'ia')) = 'humano' or coalesce(l.ai_paused, false) then 'human' else 'ana' end,
          'handoff_id', h.id,
          'handoff_status', h.status,
          'sla_due_at', coalesce(h.due_at, h.sla_expires_at),
          'sla_label', nullif(pg_catalog.btrim(l.sla_info), ''),
          'blocked', coalesce(l.opt_out, false)
        )
          from scoped_lead as l
          left join open_handoff as h on true
      ),
      'messages', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', m.id,
          'sender', m.sender,
          'sender_name', m.sender_name,
          'type', m.type,
          'text', m.text,
          'sent_at', m.sent_at,
          'created_at', m.created_at,
          'message_at', m.message_at,
          'provider_message_id', m.provider_message_id,
          'delivery_status', coalesce(outreach.status, m.delivery_status, m.type),
          'provider_status_at', coalesce(outreach.read_at, outreach.delivered_at, outreach.sent_at, outreach.failed_at, m.provider_status_at),
          'delivery_error', outreach.error,
          'attempt', coalesce(outreach.attempt, 0),
          'attachments', coalesce((
            select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
              'id', attachment.id, 'media_type', attachment.media_type, 'mime_type', attachment.mime_type,
              'file_name', attachment.file_name, 'external_url', attachment.external_url
            ) order by attachment.created_at asc)
              from public.message_attachments as attachment
             where attachment.organization_id = v_organization_id and attachment.message_id = m.id
          ), '[]'::jsonb),
          'knowledge_events', coalesce((
            select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
              'event_type', event.event_type,
              'presentation_format', event.presentation_format,
              'created_at', event.created_at,
              'item_name', item.name,
              'item_type', item.item_type,
              'source_url', item.source_url,
              'source_label', item.source_label,
              'source_updated_at', item.updated_at
            ) order by event.created_at asc)
              from public.conversation_knowledge_events as event
              join public.knowledge_catalog_items as item
                on item.id = event.item_id and item.organization_id = event.organization_id
             where event.organization_id = v_organization_id and event.message_id = m.id
          ), '[]'::jsonb)
        ) order by m.message_at asc, m.id asc)
          from message_window as m
          left join lateral (
            select o.status, o.error, o.attempt, o.sent_at, o.delivered_at, o.read_at, o.failed_at
              from public.lead_outreach as o
             where o.organization_id = v_organization_id
               and o.metadata ->> 'message_id' = m.id::text
             order by o.updated_at desc, o.id desc
             limit 1
          ) as outreach on true
      ), '[]'::jsonb),
      'has_more_messages', (select pg_catalog.count(*) > v_limit from messages_source),
      'qualification', (
        select pg_catalog.jsonb_build_object(
          'summary', qualification.summary,
          'technical_context', qualification.technical_context,
          'missing_fields', qualification.missing_fields,
          'updated_at', qualification.updated_at,
          'updated_by', qualification.updated_by,
          'source_message_id', qualification.source_message_id,
          'source_agent_run_id', qualification.source_agent_run_id,
          'evidence', qualification.evidence
        )
          from public.lead_qualifications as qualification
          join scoped_lead as l on l.id = qualification.lead_id and l.organization_id = qualification.organization_id
         limit 1
      ),
      'tasks', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', task.id, 'text', task.text, 'due_at', task.due_at, 'owner_id', task.owner_id,
          'owner_label', task.owner_label, 'completed', task.completed, 'created_at', task.created_at
        ) order by task.completed asc, task.due_at asc nulls last, task.created_at desc)
          from (
            select task.* from public.lead_tasks as task
            join scoped_lead as l on l.id = task.lead_id and l.organization_id = task.organization_id
            order by task.completed asc, task.due_at asc nulls last, task.created_at desc
            limit 12
          ) as task
      ), '[]'::jsonb),
      'notes', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', note.id, 'body', note.body, 'visibility', note.visibility, 'created_at', note.created_at,
          'author_name', coalesce(profile.name, 'Equipe')
        ) order by note.created_at desc)
          from (
            select note.* from public.lead_notes as note
            join scoped_lead as l on l.id = note.lead_id and l.organization_id = note.organization_id
            order by note.created_at desc
            limit 12
          ) as note
          left join public.profiles as profile on profile.id = note.author_id
      ), '[]'::jsonb),
      'activities', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', audit.id, 'action', audit.action, 'detail', audit.detail, 'actor_name', audit.actor_name, 'created_at', audit.created_at
        ) order by audit.created_at desc)
          from (
            select audit.* from public.audit_logs as audit
            join scoped_lead as l on l.id = audit.entity_id and l.organization_id = audit.organization_id
            where audit.entity_table = 'leads'
            order by audit.created_at desc
            limit 12
          ) as audit
      ), '[]'::jsonb)
    ) end
  );
end;
$function$;

create or replace function public.central_mark_conversation_read(p_lead_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_organization_id uuid := public.current_org_id();
  v_user_id uuid := auth.uid();
begin
  if v_organization_id is null or v_user_id is null
     or not private.can_access_lead(v_organization_id, p_lead_id, v_user_id) then
    raise exception 'lead_not_found_or_access_denied';
  end if;
  insert into public.conversation_read_states (organization_id, user_id, lead_id, last_read_at, updated_at)
  values (v_organization_id, v_user_id, p_lead_id, pg_catalog.now(), pg_catalog.now())
  on conflict (organization_id, user_id, lead_id) do update
    set last_read_at = excluded.last_read_at,
        updated_at = excluded.updated_at;
end;
$function$;

create or replace function public.central_mark_conversation_unread(p_lead_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_organization_id uuid := public.current_org_id();
  v_user_id uuid := auth.uid();
  v_last_inbound_at timestamptz;
begin
  if v_organization_id is null or v_user_id is null
     or not private.can_access_lead(v_organization_id, p_lead_id, v_user_id) then
    raise exception 'lead_not_found_or_access_denied';
  end if;
  select coalesce(m.sent_at, m.created_at)
    into v_last_inbound_at
    from public.lead_messages as m
   where m.organization_id = v_organization_id
     and m.lead_id = p_lead_id
     and pg_catalog.lower(m.sender) in ('lead', 'contact', 'cliente')
   order by coalesce(m.sent_at, m.created_at) desc, m.id desc
   limit 1;
  if v_last_inbound_at is null then return false; end if;
  insert into public.conversation_read_states (organization_id, user_id, lead_id, last_read_at, updated_at)
  values (v_organization_id, v_user_id, p_lead_id, v_last_inbound_at - interval '1 microsecond', pg_catalog.now())
  on conflict (organization_id, user_id, lead_id) do update
    set last_read_at = excluded.last_read_at,
        updated_at = excluded.updated_at;
  return true;
end;
$function$;

revoke all on function public.central_list_conversations(text, jsonb, integer, integer) from public, anon;
revoke all on function public.central_get_conversation_detail(uuid, timestamptz, integer) from public, anon;
revoke all on function public.central_mark_conversation_read(uuid) from public, anon;
revoke all on function public.central_mark_conversation_unread(uuid) from public, anon;
grant execute on function public.central_list_conversations(text, jsonb, integer, integer) to authenticated, service_role;
grant execute on function public.central_get_conversation_detail(uuid, timestamptz, integer) to authenticated, service_role;
grant execute on function public.central_mark_conversation_read(uuid) to authenticated, service_role;
grant execute on function public.central_mark_conversation_unread(uuid) to authenticated, service_role;

commit;
