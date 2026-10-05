-- Catálogo comercial estruturado. Os itens são a fonte operacional para a
-- Central e geram um documento/chunk derivado para a memória já aprovada da Ana.
-- Não armazena segredos nem muda o caminho de envio do WhatsApp.

begin;

create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 180),
  source_url text not null check (source_url ~ '^https?://'),
  source_kind text not null check (source_kind in ('website', 'catalog', 'manual', 'upload', 'api')),
  content_scope text not null check (content_scope in ('products', 'services', 'catalogs', 'documents', 'mixed')),
  enabled boolean not null default true,
  sync_status text not null default 'idle' check (sync_status in ('idle', 'syncing', 'healthy', 'error')),
  last_synced_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_url)
);

create table if not exists public.knowledge_catalog_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  item_type text not null check (item_type in ('product', 'service', 'catalog', 'document')),
  external_key text not null check (char_length(btrim(external_key)) between 1 and 500),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  ana_enabled boolean not null default false,
  name text not null check (char_length(btrim(name)) between 1 and 300),
  code text,
  short_description text,
  technical_description text,
  category text,
  material text,
  applications text[] not null default '{}'::text[],
  keywords text[] not null default '{}'::text[],
  image_url text,
  attachment_url text,
  website_url text,
  source_url text not null check (source_url ~ '^https?://'),
  source_label text,
  source_payload jsonb not null default '{}'::jsonb,
  content_fingerprint text,
  document_id uuid unique references public.documents(id) on delete set null,
  imported_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_id, external_key)
);

create table if not exists public.knowledge_item_relations (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_item_id uuid not null references public.knowledge_catalog_items(id) on delete cascade,
  target_item_id uuid not null references public.knowledge_catalog_items(id) on delete cascade,
  relation_type text not null check (relation_type in ('related', 'compatible_with', 'supports', 'catalog_for', 'document_for')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (organization_id, source_item_id, target_item_id, relation_type),
  check (source_item_id <> target_item_id)
);

create table if not exists public.knowledge_source_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  status text not null check (status in ('running', 'completed', 'failed')),
  items_seen integer not null default 0,
  items_upserted integer not null default 0,
  error text,
  created_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.conversation_knowledge_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  message_id uuid not null references public.lead_messages(id) on delete cascade,
  item_id uuid not null references public.knowledge_catalog_items(id) on delete restrict,
  event_type text not null check (event_type in ('queued', 'sent', 'opened', 'suggested')),
  presentation_format text not null check (presentation_format in ('quick', 'commercial', 'technical', 'link', 'document')),
  actor_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (message_id, item_id, event_type)
);

create index if not exists knowledge_sources_organization_idx
  on public.knowledge_sources (organization_id, content_scope, updated_at desc);
create index if not exists knowledge_catalog_items_search_idx
  on public.knowledge_catalog_items (organization_id, item_type, status, ana_enabled, updated_at desc);
create index if not exists knowledge_catalog_items_source_idx
  on public.knowledge_catalog_items (organization_id, source_id, imported_at desc);
create index if not exists knowledge_item_relations_source_idx
  on public.knowledge_item_relations (organization_id, source_item_id);
create index if not exists knowledge_item_relations_target_idx
  on public.knowledge_item_relations (organization_id, target_item_id);
create index if not exists conversation_knowledge_events_lead_idx
  on public.conversation_knowledge_events (organization_id, lead_id, created_at desc);
create index if not exists conversation_knowledge_events_message_idx
  on public.conversation_knowledge_events (message_id);

alter table public.knowledge_sources enable row level security;
alter table public.knowledge_catalog_items enable row level security;
alter table public.knowledge_item_relations enable row level security;
alter table public.knowledge_source_imports enable row level security;
alter table public.conversation_knowledge_events enable row level security;

revoke all on public.knowledge_sources, public.knowledge_catalog_items, public.knowledge_item_relations,
  public.knowledge_source_imports, public.conversation_knowledge_events from public, anon;
grant select, insert, update, delete on public.knowledge_sources, public.knowledge_catalog_items,
  public.knowledge_item_relations to authenticated;
grant select on public.knowledge_source_imports, public.conversation_knowledge_events to authenticated;
grant all on public.knowledge_sources, public.knowledge_catalog_items, public.knowledge_item_relations,
  public.knowledge_source_imports, public.conversation_knowledge_events to service_role;

create policy knowledge_sources_read on public.knowledge_sources for select to authenticated
  using (private.is_active_org_member(organization_id, (select auth.uid())));
