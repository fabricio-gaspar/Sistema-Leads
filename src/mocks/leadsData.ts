import type { SlotHorario } from '@/lib/tipos';

// Passo de um fluxo pronto agendado num lead (WS8 → motor de automação).
export interface PassoFluxoProgramado {
  passoId: string;
  enviarEm: string;
  enviado: boolean;
}

export interface FluxoProgramado {
  fluxoId: string;
  gatilho: string;
  passos: PassoFluxoProgramado[];
}

export interface Lead {
  id: string;
  nome: string;
  empresa: string;
  cnpj: string;
  email: string;
  telefone: string;
  whatsapp: string;
  segmento: string;
  cidade: string;
  estado: string;
  porte: string;
  score: number;
  temperatura: 'Frio' | 'Morno' | 'Quente';
  etapa: string;
  origem: string;
  responsavel: string;
  tags: string[];
  cargo?: string;
  campanha?: string;
  ultimaInteracao: string;
  criadoEm: string;
  createdAt?: string;
  updatedAt?: string;
  // — Campos de fluxo comercial (backfill via normalizarLead) —
  modoAtendimento?: 'IA' | 'HUMANO';
  anaStage?: 'novo' | 'apresentado' | 'qualificando' | 'reuniao' | 'orcamento' | 'fechado';
  anaOutcome?: 'ganho' | 'perdido' | null;
  automacaoStatus?: 'ATIVA' | 'PAUSADA' | 'AGUARDANDO_HUMANO' | 'CONCLUIDA' | 'ERRO';
  responsavelId?: string;
  canalPreferencial?: string;
  templateId?: string;
  intencao?: string | null;
  sentimento?: 'POSITIVO' | 'NEUTRO' | 'NEGATIVO';
  confianca?: number;
  proximaAcao?: string | null;
  motivoTransferencia?: string;
  nextFollowUpAt?: string | null;
  timeoutAt?: string | null;
  followUpCount?: number;
  maxFollowUps?: number;
  automationEvents?: string[];
  historico?: { id: string; tipo: string; descricao: string; ator: string; data: string }[];
  bloqueado?: boolean;
  contatoPermitido?: boolean;
  consentimentoWhatsApp?: boolean;
  consentimentoEmail?: boolean;
  contactApprovalStatus?: 'pending' | 'approved' | 'rejected';
  contactApprovalReason?: string;
  contactApprovedAt?: string | null;
  sourceRecordId?: string;
  sourceUrl?: string;
  deduplicationKey?: string;
  fitScore?: number;
  contactabilityScore?: number;
  engagementScore?: number;
  scoreExplanation?: string;
  scoreVerifiedAt?: string | null;
  motivoPerda?: string;
  primeiroContatoEnviadoEm?: string | null;
  // — Lista de origem (Busca de Leads) e estado de aprovação —
  listaId?: string;
  aguardandoAtivacao?: boolean;
  // — Agendamento de reunião conduzido pela Ana —
  slotsOfertados?: SlotHorario[];
  aguardandoEscolhaHorario?: boolean;
  noShows?: number;
  // — Soft-delete: lead arquivado (não aparece no funil, mas é recuperável) —
  arquivado?: boolean;
  // — Fluxos prontos agendados neste lead (WS8 disparado pelo motor) —
  fluxosProgramados?: FluxoProgramado[];
  // — Limite de atendimento da Ana (handoff por etapa) —
  etapaHandoff?: string;
  handoffWhatsappAtivo?: boolean;
  // — Coleta de produtos para orçamento (a Ana pergunta, o humano prepara) —
  aguardandoProdutosOrcamento?: boolean;
}

export const etapasCRM = [
  'Novo',
  'Apresentado',
  'Qualificando',
  'Reunião',
  'Orçamento',
  'Ganho',
  'Perdido',
];

export const segmentos = [
  'Tecnologia',
  'Construção Civil',
  'Saúde',
  'Marketing e Publicidade',
  'Alimentação',
  'Varejo',
  'Indústria',
  'Educação',
  'Serviços Financeiros',
  'Logística',
  'Agronegócio',
  'Energia',
];

