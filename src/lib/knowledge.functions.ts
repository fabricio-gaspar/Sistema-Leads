import type { Database } from '@/integrations/supabase/types'
import type { Database } from '@/types/database'
import type { Database } from '@/types/database'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

// ============================================================================
// Knowledge chunking for documents.content_text
// ============================================================================

const CHUNK_SIZE = 1200 // characters per chunk (~300 tokens)
const CHUNK_OVERLAP = 150

function splitIntoChunks(text: string): string[] {
  const cleaned = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!cleaned) return []
  const chunks: string[] = []
  let start = 0
  while (start < cleaned.length) {
    let end = Math.min(cleaned.length, start + CHUNK_SIZE)
    if (end < cleaned.length) {
      // try to break at a paragraph / sentence boundary within the last 200 chars
      const window = cleaned.slice(end - 200, end)
      const boundary = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('. '), window.lastIndexOf('\n'))
      if (boundary > 40) end = end - 200 + boundary + 1
    }
    const piece = cleaned.slice(start, end).trim()
    if (piece) chunks.push(piece)
    if (end >= cleaned.length) break
    start = Math.max(end - CHUNK_OVERLAP, start + 1)
  }
  return chunks
}

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc('has_role', {
    _user_id: ctx.userId,
    _role: 'administrador',
  })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Acesso restrito a administradores')
}

async function reindexDocumentWithClient(
  supabase: any,
  document: { id: string; name?: string | null; content_text?: string | null },
): Promise<{ chunks: number }> {
  const text = document.content_text ?? ''
  const chunks = splitIntoChunks(text)

  // Bump version: mark all existing chunks stale, then insert new active ones
  await supabase
    .from('knowledge_chunks')
    .update({ status: 'stale' } as never)
    .eq('document_id', document.id)
    .eq('status', 'active')

  if (!chunks.length) return { chunks: 0 }

  const { data: prev } = await supabase
    .from('knowledge_chunks')
    .select('version')
    .eq('document_id', document.id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextVersion = ((prev?.version as number | undefined) ?? 0) + 1

  const rows = chunks.map((content, index) => ({
    document_id: document.id,
    chunk_index: index,
    content,
    tokens: Math.ceil(content.length / 4),
    version: nextVersion,
    status: 'active',
  }))

  const { error } = await supabase.from('knowledge_chunks').insert(rows as never)
  if (error) throw new Error(error.message)
  return { chunks: rows.length }
}

export async function reindexDocumentInternal(
  ctx: { supabase: any; userId: string },
  documentId: string,
): Promise<{ chunks: number }> {
  const { data: doc, error } = await ctx.supabase
    .from('documents')
    .select('id, name, content_text, status')
    .eq('id', documentId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!doc) throw new Error('Documento não encontrado')
  if (doc.status !== 'active' || !doc.content_text) {
    // Deactivate any active chunks for inactive/emptied docs
    await ctx.supabase
      .from('knowledge_chunks')
      .update({ status: 'stale' } as never)
      .eq('document_id', documentId)
      .eq('status', 'active')
    return { chunks: 0 }
  }
  return reindexDocumentWithClient(ctx.supabase, doc)
}

/**
 * Loads a compact knowledge snippet for the AI, drawing from the freshest
 * active chunks across every active document. Trimmed to `charBudget` total
 * characters to keep the prompt small.
 */
export async function loadKnowledgeSnippetInternal(
  supabase: any,
  charBudget = 8000,
): Promise<Array<{ document: string; content: string }>> {
  const { data: docs } = await supabase
    .from('documents')
    .select('id, name')
    .eq('status', 'active')
    .limit(20)
  if (!docs?.length) return []

  const ids = docs.map((d: { id: string }) => d.id)
  const { data: chunks } = await supabase
    .from('knowledge_chunks')
    .select('document_id, content, chunk_index, version')
    .in('document_id', ids)
    .eq('status', 'active')
    .order('document_id', { ascending: true })
    .order('chunk_index', { ascending: true })
    .limit(200)

  if (!chunks?.length) return []

  const byDoc = new Map<string, string>(docs.map((d: any) => [d.id, d.name || 'documento']))
  const out: Array<{ document: string; content: string }> = []
  let used = 0
  for (const row of chunks as Array<{ document_id: string; content: string }>) {
    if (used >= charBudget) break
    const remaining = charBudget - used
    const slice = row.content.length > remaining ? row.content.slice(0, remaining) : row.content
    out.push({ document: byDoc.get(row.document_id) || 'documento', content: slice })
    used += slice.length
  }
  return out
}

// ============================================================================
// Public server functions
// ============================================================================

export const reindexDocument = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ document_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    return reindexDocumentInternal(context, data.document_id)
  })

