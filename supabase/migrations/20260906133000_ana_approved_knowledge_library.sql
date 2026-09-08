-- Central de arquivos privados usados pela Base aprovada da Ana.
-- Nenhum arquivo é público e nenhum item passa a ser fonte da Ana sem aprovação.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ana-knowledge',
  'ana-knowledge',
  false,
  104857600,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/markdown', 'text/csv',
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists storage_ana_knowledge_read on storage.objects;
drop policy if exists storage_ana_knowledge_insert on storage.objects;
drop policy if exists storage_ana_knowledge_update on storage.objects;
drop policy if exists storage_ana_knowledge_delete on storage.objects;

create policy storage_ana_knowledge_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ana-knowledge'
    and (storage.foldername(name))[1] = (select current_org_id())::text
  );

create policy storage_ana_knowledge_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ana-knowledge'
    and (storage.foldername(name))[1] = (select current_org_id())::text
  );

create policy storage_ana_knowledge_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'ana-knowledge'
    and (storage.foldername(name))[1] = (select current_org_id())::text
  )
  with check (
    bucket_id = 'ana-knowledge'
    and (storage.foldername(name))[1] = (select current_org_id())::text
  );

create policy storage_ana_knowledge_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ana-knowledge'
    and (storage.foldername(name))[1] = (select current_org_id())::text
  );

create index if not exists documents_ana_memory_status_idx
  on public.documents (organization_id, status, updated_at desc)
  where category = 'knowledge' and (metadata ->> 'ana_memory') = 'true';

create index if not exists knowledge_chunks_ana_memory_document_idx
  on public.knowledge_chunks (organization_id, document_id, status, chunk_index);
