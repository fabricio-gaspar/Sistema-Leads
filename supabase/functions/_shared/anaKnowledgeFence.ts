import type { createAdminClient } from './auth.ts';
import { catalogTypeAllowed, knowledgeUsage, normalizeCommercialCatalogPolicy } from './commercialCatalogPolicy.ts';

type Admin = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const ids = (value: unknown) => Array.isArray(value) ? [...new Set(value.filter(uuid))].sort().slice(0, 300) : [];
const sorted = (rows: Row[]) => rows.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
export interface AnaKnowledgeSnapshot { version: 1; documentIds: string[]; catalogItemIds: string[]; fingerprint: string }

export async function readAnaKnowledgeFence(admin: Admin, organizationId: string, documentIds: string[] = [], catalogItemIds: string[] = []) {
  const documentsRequested = ids(documentIds); const itemsRequested = ids(catalogItemIds);
  const [companyRead, policyRead, documentsRead, itemsRead, chunksRead] = await Promise.all([
    admin.from('company_settings').select('ui_settings,name,description,segment,website,phone,email').eq('organization_id', organizationId).maybeSingle(),
    admin.from('organization_module_data').select('data').eq('organization_id', organizationId).eq('module_key', 'commercial_catalog_policy').maybeSingle(),
    documentsRequested.length ? admin.from('documents').select('id,name,status,source_type,source_url,metadata,updated_at').eq('organization_id', organizationId).in('id', documentsRequested) : { data: [], error: null },
    documentsRequested.length || itemsRequested.length ? admin.from('knowledge_catalog_items').select('id,document_id,item_type,status,ana_enabled,source_id,updated_at,name,short_description,technical_description,category,material,applications,keywords,image_url').eq('organization_id', organizationId)
      .or([documentsRequested.length ? `document_id.in.(${documentsRequested.join(',')})` : '', itemsRequested.length ? `id.in.(${itemsRequested.join(',')})` : ''].filter(Boolean).join(',')) : { data: [], error: null },
    documentsRequested.length ? admin.from('knowledge_chunks').select('id,document_id,chunk_index,status,content,metadata').eq('organization_id', organizationId).in('document_id', documentsRequested).order('id').limit(1001) : { data: [], error: null },
  ]);
  if ([companyRead, policyRead, documentsRead, itemsRead, chunksRead].some((read) => read.error)) throw new Error('ana_knowledge_policy_read_failed');
  if ((chunksRead.data?.length ?? 0) >= 1001) throw new Error('ana_knowledge_context_too_large');
  const documents = (documentsRead.data ?? []) as Row[]; const items = (itemsRead.data ?? []) as Row[];
  const sourceIds = ids([...items.map((item) => item.source_id), ...documents.map((document) => object(document.metadata).source_id)]);
  const sourcesRead = sourceIds.length ? await admin.from('knowledge_sources').select('id,enabled,sync_status,updated_at').eq('organization_id', organizationId).in('id', sourceIds) : { data: [], error: null };
  if (sourcesRead.error) throw new Error('ana_knowledge_policy_read_failed');
  const sources = (sourcesRead.data ?? []) as Row[];
  const company = object(companyRead.data); const usage = knowledgeUsage(company.ui_settings);
  const policy = normalizeCommercialCatalogPolicy(policyRead.data?.data);
  const allowedItems = items.filter((item) => item.status === 'active' && item.ana_enabled === true && catalogTypeAllowed(item.item_type, usage, policy)
    && (!item.source_id || (usage.sources && sources.some((source) => source.id === item.source_id && source.enabled === true && source.sync_status === 'healthy'))));
  const allowedDocuments = documents.filter((document) => {
    if (document.status !== 'active') return false;
    const metadata = object(document.metadata);
    if (document.source_type === 'commercial_catalog' || metadata.commercial_item_id) return allowedItems.some((item) => item.document_id === document.id && item.id === metadata.commercial_item_id);
    if (!usage.documents) return false;
    if (document.source_type !== 'manual' && document.source_type !== 'upload') {
      // Imported/URL provenance without a canonical source relation cannot prove
      // that the source is still enabled. Do not infer authority from a URL.
      if (!usage.sources || !uuid(metadata.source_id) || !sources.some((source) => source.id === metadata.source_id && source.enabled === true && source.sync_status === 'healthy')) return false;
    } else if (metadata.source_id && (!usage.sources || !sources.some((source) => source.id === metadata.source_id && source.enabled === true && source.sync_status === 'healthy'))) return false;
    return metadata.approval_status !== 'rejected' && metadata.content_status !== 'needs_review';
  });
  // Store only a digest and UUIDs in jobs. Source text/metadata is never copied into the token.
  const serialized = JSON.stringify({ policy, usage, company, documents: sorted(documents), items: sorted(items), sources: sorted(sources), chunks: sorted((chunksRead.data ?? []) as Row[]) });
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized))), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const snapshot: AnaKnowledgeSnapshot = { version: 1, documentIds: documentsRequested, catalogItemIds: itemsRequested, fingerprint };
  const canonicalKnowledge: Row[] = ((chunksRead.data ?? []) as Row[]).filter((chunk) => chunk.status === 'active' && allowedDocuments.some((document) => document.id === chunk.document_id))
    .map((chunk) => ({ ...chunk, documents: allowedDocuments.find((document) => document.id === chunk.document_id) }));
  return { policy, usage, company, canonicalKnowledge, catalogItems: allowedItems, allowedDocumentIds: allowedDocuments.map((document) => String(document.id)), allowedCatalogItemIds: allowedItems.map((item) => String(item.id)), snapshot };
}

export async function assertAnaKnowledgeSnapshot(admin: Admin, organizationId: string, expected: unknown): Promise<void> {
  const value = object(expected);
  if (value.version !== 1 || !Array.isArray(value.documentIds) || !Array.isArray(value.catalogItemIds) || typeof value.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(value.fingerprint)) throw new Error('ana_knowledge_snapshot_missing');
  if (ids(value.documentIds).length !== value.documentIds.length || ids(value.catalogItemIds).length !== value.catalogItemIds.length) throw new Error('ana_knowledge_snapshot_invalid');
  const current = await readAnaKnowledgeFence(admin, organizationId, value.documentIds as string[], value.catalogItemIds as string[]);
  if (current.snapshot.fingerprint !== value.fingerprint) throw new Error('ana_knowledge_context_changed');
}
