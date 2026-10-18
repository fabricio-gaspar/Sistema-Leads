-- File imports can contain tens of thousands of rows. Keep this capability
-- separate from ordinary prospecting batches: only users who can create and
-- read the full organization portfolio may execute it. Reserve every strong
-- identity atomically so a changed phone cannot bypass an existing e-mail.

begin;

create schema if not exists lead_import_private;
revoke all on schema lead_import_private from public, anon, authenticated;
grant usage on schema lead_import_private to authenticated, service_role;

-- SECURITY DEFINER is restricted to this non-exposed schema because the
-- identity fence is intentionally inaccessible to browser roles.
create or replace function lead_import_private.reserve_prospecting_import_identities(
  p_organization_id uuid,
  p_identity_keys text[],
  p_requested_lead_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_actor uuid := auth.uid();
  v_keys text[];
  v_hashes text[];
  v_hash text;
  v_existing_ids uuid[];
  v_canonical_lead_id uuid;
begin
  if p_organization_id is null or p_requested_lead_id is null
     or v_actor is null
     or p_organization_id is distinct from public.current_org_id()
     or not private.has_org_permission(p_organization_id, v_actor, 'leads.create')
     or not private.has_org_permission(p_organization_id, v_actor, 'leads.read_all') then
    raise exception 'prospecting_bulk_import_not_allowed' using errcode = '42501';
  end if;

  if exists (select 1 from public.leads where id = p_requested_lead_id)
     and not exists (
       select 1 from public.leads
       where id = p_requested_lead_id
         and organization_id = p_organization_id
         and private.can_access_lead(p_organization_id, id, v_actor)
     ) then
    raise exception 'prospecting_import_identity_conflict' using errcode = '42501';
  end if;

  select array_agg(distinct lower(btrim(raw_key)) order by lower(btrim(raw_key)))
  into v_keys
  from unnest(coalesce(p_identity_keys, array[]::text[])) as candidate(raw_key)
  where nullif(btrim(raw_key), '') is not null;

  if coalesce(array_length(v_keys, 1), 0) = 0 then
    return p_requested_lead_id;
  end if;

  select array_agg(md5(p_organization_id::text || ':' || identity_key) order by md5(p_organization_id::text || ':' || identity_key))
  into v_hashes
  from unnest(v_keys) as identity(identity_key);

  -- Sorted hashes keep concurrent imports from locking the same keys in a
  -- different order. The deferred FK permits the requested lead to be created
  -- later in the same transaction.
  foreach v_hash in array v_hashes
  loop
    insert into private.prospecting_import_dedupe_keys as key_row (
      organization_id, identity_hash, lead_id
    ) values (
      p_organization_id, v_hash, p_requested_lead_id
    ) on conflict (organization_id, identity_hash) do update
      set last_seen_at = excluded.last_seen_at;
  end loop;

  select array_agg(distinct key_row.lead_id order by key_row.lead_id)
  into v_existing_ids
  from private.prospecting_import_dedupe_keys as key_row
  where key_row.organization_id = p_organization_id
    and key_row.identity_hash = any(v_hashes)
    and key_row.lead_id is distinct from p_requested_lead_id;

  if coalesce(array_length(v_existing_ids, 1), 0) > 1 then
    raise exception 'prospecting_import_identity_ambiguous' using errcode = '23505';
  end if;

  v_canonical_lead_id := coalesce(v_existing_ids[1], p_requested_lead_id);
  if v_canonical_lead_id is distinct from p_requested_lead_id
    and not private.can_access_lead(p_organization_id, v_canonical_lead_id, v_actor) then
    raise exception 'prospecting_import_identity_conflict' using errcode = '42501';
  end if;

  if v_canonical_lead_id is distinct from p_requested_lead_id then
    update private.prospecting_import_dedupe_keys
    set lead_id = v_canonical_lead_id,
        last_seen_at = pg_catalog.now()
    where organization_id = p_organization_id
      and identity_hash = any(v_hashes)
      and lead_id = p_requested_lead_id;
  end if;

  return v_canonical_lead_id;
end;
$function$;

revoke all on function lead_import_private.reserve_prospecting_import_identities(uuid, text[], uuid)
  from public, anon, authenticated;
grant execute on function lead_import_private.reserve_prospecting_import_identities(uuid, text[], uuid)
  to authenticated, service_role;

create table if not exists lead_import_private.prospecting_bulk_import_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null,
  import_group_id uuid not null,
  lead_id uuid not null references public.leads(id) on delete cascade deferrable initially deferred,
  batch_id uuid not null,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (organization_id, created_by, import_group_id, lead_id)
);

