import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import type { CategoriaConhecimento } from '@/mocks/conhecimentoData';

export type AnaKnowledgeKind = 'documento' | 'imagem' | 'apresentacao' | 'planilha' | 'video' | 'link' | 'texto';
export type AnaKnowledgeStatus = 'active' | 'draft' | 'processing';

export interface AnaKnowledgeSource {
  id: string;
  name: string;
  status: AnaKnowledgeStatus;
  type: string | null;
  size: string | null;
  sourceUrl: string | null;
  storagePath: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  category: CategoriaConhecimento;
  kind: AnaKnowledgeKind;
  tags: string[];
  processingNote: string | null;
  content: string;
  chunks: number;
}

type DocumentRow = {
  id: string; name: string; status: string | null; type: string | null; size: string | null;
  source_url: string | null; storage_path: string | null; created_at: string | null; updated_at: string | null;
  content_text: string | null; metadata: Record<string, unknown> | null;
};

const acceptedCategories = new Set<CategoriaConhecimento>([
  'institucional', 'materiais', 'solucoes_e_produtos', 'qualificacao', 'regras_comerciais', 'respostas_aprovadas', 'handoff_humano',
]);

function asText(value: unknown): string { return typeof value === 'string' ? value : ''; }
function asList(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }
function categoryOf(value: unknown): CategoriaConhecimento { return acceptedCategories.has(value as CategoriaConhecimento) ? value as CategoriaConhecimento : 'institucional'; }
function kindOf(value: unknown): AnaKnowledgeKind {
  return ['documento', 'imagem', 'apresentacao', 'planilha', 'video', 'link', 'texto'].includes(asText(value))
    ? asText(value) as AnaKnowledgeKind : 'documento';
}

function mapSource(row: DocumentRow, chunks: number): AnaKnowledgeSource {
  const metadata = row.metadata ?? {};
  return {
    id: row.id, name: row.name, status: (row.status === 'active' || row.status === 'processing' ? row.status : 'draft') as AnaKnowledgeStatus,
    type: row.type, size: row.size, sourceUrl: row.source_url, storagePath: row.storage_path, createdAt: row.created_at, updatedAt: row.updated_at,
    category: categoryOf(metadata.category), kind: kindOf(metadata.kind), tags: asList(metadata.tags),
    processingNote: asText(metadata.processing_note) || null, content: row.content_text ?? '', chunks,
  };
}

async function invoke(action: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('base-ana-ingest', { body: { action, ...body } });
  if (error) {
    const response = (error as { context?: Response }).context;
    if (response) {
      try { throw new Error((await response.clone().json() as { erro?: string }).erro || 'knowledge_operation_failed'); } catch (cause) { if (cause instanceof Error) throw cause; }
    }
    throw error;
  }
  if (!data?.ok) throw new Error(data?.erro || 'knowledge_operation_failed');
  return data as Record<string, unknown>;
}

export async function loadAnaKnowledgeSources(): Promise<AnaKnowledgeSource[]> {
  const session = await resolveOrganizationSession();
  const { data: documents, error } = await supabase.from('documents')
    .select('id,name,status,type,size,source_url,storage_path,created_at,updated_at,content_text,metadata')
    .eq('organization_id', session.organizationId).eq('category', 'knowledge').contains('metadata', { ana_memory: true })
    .order('updated_at', { ascending: false });
  if (error) throw error;
  const ids = (documents ?? []).map((document) => document.id);
  if (!ids.length) return [];
  const { data: chunkRows, error: chunkError } = await supabase.from('knowledge_chunks')
    .select('document_id').eq('organization_id', session.organizationId).in('document_id', ids);
  if (chunkError) throw chunkError;
  const counts = new Map<string, number>();
  (chunkRows ?? []).forEach((chunk) => counts.set(chunk.document_id, (counts.get(chunk.document_id) ?? 0) + 1));
  return (documents ?? []).map((document) => mapSource(document as DocumentRow, counts.get(document.id) ?? 0));
}

export async function uploadAnaKnowledgeFile(input: {
  file: File; category: CategoriaConhecimento; kind: AnaKnowledgeKind; tags: string[]; sourceLabel?: string; processingNote?: string;
}): Promise<void> {
  const session = await resolveOrganizationSession();
  const safeName = input.file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-130);
  const storagePath = `${session.organizationId}/ana/${crypto.randomUUID()}-${safeName || 'arquivo'}`;
  const { error: uploadError } = await supabase.storage.from('ana-knowledge').upload(storagePath, input.file, { contentType: input.file.type || 'application/octet-stream', upsert: false });
  if (uploadError) throw uploadError;
  let content = '';
  if (/^(text\/|application\/json)/.test(input.file.type) || /\.(txt|md|csv)$/i.test(input.file.name)) {
    content = (await input.file.text()).slice(0, 120_000);
  }
  try {
    await invoke('register', {
      name: input.file.name, storage_path: storagePath, mime_type: input.file.type, size: String(input.file.size), category: input.category,
      kind: input.kind, tags: input.tags, source_label: input.sourceLabel, processing_note: input.processingNote, content,
    });
  } catch (error) {
    await supabase.storage.from('ana-knowledge').remove([storagePath]);
    throw error;
  }
}

export async function registerAnaKnowledgeLink(input: {
  name: string; sourceUrl: string; category: CategoriaConhecimento; kind: AnaKnowledgeKind; tags: string[]; sourceLabel?: string; processingNote?: string; content?: string;
}): Promise<void> {
  await invoke('register', { name: input.name, source_url: input.sourceUrl, category: input.category, kind: input.kind, tags: input.tags, source_label: input.sourceLabel, processing_note: input.processingNote, content: input.content ?? '' });
}

export async function saveAnaKnowledgeText(id: string, input: { content: string; category: CategoriaConhecimento; kind: AnaKnowledgeKind; tags: string[]; processingNote?: string }): Promise<void> {
  await invoke('save_text', { document_id: id, ...input });
}

export async function setAnaKnowledgeStatus(id: string, publish: boolean): Promise<void> {
  await invoke(publish ? 'publish' : 'unpublish', { document_id: id });
}

export async function deleteAnaKnowledgeSource(id: string): Promise<void> { await invoke('delete', { document_id: id }); }
