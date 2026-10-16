import { normalizeProspectingTerms } from './prospectingUi';

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
 * Só usa categorias de compradores escolhidas pelo operador. O nome do
 * produto/material pode atrair fornecedores concorrentes, não compradores.
 */
export function termsFromIdealProfile(
  _offering: string,
  targetProfile: ProspectingTargetProfile,
  customerSegments: string[],
): string[] {
  const profile = PROSPECTING_TARGET_PROFILES.find((item) => item.id === targetProfile);
  return normalizeProspectingTerms([
    ...customerSegments,
    profile?.searchTerm || '',
  ]);
}
