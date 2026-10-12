import type { ProspectingTargetProfile } from './prospectingIdealProfile';

export interface ProspectingQuickProcess {
  id: string;
  label: string;
  description: string;
  group: 'materials' | 'applications';
  terms: [string];
  offer: string;
  customerSegments: string[];
  targetProfile: ProspectingTargetProfile;
  volume: number;
  requireSite: boolean;
  requireWhatsApp: boolean;
  requireEmail: boolean;
}

const defaultCriteria = {
  targetProfile: 'potential_customers' as const,
  volume: 10,
  requireSite: true,
  requireWhatsApp: false,
  requireEmail: false,
};

export const PROSPECTING_QUICK_PROCESSES: ProspectingQuickProcess[] = [
  { id: 'rubber-products', label: 'Artefatos de borracha', description: 'Empresas com artefatos e aplicações industriais em borracha.', group: 'materials', terms: ['artefatos de borracha'], offer: 'Peças e soluções em borracha, silicone e poliuretano', customerSegments: [], ...defaultCriteria },
  { id: 'rubber-profiles', label: 'Perfis de borracha', description: 'Empresas que trabalham com perfis e guarnições de borracha.', group: 'materials', terms: ['perfis de borracha'], offer: 'Peças e soluções em borracha, silicone e poliuretano', customerSegments: [], ...defaultCriteria },
  { id: 'silicone-components', label: 'Componentes de silicone', description: 'Perfis e componentes técnicos em silicone.', group: 'materials', terms: ['perfis de silicone'], offer: 'Peças e soluções em borracha, silicone e poliuretano', customerSegments: [], ...defaultCriteria },
  { id: 'polyurethane-components', label: 'Componentes de poliuretano', description: 'Peças industriais sujeitas a abrasão, impacto ou desgaste.', group: 'materials', terms: ['peças em poliuretano'], offer: 'Peças e soluções em borracha, silicone e poliuretano', customerSegments: [], ...defaultCriteria },
  { id: 'industrial-sealing', label: 'Vedação industrial', description: 'Empresas ligadas a juntas, gaxetas e soluções de vedação.', group: 'materials', terms: ['vedação industrial'], offer: 'Peças e soluções em borracha, silicone e poliuretano', customerSegments: [], ...defaultCriteria },
  { id: 'industrial-maintenance', label: 'Manutenção industrial', description: 'Empresas de manutenção, reposição e MRO industrial.', group: 'materials', terms: ['manutenção industrial'], offer: 'Peças e soluções em borracha, silicone e poliuretano', customerSegments: [], ...defaultCriteria },
  { id: 'automotive-applications', label: 'Aplicações automotivas', description: 'Empresas do setor automotivo para revisar como potenciais usuárias.', group: 'applications', terms: ['indústria automotiva'], offer: 'Componentes técnicos para aplicações automotivas', customerSegments: ['Automotivo'], ...defaultCriteria },
  { id: 'food-and-beverage-applications', label: 'Alimentos e bebidas', description: 'Empresas do setor para revisar aplicações e necessidades técnicas.', group: 'applications', terms: ['indústria alimentícia'], offer: 'Componentes técnicos para processos de alimentos e bebidas', customerSegments: ['Alimentos e bebidas'], ...defaultCriteria },
  { id: 'machinery-applications', label: 'Máquinas e equipamentos', description: 'Fabricantes e integradores de máquinas para revisão comercial.', group: 'applications', terms: ['máquinas e equipamentos'], offer: 'Componentes técnicos para máquinas e equipamentos', customerSegments: ['Máquinas e equipamentos'], ...defaultCriteria },
  { id: 'mining-applications', label: 'Mineração', description: 'Empresas de mineração para revisar aplicações de alta abrasão.', group: 'applications', terms: ['mineração'], offer: 'Componentes técnicos para mineração', customerSegments: ['Mineração'], ...defaultCriteria },
  { id: 'construction-applications', label: 'Construção industrial', description: 'Empresas de pré-moldados e construção industrializada.', group: 'applications', terms: ['construção pré-moldada'], offer: 'Componentes técnicos para construção industrial', customerSegments: ['Construção'], ...defaultCriteria },
  { id: 'industrial-refrigeration', label: 'Refrigeração industrial', description: 'Empresas para revisar aplicações térmicas e de vedação.', group: 'applications', terms: ['refrigeração industrial'], offer: 'Componentes técnicos para refrigeração industrial', customerSegments: [], ...defaultCriteria },
  { id: 'renewable-energy', label: 'Energia renovável', description: 'Empresas do setor para revisar possíveis aplicações técnicas.', group: 'applications', terms: ['energia renovável'], offer: 'Componentes técnicos para energia renovável', customerSegments: [], ...defaultCriteria },
];

export function getProspectingQuickProcess(id: string): ProspectingQuickProcess | null {
  return PROSPECTING_QUICK_PROCESSES.find((process) => process.id === id) || null;
}
