import { describe, expect, it } from 'vitest';
import { formatKnowledgeMessage, type KnowledgeCatalogItem } from '@/lib/crm/catalogKnowledgeRepository';
import { createKnowledgeDragPayload, parseKnowledgeDragPayload } from './knowledgeDrag';

const product: KnowledgeCatalogItem = {
  id: '00000000-0000-4000-8000-000000000001', sourceId: 'source-1', type: 'product', externalKey: 'product:anel', status: 'active', anaEnabled: true,
  name: 'Anel de vedação', code: 'ANEL-01', shortDescription: 'Vedação para aplicações industriais.', technicalDescription: 'NBR 70 shore.', category: 'Vedação', material: 'NBR', applications: ['Bombas'], qualificationQuestions: [], keywords: ['anel'], imageUrl: 'https://example.com/anel.png', attachmentUrl: null, websiteUrl: 'https://example.com/anel', sourceUrl: 'https://example.com/catalogo', sourceLabel: 'Catálogo', importedAt: null, updatedAt: '2026-10-11T00:00:00Z',
};

describe('knowledge drag and drop', () => {
  it('serializes only the product content needed to prepare a message', () => {
    const payload = createKnowledgeDragPayload(product);
    expect(payload).toEqual({
      item: product,
      format: 'quick',
      text: formatKnowledgeMessage(product, 'quick'),
      sendImage: false,
    });
    expect(parseKnowledgeDragPayload(JSON.stringify(payload))).toMatchObject({ item: { id: product.id }, format: 'quick', sendImage: false });
  });

  it('rejects malformed or unsupported drops', () => {
    expect(parseKnowledgeDragPayload('not-json')).toBeNull();
    expect(parseKnowledgeDragPayload(JSON.stringify({ item: { id: product.id }, format: 'unsupported' }))).toBeNull();
    expect(parseKnowledgeDragPayload(JSON.stringify({ item: { id: 'not-a-uuid' }, format: 'quick' }))).toBeNull();
  });
});
