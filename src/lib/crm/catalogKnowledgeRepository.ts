import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { detalheDoErroDeFuncao } from '@/lib/transportador';

export type KnowledgeCatalogItemType = 'product' | 'service' | 'catalog' | 'document';
export type KnowledgeCatalogStatus = 'draft' | 'active' | 'archived';
export type KnowledgePresentationFormat = 'quick' | 'commercial' | 'technical' | 'link' | 'document';
export type KnowledgeSourceScope = 'products' | 'services' | 'catalogs' | 'documents' | 'mixed';
export type KnowledgeUsageKey = 'profile' | 'business' | 'products' | 'services' | 'catalogs' | 'documents' | 'sources';
export type KnowledgeUsage = Record<KnowledgeUsageKey, boolean>;
export interface KnowledgePublication { version: number; publishedAt: string; publishedBy: string; pendingItems: number; pendingSources: number; itemCount: number; sourceCount: number; }
export interface KnowledgeAuditEvent { id: string; action: string; detail: string | null; actorName: string | null; createdAt: string; }

export interface KnowledgeSource {
  id: string;
  name: string;
  sourceUrl: string;
  sourceKind: 'website' | 'catalog' | 'manual' | 'upload' | 'api';
  contentScope: KnowledgeSourceScope;
  enabled: boolean;
  syncStatus: 'idle' | 'syncing' | 'healthy' | 'error';
  lastSyncedAt: string | null;
  lastError: string | null;
  updatedAt: string;
}

export interface KnowledgeCatalogItem {
  id: string;
  sourceId: string;
  type: KnowledgeCatalogItemType;
  externalKey: string;
  status: KnowledgeCatalogStatus;
  anaEnabled: boolean;
  name: string;
  code: string | null;
  shortDescription: string | null;
  technicalDescription: string | null;
  category: string | null;
  material: string | null;
  applications: string[];
  qualificationQuestions: string[];
  keywords: string[];
  imageUrl: string | null;
  attachmentUrl: string | null;
  websiteUrl: string | null;
  sourceUrl: string;
  sourceLabel: string | null;
  importedAt: string | null;
  updatedAt: string;
}

export interface KnowledgeCatalogDraft {
  sourceId: string;
  type: KnowledgeCatalogItemType;
  name: string;
  externalKey?: string;
  status?: KnowledgeCatalogStatus;
  anaEnabled?: boolean;
  code?: string;
  shortDescription?: string;
  technicalDescription?: string;
  category?: string;
  material?: string;
  applications?: string[];
  qualificationQuestions?: string[];
  keywords?: string[];
  imageUrl?: string;
  attachmentUrl?: string;
  websiteUrl?: string;
  sourceUrl: string;
  sourceLabel?: string;
}

export interface ConversationKnowledgeEvent {
  messageId: string;
  itemId: string;
  eventType: 'queued' | 'sent' | 'opened' | 'suggested';
  presentationFormat: KnowledgePresentationFormat;
  mediaQueued: boolean;
  createdAt: string;
  item: Pick<KnowledgeCatalogItem, 'id' | 'name' | 'type' | 'imageUrl' | 'attachmentUrl' | 'sourceUrl'> | null;
}

type CatalogItemRow = {
  id: string;
  source_id: string;
  item_type: KnowledgeCatalogItemType;
  external_key: string;
  status: KnowledgeCatalogStatus;
  ana_enabled: boolean;
  name: string;
  code: string | null;
  short_description: string | null;
  technical_description: string | null;
  category: string | null;
  material: string | null;
  applications: string[] | null;
  qualification_questions?: string[] | null;
  keywords: string[] | null;
  image_url: string | null;
  attachment_url: string | null;
  website_url: string | null;
  source_url: string;
  source_label: string | null;
  imported_at: string | null;
  updated_at: string;
};

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function mapSource(row: Record<string, unknown>): KnowledgeSource {
  return {
    id: String(row.id),
    name: String(row.name || 'Fonte sem nome'),
    sourceUrl: String(row.source_url || ''),
    sourceKind: row.source_kind as KnowledgeSource['sourceKind'],
    contentScope: row.content_scope as KnowledgeSourceScope,
    enabled: row.enabled === true,
    syncStatus: row.sync_status as KnowledgeSource['syncStatus'],
    lastSyncedAt: typeof row.last_synced_at === 'string' ? row.last_synced_at : null,
    lastError: typeof row.last_error === 'string' ? row.last_error : null,
    updatedAt: String(row.updated_at || ''),
  };
}

