import { describe, expect, it } from 'vitest';
import { suggestBuyerSearchTerms, type BuyerTermCatalogItem } from './prospectingBuyerTerms';

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
