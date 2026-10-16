import type { KnowledgeCatalogItem, KnowledgeSource } from './catalogKnowledgeRepository';

export type CatalogBuyerSectorItem = Pick<KnowledgeCatalogItem, 'id' | 'sourceId' | 'type' | 'status' | 'category' | 'name'>;
export type CatalogBuyerSectorSource = Pick<KnowledgeSource, 'id' | 'name' | 'enabled'>;

export interface CatalogBuyerSectorOption {
  itemId: string;
  sourceId: string;
  sourceName: string;
  label: string;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

export function extractCatalogBuyerSectors(input: {
  items: readonly CatalogBuyerSectorItem[];
  sources: readonly CatalogBuyerSectorSource[];
}): CatalogBuyerSectorOption[] {
  const enabledSources = new Map(input.sources.filter((source) => source.enabled).map((source) => [source.id, source]));
  const seen = new Set<string>();
  const sectors: CatalogBuyerSectorOption[] = [];

  for (const item of input.items) {
    const source = enabledSources.get(item.sourceId);
    if (!source || item.type !== 'service' || item.status !== 'active' || normalize(item.category ?? '') !== 'segmento de atuacao') continue;
    const label = item.name.trim().replace(/\s+/g, ' ');
    const key = normalize(label);
    if (!key || key === 'multiuso' || seen.has(key)) continue;
    seen.add(key);
    sectors.push({ itemId: item.id, sourceId: source.id, sourceName: source.name, label });
  }

  return sectors;
}
