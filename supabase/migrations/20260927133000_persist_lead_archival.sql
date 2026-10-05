-- Arquivamento comercial reversível: preserva o lead e seu histórico.
alter table public.leads
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

create index if not exists leads_organization_archived_updated_idx
  on public.leads (organization_id, archived_at, updated_at desc);