export const reindexAllDocuments = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context)
    const { data: docs, error } = await context.supabase
      .from('documents')
      .select('id, name, content_text')
      .eq('status', 'active')
      .not('content_text', 'is', null)
    if (error) throw new Error(error.message)
    let total = 0
    let processed = 0
    for (const doc of docs ?? []) {
      try {
        const res = await reindexDocumentWithClient(context.supabase, doc as any)
        total += res.chunks
        processed += 1
      } catch (err) {
        console.error('[knowledge] reindex failed', (doc as any).id, (err as Error).message)
      }
    }
    return { documents: processed, chunks: total }
  })

export const getKnowledgeStats = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context)
    const [{ count: activeChunks }, { count: staleChunks }, { count: docsWithText }] = await Promise.all([
      context.supabase.from('knowledge_chunks').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      context.supabase.from('knowledge_chunks').select('id', { count: 'exact', head: true }).eq('status', 'stale'),
      context.supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .not('content_text', 'is', null),
    ])
    return {
      activeChunks: activeChunks ?? 0,
      staleChunks: staleChunks ?? 0,
      documentsWithText: docsWithText ?? 0,
    }
  })

// ============================================================================
// Binary extraction (PDF / DOCX) — runs on Cloudflare Worker via unpdf & mammoth
// ============================================================================

function detectKind(name: string, mime: string): 'pdf' | 'docx' | 'text' | 'unsupported' {
  const lower = (name || '').toLowerCase()
  if (mime === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf'
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx')
  )
    return 'docx'
  if (mime.startsWith('text/') || /\.(txt|md|csv|json)$/i.test(lower)) return 'text'
  return 'unsupported'
}

async function extractText(bytes: Uint8Array, kind: 'pdf' | 'docx' | 'text'): Promise<string> {
  if (kind === 'text') {
    return new TextDecoder().decode(bytes).trim()
  }
  if (kind === 'pdf') {
    const { extractText: unpdfExtract, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(bytes)
    const { text } = await unpdfExtract(pdf, { mergePages: true })
    return (Array.isArray(text) ? text.join('\n\n') : String(text)).trim()
  }
  // docx
  const mammoth = await import('mammoth')
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const result = await mammoth.extractRawText({ arrayBuffer: buf })
  return (result.value || '').trim()
}

export const extractAndIndexDocument = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ document_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const { data: doc, error } = await context.supabase
      .from('documents')
      .select('id, name, type, storage_path, content_text')
      .eq('id', data.document_id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!doc) throw new Error('Documento não encontrado')
    if (!doc.storage_path) throw new Error('Documento sem arquivo em storage')

    const kind = detectKind(doc.name || '', doc.type || '')
    if (kind === 'unsupported') throw new Error('Formato não suportado (use PDF, DOCX, TXT, MD, CSV, JSON)')

    const { data: blob, error: dlErr } = await context.supabase.storage
      .from('docs')
      .download(doc.storage_path as string)
    if (dlErr) throw new Error(dlErr.message)

    const bytes = new Uint8Array(await blob.arrayBuffer())
    if (bytes.byteLength > 15_000_000) throw new Error('Arquivo muito grande (>15 MB)')

    const text = await extractText(bytes, kind)
    if (!text) throw new Error('Não foi possível extrair texto do arquivo')

    const { error: upErr } = await context.supabase
      .from('documents')
      .update({ content_text: text } as never)
      .eq('id', doc.id)
    if (upErr) throw new Error(upErr.message)

    const result = await reindexDocumentInternal(context, doc.id)
    return { chars: text.length, chunks: result.chunks, kind }
  })
