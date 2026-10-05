-- Índices de apoio para as chaves estrangeiras criadas na reconciliação.
begin;

create index if not exists lead_list_members_lead_id_idx
  on public.lead_list_members (lead_id);
create index if not exists lead_lists_created_by_idx
  on public.lead_lists (created_by) where created_by is not null;
create index if not exists organization_module_data_updated_by_idx
  on public.organization_module_data (updated_by) where updated_by is not null;

commit;