function mapItem(row: CatalogItemRow): KnowledgeCatalogItem {
  return {
    id: row.id,
    sourceId: row.source_id,
    type: row.item_type,
    externalKey: row.external_key,
    status: row.status,
    anaEnabled: row.ana_enabled === true,
    name: row.name,
    code: row.code,
    shortDescription: row.short_description,
    technicalDescription: row.technical_description,
    category: row.category,
    material: row.material,
    applications: list(row.applications),
    qualificationQuestions: list(row.qualification_questions),
    keywords: list(row.keywords),
    imageUrl: row.image_url,
    attachmentUrl: row.attachment_url,
    websiteUrl: row.website_url,
    sourceUrl: row.source_url,
    sourceLabel: row.source_label,
    importedAt: row.imported_at,
    updatedAt: row.updated_at,
  };
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function makeExternalKey(draft: KnowledgeCatalogDraft): string {
  const base = `${draft.type}:${draft.sourceUrl}:${draft.name}`.toLocaleLowerCase('pt-BR');
  return base.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 480) || crypto.randomUUID();
}

function cleanUrl(value: string | undefined): string | null {
  const source = value?.trim();
  if (!source) return null;
  try {
    const parsed = new URL(source);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function loadKnowledgeSources(): Promise<KnowledgeSource[]> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase.from('knowledge_sources')
    .select('id,name,source_url,source_kind,content_scope,enabled,sync_status,last_synced_at,last_error,updated_at')
    .eq('organization_id', session.organizationId).order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapSource(row as Record<string, unknown>));
}

export async function loadKnowledgeCatalogItems(input: {
  type?: KnowledgeCatalogItemType | 'all';
  includeInactive?: boolean;
  query?: string;
  limit?: number;
} = {}): Promise<KnowledgeCatalogItem[]> {
  const session = await resolveOrganizationSession();
  let request = supabase.from('knowledge_catalog_items')
    .select('id,source_id,item_type,external_key,status,ana_enabled,name,code,short_description,technical_description,category,material,applications,qualification_questions,keywords,image_url,attachment_url,website_url,source_url,source_label,imported_at,updated_at')
    .eq('organization_id', session.organizationId)
    .order('updated_at', { ascending: false })
    .limit(input.limit ?? 120);
  if (input.type && input.type !== 'all') request = request.eq('item_type', input.type);
  if (!input.includeInactive) request = request.eq('status', 'active');
  const { data, error } = await request;
  if (error) throw error;
  const rows = (data ?? []).map((row) => mapItem(row as CatalogItemRow));
  const needle = normalizeText(input.query?.trim() || '');
  if (!needle) return rows;
  const terms = needle.split(/\s+/).filter((term) => term.length >= 2);
  return rows.filter((item) => {
    const searchable = normalizeText([
      item.name, item.code, item.category, item.material, item.shortDescription, item.technicalDescription,
      item.applications.join(' '), item.qualificationQuestions.join(' '), item.keywords.join(' '), item.sourceLabel,
    ].filter(Boolean).join(' '));
    return terms.every((term) => searchable.includes(term));
  });
}

export async function loadRelatedKnowledgeItems(itemId: string, includeInactive = false): Promise<KnowledgeCatalogItem[]> {
  const session = await resolveOrganizationSession();
  const { data: relations, error } = await supabase.from('knowledge_item_relations')
    .select('source_item_id,target_item_id').eq('organization_id', session.organizationId)
    .or(`source_item_id.eq.${itemId},target_item_id.eq.${itemId}`);
  if (error) throw error;
  const ids = [...new Set((relations ?? []).flatMap((row) => [row.source_item_id, row.target_item_id]).filter((id) => id !== itemId))];
  if (!ids.length) return [];
  let itemsQuery = supabase.from('knowledge_catalog_items')
    .select('id,source_id,item_type,external_key,status,ana_enabled,name,code,short_description,technical_description,category,material,applications,qualification_questions,keywords,image_url,attachment_url,website_url,source_url,source_label,imported_at,updated_at')
    .eq('organization_id', session.organizationId).in('id', ids);
  if (!includeInactive) itemsQuery = itemsQuery.eq('status', 'active');
  const { data, error: itemsError } = await itemsQuery;
  if (itemsError) throw itemsError;
  return (data ?? []).map((row) => mapItem(row as CatalogItemRow));
}

export async function loadConversationKnowledgeEvents(leadId: string): Promise<ConversationKnowledgeEvent[]> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase.from('conversation_knowledge_events')
    .select('message_id,item_id,event_type,presentation_format,metadata,created_at,knowledge_catalog_items(id,name,item_type,image_url,attachment_url,source_url)')
    .eq('organization_id', session.organizationId).eq('lead_id', leadId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const linked = row.knowledge_catalog_items as unknown as Record<string, unknown> | null;
    const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata as Record<string, unknown>
      : {};
    return {
      messageId: String(row.message_id), itemId: String(row.item_id), eventType: row.event_type as ConversationKnowledgeEvent['eventType'],
      presentationFormat: row.presentation_format as KnowledgePresentationFormat, mediaQueued: metadata.media_queued === true, createdAt: String(row.created_at),
      item: linked ? {
        id: String(linked.id), name: String(linked.name || 'Conteúdo'), type: linked.item_type as KnowledgeCatalogItemType,
        imageUrl: typeof linked.image_url === 'string' ? linked.image_url : null,
        attachmentUrl: typeof linked.attachment_url === 'string' ? linked.attachment_url : null,
        sourceUrl: String(linked.source_url || ''),
      } : null,
    };
  });
}

