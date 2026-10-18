import { describe, expect, it } from 'vitest';
import {
  catalogOfferTermOptions,
  composeCatalogBuyerSearchTerms,
  suggestBuyerSearchTerms,
  type BuyerTermCatalogItem,
} from './prospectingBuyerTerms';

const baseItem: BuyerTermCatalogItem = {
  id: 'product-1',
  name: 'Vedação técnica',
  status: 'active',
  type: 'product',
  applications: ['Fabricantes de máquinas alimentícias', 'Manutenção industrial'],
  category: 'Vedação',
  keywords: ['gaxeta'],
  material: 'borracha nitrílica',
};

describe('buyer search terms from the company catalog', () => {
  it('offers traceable words from the selected catalog items without inventing data', () => {
    expect(catalogOfferTermOptions([baseItem])).toEqual([
      { term: 'borracha nitrílica', origin: 'material', itemId: 'product-1', itemName: 'Vedação técnica' },
      { term: 'gaxeta', origin: 'keyword', itemId: 'product-1', itemName: 'Vedação técnica' },
      { term: 'Vedação técnica', origin: 'name', itemId: 'product-1', itemName: 'Vedação técnica' },
      { term: 'Fabricantes de máquinas alimentícias', origin: 'application', itemId: 'product-1', itemName: 'Vedação técnica' },
      { term: 'Manutenção industrial', origin: 'application', itemId: 'product-1', itemName: 'Vedação técnica' },
    ]);
  });

  it('deduplicates catalog words and excludes inactive or non-commercial items', () => {
    expect(catalogOfferTermOptions([
      baseItem,
      { ...baseItem, id: 'product-2', name: 'Outro produto', material: ' BORRACHA   NITRILICA ', keywords: ['Gaxeta', ''], applications: [] },
      { ...baseItem, id: 'draft', status: 'draft', material: 'silicone' },
      { ...baseItem, id: 'document', type: 'document', material: 'poliuretano' },
    ]).map((option) => option.term)).toEqual([
      'borracha nitrílica', 'gaxeta', 'Vedação técnica', 'Fabricantes de máquinas alimentícias', 'Manutenção industrial', 'Outro produto',
    ]);
  });

  it('connects every selected offer word to the unchanged buyer profile and segments', () => {
    expect(composeCatalogBuyerSearchTerms({
      offerTerms: ['EPDM', 'borracha nitrílica'],
      targetProfile: 'potential_customers',
      selectedSegments: ['Mineração', 'Automotivo'],
    })).toEqual([
      'empresas que utilizam EPDM no setor Mineração',
      'empresas que utilizam borracha nitrílica no setor Mineração',
      'empresas que utilizam EPDM no setor Automotivo',
      'empresas que utilizam borracha nitrílica no setor Automotivo',
    ]);

    expect(composeCatalogBuyerSearchTerms({
      offerTerms: ['EPDM', 'silicone'],
      targetProfile: 'distributors',
      selectedSegments: [],
    })).toEqual(['distribuidores industriais EPDM', 'distribuidores industriais silicone']);
  });

  it('adds explicit buyer intent for potential customers without a segment', () => {
    expect(composeCatalogBuyerSearchTerms({
      offerTerms: ['EPDM'],
      targetProfile: 'potential_customers',
      selectedSegments: [],
    })).toEqual(['empresas que utilizam EPDM']);
  });

  it('covers every selected word before adding segment variations and caps the provider queries', () => {
    const result = composeCatalogBuyerSearchTerms({
      offerTerms: ['Material 1', 'Material 2', 'Material 3', 'Material 4'],
      targetProfile: 'resellers',
      selectedSegments: ['Setor 1', 'Setor 2', 'Setor 3'],
    });
    expect(result).toHaveLength(10);
    expect(result[0]).toBe('revendedores industriais Material 1 Setor 1');
    expect(result.slice(0, 4)).toEqual([
      'revendedores industriais Material 1 Setor 1',
      'revendedores industriais Material 2 Setor 1',
      'revendedores industriais Material 3 Setor 1',
      'revendedores industriais Material 4 Setor 1',
    ]);
    for (const offerTerm of ['Material 1', 'Material 2', 'Material 3', 'Material 4']) {
      expect(result.some((query) => query.includes(offerTerm))).toBe(true);
    }
  });

  it('keeps the reviewed query within the same eighty-character limit enforced by the provider contract', () => {
    const [query] = composeCatalogBuyerSearchTerms({
      offerTerms: [`Material ${'x'.repeat(100)}`],
      targetProfile: 'suppliers',
      selectedSegments: ['Indústria de equipamentos pesados'],
    });
    expect(query).toHaveLength(80);
    expect(query).toMatch(/^fornecedores industriais Material x+/);
  });

  it('preserves every selected offer word when a buyer segment is longer than the provider limit', () => {
    const result = composeCatalogBuyerSearchTerms({
      offerTerms: ['EPDM', 'silicone'],
      targetProfile: 'potential_customers',
      selectedSegments: [`Indústria ${'x'.repeat(100)}`],
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('EPDM');
    expect(result[1]).toContain('silicone');
    expect(result.every((query) => query.length <= 80)).toBe(true);
  });

  it('prioritizes selected buyer segments, then active product applications, with traceable origins', () => {
    expect(suggestBuyerSearchTerms({
      items: [baseItem],
      selectedSegments: ['Mineração'],
    })).toEqual([
      { term: 'Mineração', origin: 'selected_segment', rationale: 'Segmento selecionado pelo usuário.' },
      { term: 'Fabricantes de máquinas alimentícias', origin: 'catalog_application', itemId: 'product-1', rationale: 'Aplicação cadastrada em Vedação técnica.' },
      { term: 'Manutenção industrial', origin: 'catalog_application', itemId: 'product-1', rationale: 'Aplicação cadastrada em Vedação técnica.' },
    ]);
  });

  it('ignores inactive and unrelated catalog entries instead of searching product or material names', () => {
    expect(suggestBuyerSearchTerms({
      items: [
        { ...baseItem, applications: [] },
        { ...baseItem, id: 'product-2', status: 'draft', applications: ['Clínicas'] },
        { ...baseItem, id: 'product-3', type: 'document', applications: ['Escolas'] },
      ],
      selectedSegments: [],
    })).toEqual([]);
  });

  it('deduplicates accents and whitespace and caps suggestions at ten', () => {
    const result = suggestBuyerSearchTerms({
      items: [{ ...baseItem, applications: [
        '  Manutenção   industrial ', 'manutencao industrial',
        'Setor 1', 'Setor 2', 'Setor 3', 'Setor 4', 'Setor 5', 'Setor 6', 'Setor 7', 'Setor 8', 'Setor 9', 'Setor 10',
      ] }],
      selectedSegments: ['  Mineração  ', 'mineracao'],
    });
    expect(result).toHaveLength(10);
    expect(result.map((entry) => entry.term)).toEqual([
      'Mineração', 'Manutenção industrial', 'Setor 1', 'Setor 2', 'Setor 3', 'Setor 4', 'Setor 5', 'Setor 6', 'Setor 7', 'Setor 8',
    ]);
  });
});
