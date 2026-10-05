/** One policy contract for the settings UI, Ana and dispatch. No pricing authority. */
export interface CommercialCatalogPolicy {
  catalogEnabled: boolean; productsForAna: boolean; servicesForAna: boolean; draftEnabled: boolean;
  automaticSendEnabled: boolean; approvedPriceTable: boolean; discountApprovalRequired: boolean;
  includeValidityAndConditions: boolean; defaultTemplateId: string | null; updatedAt: string | null;
}
export const defaultCommercialCatalogPolicy: CommercialCatalogPolicy = {
  catalogEnabled: true, productsForAna: true, servicesForAna: true, draftEnabled: true,
  automaticSendEnabled: false, approvedPriceTable: true, discountApprovalRequired: true,
  includeValidityAndConditions: true, defaultTemplateId: null, updatedAt: null,
};
export function normalizeCommercialCatalogPolicy(value: unknown): CommercialCatalogPolicy {
  const candidate = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const flag = (key: 'catalogEnabled' | 'productsForAna' | 'servicesForAna' | 'draftEnabled') => candidate[key] === undefined ? defaultCommercialCatalogPolicy[key] : candidate[key] === true;
  return {
    catalogEnabled: flag('catalogEnabled'), productsForAna: flag('productsForAna'), servicesForAna: flag('servicesForAna'), draftEnabled: flag('draftEnabled'),
    // These are mandatory safeguards, not configurable permissions or evidence of approval.
    automaticSendEnabled: false, approvedPriceTable: true, discountApprovalRequired: true, includeValidityAndConditions: true,
    defaultTemplateId: typeof candidate.defaultTemplateId === 'string' ? candidate.defaultTemplateId : null,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : null,
  };
}
export type KnowledgeUsage = Record<'profile' | 'business' | 'products' | 'services' | 'catalogs' | 'documents' | 'sources', boolean>;
export function knowledgeUsage(value: unknown): KnowledgeUsage {
  const settings = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const usage = settings.knowledge_usage && typeof settings.knowledge_usage === 'object' ? settings.knowledge_usage as Record<string, unknown> : {};
  return Object.fromEntries(['profile', 'business', 'products', 'services', 'catalogs', 'documents', 'sources'].map((key) => [key, usage[key] === undefined || usage[key] === true])) as KnowledgeUsage;
}
export function catalogTypeAllowed(type: unknown, usage: KnowledgeUsage, policy: CommercialCatalogPolicy): boolean {
  if (!policy.catalogEnabled) return false;
  if (type === 'product') return policy.productsForAna && usage.products;
  if (type === 'service') return policy.servicesForAna && usage.services;
  if (type === 'catalog') return usage.catalogs;
  if (type === 'document') return usage.documents;
  return false;
}