export const portes = ['MEI', 'Micro', 'Pequeno', 'Médio', 'Grande'];

export const leads: Lead[] = [
  {
    id: 'ld-1',
    nome: 'Carlos Mendes',
    empresa: 'Tech Solutions Ltda',
    cnpj: '12.345.678/0001-90',
    email: 'carlos@techsolutions.com.br',
    telefone: '(11) 3456-7890',
    whatsapp: '(11) 98765-4321',
    segmento: 'Tecnologia',
    cidade: 'São Paulo',
    estado: 'SP',
    porte: 'Médio',
    score: 92,
    temperatura: 'Quente',
    etapa: 'Em Qualificação',
    origem: 'Google Places',
    responsavel: 'Ana (IA)',
    tags: ['Decisor', 'Urgente'],
    ultimaInteracao: 'há 25 min',
    criadoEm: '2026-08-10',
  },
  {
    id: 'ld-2',
    nome: 'Ana Oliveira',
    empresa: 'Construtora Nova Era',
    cnpj: '23.456.789/0001-01',
    email: 'ana@novaera.com.br',
    telefone: '(31) 3456-7890',
    whatsapp: '(31) 98888-0000',
    segmento: 'Construção Civil',
    cidade: 'Belo Horizonte',
    estado: 'MG',
    porte: 'Grande',
    score: 78,
    temperatura: 'Morno',
    etapa: 'Em Contato',
    origem: 'CNPJ Público',
    responsavel: 'Ana (IA)',
    tags: ['Orçamento'],
    ultimaInteracao: 'há 2h',
    criadoEm: '2026-08-12',
  },
  {
    id: 'ld-3',
    nome: 'Roberto Alves',
    empresa: 'Farmácia Bem Estar',
    cnpj: '34.567.890/0001-12',
    email: 'roberto@bemestar.com.br',
    telefone: '(41) 3456-7890',
    whatsapp: '(41) 97777-1111',
    segmento: 'Saúde',
    cidade: 'Curitiba',
    estado: 'PR',
    porte: 'Pequeno',
    score: 85,
    temperatura: 'Quente',
    etapa: 'Orçamento Enviado',
    origem: 'Indicação',
    responsavel: 'João Vendedor',
    tags: ['Proposta enviada'],
    ultimaInteracao: 'há 5h',
    criadoEm: '2026-08-09',
  },
  {
    id: 'ld-4',
    nome: 'Juliana Costa',
    empresa: 'Agência Criativa',
    cnpj: '45.678.901/0001-23',
    email: 'juliana@agenciacriativa.com',
    telefone: '(21) 3456-7890',
    whatsapp: '(21) 96666-2222',
    segmento: 'Marketing e Publicidade',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    porte: 'Médio',
    score: 95,
    temperatura: 'Quente',
    etapa: 'Negociação',
    origem: 'LinkedIn',
    responsavel: 'Marina Sales',
    tags: ['Negociação', 'Desconto'],
    ultimaInteracao: 'há 1h',
    criadoEm: '2026-08-08',
  },
  {
    id: 'ld-5',
    nome: 'Marcos Vinícius',
    empresa: 'Restaurante Sabor & Arte',
    cnpj: '56.789.012/0001-34',
    email: 'marcos@saborarte.com.br',
    telefone: '(48) 3456-7890',
    whatsapp: '(48) 95555-3333',
    segmento: 'Alimentação',
    cidade: 'Florianópolis',
    estado: 'SC',
    porte: 'Micro',
    score: 70,
    temperatura: 'Morno',
    etapa: 'Em Contato',
    origem: 'Google Places',
    responsavel: 'Ana (IA)',
    tags: [],
    ultimaInteracao: 'há 3h',
    criadoEm: '2026-08-11',
  },
  {
    id: 'ld-6',
    nome: 'Patrícia Lima',
    empresa: 'Clínica Vida Saudável',
    cnpj: '67.890.123/0001-45',
    email: 'patricia@vidasaudavel.com.br',
    telefone: '(51) 3456-7890',
    whatsapp: '(51) 94444-4444',
    segmento: 'Saúde',
    cidade: 'Porto Alegre',
    estado: 'RS',
    porte: 'Pequeno',
    score: 88,
    temperatura: 'Quente',
    etapa: 'Proposta em Preparação',
    origem: 'Indicação',
    responsavel: 'Marina Sales',
    tags: ['Proposta enviada'],
    ultimaInteracao: 'há 6h',
    criadoEm: '2026-08-07',
  },
  {
    id: 'ld-7',
    nome: 'Eduardo Santos',
    empresa: 'LogiTrans Express',
    cnpj: '78.901.234/0001-56',
    email: 'eduardo@logitrans.com.br',
    telefone: '(19) 3456-7890',
    whatsapp: '(19) 93333-5555',
    segmento: 'Logística',
    cidade: 'Campinas',
    estado: 'SP',
    porte: 'Grande',
    score: 64,
    temperatura: 'Frio',
    etapa: 'Aguardando Resposta',
    origem: 'CSV Importado',
    responsavel: 'Ana (IA)',
    tags: ['Follow-up'],
    ultimaInteracao: 'há 1 dia',
    criadoEm: '2026-08-05',
  },
  {
    id: 'ld-8',
    nome: 'Fernando Gomes',
    empresa: 'Alpha Automação',
    cnpj: '89.012.345/0001-67',
    email: 'fernando@alphaautomacao.com',
    telefone: '(47) 3456-7890',
    whatsapp: '(47) 92222-6666',
    segmento: 'Indústria',
    cidade: 'Joinville',
    estado: 'SC',
    porte: 'Médio',
    score: 82,
    temperatura: 'Morno',
    etapa: 'Reunião Agendada',
    origem: 'Google Places',
    responsavel: 'João Vendedor',
    tags: ['Interesse alto'],
    ultimaInteracao: 'há 4h',
    criadoEm: '2026-08-06',
  },
  {
    id: 'ld-9',
    nome: 'Beatriz Rocha',
    empresa: 'Escola Horizonte',
    cnpj: '90.123.456/0001-78',
    email: 'beatriz@escolahorizonte.com.br',
    telefone: '(71) 3456-7890',
    whatsapp: '(71) 91111-7777',
    segmento: 'Educação',
    cidade: 'Salvador',
    estado: 'BA',
    porte: 'Pequeno',
    score: 58,
    temperatura: 'Frio',
    etapa: 'Novo',
    origem: 'CNPJ Público',
    responsavel: 'Ana (IA)',
    tags: [],
    ultimaInteracao: 'há 2 dias',
    criadoEm: '2026-08-03',
  },
  {
    id: 'ld-10',
    nome: 'Ricardo Nunes',
    empresa: 'AgroPlanta',
    cnpj: '11.234.567/0001-89',
    email: 'ricardo@agroplanta.com.br',
    telefone: '(62) 3456-7890',
    whatsapp: '(62) 99999-8888',
    segmento: 'Agronegócio',
    cidade: 'Goiânia',
    estado: 'GO',
    porte: 'Grande',
    score: 91,
    temperatura: 'Quente',
    etapa: 'Fechado — Ganho',
    origem: 'Indicação',
    responsavel: 'Marina Sales',
    tags: ['Cliente'],
    ultimaInteracao: 'há 1 dia',
    criadoEm: '2026-07-28',
  },
  {
    id: 'ld-11',
    nome: 'Camila Duarte',
    empresa: 'Varejo Top',
    cnpj: '22.345.678/0001-90',
    email: 'camila@varejotop.com.br',
    telefone: '(81) 3456-7890',
    whatsapp: '(81) 98888-9999',
    segmento: 'Varejo',
    cidade: 'Recife',
    estado: 'PE',
    porte: 'Médio',
    score: 74,
    temperatura: 'Morno',
    etapa: 'Negociação',
    origem: 'Google Places',
    responsavel: 'João Vendedor',
    tags: ['Negociação'],
    ultimaInteracao: 'há 3h',
    criadoEm: '2026-08-04',
  },
  {
    id: 'ld-12',
    nome: 'Sérgio Barros',
    empresa: 'FinanPrime',
    cnpj: '33.456.789/0001-01',
    email: 'sergio@finanprime.com.br',
    telefone: '(11) 3456-7890',
    whatsapp: '(11) 97777-0000',
    segmento: 'Serviços Financeiros',
    cidade: 'São Paulo',
    estado: 'SP',
    porte: 'Grande',
    score: 66,
    temperatura: 'Frio',
    etapa: 'Fechado — Perdido',
    origem: 'LinkedIn',
    responsavel: 'Ana (IA)',
    tags: ['Sem interesse'],
    ultimaInteracao: 'há 5 dias',
    criadoEm: '2026-07-30',
  },
  {
    id: 'ld-13',
    nome: 'Larissa Melo',
    empresa: 'Energia Solar Brasil',
    cnpj: '44.567.890/0001-12',
    email: 'larissa@energiasolar.com.br',
    telefone: '(31) 3456-7890',
    whatsapp: '(31) 96666-1111',
    segmento: 'Energia',
    cidade: 'Belo Horizonte',
    estado: 'MG',
    porte: 'Médio',
    score: 89,
    temperatura: 'Quente',
    etapa: 'Orçamento Enviado',
    origem: 'Indicação',
    responsavel: 'Marina Sales',
    tags: ['Pedido'],
    ultimaInteracao: 'há 2h',
    criadoEm: '2026-08-01',
  },
  {
    id: 'ld-14',
    nome: 'Diego Farias',
    empresa: 'Studio Arquitetura',
    cnpj: '55.678.901/0001-23',
    email: 'diego@studioarq.com.br',
    telefone: '(41) 3456-7890',
    whatsapp: '(41) 95555-2222',
    segmento: 'Construção Civil',
    cidade: 'Curitiba',
    estado: 'PR',
    porte: 'Micro',
    score: 71,
    temperatura: 'Morno',
    etapa: 'Novo',
    origem: 'Google Places',
    responsavel: 'Ana (IA)',
    tags: [],
    ultimaInteracao: 'há 1 dia',
    criadoEm: '2026-08-11',
  },
];