alter table lead_import_private.prospecting_bulk_import_members enable row level security;
revoke all on table lead_import_private.prospecting_bulk_import_members from public, anon, authenticated;
grant all on table lead_import_private.prospecting_bulk_import_members to service_role;

-- The bulk RPC remains SECURITY INVOKER for every public-table mutation. This
-- narrow SECURITY DEFINER gate lives in the same non-exposed schema and can
-- write exactly one protected membership row after independently rechecking
-- organization, actor, permissions, batch and import group.
create or replace function lead_import_private.reserve_prospecting_bulk_import_member(
  p_organization_id uuid,
  p_import_group_id uuid,
  p_lead_id uuid,
  p_batch_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_actor uuid := auth.uid();
  v_inserted integer := 0;
begin
  if p_organization_id is null or p_import_group_id is null
     or p_lead_id is null or p_batch_id is null or v_actor is null
     or p_organization_id is distinct from public.current_org_id()
     or not private.has_org_permission(p_organization_id, v_actor, 'leads.create')
     or not private.has_org_permission(p_organization_id, v_actor, 'leads.read_all')
     or not exists (
       select 1
       from public.lead_lists as list
       where list.id = p_batch_id
         and list.organization_id = p_organization_id
         and list.created_by = v_actor
         and list.criteria->>'import_group_id' = p_import_group_id::text
     )
     or exists (
       select 1 from public.leads as lead
       where lead.id = p_lead_id
         and (lead.organization_id <> p_organization_id
           or not private.can_access_lead(p_organization_id, lead.id, v_actor))
     ) then
    raise exception 'prospecting_bulk_import_not_allowed' using errcode = '42501';
  end if;

  insert into lead_import_private.prospecting_bulk_import_members (
    organization_id, created_by, import_group_id, lead_id, batch_id
  ) values (
    p_organization_id, v_actor, p_import_group_id, p_lead_id, p_batch_id
  ) on conflict (organization_id, created_by, import_group_id, lead_id) do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
end;
$function$;

revoke all on function lead_import_private.reserve_prospecting_bulk_import_member(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function lead_import_private.reserve_prospecting_bulk_import_member(uuid, uuid, uuid, uuid)
  to authenticated, service_role;

-- Protect legacy rows that predate the single-key import fence. Raw contact
-- values never enter this table: only organization-scoped MD5 fences do.
with candidate_keys as (
  select lead.organization_id, lead.id, lead.created_at, identity.identity_key
  from public.leads as lead
  cross join lateral unnest(array[
    case when length(public.normalize_phone_identity(lead.whatsapp)) >= 10 then 'tel:' || public.normalize_phone_identity(lead.whatsapp) end,
    case when length(public.normalize_phone_identity(lead.whatsapp)) >= 10 then 'whatsapp:' || public.normalize_phone_identity(lead.whatsapp) end,
    case when length(public.normalize_phone_identity(lead.phone)) >= 10 then 'tel:' || public.normalize_phone_identity(lead.phone) end,
    case when length(public.normalize_phone_identity(lead.phone)) >= 10 then 'phone:' || public.normalize_phone_identity(lead.phone) end,
    case when nullif(btrim(lead.email), '') is not null then 'email:' || lower(btrim(lead.email)) end,
    nullif(lower(btrim(lead.deduplication_key)), ''),
    case when nullif(btrim(lead.company), '') is not null then 'company:' || nullif(btrim(regexp_replace(
      translate(lower(lead.company), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
      '[^a-z0-9]+', ' ', 'g'
    )), '') end
  ]) as identity(identity_key)
  where identity.identity_key is not null
), canonical_keys as (
  select distinct on (organization_id, md5(organization_id::text || ':' || identity_key))
    organization_id,
    md5(organization_id::text || ':' || identity_key) as identity_hash,
    id as lead_id,
    created_at
  from candidate_keys
  order by organization_id,
    md5(organization_id::text || ':' || identity_key),
    created_at asc,
    id asc
)
insert into private.prospecting_import_dedupe_keys (
  organization_id, identity_hash, lead_id, created_at, last_seen_at
)
select organization_id, identity_hash, lead_id, created_at, pg_catalog.now()
from canonical_keys
on conflict (organization_id, identity_hash) do nothing;

create or replace function public.import_prospecting_bulk_batch(
  p_import_group_id uuid,
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
  v_email_identity text;
  v_company_identity text;
  v_identity_keys text[];
  v_group_member_reserved boolean;
  v_duplicate_count integer := 0;
  v_accepted_count integer := 0;
begin
  if v_actor is null or v_org is null
    or not private.has_org_permission(v_org, v_actor, 'leads.create')
    or not private.has_org_permission(v_org, v_actor, 'leads.read_all') then
    raise exception 'prospecting_bulk_import_not_allowed' using errcode = '42501';
  end if;

  if p_import_group_id is null or p_batch_id is null or jsonb_typeof(p_leads) is distinct from 'array'
    or jsonb_typeof(p_list_criteria) is distinct from 'object'
    or nullif(btrim(p_list_name), '') is null
    or length(p_list_name) > 160 then
    raise exception 'prospecting_import_invalid_request' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_leads);
  if v_count < 1 or v_count > 100 then
    raise exception 'prospecting_import_invalid_count' using errcode = '22023';
  end if;

  if octet_length(p_leads::text) > 2097152 then
    raise exception 'prospecting_import_payload_too_large' using errcode = '22023';
  end if;

  v_fingerprint := md5(p_import_group_id::text || ':' || p_leads::text || ':' || btrim(p_list_name) || ':' || p_list_criteria::text);
  insert into public.lead_lists (id, organization_id, name, status, criteria, created_by)
  values (
    p_batch_id, v_org, btrim(p_list_name), 'pending',
    p_list_criteria || jsonb_build_object(
      'total', v_count,
      'import_fingerprint', v_fingerprint,
      'import_group_id', p_import_group_id,
      'bulk_file_import', true
    ),
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
    v_accepted_count := coalesce((v_existing.criteria->>'accepted_total')::integer, -1);
    v_duplicate_count := coalesce((v_existing.criteria->>'duplicate_count')::integer, -1);
    if v_accepted_count < 0 or v_duplicate_count < 0
      or v_accepted_count + v_duplicate_count <> v_count
      or coalesce(array_length(v_existing_ids, 1), 0) <> v_accepted_count then
      raise exception 'prospecting_import_batch_incomplete' using errcode = '23514';
    end if;
    return jsonb_build_object(
      'listId', p_batch_id,
      'leadIds', to_jsonb(coalesce(v_existing_ids, array[]::uuid[])),
      'duplicateCount', v_duplicate_count,
      'alreadyImported', true
    );
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
      or v_lead.owner_id is distinct from v_lead.assigned_to
      or length(v_lead.company) > 200
      or length(coalesce(v_lead.contact, '')) > 200
      or length(coalesce(v_lead.email, '')) > 254
      or length(coalesce(v_lead.phone, '')) > 32
      or length(coalesce(v_lead.whatsapp, '')) > 32
      or length(coalesce(v_lead.segment, '')) > 160
      or length(coalesce(v_lead.city, '')) > 120
      or length(coalesce(v_lead.uf, '')) > 64
      or length(coalesce(v_lead.source_url, '')) > 500
      or (nullif(btrim(v_lead.email), '') is not null and v_lead.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
      raise exception 'prospecting_import_invalid_lead' using errcode = '22023';
    end if;

    v_whatsapp_identity := public.normalize_phone_identity(v_lead.whatsapp);
    v_phone_identity := public.normalize_phone_identity(v_lead.phone);
    v_email_identity := case when nullif(btrim(v_lead.email), '') is not null then lower(btrim(v_lead.email)) end;
    v_company_identity := nullif(btrim(regexp_replace(
      translate(lower(v_lead.company), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
      '[^a-z0-9]+', ' ', 'g'
    )), '');

    -- A file import never authorizes outreach. Ignore all client-provided
    -- operational state and keep the record outside Kanban/Ana until a human
    -- explicitly reviews it through the canonical workflow. Identity values
    -- above are calculated first so a supplied WhatsApp can still participate
    -- in deduplication even though it is not activated on the imported lead.
    v_lead.stage := 'Prospecção';
    v_lead.ana_stage := 'novo';
    v_lead.ana_outcome := null;
    v_lead.modo_atendimento := 'ia';
    v_lead.owner := 'Ana (IA)';
    v_lead.owner_id := null;
    v_lead.assigned_to := null;
    v_lead.whatsapp := null;
    v_lead.ai_paused := true;
    v_lead.automation_status := 'pending_approval';
    v_lead.contact_approval_status := 'pending';
    v_lead.contact_approval_reason := 'Importação de arquivo exige revisão humana antes de qualquer contato.';
    v_lead.contact_approved_at := null;
    v_lead.active_channel := null;
    v_lead.score_verified_at := null;

    v_identity_keys := array_remove(array[
      case when length(v_whatsapp_identity) >= 10 then 'tel:' || v_whatsapp_identity end,
      case when length(v_whatsapp_identity) >= 10 then 'whatsapp:' || v_whatsapp_identity end,
      case when length(v_phone_identity) >= 10 then 'tel:' || v_phone_identity end,
      case when length(v_phone_identity) >= 10 then 'phone:' || v_phone_identity end,
      case when v_email_identity is not null then 'email:' || v_email_identity end
    ], null);
    if coalesce(array_length(v_identity_keys, 1), 0) = 0 and v_company_identity is not null then
      v_identity_keys := array['company:' || v_company_identity];
    end if;
    v_lead.deduplication_key := v_identity_keys[1];

    v_canonical_lead_id := lead_import_private.reserve_prospecting_import_identities(
      v_org,
      v_identity_keys,
      v_lead.id
    );

    v_group_member_reserved := lead_import_private.reserve_prospecting_bulk_import_member(
      v_org,
      p_import_group_id,
      v_canonical_lead_id,
      p_batch_id
    );

    if not v_group_member_reserved then
      v_duplicate_count := v_duplicate_count + 1;
      continue;
    end if;

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

  v_accepted_count := coalesce(array_length(v_ids, 1), 0);
  if (select count(*) from public.lead_list_members where organization_id = v_org and list_id = p_batch_id) <> v_accepted_count
    or v_accepted_count + v_duplicate_count <> v_count then
    raise exception 'prospecting_import_batch_incomplete' using errcode = '23514';
  end if;

  update public.lead_lists
  set status = case when v_accepted_count = 0 then 'archived' else 'pending' end,
      criteria = criteria || jsonb_build_object(
        'accepted_total', v_accepted_count,
        'duplicate_count', v_duplicate_count
      )
  where id = p_batch_id and organization_id = v_org and created_by = v_actor;

  return jsonb_build_object(
    'listId', p_batch_id,
    'leadIds', to_jsonb(v_ids),
    'duplicateCount', v_duplicate_count,
    'alreadyImported', false
  );
end;
$function$;

revoke all on function public.import_prospecting_bulk_batch(uuid, uuid, jsonb, text, jsonb)
  from public, anon;
grant execute on function public.import_prospecting_bulk_batch(uuid, uuid, jsonb, text, jsonb)
  to authenticated;

commit;
