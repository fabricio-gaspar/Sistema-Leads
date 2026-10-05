-- Agenda comercial operacional: leitura paginada no servidor, visões pessoais
-- persistidas e trilha de auditoria. Não cria uma agenda paralela nem chama
-- provedores externos.

alter table public.user_saved_views
  drop constraint if exists user_saved_views_module_key_check;

alter table public.user_saved_views
  add constraint user_saved_views_module_key_check
  check (module_key in ('kanban', 'agenda'));

create index if not exists appointments_agenda_portfolio_idx
  on public.appointments (organization_id, starts_at, status, updated_at desc);

create index if not exists appointments_agenda_responsible_idx
  on public.appointments (organization_id, (metadata ->> 'responsible_user_id'), starts_at);

create or replace function private.audit_appointment_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_action text;
  v_detail text;
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_row public.appointments%rowtype;
begin
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;
  v_action := case tg_op
    when 'INSERT' then 'appointment.created'
    when 'DELETE' then 'appointment.deleted'
    when 'UPDATE' then 'appointment.updated'
    else 'appointment.changed'
  end;
  v_detail := case tg_op
    when 'INSERT' then 'Compromisso criado na Agenda.'
    when 'DELETE' then 'Compromisso removido da Agenda.'
    else 'Compromisso atualizado na Agenda.'
  end;
  select coalesce(nullif(p.name, ''), 'Usuário')
    into v_actor_name
    from public.profiles p
   where p.id = v_actor_id;

  insert into public.audit_logs (
    organization_id, actor_id, actor_name, actor_type, action, detail,
    entity_table, entity_id, event_data
  ) values (
    v_row.organization_id,
    v_actor_id,
    coalesce(v_actor_name, case when v_actor_id is null then 'Sistema' else 'Usuário' end),
    case when v_actor_id is null then 'system' else 'user' end,
    v_action,
    v_detail,
    'appointments',
    v_row.id,
    jsonb_build_object(
      'lead_id', v_row.lead_id,
      'status', v_row.status,
      'starts_at', v_row.starts_at,
      'ends_at', v_row.ends_at,
      'source', coalesce(v_row.metadata ->> 'origin', 'manual'),
      'operation', tg_op
    )
  );
  return coalesce(new, old);
end;
$$;

revoke all on function private.audit_appointment_change() from public, anon, authenticated;

create or replace function private.set_appointment_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_appointment_updated_at() from public, anon, authenticated;

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
before update on public.appointments
for each row execute procedure private.set_appointment_updated_at();

drop trigger if exists appointments_audit_change on public.appointments;
create trigger appointments_audit_change
after insert or update or delete on public.appointments
for each row execute procedure private.audit_appointment_change();

