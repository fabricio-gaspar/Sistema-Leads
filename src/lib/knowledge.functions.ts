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

/** Compatibilidade para telas administrativas que precisam de uma amostra. */
export async function loadKnowledgeSnippetInternal(
  supabase: any,
  charBudget = 8000,
  organizationId?: string | null,
): Promise<Array<{ document: string; content: string }>> {
  return retrieveKnowledgeInternal(supabase, '', charBudget, organizationId, true)
}

const RAG_STOP_WORDS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'como', 'da', 'das', 'de', 'do', 'dos', 'e', 'ela', 'ele',
  'em', 'essa', 'esse', 'esta', 'este', 'eu', 'isso', 'mais', 'me', 'meu', 'minha', 'na', 'nas',
  'no', 'nos', 'o', 'os', 'ou', 'para', 'por', 'qual', 'que', 'se', 'sem', 'ser', 'seu', 'sua',
  'tem', 'ter', 'um', 'uma', 'voce', 'voces', 'empresa', 'produto', 'servico',
])

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function searchTerms(value: string): string[] {
  return [...new Set(normalizeSearchText(value).split(/\s+/))]
    .filter((term) => term.length >= 3 && !RAG_STOP_WORDS.has(term))
    .slice(0, 24)
}

/**
 * Recuperacao lexical do RAG. Seleciona os trechos mais relacionados a
 * pergunta antes de monta-los no prompt e nao exige uma API de embeddings.
 */
