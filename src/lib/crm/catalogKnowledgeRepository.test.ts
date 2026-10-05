import { describe, expect, it } from 'vitest';
import { formatKnowledgeMessage, type KnowledgeCatalogItem } from './catalogKnowledgeRepository';

const product: KnowledgeCatalogItem = {
  id: 'item-1', sourceId: 'source-1', type: 'product', externalKey: 'product-1', status: 'active', anaEnabled: true,
  name: 'Perfil de vedação', code: 'PV-01', shortDescription: 'Perfil técnico para vedação industrial.',
  technicalDescription: 'Material publicado: borracha nitrílica para aplicações compatíveis.', category: 'Acessórios', material: 'Borracha nitrílica',
  applications: ['Vedação industrial'], qualificationQuestions: ['Em qual equipamento o perfil será utilizado?'], keywords: ['vedação', 'nitrílica'], imageUrl: null,
  attachmentUrl: null, websiteUrl: 'https://wayflex.ind.br/acessorios', sourceUrl: 'https://wayflex.ind.br/acessorios', sourceLabel: 'Wayflex', importedAt: null, updatedAt: '2026-09-18T00:00:00Z',
};

describe('formatKnowledgeMessage', () => {
  it('prepara envio técnico somente com fatos publicados e pede contexto', () => {
    const message = formatKnowledgeMessage(product, 'technical');
    expect(message).toContain('Perfil de vedação (PV-01)');
    expect(message).toContain('Material publicado: borracha nitrílica');
    expect(message).toContain('preciso da aplicação, medida e condição de uso');
    expect(message).not.toContain('R$');
  });

  it('prepara envio comercial com a origem rastreável', () => {
    const message = formatKnowledgeMessage(product, 'commercial');
    expect(message).toContain('Confira os detalhes: https://wayflex.ind.br/acessorios');
    expect(message).toContain('Se me disser a aplicação');
    expect(message).toContain('Em qual equipamento o perfil será utilizado?');
  });
});
