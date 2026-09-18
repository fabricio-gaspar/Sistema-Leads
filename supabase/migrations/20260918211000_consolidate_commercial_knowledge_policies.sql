-- Uma única política permissiva de SELECT por tabela. Gestão continua
-- restrita a configuration.manage, sem alargar leitura ou escrita.

begin;

drop policy if exists knowledge_sources_manage on public.knowledge_sources;
create policy knowledge_sources_insert on public.knowledge_sources for insert to authenticated
  with check (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'));
create policy knowledge_sources_update on public.knowledge_sources for update to authenticated
  using (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'))
  with check (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'));
create policy knowledge_sources_delete on public.knowledge_sources for delete to authenticated
  using (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'));

drop policy if exists knowledge_catalog_items_manage on public.knowledge_catalog_items;
create policy knowledge_catalog_items_insert on public.knowledge_catalog_items for insert to authenticated
  with check (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'));
create policy knowledge_catalog_items_update on public.knowledge_catalog_items for update to authenticated
  using (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'))
  with check (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'));
create policy knowledge_catalog_items_delete on public.knowledge_catalog_items for delete to authenticated
  using (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'));

drop policy if exists knowledge_item_relations_manage on public.knowledge_item_relations;
create policy knowledge_item_relations_insert on public.knowledge_item_relations for insert to authenticated
  with check (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'));
create policy knowledge_item_relations_update on public.knowledge_item_relations for update to authenticated
  using (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'))
  with check (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'));
create policy knowledge_item_relations_delete on public.knowledge_item_relations for delete to authenticated
  using (private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'));

commit;
