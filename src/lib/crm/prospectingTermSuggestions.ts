export interface ProspectingTermSuggestionGroup {
  id: string;
  label: string;
  description: string;
  aliases: string[];
  terms: string[];
}

export const PROSPECTING_TERM_SUGGESTION_GROUPS: ProspectingTermSuggestionGroup[] = [
  {
    id: 'borracha',
    label: 'Borracha',
    description: 'Produtos, peças e aplicações industriais em borracha.',
    aliases: ['borracha', 'elastomero', 'elastômero', 'epdm', 'nitrilica', 'nitrílica', 'neoprene'],
    terms: [
      'artefatos de borracha',
      'perfis de borracha',
      'guarnições de borracha',
      'lençóis de borracha',
      'mangueiras de borracha',
      'juntas de borracha',
    ],
  },
  {
    id: 'silicone',
    label: 'Silicone',
    description: 'Perfis, peças e vedações técnicas em silicone.',
    aliases: ['silicone', 'silicones', 'silicone tecnico', 'silicone técnico'],
    terms: [
      'perfis de silicone',
      'vedação em silicone',
      'guarnições de silicone',
      'tubos de silicone',
      'silicone para forno industrial',
      'silicone para estufa industrial',
    ],
  },
  {
    id: 'poliuretano',
    label: 'Poliuretano',
    description: 'Componentes industriais em PU sujeitos a impacto ou abrasão.',
    aliases: ['poliuretano', 'pu', 'uretano'],
    terms: [
      'peças em poliuretano',
      'buchas de poliuretano',
      'placas de poliuretano',
      'raspadores de poliuretano',
      'revestimento em poliuretano',
      'rodas de poliuretano',
    ],
  },
  {
    id: 'vedacao',
    label: 'Vedação industrial',
    description: 'Soluções e componentes usados em vedação industrial.',
    aliases: ['vedacao', 'vedação', 'vedacoes', 'vedações', 'gaxeta', 'junta'],
    terms: [
      'vedação industrial',
      'juntas industriais',
      'gaxetas industriais',
      'anéis de vedação',
      'retentores industriais',
      'juntas de expansão',
    ],
  },
  {
    id: 'manutencao',
    label: 'Manutenção industrial',
    description: 'Itens de manutenção, transmissão e reposição industrial.',
    aliases: ['manutencao', 'manutenção', 'mro', 'reposicao', 'reposição', 'correia'],
    terms: [
      'manutenção industrial',
      'correias industriais',
      'acoplamentos industriais',
      'rolamentos industriais',
      'peças de reposição industrial',
      'mangueiras industriais',
    ],
  },
  {
    id: 'aplicacoes',
    label: 'Aplicações e mercados',
    description: 'Mercados com aplicações publicadas no catálogo Wayflex.',
    aliases: ['aplicacao', 'aplicação', 'mercado', 'segmento', 'industria', 'indústria'],
    terms: [
      'indústria automotiva',
      'indústria alimentícia',
      'mineração',
      'refrigeração industrial',
      'construção pré-moldada',
      'energia renovável',
    ],
  },
];

function normalizeSuggestionKey(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ');
}

export function findProspectingTermSuggestions(query: string): ProspectingTermSuggestionGroup[] {
  const keys = query
    .split(/[,;/]+/)
    .map(normalizeSuggestionKey)
    .filter(Boolean);
  if (!keys.length) return [];

  return PROSPECTING_TERM_SUGGESTION_GROUPS.filter((group) => {
    const candidates = [group.label, ...group.aliases].map(normalizeSuggestionKey);
    return keys.some((key) => candidates.some((candidate) => candidate.includes(key) || key.includes(candidate)));
  });
}
