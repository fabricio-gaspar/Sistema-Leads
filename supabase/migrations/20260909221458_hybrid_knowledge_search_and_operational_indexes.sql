create or replace function public.match_knowledge_chunks(
  p_organization_id uuid,
  p_query_embedding extensions.vector(1536),
  p_match_count integer default 8,
  p_min_similarity double precision default 0.20
)
returns table (
  document_id uuid,
  document_name text,
  content text,
  chunk_index integer,
  similarity double precision
)
language sql
stable
security invoker
set search_path = pg_catalog, public, extensions
as $$
  select
    kc.document_id,
    coalesce(d.name, 'Base aprovada da Ana')::text as document_name,
    kc.content,
    kc.chunk_index,
    (1 - (kc.embedding <=> p_query_embedding))::double precision as similarity
  from public.knowledge_chunks kc
  join public.documents d on d.id = kc.document_id
  where kc.organization_id = p_organization_id
    and d.organization_id = p_organization_id
    and kc.status = 'active'
    and d.status = 'active'
    and kc.embedding is not null
    and (1 - (kc.embedding <=> p_query_embedding)) >= greatest(0.0, least(1.0, p_min_similarity))
  order by kc.embedding <=> p_query_embedding
  limit greatest(1, least(20, p_match_count));
$$;

revoke all on function public.match_knowledge_chunks(uuid, extensions.vector, integer, double precision) from public;
grant execute on function public.match_knowledge_chunks(uuid, extensions.vector, integer, double precision) to authenticated;

create index if not exists knowledge_chunks_embedding_hnsw_active_idx
  on public.knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null and status = 'active';

create index if not exists appointments_org_lead_starts_idx
  on public.appointments (organization_id, lead_id, starts_at desc);
create index if not exists lead_handoffs_org_status_due_idx
  on public.lead_handoffs (organization_id, status, due_at);
create index if not exists proposals_org_lead_status_idx
  on public.proposals (organization_id, lead_id, status, created_at desc);
