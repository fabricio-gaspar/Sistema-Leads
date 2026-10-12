begin;

-- Contacts discovered by the seller's device are safe by default.  A provider
-- name/photo is not proof that the number is saved in the phone agenda, so
-- every synchronized row starts as unclassified and remains outside Ana until
-- an operator makes an explicit decision.
alter table public.whatsapp_contact_directory
  add column if not exists classification_state text not null default 'unclassified',
  add column if not exists evidence_state text not null default 'unverified',
  add column if not exists decision_revision bigint not null default 0,
  add column if not exists decision_by uuid references auth.users(id) on delete set null,
  add column if not exists decision_at timestamptz,
  add column if not exists decision_reason text,
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

alter table public.whatsapp_contact_directory
  drop constraint if exists whatsapp_contact_directory_classification_state_check,
  add constraint whatsapp_contact_directory_classification_state_check
    check (classification_state in ('agenda_protected', 'unclassified', 'lead_authorized')),
  drop constraint if exists whatsapp_contact_directory_evidence_state_check,
  add constraint whatsapp_contact_directory_evidence_state_check
    check (evidence_state in ('provider_verified', 'operator_confirmed', 'unverified'));

create index if not exists whatsapp_contact_directory_policy_idx
  on public.whatsapp_contact_directory (organization_id, whatsapp_account_id, classification_state, phone);

create or replace function private.resolve_wa_akg_contact_policy(
  p_organization_id uuid,
  p_account_id uuid,
  p_phone text
)
returns table(state text, evidence_state text, lead_id uuid, reason text)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_phone text := public.normalize_phone_identity(p_phone);
  v_directory public.whatsapp_contact_directory%rowtype;
  v_lead_id uuid;
begin
  if p_organization_id is null or p_account_id is null or v_phone is null then
    return query select 'unknown'::text, 'unverified'::text, null::uuid, 'identity_unresolved'::text;
    return;
  end if;

  select d.* into v_directory
    from public.whatsapp_contact_directory d
   where d.organization_id = p_organization_id
     and d.whatsapp_account_id = p_account_id
     and public.normalize_phone_identity(d.phone) = v_phone
   order by d.last_synced_at desc, d.updated_at desc
   limit 1;

  if not found then
    return query select 'unknown'::text, 'unverified'::text, null::uuid, 'directory_row_not_found'::text;
    return;
  end if;

  v_lead_id := v_directory.lead_id;
  if v_lead_id is null then
    select l.id into v_lead_id
      from public.leads l
     where l.organization_id = p_organization_id
       and l.whatsapp_account_id = p_account_id
       and (l.whatsapp_identity = v_phone or l.phone_identity = v_phone)
     order by l.updated_at desc nulls last, l.created_at desc nulls last
     limit 1;
  end if;

  return query select
    v_directory.classification_state,
    v_directory.evidence_state,
    v_lead_id,
    case v_directory.classification_state
      when 'agenda_protected' then 'contact_protection_required'
      when 'unclassified' then 'explicit_operator_decision_required'
      when 'lead_authorized' then 'lead_authorized_by_operator'
      else 'unknown'
    end;
end;
$function$;

