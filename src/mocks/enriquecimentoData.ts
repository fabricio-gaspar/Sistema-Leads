// Dados de enriquecimento e qualificação dos leads encontrados na Busca de Leads.
// Representam o que a Ana faz entre "lead bruto encontrado" e "pronto para abordar":
// temperatura (quente/morno/frio), grau de completude do contato, motivos do match,
// canais detectados, eficiência por fonte e alertas de novos leads.

export interface PreviewLead {
  id: string;
  nome: string;
  empresa: string;
  cnpj: string;
  cargo: string;
  telefone: string;
  whatsapp?: string;
  email: string;
  localidade: string;
  cidade?: string;
  estado?: string;
  segmento?: string;
  porte?: string;
  fonte: string;
  validacao: 'ok' | 'revisar';
  duplicado: boolean;
  score: number;
  fitScore?: number;
  contactabilityScore?: number;
  engagementScore?: number;
  scoreExplanation?: string;
  temperatura: 'Quente' | 'Morno' | 'Frio';
  completude: number;
  motivos: string[];
  canais: { whatsapp: boolean; email: boolean; site: boolean; instagram: boolean };
  whatsappStatus?: 'verified' | 'unverified' | 'absent';
  sourceRecordId?: string;
  sourceUrl?: string;
  selecionado: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export const leadsPreviewInicial: PreviewLead[] = [
  {
    id: 'pr-1',
    nome: 'André Silva',
    empresa: 'TechNova Ltda',
    cnpj: '12.345.678/0001-90',
    cargo: 'Diretor',
    telefone: '(11) 91234-5678',
    email: 'andre@technova.com',
    localidade: 'São Paulo - SP',
    fonte: 'Receita Federal',
    validacao: 'ok',
    duplicado: false,
    score: 82,
    temperatura: 'Quente',
    completude: 88,
    motivos: ['Segmento: Tecnologia', 'Tem site próprio', 'Decisor identificado (Diretor)'],
    canais: { whatsapp: true, email: true, site: true, instagram: false },
    selecionado: true,
  },
  {
    id: 'pr-2',
    nome: 'Bianca Rocha',
    empresa: 'Rocha Digital',
    cnpj: '23.456.789/0001-01',
    cargo: 'CEO',
    telefone: '(21) 92345-6789',
    email: 'bianca@rochadigital.com',
    localidade: 'Rio de Janeiro - RJ',
    fonte: 'Google Places',
    validacao: 'ok',
    duplicado: false,
    score: 75,
    temperatura: 'Morno',
    completude: 75,
    motivos: ['Segmento: Marketing e Publicidade', 'Contato direto do CEO', 'Avaliação alta no Google'],
    canais: { whatsapp: true, email: true, site: true, instagram: true },
    selecionado: true,
  },
  {
    id: 'pr-3',
    nome: 'Carlos Menezes',
    empresa: 'Menezes Corp',
    cnpj: '34.567.890/0001-12',
    cargo: 'Gerente',
    telefone: '(31) 93456-7890',
    email: 'carlos@menezescorp.com',
    localidade: 'Belo Horizonte - MG',
    fonte: 'Receita Federal',
    validacao: 'ok',
    duplicado: true,
    score: 60,
    temperatura: 'Frio',
    completude: 60,
    motivos: ['Segmento: Tecnologia', 'Já existe no funil (duplicado)'],
    canais: { whatsapp: true, email: true, site: false, instagram: false },
    selecionado: false,
  },
  {
    id: 'pr-4',
    nome: 'Daniela Souza',
    empresa: 'Souza Marketing',
    cnpj: '45.678.901/0001-23',
    cargo: 'Proprietário',
    telefone: '(41) 94567-8901',
    email: 'daniela@souza-marketing',
    localidade: 'Curitiba - PR',
    fonte: 'Apify — Google Maps',
    validacao: 'revisar',
    duplicado: false,
    score: 68,
    temperatura: 'Morno',
    completude: 45,
    motivos: ['Segmento: Marketing', 'E-mail a validar', 'Presente no Google Maps'],
    canais: { whatsapp: true, email: false, site: true, instagram: false },
    selecionado: true,
  },
  {
    id: 'pr-5',
    nome: 'Eduardo Lima',
    empresa: 'Lima Soluções',
    cnpj: '56.789.012/0001-34',
    cargo: 'Diretor',
    telefone: '(51) 95678-9012',
    email: 'eduardo@limasolucoes.com',
    localidade: 'Porto Alegre - RS',
    fonte: 'Receita Federal',
    validacao: 'ok',
    duplicado: false,
    score: 91,
    temperatura: 'Quente',
    completude: 95,
    motivos: ['Segmento: Tecnologia', 'Decisor identificado (Diretor)', 'Tem WhatsApp ativo'],
    canais: { whatsapp: true, email: true, site: true, instagram: true },
    selecionado: true,
  },
  {
    id: 'pr-6',
    nome: 'Fernanda Alves',
    empresa: 'Alves Tech',
    cnpj: '67.890.123/0001-45',
    cargo: 'CEO',
    telefone: '(71) 96789-0123',
    email: 'fernanda@alvestech.com',
    localidade: 'Salvador - BA',
    fonte: 'Google Places',
    validacao: 'ok',
    duplicado: false,
    score: 78,
    temperatura: 'Morno',
    completude: 80,
    motivos: ['Segmento: Tecnologia', 'CEO identificado', 'Tem site e Instagram'],
    canais: { whatsapp: true, email: true, site: true, instagram: true },
    selecionado: true,
  },
];

// Converte o score numérico em temperatura de qualificação.
export const temperaturaDe = (score: number): 'Quente' | 'Morno' | 'Frio' =>
  score >= 80 ? 'Quente' : score >= 65 ? 'Morno' : 'Frio';

export const tempLabel: Record<string, string> = {
  Quente: 'Quente',
  Morno: 'Morno',
  Frio: 'Frio',
};

export const tempBadge: Record<string, string> = {
  Quente: 'bg-accent-100 text-accent-700',
  Morno: 'bg-primary-100 text-primary-700',
  Frio: 'bg-background-200 text-foreground-500',
};

export const tempCorTexto: Record<string, string> = {
  Quente: 'text-accent-500',
  Morno: 'text-accent-600',
  Frio: 'text-foreground-400',
};

// Eficiência de cada fonte: quantos dos leads importados foram qualificados (score >= 65).
export const eficienciaFonte = [
  { fonte: 'Google Places', importados: 856, qualificados: 385, custo: 'Médio' },
  { fonte: 'Receita Federal', importados: 1240, qualificados: 412, custo: 'Baixo' },
  { fonte: 'Apify — Google Maps', importados: 432, qualificados: 230, custo: 'Médio' },
  { fonte: 'Importação CSV', importados: 320, qualificados: 96, custo: 'Baixo' },
  { fonte: 'Pesquisa assistida por IA', importados: 0, qualificados: 0, custo: '—' },
];

// Alertas de novos leads que a Ana gera ao detectar contatos que batem com o ICP.
export const alertasLeads = [
  { id: 'al-1', tipo: 'icp', titulo: '5 novos leads batem com seu ICP prioritário', tempo: 'há 2 min' },
  { id: 'al-2', tipo: 'quente', titulo: '3 leads qualificados como Quentes prontos para abordagem', tempo: 'há 18 min' },
  { id: 'al-3', tipo: 'fonte', titulo: 'Google Places terminou a sincronização: 120 novos contatos', tempo: 'há 1h' },
];
