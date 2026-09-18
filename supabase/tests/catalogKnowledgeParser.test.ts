import { describe, expect, it } from 'vitest';
import { extractCatalogKnowledgeItems, type CatalogKnowledgeSourceDefinition } from '../functions/_shared/catalogKnowledgeParser';

const productSource: CatalogKnowledgeSourceDefinition = {
  url: 'https://wayflex.ind.br/acessorios', itemType: 'product', scope: 'products', name: 'Wayflex — Produtos e acessórios',
};

describe('catalogKnowledgeParser', () => {
  it('imports product cards without relying on DOMParser', () => {
    const items = extractCatalogKnowledgeItems(`
      <main><h1>Acessórios</h1><article class="product-card"><h2>Perfil de borracha</h2>
      <p>Perfil técnico para aplicações industriais.</p><a href="/acessorios/perfil">Ver produto</a></article></main>
    `, productSource);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: 'Perfil de borracha', type: 'product', websiteUrl: 'https://wayflex.ind.br/acessorios/perfil' });
  });

  it('keeps a catalog PDF URL as the imported source', () => {
    const items = extractCatalogKnowledgeItems(`
      <main><h1>Catálogos</h1><section><p>Material técnico publicado pela Wayflex.</p>
      <a href="/wp-content/uploads/catalogo-mantas.pdf">Catálogo de mantas</a></section></main>
    `, { url: 'https://wayflex.ind.br/catalogos', itemType: 'catalog', scope: 'catalogs', name: 'Wayflex — Catálogos' });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: 'Catálogo de mantas', attachmentUrl: 'https://wayflex.ind.br/wp-content/uploads/catalogo-mantas.pdf' });
  });
});
