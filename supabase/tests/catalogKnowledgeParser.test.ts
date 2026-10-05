import { describe, expect, it } from 'vitest';
import { catalogItemTraceUrl, extractCatalogKnowledgeItems, extractWayflexSegmentSnapshotItems, extractWayflexSpaBundleItems, type CatalogKnowledgeSourceDefinition } from '../functions/_shared/catalogKnowledgeParser';

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

  it('extracts published product and visual catalog cards from the Wayflex SPA bundle', () => {
    const bundle = `
      const accessoryImage="/assets/acessorio-01.jpg", catalogCover="/assets/catalogo-01.png";
      const accessories=[{img:accessoryImage,label:"Gaxetas para vedação industrial"}];
      const catalogs=[{id:"fallback-1",title:"Catálogo de vedações",category:"Industrial",cover_url:catalogCover,description:"Soluções publicadas para vedação industrial.",pdf_url:null}];
    `;
    const products = extractWayflexSpaBundleItems(bundle, productSource);
    const catalogs = extractWayflexSpaBundleItems(bundle, { url: 'https://wayflex.ind.br/catalogos', itemType: 'catalog', scope: 'catalogs', name: 'Wayflex — Catálogos' });

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({ name: 'Gaxetas para vedação industrial', category: 'Acessório industrial', imageUrl: 'https://wayflex.ind.br/assets/acessorio-01.jpg', importShape: 'spa_bundle' });
    expect(catalogs).toHaveLength(1);
    expect(catalogs[0]).toMatchObject({ name: 'Catálogo de vedações', category: 'Industrial', imageUrl: 'https://wayflex.ind.br/assets/catalogo-01.png', attachmentUrl: null, importShape: 'spa_bundle' });
  });

  it('keeps the public segment snapshot distinct from products and traceable to its source page', () => {
    const segments = extractWayflexSegmentSnapshotItems({ url: 'https://wayflex.ind.br/servicos', itemType: 'service', scope: 'services', name: 'Wayflex — Segmentos e aplicações' });

    expect(segments.length).toBeGreaterThan(10);
    expect(segments.find((item) => item.name === 'Mineração')).toMatchObject({ type: 'service', category: 'Segmento de atuação', sourceUrl: 'https://wayflex.ind.br/servicos', importShape: 'public_snapshot' });
  });

  it('creates a stable derived-document trace for cards from the same source page', () => {
    const items = extractWayflexSpaBundleItems('const image="/assets/acessorio-01.jpg"; const cards=[{img:image,label:"Gaxeta"}];', productSource);
    const trace = catalogItemTraceUrl(items[0], productSource);

    expect(trace).toContain('https://wayflex.ind.br/acessorios#knowledge-spa%3Aproduct%3Agaxeta');
    expect(new URL(trace).pathname).toBe('/acessorios');
  });
});
