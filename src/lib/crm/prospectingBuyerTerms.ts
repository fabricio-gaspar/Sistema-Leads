import type { KnowledgeCatalogItem } from './catalogKnowledgeRepository';
import { MAX_PROSPECTING_TERMS } from './prospectingUi';

export type BuyerTermCatalogItem = Pick<KnowledgeCatalogItem,
  'id' | 'name' | 'status' | 'type' | 'applications' | 'category' | 'keywords' | 'material'>;

export interface BuyerSearchTermSuggestion {
  term: string;
  origin: 'selected_segment' | 'catalog_application';
  itemId?: string;
  rationale: string;
}

function normalizedKey(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

export function suggestBuyerSearchTerms(input: {
  items: readonly BuyerTermCatalogItem[];
  selectedSegments: readonly string[];
}): BuyerSearchTermSuggestion[] {
  const suggestions: BuyerSearchTermSuggestion[] = [];
  const seen = new Set<string>();

  const add = (value: string, origin: BuyerSearchTermSuggestion['origin'], item?: BuyerTermCatalogItem) => {
    const term = value.trim().replace(/\s+/g, ' ');
    if (!term || term.length > 120) return;
    const key = normalizedKey(term);
    if (seen.has(key) || suggestions.length >= MAX_PROSPECTING_TERMS) return;
    seen.add(key);
    suggestions.push(origin === 'selected_segment'
      ? { term, origin, rationale: 'Segmento selecionado pelo usuário.' }
      : { term, origin, itemId: item!.id, rationale: `Aplicação cadastrada em ${item!.name.trim()}.` });
  };

  input.selectedSegments.forEach((segment) => add(segment, 'selected_segment'));
  for (const item of input.items) {
    if (item.status !== 'active' || (item.type !== 'product' && item.type !== 'service')) continue;
    item.applications.forEach((application) => add(application, 'catalog_application', item));
    if (suggestions.length >= MAX_PROSPECTING_TERMS) break;
  }
  return suggestions;
}
