import { normalizeProspectingTerms } from './prospectingUi';
import { findProspectingTermSuggestions } from './prospectingTermSuggestions';

export const PROSPECTING_TARGET_PROFILES = [
  { id: 'potential_customers', label: 'Clientes potenciais', searchTerm: '' },
  { id: 'distributors', label: 'Distribuidores', searchTerm: 'distribuidores industriais' },
  { id: 'resellers', label: 'Revendedores', searchTerm: 'revendedores industriais' },
  { id: 'suppliers', label: 'Fornecedores', searchTerm: 'fornecedores industriais' },
] as const;

export type ProspectingTargetProfile = typeof PROSPECTING_TARGET_PROFILES[number]['id'];

export const PROSPECTING_CUSTOMER_SEGMENTS = [
  'Automotivo',
  'Alimentos e bebidas',
  'Máquinas e equipamentos',
  'Construção',
  'Mineração',
] as const;

/**
 * Combina somente dados que o operador informou com termos curados já
 * publicados no catálogo Wayflex. Não chama IA nem um provedor externo.
 */
export function termsFromIdealProfile(
  offering: string,
  targetProfile: ProspectingTargetProfile,
  customerSegments: string[],
): string[] {
  const profile = PROSPECTING_TARGET_PROFILES.find((item) => item.id === targetProfile);
  const catalogueTerms = findProspectingTermSuggestions(offering).flatMap((group) => group.terms);
  return normalizeProspectingTerms([
    ...customerSegments,
    profile?.searchTerm || '',
    ...catalogueTerms,
  ]);
}
