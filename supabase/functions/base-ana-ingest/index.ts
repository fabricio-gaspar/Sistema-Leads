import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

const CATEGORIES = new Set([
  'institucional', 'materiais', 'solucoes_e_produtos', 'qualificacao',
  'regras_comerciais', 'respostas_aprovadas', 'handoff_humano',
]);
const KINDS = new Set(['documento', 'imagem', 'apresentacao', 'planilha', 'video', 'link', 'texto']);
const ACTIONS = new Set(['register', 'save_text', 'publish', 'unpublish', 'delete']);
const asText = (value: unknown, max = 120_000): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
const asObject = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asList = (value: unknown, max = 20): string[] => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, max)
  : [];
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function validUrl(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}

function chunksFrom(content: string): string[] {
  const clean = content.replace(/\r/g, '').trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let current = '';
  for (const paragraph of clean.split(/\n{2,}/)) {
    const next = paragraph.trim();
    if (!next) continue;
    if (current && current.length + next.length + 2 > 1800) {
      chunks.push(current);
      current = next;
    } else {
      current = current ? `${current}\n\n${next}` : next;
    }
  }
  if (current) chunks.push(current);
  if (!chunks.length) chunks.push(clean.slice(0, 1800));
  return chunks.slice(0, 40);
}

function metadataFor(input: Record<string, unknown>, previous: Record<string, unknown> = {}) {
  const category = asText(input.category, 80);
  const kind = asText(input.kind, 32);
  return {
    ...previous,
    ana_memory: true,
    category: CATEGORIES.has(category) ? category : (previous.category || 'institucional'),
    kind: KINDS.has(kind) ? kind : (previous.kind || 'documento'),
    tags: asList(input.tags),
    linked_product_id: isUuid(asText(input.linked_product_id, 80)) ? asText(input.linked_product_id, 80) : null,
    source_label: asText(input.source_label, 180) || null,
    processing_note: asText(input.processing_note, 1_200) || null,
    content_status: asText(input.content_status, 32) || previous.content_status || 'needs_review',
  };
}

