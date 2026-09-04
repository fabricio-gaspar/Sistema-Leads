import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import type { CategoriaConhecimento, EntradaConhecimento } from '@/mocks/conhecimentoData';

type DocumentRow = {
  id: string;
  name: string;
  content_text: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

type ChunkRow = {
  document_id: string;
  content: string;
  status: string | null;
  metadata: Record<string, unknown> | null;
};

const validCategories = new Set<CategoriaConhecimento>([
  'institucional', 'materiais', 'solucoes_e_produtos', 'qualificacao',
  'regras_comerciais', 'respostas_aprovadas', 'handoff_humano',
]);

const legacyCategoryAliases: Record<string, CategoriaConhecimento> = {
  faq: 'respostas_aprovadas',
  objecoes: 'regras_comerciais',
  cases: 'solucoes_e_produtos',
  politicas: 'regras_comerciais',
  produtos: 'solucoes_e_produtos',
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asKeywords(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function toDate(value: string | null): string {
  return value ? value.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function categoryOf(value: unknown): CategoriaConhecimento {
  if (validCategories.has(value as CategoriaConhecimento)) return value as CategoriaConhecimento;
  return legacyCategoryAliases[asText(value)] ?? 'institucional';
}

function metadataFor(entry: EntradaConhecimento): Record<string, unknown> {
  return {
    ana_memory: true,
    category: entry.categoria,
    question: entry.pergunta || null,
    keywords: entry.palavrasChave,
    author: entry.autor,
    uses: entry.usos,
  };
}

function mapEntry(document: DocumentRow, chunk?: ChunkRow): EntradaConhecimento {
  const metadata = { ...(document.metadata ?? {}), ...(chunk?.metadata ?? {}) };
  const status = chunk?.status ?? document.status;
  return {
    id: document.id,
    categoria: categoryOf(metadata.category),
    titulo: document.name,
    pergunta: asText(metadata.question) || undefined,
    conteudo: chunk?.content || document.content_text || '',
    palavrasChave: asKeywords(metadata.keywords),
    status: status === 'active' || status === 'ativo' ? 'ativo' : 'rascunho',
    autor: asText(metadata.author) || 'Equipe Wayflex',
    data: toDate(document.updated_at || document.created_at),
    usos: Number(metadata.uses) || 0,
    fonte: 'Base aprovada da Ana',
  };
}

export async function loadKnowledgeEntries(): Promise<EntradaConhecimento[]> {
  const session = await resolveOrganizationSession();
  const { data: documents, error: documentsError } = await supabase
    .from('documents')
    .select('id,name,content_text,status,metadata,created_at,updated_at')
    .eq('organization_id', session.organizationId)
    .eq('category', 'knowledge')
    .contains('metadata', { ana_memory: true })
    .order('updated_at', { ascending: false });
  if (documentsError) throw documentsError;

  const ids = (documents ?? []).map((document) => document.id);
  if (!ids.length) return [];
  const { data: chunks, error: chunksError } = await supabase
    .from('knowledge_chunks')
    .select('document_id,content,status,metadata')
    .eq('organization_id', session.organizationId)
    .in('document_id', ids)
    .eq('chunk_index', 0);
  if (chunksError) throw chunksError;
  const chunkByDocument = new Map((chunks ?? []).map((chunk) => [chunk.document_id, chunk as ChunkRow]));
  return (documents ?? []).map((document) => mapEntry(document as DocumentRow, chunkByDocument.get(document.id)));
}

export async function createKnowledgeEntry(entry: EntradaConhecimento): Promise<EntradaConhecimento> {
  const session = await resolveOrganizationSession();
  const metadata = metadataFor(entry);
  const status = entry.status === 'ativo' ? 'active' : 'draft';
  const { data: document, error: documentError } = await supabase
    .from('documents')
    .insert({
      organization_id: session.organizationId,
      name: entry.titulo,
      content_text: entry.conteudo,
      type: 'text/plain',
      status,
      source_type: 'manual',
      category: 'knowledge',
      visibility: 'team',
      uploaded_by: session.userId,
      metadata,
    })
    .select('id,name,content_text,status,metadata,created_at,updated_at')
    .single();
  if (documentError || !document) throw documentError ?? new Error('knowledge_document_not_created');

  const { data: chunk, error: chunkError } = await supabase
    .from('knowledge_chunks')
    .insert({
      organization_id: session.organizationId,
      document_id: document.id,
      chunk_index: 0,
      content: entry.conteudo,
      tokens: Math.ceil(entry.conteudo.length / 4),
      status,
      metadata,
    })
    .select('document_id,content,status,metadata')
    .single();
  if (chunkError || !chunk) {
    await supabase.from('documents').delete().eq('id', document.id).eq('organization_id', session.organizationId);
    throw chunkError ?? new Error('knowledge_chunk_not_created');
  }
  return mapEntry(document as DocumentRow, chunk as ChunkRow);
}

export async function updateKnowledgeEntry(id: string, changes: Partial<EntradaConhecimento>): Promise<EntradaConhecimento> {
  const session = await resolveOrganizationSession();
  const { data: current, error: currentError } = await supabase
    .from('documents')
    .select('id,name,content_text,status,metadata,created_at,updated_at')
    .eq('id', id).eq('organization_id', session.organizationId).maybeSingle();
  if (currentError || !current) throw currentError ?? new Error('knowledge_entry_not_found');
  const currentEntry = mapEntry(current as DocumentRow);
  const next = { ...currentEntry, ...changes, id } as EntradaConhecimento;
  const metadata = metadataFor(next);
  const status = next.status === 'ativo' ? 'active' : 'draft';
  const { data: document, error: documentError } = await supabase
    .from('documents')
    .update({ name: next.titulo, content_text: next.conteudo, status, metadata, updated_at: new Date().toISOString() })
    .eq('id', id).eq('organization_id', session.organizationId)
    .select('id,name,content_text,status,metadata,created_at,updated_at')
    .single();
  if (documentError || !document) throw documentError ?? new Error('knowledge_document_not_updated');

  const { data: chunk, error: chunkError } = await supabase
    .from('knowledge_chunks')
    .update({ content: next.conteudo, tokens: Math.ceil(next.conteudo.length / 4), status, metadata })
    .eq('document_id', id).eq('organization_id', session.organizationId).eq('chunk_index', 0)
    .select('document_id,content,status,metadata')
    .single();
  if (chunkError || !chunk) throw chunkError ?? new Error('knowledge_chunk_not_updated');
  return mapEntry(document as DocumentRow, chunk as ChunkRow);
}

export async function deleteKnowledgeEntry(id: string): Promise<void> {
  const session = await resolveOrganizationSession();
  const { error } = await supabase.from('documents').delete().eq('id', id).eq('organization_id', session.organizationId);
  if (error) throw error;
}
