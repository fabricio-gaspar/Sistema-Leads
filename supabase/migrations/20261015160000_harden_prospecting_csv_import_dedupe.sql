-- CSV imports may be submitted from two browsers before either local store has
-- refreshed.  Keep the import atomic and choose one canonical lead per
-- organization/identity without trusting browser-side de-duplication.

begin;

create table if not exists private.prospecting_import_dedupe_keys (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  identity_hash text not null check (identity_hash ~ '^[0-9a-f]{32}$'),
  -- The import reserves the canonical identity before it inserts a new lead.
  -- Deferring this FK keeps that atomic order valid until the transaction ends.
  lead_id uuid not null references public.leads(id) on delete cascade deferrable initially deferred,
  created_at timestamptz not null default pg_catalog.now(),
  last_seen_at timestamptz not null default pg_catalog.now(),
  primary key (organization_id, identity_hash)
);

alter table private.prospecting_import_dedupe_keys enable row level security;
revoke all on table private.prospecting_import_dedupe_keys from public, anon, authenticated;
grant all on table private.prospecting_import_dedupe_keys to service_role;

-- The raw e-mail/phone/company identity never leaves the lead payload and is
-- never persisted here.  The hash is only a short-lived uniqueness fence.
create or replace function private.reserve_prospecting_import_identity(
  p_organization_id uuid,
  p_identity_key text,
  p_requested_lead_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_actor uuid := auth.uid();
  v_hash text;
  v_lead_id uuid;
begin
  if p_organization_id is null or p_requested_lead_id is null
     or v_actor is null
     or p_organization_id is distinct from public.current_org_id()
     or not private.has_org_permission(p_organization_id, v_actor, 'leads.create') then
    raise exception 'prospecting_import_not_allowed' using errcode = '42501';
  end if;

  if nullif(btrim(p_identity_key), '') is null then
    return p_requested_lead_id;
  end if;

  v_hash := md5(p_organization_id::text || ':' || lower(btrim(p_identity_key)));
  insert into private.prospecting_import_dedupe_keys as key_row (
    organization_id, identity_hash, lead_id
  ) values (
    p_organization_id, v_hash, p_requested_lead_id
  ) on conflict (organization_id, identity_hash) do update
    set last_seen_at = excluded.last_seen_at
  returning key_row.lead_id into v_lead_id;

  -- A collision may belong to another seller's portfolio.  Never attach that
  -- record to this batch or return its id unless the caller can already see
  -- it through the canonical lead access policy.
  if v_lead_id is distinct from p_requested_lead_id
    and not private.can_access_lead(p_organization_id, v_lead_id, v_actor) then
    raise exception 'prospecting_import_identity_conflict' using errcode = '42501';
  end if;

  return v_lead_id;
end;
$function$;

revoke all on function private.reserve_prospecting_import_identity(uuid, text, uuid)
  from public, anon;
grant execute on function private.reserve_prospecting_import_identity(uuid, text, uuid)
  to authenticated, service_role;

-- Backfill only stable keys already persisted by the CRM.  When old records
-- collide, choose the oldest canonical record deterministically; no existing
-- lead data is merged or removed by this migration.
insert into private.prospecting_import_dedupe_keys (
  organization_id, identity_hash, lead_id, created_at, last_seen_at
)
select distinct on (lead.organization_id, md5(lead.organization_id::text || ':' || lower(btrim(lead.deduplication_key))))
  lead.organization_id,
  md5(lead.organization_id::text || ':' || lower(btrim(lead.deduplication_key))),
  lead.id,
  lead.created_at,
  pg_catalog.now()
from public.leads as lead
where nullif(btrim(lead.deduplication_key), '') is not null
order by lead.organization_id,
  md5(lead.organization_id::text || ':' || lower(btrim(lead.deduplication_key))),
  lead.created_at asc,
  lead.id asc
on conflict (organization_id, identity_hash) do nothing;

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
as $function$
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
  v_canonical_lead_id uuid;
  v_whatsapp_identity text;
  v_phone_identity text;
  v_identity_key text;
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
          'city','uf','size','source_record_id','source_url','deduplication_key',
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

    -- Do not trust a browser-provided identity when a strong contact field is
    -- present. This keeps concurrent CSV imports from bypassing the fence by
    -- changing the client-side key, while records with no strong identifier
    -- retain their explicit legacy key (when any).
    v_whatsapp_identity := public.normalize_phone_identity(v_lead.whatsapp);
    v_phone_identity := public.normalize_phone_identity(v_lead.phone);
    v_identity_key := case
      when coalesce(length(v_whatsapp_identity), 0) >= 10 then 'whatsapp:' || v_whatsapp_identity
      when coalesce(length(v_phone_identity), 0) >= 10 then 'phone:' || v_phone_identity
      when nullif(btrim(v_lead.email), '') is not null then 'email:' || lower(btrim(v_lead.email))
      else nullif(btrim(v_lead.deduplication_key), '')
    end;
    v_lead.deduplication_key := v_identity_key;

    v_canonical_lead_id := private.reserve_prospecting_import_identity(
      v_org,
      v_identity_key,
      v_lead.id
    );

    if v_canonical_lead_id = v_lead.id then
      insert into public.leads (
        id, organization_id, company, contact, email, phone, whatsapp, segment,
        score, temp, stage, ana_stage, ana_outcome, modo_atendimento, origin,
        owner, owner_id, assigned_to, opt_out, ai_paused, automation_status,
        contact_approval_status, contact_approval_reason, contact_approved_at,
        contact_approved_by, active_channel, city, uf, size, source_record_id,
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
        v_lead.active_channel, v_lead.city, v_lead.uf, v_lead.size, v_lead.source_record_id,
        v_lead.source_url, v_lead.deduplication_key, v_lead.prospect_identity,
        v_lead.score_snapshot, v_lead.score_explanation, v_lead.score_source,
        v_lead.score_verified_at, coalesce(v_lead.source_metadata, '{}'::jsonb)
      );
    end if;

    insert into public.lead_list_members (organization_id, list_id, lead_id)
    values (v_org, p_batch_id, v_canonical_lead_id)
    on conflict (list_id, lead_id) do nothing;
    v_ids := array_append(v_ids, v_canonical_lead_id);
  end loop;

  -- A CSV containing duplicate rows is ambiguous to the caller.  Roll back
  -- instead of falsely claiming all rows became distinct list members.
  if (select count(*) from public.lead_list_members where organization_id = v_org and list_id = p_batch_id) <> v_count then
    raise exception 'prospecting_import_duplicate_rows' using errcode = '23505';
  end if;

  return jsonb_build_object('listId', p_batch_id, 'leadIds', to_jsonb(v_ids), 'alreadyImported', false);
end;
$function$;

revoke all on function public.import_prospecting_batch(uuid, jsonb, text, jsonb) from public, anon;
grant execute on function public.import_prospecting_batch(uuid, jsonb, text, jsonb) to authenticated;

commit;
