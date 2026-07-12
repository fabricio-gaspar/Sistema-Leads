export type Temperature = "hot" | "warm" | "cold";
export type Stage =
  | "novo"
  | "contatado"
  | "qualificado"
  | "proposta"
  | "negociacao"
  | "fechado";

export const STAGES: { id: Stage; label: string }[] = [
  { id: "novo", label: "Novo" },
  { id: "contatado", label: "Contatado" },
  { id: "qualificado", label: "Qualificado" },
  { id: "proposta", label: "Proposta" },
  { id: "negociacao", label: "Negociação" },
  { id: "fechado", label: "Fechado" },
];

export type ChatMessage = {
  id: string;
  from: "ana" | "lead" | "vendedor";
  text: string;
  at: string;
};

export type TimelineEvent = {
  id: string;
  at: string;
  kind: "ana" | "humano" | "sistema" | "proposta";
  text: string;
};

export type Lead = {
  id: string;
  empresa: string;
  contato: string;
  cargo: string;
  telefone: string;
  email: string;
  cidade: string;
  segmento: string;
  valor: number;
  score: number;
  temperatura: Temperature;
  stage: Stage;
  responsavel: "Ana (IA)" | "Fabrício" | "Camila" | "Diego";
  ultimaInteracao: string;
  paradoHa: number; // dias
  origem: string;
  chat: ChatMessage[];
  timeline: TimelineEvent[];
  scoreBreakdown: { label: string; peso: number; nota: number }[];
};

const brl = (n: number) => n;