revoke all on function private.resolve_wa_akg_contact_policy(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.resolve_wa_akg_contact_policy(uuid, uuid, text) to service_role;

create or replace function private.enforce_wa_akg_contact_protection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_state text;
begin
  if new.whatsapp_account_id is null then
    return new;
  end if;

  select policy.state into v_state
    from private.resolve_wa_akg_contact_policy(
      new.organization_id,
      new.whatsapp_account_id,
      coalesce(new.whatsapp_identity, new.phone_identity, new.whatsapp, new.phone)
    ) policy;

  if v_state in ('agenda_protected', 'unclassified') then
    new.modo_atendimento := 'humano';
    new.ai_paused := true;
    new.automation_status := 'human';
    new.contact_approval_status := 'pending';
    new.contact_approval_reason := 'Contato protegido da agenda; aguarda autorização explícita.';
    new.contact_approved_at := null;
    new.contact_approved_by := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists leads_wa_akg_contact_protection on public.leads;
create trigger leads_wa_akg_contact_protection
before insert or update on public.leads
for each row execute function private.enforce_wa_akg_contact_protection();

-- Backfill only the safe state. Existing messages and lead history remain intact.
update public.leads l
   set modo_atendimento = 'humano',
       ai_paused = true,
       automation_status = 'human',
       contact_approval_status = 'pending',
       contact_approval_reason = 'Contato protegido da agenda; aguarda autorização explícita.',
       contact_approved_at = null,
       contact_approved_by = null,
       updated_at = pg_catalog.now()
 where exists (
   select 1
     from public.whatsapp_contact_directory d
    where d.organization_id = l.organization_id
      and d.whatsapp_account_id = l.whatsapp_account_id
      and public.normalize_phone_identity(d.phone) = coalesce(l.whatsapp_identity, l.phone_identity)
      and d.classification_state in ('agenda_protected', 'unclassified')
 );

create or replace function private.enforce_wa_akg_outreach_protection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_policy record;
  v_lead public.leads%rowtype;
begin
  if coalesce(new.channel, '') <> 'whatsapp' or coalesce(new.payload ->> 'manual', 'false') = 'true' then
    return new;
  end if;

  select l.* into v_lead
    from public.leads l
   where l.id = new.lead_id
     and l.organization_id = new.organization_id;
  if not found or v_lead.whatsapp_account_id is null then
    return new;
  end if;

  select * into v_policy
    from private.resolve_wa_akg_contact_policy(
      new.organization_id,
      v_lead.whatsapp_account_id,
      coalesce(v_lead.whatsapp_identity, v_lead.phone_identity, v_lead.whatsapp, v_lead.phone)
    ) limit 1;
  if v_policy.state in ('agenda_protected', 'unclassified') then
    new.status := 'cancelled';
    new.processed_at := coalesce(new.processed_at, pg_catalog.now());
    new.error := 'contact_protection_required';
  end if;
  return new;
end;
$function$;

drop trigger if exists outreach_jobs_wa_akg_contact_protection on public.outreach_jobs;
create trigger outreach_jobs_wa_akg_contact_protection
before insert or update on public.outreach_jobs
for each row execute function private.enforce_wa_akg_outreach_protection();

create or replace function public.decide_wa_akg_contact(
  p_account_id uuid,
  p_phone text,
  p_decision text,
  p_lead_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_organization_id uuid := public.current_org_id();
  v_user_id uuid := auth.uid();
  v_phone text := public.normalize_phone_identity(p_phone);
  v_directory public.whatsapp_contact_directory%rowtype;
  v_lead_id uuid;
  v_name text;
  v_actor_name text;
  v_reason text;
begin
  if v_organization_id is null or v_user_id is null or v_phone is null then
    raise exception 'wa_akg_contact_decision_context_required';
  end if;
  if p_decision not in ('keep', 'promote') then
    raise exception 'wa_akg_contact_decision_invalid';
  end if;
  if not private.can_read_wa_akg_contact_directory(v_organization_id, p_account_id, v_user_id) then
    raise exception 'wa_akg_contact_decision_access_denied';
  end if;

  select d.* into strict v_directory
    from public.whatsapp_contact_directory d
   where d.organization_id = v_organization_id
     and d.whatsapp_account_id = p_account_id
     and public.normalize_phone_identity(d.phone) = v_phone
   order by d.last_synced_at desc, d.updated_at desc
   limit 1
   for update;

  v_name := coalesce(nullif(btrim(v_directory.agenda_name), ''), nullif(btrim(v_directory.whatsapp_name), ''), nullif(btrim(v_directory.public_name), ''), 'Contato WhatsApp');
  v_lead_id := v_directory.lead_id;
  if v_lead_id is null then
    select l.id into v_lead_id
      from public.leads l
     where l.organization_id = v_organization_id
       and l.whatsapp_account_id = p_account_id
       and (l.whatsapp_identity = v_phone or l.phone_identity = v_phone)
     order by l.updated_at desc nulls last, l.created_at desc nulls last
     limit 1;
  end if;

  if p_decision = 'promote' then
    if p_lead_id is not null then
      if not exists (
        select 1 from public.leads l
         where l.id = p_lead_id
           and l.organization_id = v_organization_id
           and l.whatsapp_account_id = p_account_id
           and (l.whatsapp_identity = v_phone or l.phone_identity = v_phone)
      ) then
        raise exception 'wa_akg_contact_lead_invalid';
      end if;
      v_lead_id := p_lead_id;
    end if;

    if v_lead_id is null then
      insert into public.leads (
        organization_id, company, contact, phone, whatsapp, owner, owner_id, assigned_to,
        active_channel, modo_atendimento, ai_paused, automation_status,
        contact_approval_status, contact_approval_reason, contact_approved_at,
        contact_approved_by, source_metadata, whatsapp_account_id
      ) values (
        v_organization_id, v_name, v_name, v_phone, v_phone, 'humano', v_user_id, v_user_id,
        'whatsapp', 'humano', true, 'human', 'approved',
        'Lead criado por autorização explícita.', pg_catalog.now(), v_user_id,
        pg_catalog.jsonb_build_object('source', 'wa_akg_contact_decision', 'decision', 'promote'), p_account_id
      ) returning id into v_lead_id;
    else
      update public.leads
         set owner_id = coalesce(owner_id, v_user_id),
             assigned_to = coalesce(assigned_to, v_user_id),
             active_channel = 'whatsapp',
             modo_atendimento = 'humano',
             ai_paused = true,
             automation_status = 'human',
             contact_approval_status = 'approved',
             contact_approval_reason = 'Lead autorizado manualmente a partir da agenda.',
             contact_approved_at = coalesce(contact_approved_at, pg_catalog.now()),
             contact_approved_by = v_user_id,
             whatsapp_account_id = p_account_id,
             updated_at = pg_catalog.now()
       where id = v_lead_id and organization_id = v_organization_id;
    end if;
    v_reason := 'Tornar lead';
  else
    v_reason := 'Manter como contato';
    if v_lead_id is not null then
      update public.leads
         set modo_atendimento = 'humano',
             ai_paused = true,
             automation_status = 'human',
             contact_approval_status = 'pending',
             contact_approval_reason = 'Contato protegido da agenda; aguarda autorização explícita.',
             contact_approved_at = null,
             contact_approved_by = null,
             updated_at = pg_catalog.now()
       where id = v_lead_id and organization_id = v_organization_id;
    end if;
  end if;

  update public.whatsapp_contact_directory
     set classification_state = case when p_decision = 'promote' then 'lead_authorized' else 'agenda_protected' end,
         evidence_state = 'operator_confirmed',
         decision_revision = decision_revision + 1,
         decision_by = v_user_id,
         decision_at = pg_catalog.now(),
         decision_reason = v_reason,
         lead_id = v_lead_id,
         updated_at = pg_catalog.now()
   where id = v_directory.id;

  -- The directory state is now authoritative, so an explicit promotion can
  -- safely set the lead back to an approved, human-owned starting mode.
  if p_decision = 'promote' and v_lead_id is not null then
    update public.leads
       set modo_atendimento = 'humano',
           ai_paused = true,
           automation_status = 'human',
           contact_approval_status = 'approved',
           contact_approval_reason = 'Lead autorizado manualmente a partir da agenda.',
           contact_approved_at = coalesce(contact_approved_at, pg_catalog.now()),
           contact_approved_by = v_user_id,
           updated_at = pg_catalog.now()
     where id = v_lead_id and organization_id = v_organization_id;
  end if;

  select coalesce(nullif(btrim(p.name), ''), 'Usuário') into v_actor_name
    from public.profiles p where p.id = v_user_id;
  insert into public.audit_logs (
    organization_id, actor_id, actor_name, actor_type, action, detail,
    entity_table, entity_id, event_data
  ) values (
    v_organization_id, v_user_id, coalesce(v_actor_name, 'Usuário'), 'user',
    'wa_akg_contact_decision', v_reason, 'whatsapp_contact_directory', v_directory.id,
    pg_catalog.jsonb_build_object(
      'account_id', p_account_id,
      'phone', v_phone,
      'decision', p_decision,
      'classification_state', case when p_decision = 'promote' then 'lead_authorized' else 'agenda_protected' end,
      'lead_id', v_lead_id
    )
  );

  return pg_catalog.jsonb_build_object(
    'state', case when p_decision = 'promote' then 'lead_authorized' else 'agenda_protected' end,
    'evidence_state', 'operator_confirmed',
    'lead_id', v_lead_id,
    'decision_revision', v_directory.decision_revision + 1
  );
end;
$function$;

revoke all on function public.decide_wa_akg_contact(uuid, text, text, uuid) from public, anon;
grant execute on function public.decide_wa_akg_contact(uuid, text, text, uuid) to authenticated, service_role;

create or replace function public.central_list_wa_akg_contact_directory(
  p_account_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_organization_id uuid := public.current_org_id();
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 250);
begin
  if v_organization_id is null or v_user_id is null
    or not private.can_read_wa_akg_contact_directory(v_organization_id, p_account_id, v_user_id) then
    raise exception 'wa_akg_contact_directory_access_denied';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'phone', d.phone,
      'name', coalesce(nullif(btrim(d.agenda_name), ''), nullif(btrim(d.whatsapp_name), ''), nullif(btrim(d.public_name), ''), 'Contato sem nome'),
      'last_synced_at', d.last_synced_at,
      'state', d.classification_state,
      'evidence_state', d.evidence_state,
      'lead_id', d.lead_id,
      'decision_revision', d.decision_revision
    ) order by coalesce(nullif(btrim(d.agenda_name), ''), nullif(btrim(d.whatsapp_name), ''), nullif(btrim(d.public_name), ''), d.phone) asc)
      from (
        select phone, agenda_name, whatsapp_name, public_name, last_synced_at,
               classification_state, evidence_state, lead_id, decision_revision
          from public.whatsapp_contact_directory
         where organization_id = v_organization_id
           and whatsapp_account_id = p_account_id
         order by last_synced_at desc, phone asc
         limit v_limit
      ) d
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.central_list_wa_akg_contact_directory(uuid, integer) from public, anon;
grant execute on function public.central_list_wa_akg_contact_directory(uuid, integer) to authenticated, service_role;

commit;