async function organizationFor(request: Request) {
  const { user } = await requireUser(request);
  const admin = createAdminClient();
  const { data: profile, error } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
  if (error || !profile?.active_organization_id) throw new Error('organization_context_required');
  const organizationId = profile.active_organization_id as string;
  await requireOrganizationRole(admin, user.id, organizationId, ['owner', 'admin', 'manager']);
  return { admin, user, organizationId, actorName: profile.name || 'Usuário' };
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);

  try {
    const body = asObject(await request.json());
    const action = asText(body.action, 24);
    if (!ACTIONS.has(action)) throw new Error('unsupported_action');
    const { admin, user, organizationId, actorName } = await organizationFor(request);
    const documentId = asText(body.document_id, 80);

    if (action === 'register') {
      const name = asText(body.name, 180);
      const storagePath = asText(body.storage_path, 500);
      const sourceUrl = validUrl(asText(body.source_url, 2_000));
      if (!name) throw new Error('document_name_required');
      if (!storagePath && !sourceUrl) throw new Error('document_source_required');
      if (storagePath && !storagePath.startsWith(`${organizationId}/ana/`)) throw new Error('invalid_storage_path');
      if (storagePath) {
        const { error: fileError } = await admin.storage.from('ana-knowledge').createSignedUrl(storagePath, 60);
        if (fileError) throw new Error('uploaded_file_not_found');
      }
      const content = asText(body.content);
      const metadata = metadataFor(body);
      const { data: document, error } = await admin.from('documents').insert({
        organization_id: organizationId,
        name,
        content_text: content || null,
        storage_path: storagePath || null,
        type: asText(body.mime_type, 160) || null,
        size: asText(body.size, 32) || null,
        status: content ? 'draft' : 'processing',
        source_type: sourceUrl ? 'url' : 'upload',
        source_url: sourceUrl,
        category: 'knowledge',
        visibility: 'ai',
        uploaded_by: user.id,
        metadata,
      }).select('id').single();
      if (error || !document) throw error ?? new Error('document_not_created');
      const chunks = chunksFrom(content);
      if (chunks.length) {
        const { error: chunksError } = await admin.from('knowledge_chunks').insert(chunks.map((chunk, index) => ({
          organization_id: organizationId, document_id: document.id, chunk_index: index,
          content: chunk, tokens: Math.ceil(chunk.length / 4), status: 'draft', metadata,
        })));
        if (chunksError) throw chunksError;
      }
      await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: actorName, actor_type: 'user', action: 'ana.knowledge_registered', detail: 'Fonte adicionada à Base aprovada da Ana.', entity_table: 'documents', entity_id: document.id, event_data: { kind: metadata.kind, category: metadata.category, has_content: Boolean(chunks.length) } });
      return json({ ok: true, document_id: document.id, status: chunks.length ? 'draft' : 'processing' }, 201, headers);
    }

    if (!isUuid(documentId)) throw new Error('document_id_required');
    const { data: existing, error: existingError } = await admin.from('documents').select('id,storage_path,metadata,name').eq('id', documentId).eq('organization_id', organizationId).maybeSingle();
    if (existingError || !existing) throw existingError ?? new Error('document_not_found');

    if (action === 'save_text') {
      const content = asText(body.content);
      if (!content) throw new Error('content_required');
      const metadata = metadataFor(body, asObject(existing.metadata));
      const chunks = chunksFrom(content);
      const { error: updateError } = await admin.from('documents').update({ content_text: content, status: 'draft', metadata, index_error: null, indexed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', documentId).eq('organization_id', organizationId);
      if (updateError) throw updateError;
      const { error: deleteError } = await admin.from('knowledge_chunks').delete().eq('document_id', documentId).eq('organization_id', organizationId);
      if (deleteError) throw deleteError;
      const { error: chunksError } = await admin.from('knowledge_chunks').insert(chunks.map((chunk, index) => ({ organization_id: organizationId, document_id: documentId, chunk_index: index, content: chunk, tokens: Math.ceil(chunk.length / 4), status: 'draft', metadata })));
      if (chunksError) throw chunksError;
      await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: actorName, actor_type: 'user', action: 'ana.knowledge_text_reviewed', detail: 'Texto revisado da fonte da Ana.', entity_table: 'documents', entity_id: documentId, event_data: { chunks: chunks.length } });
      return json({ ok: true, status: 'draft', chunks: chunks.length }, 200, headers);
    }

    if (action === 'publish' || action === 'unpublish') {
      const publish = action === 'publish';
      if (publish) {
        const { count, error: countError } = await admin.from('knowledge_chunks').select('id', { count: 'exact', head: true }).eq('document_id', documentId).eq('organization_id', organizationId);
        if (countError) throw countError;
        if (!count) throw new Error('reviewed_text_required');
      }
      const nextMetadata = { ...asObject(existing.metadata), ana_memory: true, approval_status: publish ? 'approved' : 'draft', ...(publish ? { ana_approved_at: new Date().toISOString(), ana_approved_by: user.id } : {}) };
      const nextStatus = publish ? 'active' : 'draft';
      const { error: documentError } = await admin.from('documents').update({ status: nextStatus, metadata: nextMetadata, updated_at: new Date().toISOString(), indexed_at: publish ? new Date().toISOString() : null }).eq('id', documentId).eq('organization_id', organizationId);
      if (documentError) throw documentError;
      const { error: chunksError } = await admin.from('knowledge_chunks').update({ status: nextStatus, metadata: nextMetadata }).eq('document_id', documentId).eq('organization_id', organizationId);
      if (chunksError) throw chunksError;
      await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: actorName, actor_type: 'user', action: publish ? 'ana.knowledge_published' : 'ana.knowledge_unpublished', detail: publish ? 'Fonte aprovada para consulta da Ana.' : 'Fonte removida da consulta da Ana.', entity_table: 'documents', entity_id: documentId, event_data: { name: existing.name } });
      return json({ ok: true, status: nextStatus }, 200, headers);
    }

    if (existing.storage_path?.startsWith(`${organizationId}/ana/`)) {
      const { error: storageError } = await admin.storage.from('ana-knowledge').remove([existing.storage_path]);
      if (storageError && !/not found/i.test(storageError.message)) throw storageError;
    }
    const { error: deleteError } = await admin.from('documents').delete().eq('id', documentId).eq('organization_id', organizationId);
    if (deleteError) throw deleteError;
    await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: actorName, actor_type: 'user', action: 'ana.knowledge_deleted', detail: 'Fonte removida da Base aprovada da Ana.', entity_table: 'documents', entity_id: documentId, event_data: { name: existing.name } });
    return json({ ok: true }, 200, headers);
  } catch (error) {
    return json({ ok: false, erro: safeError(error) }, 400, headers);
  }
});
