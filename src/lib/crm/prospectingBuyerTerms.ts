import type { KnowledgeCatalogItem } from './catalogKnowledgeRepository';
import { MAX_PROSPECTING_TERMS } from './prospectingUi';
import { PROSPECTING_TARGET_PROFILES, type ProspectingTargetProfile } from './prospectingIdealProfile';

export type BuyerTermCatalogItem = Pick<KnowledgeCatalogItem,
  'id' | 'name' | 'status' | 'type' | 'applications' | 'category' | 'keywords' | 'material'>;

export interface BuyerSearchTermSuggestion {
  term: string;
  origin: 'selected_segment' | 'catalog_application';
  itemId?: string;
  rationale: string;
}

export interface CatalogOfferTermOption {
  term: string;
  origin: 'material' | 'keyword' | 'name' | 'application';
  itemId: string;
  itemName: string;
}

function normalizedKey(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

export function catalogOfferTermOptions(items: readonly BuyerTermCatalogItem[]): CatalogOfferTermOption[] {
  const options: CatalogOfferTermOption[] = [];
  const seen = new Set<string>();

  const add = (value: string | null | undefined, origin: CatalogOfferTermOption['origin'], item: BuyerTermCatalogItem) => {
    const term = value?.trim().replace(/\s+/g, ' ') || '';
    const key = normalizedKey(term);
    if (!key || term.length > 120 || seen.has(key)) return;
    seen.add(key);
    options.push({ term, origin, itemId: item.id, itemName: item.name.trim() });
  };

  for (const item of items) {
    if (item.status !== 'active' || (item.type !== 'product' && item.type !== 'service')) continue;
    add(item.material, 'material', item);
    item.keywords.forEach((keyword) => add(keyword, 'keyword', item));
    add(item.name, 'name', item);
    item.applications.forEach((application) => add(application, 'application', item));
  }

  return options;
}

export function composeCatalogBuyerSearchTerms(input: {
  offerTerms: readonly string[];
  targetProfile: ProspectingTargetProfile;
  selectedSegments: readonly string[];
}): string[] {
  const profile = PROSPECTING_TARGET_PROFILES.find((candidate) => candidate.id === input.targetProfile);
  const profileTerm = profile?.searchTerm || '';
  const segments = input.selectedSegments.map((segment) => segment.trim()).filter(Boolean);
  const contexts = segments.length ? segments : [''];
  const offerTerms = input.offerTerms.map((offerTerm) => offerTerm.trim()).filter(Boolean);
  const queries = contexts.flatMap((segment) => offerTerms.map((term) => {
    if (input.targetProfile === 'potential_customers') {
      return [`empresas que utilizam ${term}`, segment ? `no setor ${segment}` : ''].filter(Boolean).join(' ');
    }
    return [profileTerm, term, segment].filter(Boolean).join(' ');
  }));

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of queries) {
    const term = value.trim().replace(/\s+/g, ' ').slice(0, 80).trimEnd();
    const key = normalizedKey(term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(term);
    if (normalized.length === MAX_PROSPECTING_TERMS) break;
  }
  return normalized;
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