export async function createKnowledgeSource(input: {
  name: string;
  sourceUrl: string;
  sourceKind?: KnowledgeSource['sourceKind'];
  contentScope: KnowledgeSourceScope;
}): Promise<KnowledgeSource> {
  const session = await resolveOrganizationSession();
  const sourceUrl = cleanUrl(input.sourceUrl);
  if (!input.name.trim() || !sourceUrl) throw new Error('knowledge_source_name_and_url_required');
  const { data, error } = await supabase.from('knowledge_sources').insert({
    organization_id: session.organizationId, name: input.name.trim(), source_url: sourceUrl,
    source_kind: input.sourceKind ?? 'manual', content_scope: input.contentScope, created_by: session.userId,
  }).select('id,name,source_url,source_kind,content_scope,enabled,sync_status,last_synced_at,last_error,updated_at').single();
  if (error || !data) throw error ?? new Error('knowledge_source_not_created');
  return mapSource(data as Record<string, unknown>);
}

export async function saveKnowledgeCatalogItem(draft: KnowledgeCatalogDraft, id?: string): Promise<KnowledgeCatalogItem> {
  const session = await resolveOrganizationSession();
  const sourceUrl = cleanUrl(draft.sourceUrl);
  if (!draft.name.trim() || !sourceUrl || !draft.sourceId) throw new Error('knowledge_item_required_fields');
  const values = {
    organization_id: session.organizationId,
    source_id: draft.sourceId,
    item_type: draft.type,
    external_key: draft.externalKey?.trim() || makeExternalKey(draft),
    status: draft.status ?? 'draft',
    ana_enabled: draft.anaEnabled === true,
    name: draft.name.trim(),
    code: draft.code?.trim() || null,
    short_description: draft.shortDescription?.trim() || null,
    technical_description: draft.technicalDescription?.trim() || null,
    category: draft.category?.trim() || null,
    material: draft.material?.trim() || null,
    applications: (draft.applications ?? []).map((value) => value.trim()).filter(Boolean).slice(0, 40),
    qualification_questions: (draft.qualificationQuestions ?? []).map((value) => value.trim()).filter(Boolean).slice(0, 8),
    keywords: (draft.keywords ?? []).map((value) => value.trim()).filter(Boolean).slice(0, 60),
    image_url: cleanUrl(draft.imageUrl), attachment_url: cleanUrl(draft.attachmentUrl), website_url: cleanUrl(draft.websiteUrl),
    source_url: sourceUrl, source_label: draft.sourceLabel?.trim() || null, created_by: session.userId, updated_at: new Date().toISOString(),
  };
  const request = id
    ? supabase.from('knowledge_catalog_items').update(values).eq('id', id).eq('organization_id', session.organizationId)
    : supabase.from('knowledge_catalog_items').insert(values);
  const { data, error } = await request
    .select('id,source_id,item_type,external_key,status,ana_enabled,name,code,short_description,technical_description,category,material,applications,qualification_questions,keywords,image_url,attachment_url,website_url,source_url,source_label,imported_at,updated_at')
    .single();
  if (error || !data) throw error ?? new Error('knowledge_item_not_saved');
  return mapItem(data as CatalogItemRow);
}

export async function setKnowledgeCatalogItemStatus(id: string, status: KnowledgeCatalogStatus, anaEnabled: boolean): Promise<void> {
  const session = await resolveOrganizationSession();
  const { error } = await supabase.from('knowledge_catalog_items').update({ status, ana_enabled: anaEnabled, updated_at: new Date().toISOString() })
    .eq('id', id).eq('organization_id', session.organizationId);
  if (error) throw error;
}

export async function deleteKnowledgeCatalogItem(id: string): Promise<void> {
  const session = await resolveOrganizationSession();
  const { error } = await supabase.from('knowledge_catalog_items').delete().eq('id', id).eq('organization_id', session.organizationId);
  if (error) throw error;
}