create or replace function public.get_agenda_portfolio(
  p_filters jsonb default '{}'::jsonb,
  p_offset integer default 0,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  with parameters as (
    select
      lower(translate(btrim(coalesce(p_filters ->> 'query', '')),
        'áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) as query_folded,
      regexp_replace(coalesce(p_filters ->> 'query', ''), '[^0-9]', '', 'g') as query_phone,
      nullif(p_filters ->> 'responsible_id', '') as responsible_id,
      nullif(p_filters ->> 'type', '') as appointment_type,
      nullif(p_filters ->> 'status', '') as appointment_status,
      nullif(p_filters ->> 'origin', '') as appointment_origin,
      nullif(p_filters ->> 'segment', '') as lead_segment,
      nullif(p_filters ->> 'confirmation', '') as confirmation_status,
      nullif(p_filters ->> 'next_action', '') as next_action_filter,
      nullif(p_filters ->> 'quick', '') as quick_filter,
      coalesce(nullif(p_filters ->> 'range_start', '')::timestamptz, now() - interval '7 days') as range_start,
      coalesce(nullif(p_filters ->> 'range_end', '')::timestamptz, now() + interval '31 days') as range_end,
      greatest(0, coalesce(p_offset, 0)) as page_offset,
      least(200, greatest(1, coalesce(p_limit, 100))) as page_limit
  ),
  prepared as (
    select
      appointment.id, appointment.organization_id, appointment.lead_id, appointment.user_id,
      appointment.title, appointment.starts_at, appointment.ends_at, appointment.status,
      appointment.meeting_url, appointment.notes, appointment.provider, appointment.external_id,
      appointment.metadata, appointment.created_at, appointment.updated_at,
      lead.contact as lead_contact, lead.company as lead_company, lead.phone as lead_phone,
      lead.whatsapp as lead_whatsapp, lead.email as lead_email, lead.segment as lead_segment,
      lead.stage::text as lead_stage,
      coalesce(appointment.metadata ->> 'responsible_user_id', appointment.user_id::text) as responsible_id,
      coalesce(appointment.metadata ->> 'responsible_name', appointment.metadata ->> 'responsavel', 'Sem responsável') as responsible_name,
      coalesce(appointment.metadata ->> 'type', appointment.metadata ->> 'tipo', 'reuniao') as appointment_type,
      coalesce(appointment.metadata ->> 'origin', 'manual') as appointment_origin,
      coalesce(appointment.metadata ->> 'confirmation_status', case when appointment.status = 'confirmed' then 'confirmed' else 'pending' end) as confirmation_status,
      nullif(appointment.metadata ->> 'next_action_at', '') as next_action_at,
      coalesce(appointment.metadata ->> 'timezone', 'America/Sao_Paulo') as timezone
    from public.appointments appointment
    join public.leads lead
      on lead.id = appointment.lead_id
     and lead.organization_id = appointment.organization_id
    where appointment.organization_id = public.current_org_id()
  ),
  filtered as (
    select prepared.*,
      (prepared.ends_at < now() and prepared.status in ('scheduled', 'confirmed', 'pending')) as is_overdue
    from prepared cross join parameters p
    where prepared.starts_at < p.range_end
      and prepared.ends_at > p.range_start
      and (p.responsible_id is null or prepared.responsible_id = p.responsible_id)
      and (p.appointment_type is null or prepared.appointment_type = p.appointment_type)
      and (p.appointment_status is null or prepared.status = p.appointment_status)
      and (p.appointment_origin is null or prepared.appointment_origin = p.appointment_origin)
      and (p.lead_segment is null or prepared.lead_segment = p.lead_segment)
      and (p.confirmation_status is null or prepared.confirmation_status = p.confirmation_status)
      and (p.next_action_filter is null
        or (p.next_action_filter = 'with' and prepared.next_action_at is not null)
        or (p.next_action_filter = 'without' and prepared.next_action_at is null))
      and (p.quick_filter is null
        or (p.quick_filter = 'mine' and prepared.responsible_id = auth.uid()::text)
        or (p.quick_filter = 'ana' and prepared.appointment_origin = 'ana')
        or (p.quick_filter = 'overdue' and prepared.ends_at < now() and prepared.status in ('scheduled', 'confirmed', 'pending')))
      and (
        p.query_folded = ''
        or p.query_phone <> '' and position(p.query_phone in regexp_replace(
          coalesce(prepared.lead_phone, '') || coalesce(prepared.lead_whatsapp, '') || coalesce(prepared.metadata ->> 'contact_phone', ''),
          '[^0-9]', '', 'g'
        )) > 0
        or position(p.query_folded in lower(translate(concat_ws(' ',
          prepared.title, prepared.notes, prepared.lead_contact, prepared.lead_company,
          prepared.lead_email, prepared.responsible_name, prepared.metadata ->> 'participants',
          prepared.metadata ->> 'protocol', prepared.metadata ->> 'description'
        ), 'áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ',
          'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))) > 0
      )
  ),
  paged as (
    select * from filtered
    order by starts_at asc, id asc
    offset (select page_offset from parameters)
    limit (select page_limit from parameters)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'organization_id', organization_id, 'lead_id', lead_id, 'user_id', user_id,
      'title', title, 'starts_at', starts_at, 'ends_at', ends_at, 'status', status,
      'meeting_url', meeting_url, 'notes', notes, 'provider', provider, 'external_id', external_id,
      'metadata', metadata, 'created_at', created_at, 'updated_at', updated_at,
      'lead_contact', lead_contact, 'lead_company', lead_company, 'lead_phone', lead_phone,
      'lead_email', lead_email, 'lead_segment', lead_segment, 'lead_stage', lead_stage,
      'responsible_id', responsible_id, 'responsible_name', responsible_name,
      'appointment_type', appointment_type, 'appointment_origin', appointment_origin,
      'confirmation_status', confirmation_status, 'next_action_at', next_action_at,
      'timezone', timezone, 'is_overdue', is_overdue
    ) order by starts_at asc, id asc) from paged), '[]'::jsonb)
  );
$$;

revoke all on function public.get_agenda_portfolio(jsonb, integer, integer) from public, anon;
grant execute on function public.get_agenda_portfolio(jsonb, integer, integer) to authenticated;
