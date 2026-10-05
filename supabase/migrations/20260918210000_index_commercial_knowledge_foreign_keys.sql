-- Índices de FK das entidades de conhecimento comercial. Eles preservam os
-- índices de leitura por organização já criados e evitam varreduras em
-- cascatas, exclusões e joins futuros.

begin;

create index if not exists knowledge_sources_created_by_idx
  on public.knowledge_sources (created_by);

create index if not exists knowledge_catalog_items_source_id_idx
  on public.knowledge_catalog_items (source_id);
create index if not exists knowledge_catalog_items_created_by_idx
  on public.knowledge_catalog_items (created_by);

create index if not exists knowledge_item_relations_source_item_id_idx
  on public.knowledge_item_relations (source_item_id);
create index if not exists knowledge_item_relations_target_item_id_idx
  on public.knowledge_item_relations (target_item_id);
create index if not exists knowledge_item_relations_created_by_idx
  on public.knowledge_item_relations (created_by);

create index if not exists knowledge_source_imports_organization_id_idx
  on public.knowledge_source_imports (organization_id);
create index if not exists knowledge_source_imports_source_id_idx
  on public.knowledge_source_imports (source_id);
create index if not exists knowledge_source_imports_created_by_idx
  on public.knowledge_source_imports (created_by);

create index if not exists conversation_knowledge_events_lead_id_idx
  on public.conversation_knowledge_events (lead_id);
create index if not exists conversation_knowledge_events_item_id_idx
  on public.conversation_knowledge_events (item_id);
create index if not exists conversation_knowledge_events_actor_id_idx
  on public.conversation_knowledge_events (actor_id);

commit;
