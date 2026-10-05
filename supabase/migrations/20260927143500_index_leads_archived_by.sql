-- Covers the archive actor foreign key without enlarging the active-funnel index.
create index if not exists leads_archived_by_fk_idx
  on public.leads (archived_by)
  where archived_by is not null;