export const LEADS: Lead[] = [
  {
    id: "L-1042",
    empresa: "Metalúrgica São Jorge",
    contato: "Roberto Almeida",
    cargo: "Diretor de Compras",
    telefone: "+55 11 98811-4422",
    email: "roberto@saojorge.com.br",
    cidade: "São Bernardo do Campo/SP",
    segmento: "Metalurgia",
    valor: brl(84000),
    score: 92,
    temperatura: "hot",
    stage: "negociacao",
    responsavel: "Ana (IA)",
    ultimaInteracao: "há 12 min",
    paradoHa: 0,
    origem: "Prospecção Ana",
    chat: [
      { id: "m1", from: "ana", at: "09:12", text: "Bom dia, Roberto! Sou a Ana da WF Digital. Vi que vocês trabalham com estamparia — posso mostrar um caso parecido?" },
      { id: "m2", from: "lead", at: "09:20", text: "Bom dia. Pode mandar, sim." },
      { id: "m3", from: "ana", at: "09:21", text: "Ótimo! Nosso cliente Fixotec reduziu 22% no lead time. Faz sentido conversarmos?" },
      { id: "m4", from: "lead", at: "10:02", text: "Faz. Manda uma proposta pra 20 mil peças/mês." },
      { id: "m5", from: "ana", at: "10:03", text: "Perfeito. Envio ainda hoje. Prazo de entrega e forma de pagamento preferidos?" },
    ],
    timeline: [
      { id: "t1", at: "Hoje 09:12", kind: "ana", text: "Ana iniciou contato via WhatsApp" },
      { id: "t2", at: "Hoje 10:03", kind: "ana", text: "Lead solicitou proposta — Ana coletando requisitos" },
      { id: "t3", at: "Hoje 10:15", kind: "sistema", text: "Score subiu para 92 (hot)" },
    ],
    scoreBreakdown: [
      { label: "Fit de segmento", peso: 30, nota: 28 },
      { label: "Volume declarado", peso: 25, nota: 24 },
      { label: "Engajamento no chat", peso: 20, nota: 18 },
      { label: "Cargo do contato", peso: 15, nota: 14 },
      { label: "Região", peso: 10, nota: 8 },
    ],
  },
  {
    id: "L-1041",
    empresa: "Indústria Vitalux",
    contato: "Fernanda Rocha",
    cargo: "Gerente Industrial",
    telefone: "+55 47 99122-7788",
    email: "fernanda@vitalux.ind.br",
    cidade: "Joinville/SC",
    segmento: "Plásticos",
    valor: brl(56000),
    score: 78,
    temperatura: "warm",
    stage: "proposta",
    responsavel: "Ana (IA)",
    ultimaInteracao: "há 1h",
    paradoHa: 1,
    origem: "Site — formulário",
    chat: [
      { id: "m1", from: "lead", at: "Ontem", text: "Recebi indicação de vocês. Podem me passar detalhes?" },
      { id: "m2", from: "ana", at: "Ontem", text: "Claro, Fernanda! Vou te enviar um resumo e agendar 15 min esta semana." },
    ],
    timeline: [
      { id: "t1", at: "Ontem 14:00", kind: "sistema", text: "Lead capturado pelo site" },
      { id: "t2", at: "Ontem 14:02", kind: "ana", text: "Ana enviou primeira mensagem" },
      { id: "t3", at: "Hoje 08:40", kind: "proposta", text: "Proposta #ORC-882 enviada" },
    ],
    scoreBreakdown: [
      { label: "Fit de segmento", peso: 30, nota: 24 },
      { label: "Volume declarado", peso: 25, nota: 18 },
      { label: "Engajamento no chat", peso: 20, nota: 16 },
      { label: "Cargo do contato", peso: 15, nota: 12 },
      { label: "Região", peso: 10, nota: 8 },
    ],
  },
  {
    id: "L-1040",
    empresa: "TechFix Componentes",
    contato: "Alexandre Nunes",
    cargo: "Sócio",
    telefone: "+55 19 98004-3311",
    email: "alex@techfix.com.br",
    cidade: "Campinas/SP",
    segmento: "Eletrônicos",
    valor: brl(32500),
    score: 71,
    temperatura: "warm",
    stage: "qualificado",
    responsavel: "Camila",
    ultimaInteracao: "há 3h",
    paradoHa: 0,
    origem: "Indicação",
    chat: [],
    timeline: [
      { id: "t1", at: "Ontem", kind: "ana", text: "Ana qualificou e escalou para Camila" },
    ],
    scoreBreakdown: [
      { label: "Fit de segmento", peso: 30, nota: 22 },
      { label: "Volume declarado", peso: 25, nota: 16 },
      { label: "Engajamento no chat", peso: 20, nota: 15 },
      { label: "Cargo do contato", peso: 15, nota: 12 },
      { label: "Região", peso: 10, nota: 6 },
    ],
  },
  {
    id: "L-1039",
    empresa: "Alfa Alimentos",
    contato: "Juliana Prado",
    cargo: "Compradora",
    telefone: "+55 11 97744-2200",
    email: "juliana@alfaalimentos.com",
    cidade: "Guarulhos/SP",
    segmento: "Alimentício",
    valor: brl(18900),
    score: 55,
    temperatura: "cold",
    stage: "contatado",
    responsavel: "Ana (IA)",
    ultimaInteracao: "há 2 dias",
    paradoHa: 2,
    origem: "Prospecção Ana",
    chat: [],
    timeline: [
      { id: "t1", at: "2 dias atrás", kind: "ana", text: "Ana enviou apresentação" },
    ],
    scoreBreakdown: [
      { label: "Fit de segmento", peso: 30, nota: 18 },
      { label: "Volume declarado", peso: 25, nota: 10 },
      { label: "Engajamento no chat", peso: 20, nota: 10 },
      { label: "Cargo do contato", peso: 15, nota: 10 },
      { label: "Região", peso: 10, nota: 7 },
    ],
  },
  {
    id: "L-1038",
    empresa: "NorthTrade Importadora",
    contato: "Marcelo Beltrão",
    cargo: "Diretor Comercial",
    telefone: "+55 11 96622-1100",
    email: "marcelo@northtrade.com",
    cidade: "São Paulo/SP",
    segmento: "Distribuição",
    valor: brl(145000),
    score: 88,
    temperatura: "hot",
    stage: "proposta",
    responsavel: "Fabrício",
    ultimaInteracao: "há 40 min",
    paradoHa: 0,
    origem: "LinkedIn Ads",
    chat: [],
    timeline: [
      { id: "t1", at: "3 dias atrás", kind: "ana", text: "Ana qualificou e escalou para Fabrício" },
      { id: "t2", at: "Hoje", kind: "proposta", text: "Proposta #ORC-879 enviada" },
    ],
    scoreBreakdown: [
      { label: "Fit de segmento", peso: 30, nota: 27 },
      { label: "Volume declarado", peso: 25, nota: 24 },
      { label: "Engajamento no chat", peso: 20, nota: 16 },
      { label: "Cargo do contato", peso: 15, nota: 13 },
      { label: "Região", peso: 10, nota: 8 },
    ],
  },
  {
    id: "L-1037",
    empresa: "Grupo Ferronorte",
    contato: "Patrícia Lima",
    cargo: "Supervisora de Suprimentos",
    telefone: "+55 62 98800-7766",
    email: "patricia@ferronorte.com.br",
    cidade: "Goiânia/GO",
    segmento: "Construção",
    valor: brl(41000),
    score: 63,
    temperatura: "warm",
    stage: "novo",
    responsavel: "Ana (IA)",
    ultimaInteracao: "há 20 min",
    paradoHa: 0,
    origem: "Prospecção Ana",
    chat: [],
    timeline: [],
    scoreBreakdown: [
      { label: "Fit de segmento", peso: 30, nota: 20 },
      { label: "Volume declarado", peso: 25, nota: 14 },
      { label: "Engajamento no chat", peso: 20, nota: 12 },
      { label: "Cargo do contato", peso: 15, nota: 10 },
      { label: "Região", peso: 10, nota: 7 },
    ],
  },
  {
    id: "L-1036",
    empresa: "BioPharma Latam",
    contato: "Ricardo Sato",
    cargo: "Head de Compras",
    telefone: "+55 11 95522-9911",
    email: "ricardo@biopharma.com",
    cidade: "Barueri/SP",
    segmento: "Farmacêutico",
    valor: brl(210000),
    score: 95,
    temperatura: "hot",
    stage: "fechado",
    responsavel: "Fabrício",
    ultimaInteracao: "há 1 dia",
    paradoHa: 0,
    origem: "Indicação",
    chat: [],
    timeline: [
      { id: "t1", at: "1 semana atrás", kind: "ana", text: "Ana iniciou negociação" },
      { id: "t2", at: "Ontem", kind: "humano", text: "Fabrício fechou o pedido #PED-441" },
    ],
    scoreBreakdown: [
      { label: "Fit de segmento", peso: 30, nota: 30 },
      { label: "Volume declarado", peso: 25, nota: 25 },
      { label: "Engajamento no chat", peso: 20, nota: 18 },
      { label: "Cargo do contato", peso: 15, nota: 14 },
      { label: "Região", peso: 10, nota: 8 },
    ],
  },
  {
    id: "L-1035",
    empresa: "Móveis Aurora",
    contato: "Sandra Kim",
    cargo: "Compradora",
    telefone: "+55 51 98700-4433",
    email: "sandra@aurora.com.br",
    cidade: "Bento Gonçalves/RS",
    segmento: "Móveis",
    valor: brl(22000),
    score: 48,
    temperatura: "cold",
    stage: "contatado",
    responsavel: "Ana (IA)",
    ultimaInteracao: "há 5 dias",
    paradoHa: 5,
    origem: "Prospecção Ana",
    chat: [],
    timeline: [],
    scoreBreakdown: [
      { label: "Fit de segmento", peso: 30, nota: 15 },
      { label: "Volume declarado", peso: 25, nota: 10 },
      { label: "Engajamento no chat", peso: 20, nota: 8 },
      { label: "Cargo do contato", peso: 15, nota: 9 },
      { label: "Região", peso: 10, nota: 6 },
    ],
  },
  {
    id: "L-1034",
    empresa: "AutoParts Brasil",
    contato: "Eduardo Vaz",
    cargo: "Gerente de Compras",
    telefone: "+55 11 99911-0022",
    email: "eduardo@autoparts.com.br",
    cidade: "São Caetano do Sul/SP",
    segmento: "Automotivo",
    valor: brl(67500),
    score: 74,
    temperatura: "warm",
    stage: "qualificado",
    responsavel: "Diego",
    ultimaInteracao: "há 1 dia",
    paradoHa: 1,
    origem: "Site — chat",
    chat: [],
    timeline: [],
    scoreBreakdown: [
      { label: "Fit de segmento", peso: 30, nota: 24 },
      { label: "Volume declarado", peso: 25, nota: 18 },
      { label: "Engajamento no chat", peso: 20, nota: 14 },
      { label: "Cargo do contato", peso: 15, nota: 11 },
      { label: "Região", peso: 10, nota: 7 },
    ],
  },
];

export function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
