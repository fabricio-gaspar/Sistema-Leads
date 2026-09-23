import { describe, expect, it } from 'vitest';
import { readCatalogImageMedia, safePublicImageUrl, selectCatalogImageCandidate } from '../functions/_shared/catalogMedia.ts';

const product = {
  id: '2e7d01e1-99af-4fcf-bd32-d07ea1788d3d',
  itemType: 'product' as const,
  name: 'Perfil de vedação para juntas industriais',
  category: 'Acessório industrial',
  shortDescription: 'Perfil técnico para aplicações de vedação.',
  keywords: ['vedação', 'junta'],
  imageUrl: 'https://wayflex.ind.br/assets/perfil-vedacao.jpg',
};

describe('catalog media safety', () => {
  it.each([
    ['https://wayflex.ind.br/assets/perfil-vedacao.jpg', true],
    ['http://wayflex.ind.br/assets/perfil-vedacao.jpg', false],
    ['https://localhost/image.jpg', false],
    ['https://127.0.0.1/image.jpg', false],
    ['https://user:password@wayflex.ind.br/image.jpg', false],
  ])('accepts only public HTTPS image URLs: %s', (value, valid) => {
    expect(Boolean(safePublicImageUrl(value))).toBe(valid);
  });

  it('requires an exact catalog item reference in the queued media payload', () => {
    expect(readCatalogImageMedia({ type: 'image', catalog_item_id: product.id })).toEqual({ type: 'image', catalogItemId: product.id });
    expect(() => readCatalogImageMedia({ type: 'image', catalog_item_id: 'not-a-uuid' })).toThrow('catalog_media_payload_invalid');
  });

  it('selects an image only for a confident product match', () => {
    expect(selectCatalogImageCandidate({ enabled: true, channel: 'whatsapp', event: 'message.received', intent: 'produto', question: 'Preciso de uma vedação para junta industrial.', candidates: [product] }))
      .toMatchObject({ id: product.id });
    expect(selectCatalogImageCandidate({ enabled: true, channel: 'whatsapp', event: 'message.received', intent: 'geral', question: 'Olá, tudo bem?', candidates: [product] })).toBeNull();
    expect(selectCatalogImageCandidate({ enabled: false, channel: 'whatsapp', event: 'message.received', intent: 'produto', question: 'Preciso de vedação para junta.', candidates: [product] })).toBeNull();
  });
});
