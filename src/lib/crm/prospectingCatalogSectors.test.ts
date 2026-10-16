import { describe, expect, it } from 'vitest';
import { extractCatalogBuyerSectors, type CatalogBuyerSectorItem, type CatalogBuyerSectorSource } from './prospectingCatalogSectors';

const source: CatalogBuyerSectorSource = { id: 'source-1', name: 'Segmentos da empresa', enabled: true };
const segment: CatalogBuyerSectorItem = {
  id: 'segment-1', sourceId: source.id, type: 'service', status: 'active',
  category: 'Segmento de atuação', name: 'Mineração',
};

describe('catalog buyer sectors', () => {
  it('exposes only active sector services from enabled sources with their provenance', () => {
    expect(extractCatalogBuyerSectors({
      sources: [source, { id: 'source-2', name: 'Fonte pausada', enabled: false }],
      items: [
        segment,
        { ...segment, id: 'segment-2', name: 'Naval', status: 'draft' },
        { ...segment, id: 'segment-3', name: 'Automotivo', sourceId: 'source-2' },
        { ...segment, id: 'segment-4', name: 'Construção', type: 'product' },
        { ...segment, id: 'segment-5', name: 'Refrigeração', category: 'Produto' },
        { ...segment, id: 'segment-6', name: 'Multiuso' },
      ],
    })).toEqual([{ itemId: 'segment-1', sourceId: 'source-1', sourceName: 'Segmentos da empresa', label: 'Mineração' }]);
  });

  it('deduplicates equivalent sector names while preserving the first catalog trace', () => {
    expect(extractCatalogBuyerSectors({
      sources: [source],
      items: [
        { ...segment, name: '  Máquinas   e Equipamentos  ' },
        { ...segment, id: 'segment-2', name: 'maquinas e equipamentos' },
        { ...segment, id: 'segment-3', name: ' Naval ' },
        { ...segment, id: 'segment-4', name: ' multiuso ' },
      ],
    })).toEqual([
      { itemId: 'segment-1', sourceId: 'source-1', sourceName: 'Segmentos da empresa', label: 'Máquinas e Equipamentos' },
      { itemId: 'segment-3', sourceId: 'source-1', sourceName: 'Segmentos da empresa', label: 'Naval' },
    ]);
  });

  it('does not infer buyer sectors from a product name or its applications', () => {
    expect(extractCatalogBuyerSectors({
      sources: [source],
      items: [{ ...segment, type: 'product', name: 'Vedação para mineração' }],
    })).toEqual([]);
  });
});