export async function retrieveKnowledgeInternal(
  supabase: any,
  query: string,
  charBudget = 8000,
  organizationId?: string | null,
  allowUnranked = false,
): Promise<Array<{ document: string; content: string }>> {
  let docsQuery = supabase
    .from('documents')
    .select('id, name')
    .eq('status', 'active')
    .limit(20)
  if (organizationId) docsQuery = docsQuery.eq('organization_id', organizationId)
  const { data: docs } = await docsQuery
  if (!docs?.length) return []

  const ids = docs.map((d: { id: string }) => d.id)
  const { data: chunks } = await supabase
    .from('knowledge_chunks')
    .select('document_id, content, chunk_index, version')
    .in('document_id', ids)
    .eq('status', 'active')
    .order('document_id', { ascending: true })
    .order('chunk_index', { ascending: true })
    .limit(500)

  if (!chunks?.length) return []

  const byDoc = new Map<string, string>(docs.map((d: any) => [d.id, d.name || 'documento']))
  const normalizedQuery = normalizeSearchText(query)
  const terms = searchTerms(query)
  const ranked = (chunks as Array<{ document_id: string; content: string; chunk_index: number }>)
    .map((row) => {
      const normalizedContent = normalizeSearchText(row.content)
      const normalizedName = normalizeSearchText(byDoc.get(row.document_id) || '')
      let score = 0
      let covered = 0
      for (const term of terms) {
        const matches = normalizedContent.split(term).length - 1
        if (matches > 0) {
          covered += 1
          score += Math.min(matches, 4) * (term.length >= 7 ? 4 : 2)
        }
        if (normalizedName.includes(term)) score += 3
      }
      if (normalizedQuery.length >= 8 && normalizedContent.includes(normalizedQuery)) score += 18
      if (covered > 1) score += covered * 3
      return { ...row, score }
    })
    .filter((row) => allowUnranked || row.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk_index - b.chunk_index)

  if (!ranked.length) return []
  const out: Array<{ document: string; content: string }> = []
  let used = 0
  for (const row of ranked.slice(0, 12)) {
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

function detectKind(name: string, mime: string): 'pdf' | 'docx' | 'xlsx' | 'text' | 'unsupported' {
  const lower = (name || '').toLowerCase()
  if (mime === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf'
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx')
  )
    return 'docx'
  if (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    lower.endsWith('.xlsx')
  )
    return 'xlsx'
  if (mime.startsWith('text/') || /\.(txt|md|csv|json)$/i.test(lower)) return 'text'
  return 'unsupported'
}

async function extractText(bytes: Uint8Array, kind: 'pdf' | 'docx' | 'xlsx' | 'text'): Promise<string> {
  if (kind === 'text') {
    return new TextDecoder().decode(bytes).trim()
  }
  if (kind === 'pdf') {
    const { extractText: unpdfExtract, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(bytes)
    const { text } = await unpdfExtract(pdf, { mergePages: true })
    return (Array.isArray(text) ? text.join('\n\n') : String(text)).trim()
  }
  if (kind === 'xlsx') {
    const module = await import('read-excel-file/universal')
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    const rows = await module.readSheet(data)
    return rows
      .map((row) => row.map((cell) => cell == null ? '' : String(cell).trim()).join(' | '))
      .filter((row) => row.replace(/\|/g, '').trim())
      .join('\n')
      .trim()
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
    if (kind === 'unsupported') throw new Error('Formato não suportado (use PDF, DOCX, XLSX, TXT, MD, CSV ou JSON)')

    const { data: blob, error: dlErr } = await context.supabase.storage
      .from('docs')
      .download(doc.storage_path as string)
    if (dlErr) throw new Error(dlErr.message)

    const bytes = new Uint8Array(await blob.arrayBuffer())
    if (bytes.byteLength > 15_000_000) throw new Error('Arquivo muito grande (>15 MB)')

    const text = await extractText(bytes, kind)
    if (!text) throw new Error('Não foi possível extrair texto do arquivo')

    const hash = await sha256(text)
    const { error: upErr } = await context.supabase
      .from('documents')
      .update({
        content_text: text,
        content_hash: hash,
        indexed_at: new Date().toISOString(),
        index_error: null,
      } as never)
      .eq('id', doc.id)
    if (upErr) throw new Error(upErr.message)

    const result = await reindexDocumentInternal(context, doc.id)
    return { chars: text.length, chunks: result.chunks, kind }
  })

const urlSourceSchema = z.object({
  url: z.string().url().max(2000),
  name: z.string().trim().min(2).max(200).optional(),
})

export const importKnowledgeUrl = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => urlSourceSchema.parse(value))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    let currentUrl = validateKnowledgeUrl(data.url)
    let response: Response | null = null
    for (let redirects = 0; redirects <= 3; redirects++) {
      response = await fetch(currentUrl, {
        headers: { 'user-agent': 'Sistema-Leads-Knowledge/1.0', accept: 'text/html,text/plain,application/json' },
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
      })
      if (![301, 302, 303, 307, 308].includes(response.status)) break
      const location = response.headers.get('location')
      if (!location) throw new Error('Redirecionamento sem destino')
      if (redirects === 3) throw new Error('A URL possui redirecionamentos demais')
      currentUrl = validateKnowledgeUrl(new URL(location, currentUrl).toString())
    }
    if (!response) throw new Error('Não foi possível iniciar a importação da URL')
    if (!response.ok) throw new Error(`Não foi possível acessar a URL (HTTP ${response.status})`)
    const contentLength = Number(response.headers.get('content-length') || 0)
    if (contentLength > 2_000_000) throw new Error('A página excede o limite de 2 MB')
    const contentType = response.headers.get('content-type') || ''
    if (!/text\/(html|plain)|application\/(json|ld\+json)/i.test(contentType)) {
      throw new Error('A URL precisa retornar HTML, texto ou JSON')
    }
    const raw = (await response.text()).slice(0, 2_000_000)
    const contentText = contentType.includes('html') ? htmlToText(raw) : raw.trim()
    if (contentText.length < 50) throw new Error('A página não possui texto suficiente para indexação')
    const finalUrl = currentUrl
    const title = data.name || extractHtmlTitle(raw) || finalUrl.hostname
    const hash = await sha256(contentText)
    const { data: existing } = await context.supabase
      .from('documents')
      .select('id')
      .eq('source_type', 'url')
      .eq('source_url', finalUrl.toString())
      .maybeSingle()
    const payload = {
      name: title,
      type: contentType,
      status: 'active',
      source_type: 'url',
      source_url: finalUrl.toString(),
      content_text: contentText,
      content_hash: hash,
      indexed_at: new Date().toISOString(),
      index_error: null,
      uploaded_by: context.userId,
    }
    const query = existing?.id
      ? context.supabase.from('documents').update(payload as never).eq('id', existing.id).select().single()
      : context.supabase.from('documents').insert(payload as never).select().single()
    const { data: document, error } = await query
    if (error) throw new Error(error.message)
    const result = await reindexDocumentInternal(context, document.id)
    return { document, chars: contentText.length, chunks: result.chunks, updated: Boolean(existing?.id) }
  })

function validateKnowledgeUrl(value: string): URL {
  const url = new URL(value)
  if (url.protocol !== 'https:') throw new Error('Use apenas URLs HTTPS')
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (
    host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')
  ) throw new Error('Endereço local ou privado não é permitido')
  url.username = ''
  url.password = ''
  url.hash = ''
  return url
}

function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractHtmlTitle(html: string): string | null {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  return title ? htmlToText(title).slice(0, 200) : null
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