// Preenche os novos campos de fluxo comercial com defaults seguros,
// migrando leads já salvos no localStorage sem quebrar a renderização.
export function normalizarLead(l: Lead): Lead {
  const modo: 'IA' | 'HUMANO' = l.modoAtendimento ?? (l.responsavel === 'Ana (IA)' || !l.responsavel ? 'IA' : 'HUMANO');
  return {
    ...l,
    modoAtendimento: modo,
    automacaoStatus: l.automacaoStatus ?? 'ATIVA',
    responsavelId: l.responsavelId ?? '',
    canalPreferencial: l.canalPreferencial ?? 'WhatsApp',
    templateId: l.templateId ?? 'tm-1',
    intencao: l.intencao ?? null,
    sentimento: l.sentimento ?? 'NEUTRO',
    confianca: l.confianca ?? 100,
    proximaAcao: l.proximaAcao ?? null,
    motivoTransferencia: l.motivoTransferencia ?? '',
    nextFollowUpAt: l.nextFollowUpAt ?? null,
    timeoutAt: l.timeoutAt ?? null,
    followUpCount: l.followUpCount ?? 0,
    maxFollowUps: l.maxFollowUps ?? 2,
    automationEvents: l.automationEvents ?? [],
    historico: l.historico ?? [],
    bloqueado: l.bloqueado ?? false,
    contatoPermitido: l.contatoPermitido ?? true,
    consentimentoWhatsApp: l.consentimentoWhatsApp ?? true,
    consentimentoEmail: l.consentimentoEmail ?? true,
    motivoPerda: l.motivoPerda ?? '',
    primeiroContatoEnviadoEm: l.primeiroContatoEnviadoEm ?? null,
    slotsOfertados: l.slotsOfertados ?? [],
    aguardandoEscolhaHorario: l.aguardandoEscolhaHorario ?? false,
    noShows: l.noShows ?? 0,
    arquivado: l.arquivado ?? false,
    fluxosProgramados: l.fluxosProgramados ?? [],
    etapaHandoff: l.etapaHandoff ?? undefined,
    aguardandoProdutosOrcamento: l.aguardandoProdutosOrcamento ?? false,
  };
}
