import { formatKnowledgeMessage, type KnowledgeCatalogItem, type KnowledgePresentationFormat } from '@/lib/crm/catalogKnowledgeRepository';

export const knowledgeDragMime = 'application/x-wayflex-knowledge';

export interface KnowledgeDragPayload {
  item: KnowledgeCatalogItem;
  format: KnowledgePresentationFormat;
  text: string;
  sendImage: boolean;
}

const formats = new Set<KnowledgePresentationFormat>(['quick', 'commercial', 'technical', 'link', 'document']);

export function createKnowledgeDragPayload(item: KnowledgeCatalogItem): KnowledgeDragPayload {
  return { item, format: 'quick', text: formatKnowledgeMessage(item, 'quick'), sendImage: false };
}

export function parseKnowledgeDragPayload(value: string | null | undefined): KnowledgeDragPayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<KnowledgeDragPayload>;
    if (!parsed.item || typeof parsed.item !== 'object' || typeof parsed.item.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.item.id)) return null;
    if (typeof parsed.text !== 'string' || typeof parsed.format !== 'string' || !formats.has(parsed.format as KnowledgePresentationFormat)) return null;
    return { item: parsed.item as KnowledgeCatalogItem, format: parsed.format as KnowledgePresentationFormat, text: parsed.text, sendImage: parsed.sendImage === true };
  } catch {
    return null;
  }
}