export async function saveKnowledgeRelation(input: { sourceItemId: string; targetItemId: string; relationType?: 'related' | 'compatible_with' | 'supports' | 'catalog_for' | 'document_for' }): Promise<void> {
  if (input.sourceItemId === input.targetItemId) throw new Error('knowledge_relation_same_item');
  const session = await resolveOrganizationSession();
  const { error } = await supabase.from('knowledge_item_relations').upsert({
    organization_id: session.organizationId, source_item_id: input.sourceItemId, target_item_id: input.targetItemId,
    relation_type: input.relationType ?? 'related', created_by: session.userId,
  }, { onConflict: 'organization_id,source_item_id,target_item_id,relation_type', ignoreDuplicates: true });
  if (error) throw error;
}

export async function syncKnowledgeSource(sourceUrl: string): Promise<{ upserted: number; seen: number; message: string }> {
  const { data, error } = await supabase.functions.invoke('catalog-knowledge', { body: { action: 'sync', source_url: sourceUrl } });
  if (error || !data?.ok) throw new Error(data?.erro ?? await detalheDoErroDeFuncao(error));
  return { upserted: Number(data.upserted) || 0, seen: Number(data.seen) || 0, message: String(data.message || 'Fonte sincronizada.') };
}

async function knowledgeOperation(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('knowledge-publish', { body: { action, ...body } });
  if (error || !data?.ok) throw new Error(data?.erro ?? await detalheDoErroDeFuncao(error));
  return data as Record<string, unknown>;
}

export const defaultKnowledgeUsage: KnowledgeUsage = { profile: true, business: true, products: true, services: true, catalogs: true, documents: true, sources: true };

export async function setKnowledgeUsage(key: KnowledgeUsageKey, enabled: boolean): Promise<KnowledgeUsage> {
  const data = await knowledgeOperation('set_usage', { key, enabled });
  return { ...defaultKnowledgeUsage, ...(data.usage as Partial<KnowledgeUsage> || {}) };
}

export async function publishKnowledge(): Promise<KnowledgePublication> {
  const data = await knowledgeOperation('publish');
  return data.publication as KnowledgePublication;
}

export async function loadKnowledgePublicationState(): Promise<{ usage: KnowledgeUsage; publication: KnowledgePublication | null; audit: KnowledgeAuditEvent[] }> {
  const data = await knowledgeOperation('get_state');
  const audit = Array.isArray(data.audit) ? data.audit.map((event) => {
    const item = event as Record<string, unknown>;
    return { id: String(item.id), action: String(item.action || ''), detail: typeof item.detail === 'string' ? item.detail : null, actorName: typeof item.actor_name === 'string' ? item.actor_name : null, createdAt: String(item.created_at || '') };
  }) : [];
  return { usage: { ...defaultKnowledgeUsage, ...(data.usage as Partial<KnowledgeUsage> || {}) }, publication: (data.publication as KnowledgePublication | null) || null, audit };
}

export function formatKnowledgeMessage(item: KnowledgeCatalogItem, format: KnowledgePresentationFormat): string {
  const link = item.attachmentUrl || item.websiteUrl || item.sourceUrl;
  const summary = item.shortDescription || item.technicalDescription || '';
  if (format === 'quick') return [`Opção disponível: ${item.name}.`, summary, link ? `Mais informações: ${link}` : ''].filter(Boolean).join('\n');
  if (format === 'commercial') return [
    `Olá! Separei uma opção que pode atender sua necessidade: ${item.name}.`, summary,
    item.applications.length ? `Aplicações informadas: ${item.applications.join(', ')}.` : '',
    item.qualificationQuestions.length ? `Para direcionar corretamente: ${item.qualificationQuestions[0]}` : '',
    link ? `Confira os detalhes: ${link}` : '',
    'Se me disser a aplicação, medida ou equipamento, preparo o próximo direcionamento com precisão.',
  ].filter(Boolean).join('\n\n');
  if (format === 'technical') return [
    `${item.name}${item.code ? ` (${item.code})` : ''}`,
    item.technicalDescription || item.shortDescription || 'A fonte não disponibiliza ficha técnica detalhada para este item.',
    item.material ? `Material informado: ${item.material}.` : '',
    item.applications.length ? `Aplicações informadas: ${item.applications.join(', ')}.` : '',
    item.qualificationQuestions.length ? `Para qualificar sem assumir compatibilidade: ${item.qualificationQuestions.join(' ')}` : '',
    link ? `Fonte técnica: ${link}` : '',
    'Para confirmar compatibilidade, preciso da aplicação, medida e condição de uso.',
  ].filter(Boolean).join('\n\n');
  return [`Segue ${item.type === 'catalog' ? 'o catálogo' : 'o conteúdo'} ${item.name}.`, summary, link || 'A fonte não possui link público para envio.'].filter(Boolean).join('\n\n');
}

export const catalogTypeLabel: Record<KnowledgeCatalogItemType, string> = {
  product: 'Produto', service: 'Serviço', catalog: 'Catálogo', document: 'Documento',
};