create policy knowledge_sources_manage on public.knowledge_sources for all to authenticated
  using (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'))
  with check (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'));

create policy knowledge_catalog_items_read on public.knowledge_catalog_items for select to authenticated
  using (private.is_active_org_member(organization_id, (select auth.uid())));
create policy knowledge_catalog_items_manage on public.knowledge_catalog_items for all to authenticated
  using (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'))
  with check (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'));

create policy knowledge_item_relations_read on public.knowledge_item_relations for select to authenticated
  using (private.is_active_org_member(organization_id, (select auth.uid())));
create policy knowledge_item_relations_manage on public.knowledge_item_relations for all to authenticated
  using (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'))
  with check (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'));

create policy knowledge_source_imports_read on public.knowledge_source_imports for select to authenticated
  using (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'));
create policy conversation_knowledge_events_read on public.conversation_knowledge_events for select to authenticated
  using (private.can_access_lead(organization_id, lead_id, (select auth.uid())));

create or replace function private.validate_knowledge_item_relation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if not exists (
    select 1 from public.knowledge_catalog_items item
     where item.id = new.source_item_id and item.organization_id = new.organization_id
  ) or not exists (
    select 1 from public.knowledge_catalog_items item
     where item.id = new.target_item_id and item.organization_id = new.organization_id
  ) then
    raise exception 'knowledge_relation_organization_mismatch';
  end if;
  return new;
end;
$function$;

revoke all on function private.validate_knowledge_item_relation() from public, anon, authenticated;
drop trigger if exists knowledge_item_relations_validate_organization on public.knowledge_item_relations;
create trigger knowledge_item_relations_validate_organization
before insert or update on public.knowledge_item_relations
for each row execute function private.validate_knowledge_item_relation();

create or replace function private.commercial_knowledge_text(p_item public.knowledge_catalog_items)
returns text
language sql
stable
set search_path = pg_catalog, public, private
as $function$
  select pg_catalog.left(pg_catalog.concat_ws(E'\n\n',
    'Tipo: ' || case p_item.item_type
      when 'product' then 'Produto ou acessório'
      when 'service' then 'Serviço'
      when 'catalog' then 'Catálogo'
      else 'Documento'
    end,
    'Nome: ' || p_item.name,
    case when nullif(pg_catalog.btrim(coalesce(p_item.code, '')), '') is not null then 'Código: ' || p_item.code end,
    case when nullif(pg_catalog.btrim(coalesce(p_item.category, '')), '') is not null then 'Categoria: ' || p_item.category end,
    case when nullif(pg_catalog.btrim(coalesce(p_item.material, '')), '') is not null then 'Material: ' || p_item.material end,
    case when nullif(pg_catalog.btrim(coalesce(p_item.short_description, '')), '') is not null then 'Resumo: ' || p_item.short_description end,
    case when nullif(pg_catalog.btrim(coalesce(p_item.technical_description, '')), '') is not null then 'Detalhes: ' || p_item.technical_description end,
    case when pg_catalog.cardinality(p_item.applications) > 0 then 'Aplicações: ' || pg_catalog.array_to_string(p_item.applications, ', ') end,
    case when pg_catalog.cardinality(p_item.keywords) > 0 then 'Palavras-chave: ' || pg_catalog.array_to_string(p_item.keywords, ', ') end,
    case when nullif(pg_catalog.btrim(coalesce(p_item.attachment_url, '')), '') is not null then 'Arquivo: ' || p_item.attachment_url end,
    'Fonte: ' || p_item.source_url
  ), 12000)
$function$;

create or replace function private.sync_commercial_knowledge_item()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_document_id uuid;
  v_status text;
  v_content text;
  v_metadata jsonb;
begin
  if tg_op = 'DELETE' then
    if old.document_id is not null then
      delete from public.documents where id = old.document_id and organization_id = old.organization_id;
    end if;
    return old;
  end if;

  -- The update used to persist the generated document id must not recursively
  -- rebuild the document a second time.
  if pg_trigger_depth() > 1 then return new; end if;

  v_status := case when new.status = 'active' and new.ana_enabled then 'active' else 'draft' end;
  v_content := private.commercial_knowledge_text(new);
  v_metadata := jsonb_build_object(
    'ana_memory', true,
    'category', case when new.item_type = 'service' then 'solucoes_e_produtos' else 'solucoes_e_produtos' end,
    'kind', case when new.item_type in ('catalog', 'document') then 'documento' else 'texto' end,
    'tags', to_jsonb(new.keywords),
    'commercial_item_id', new.id,
    'commercial_item_type', new.item_type,
    'source_url', new.source_url,
    'source_label', new.source_label,
    'approval_status', case when v_status = 'active' then 'approved' else 'draft' end,
    'content_status', case when v_status = 'active' then 'approved' else 'needs_review' end
  );

  if new.document_id is null then
    insert into public.documents (
      organization_id, name, content_text, type, status, source_type, source_url,
      category, visibility, metadata, uploaded_by, updated_at
    ) values (
      new.organization_id, new.name, v_content, 'text/plain', v_status, 'commercial_catalog', new.source_url,
      'knowledge', 'ai', v_metadata, new.created_by, now()
    ) returning id into v_document_id;
    update public.knowledge_catalog_items
      set document_id = v_document_id, updated_at = now()
      where id = new.id and document_id is null;
  else
    v_document_id := new.document_id;
    update public.documents
      set name = new.name, content_text = v_content, status = v_status, source_type = 'commercial_catalog',
          source_url = new.source_url, metadata = v_metadata, updated_at = now()
      where id = v_document_id and organization_id = new.organization_id;
  end if;

  delete from public.knowledge_chunks
    where organization_id = new.organization_id and document_id = v_document_id;
  insert into public.knowledge_chunks (
    organization_id, document_id, chunk_index, content, tokens, status, metadata
  ) values (
    new.organization_id, v_document_id, 0, v_content,
    greatest(1, ceil(length(v_content)::numeric / 4)::integer), v_status, v_metadata
  );
  return new;
end;
$function$;

revoke all on function private.commercial_knowledge_text(public.knowledge_catalog_items) from public, anon, authenticated;
revoke all on function private.sync_commercial_knowledge_item() from public, anon, authenticated;

drop trigger if exists commercial_knowledge_item_sync_to_ana on public.knowledge_catalog_items;
create trigger commercial_knowledge_item_sync_to_ana
after insert or update or delete on public.knowledge_catalog_items
for each row execute function private.sync_commercial_knowledge_item();

create or replace function public.queue_human_whatsapp_catalog_message(
  p_organization_id uuid,
  p_lead_id uuid,
  p_user_id uuid,
  p_sender_name text,
  p_request_id uuid,
  p_recipient text,
  p_message text,
  p_integration_id uuid,
  p_context_last_contact timestamptz,
  p_item_id uuid,
  p_presentation_format text,
  p_controlled_test boolean default false,
  p_controlled_test_expires_at timestamptz default null
)
returns table(job_id uuid, message_id uuid, job_status text, duplicate boolean)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_queue record;
  v_item public.knowledge_catalog_items%rowtype;
  v_format text := lower(trim(coalesce(p_presentation_format, '')));
  v_payload jsonb;
begin
  if p_item_id is null or v_format not in ('quick', 'commercial', 'technical', 'link', 'document') then
    raise exception 'catalog_content_input_required';
  end if;
  select * into v_item from public.knowledge_catalog_items
    where id = p_item_id and organization_id = p_organization_id and status = 'active';
  if not found then raise exception 'catalog_content_not_available'; end if;

  select * into v_queue from public.queue_human_whatsapp_message(
    p_organization_id, p_lead_id, p_user_id, p_sender_name, p_request_id, p_recipient, p_message,
    p_integration_id, p_context_last_contact, p_controlled_test, p_controlled_test_expires_at
  );

  select payload into v_payload from public.outreach_jobs where id = v_queue.job_id;
  if v_queue.duplicate and (
    v_payload ->> 'catalog_item_id' is distinct from p_item_id::text
    or v_payload ->> 'catalog_presentation_format' is distinct from v_format
  ) then
    raise exception 'idempotency_payload_mismatch';
  end if;

  update public.outreach_jobs
    set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object(
      'catalog_item_id', p_item_id,
      'catalog_presentation_format', v_format
    )
    where id = v_queue.job_id;

  insert into public.conversation_knowledge_events (
    organization_id, lead_id, message_id, item_id, event_type, presentation_format, actor_id, metadata
  ) values (
    p_organization_id, p_lead_id, v_queue.message_id, p_item_id, 'queued', v_format, p_user_id,
    jsonb_build_object('item_name', v_item.name, 'item_type', v_item.item_type, 'source_url', v_item.source_url)
  ) on conflict (message_id, item_id, event_type) do nothing;

  return query select v_queue.job_id, v_queue.message_id, v_queue.job_status, v_queue.duplicate;
end;
$function$;

revoke all on function public.queue_human_whatsapp_catalog_message(uuid, uuid, uuid, text, uuid, text, text, uuid, timestamptz, uuid, text, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.queue_human_whatsapp_catalog_message(uuid, uuid, uuid, text, uuid, text, text, uuid, timestamptz, uuid, text, boolean, timestamptz) to service_role;

commit;
