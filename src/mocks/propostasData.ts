export interface ItemCatalogo {
  id: string;
  nome: string;
  preco: number;
  unidade: string;
}

export interface ItemProposta {
  id: string;
  nome: string;
  quantidade: number;
  preco: number;
}

export interface Proposta {
  id: string;
  numero: string;
  lead: string;
  leadId?: string;
  empresa: string;
  valor: number;
  status: 'rascunho' | 'enviada' | 'visualizada' | 'aceita' | 'recusada' | 'expirada' | 'aguardando_aprovacao';
  validade: string;
  responsavel: string;
  data: string;
  canal: string;
  itens: ItemProposta[];
  descontoPct: number;
  versao: number;
  motivoPerda?: string;
  aprovador?: string;
  propostaPaiId?: string;
  descontoAprovado?: boolean;
  bloqueadaEnvio?: boolean;
  templateId?: string;
  formaPagamento?: string;
  garantia?: string;
  termos?: string;
}

export interface Venda {
  id: string;
  lead: string;
  empresa: string;
  valor: number;
  metodo: string;
  status: 'pago' | 'pendente' | 'estornado' | 'processando' | 'cancelado';
  data: string;
  comprovante: string;
  proposta: string;
}

export const catalogo: ItemCatalogo[] = [
  { id: 'cat-1', nome: 'Site institucional', preco: 3500, unidade: 'projeto' },
  { id: 'cat-2', nome: 'Landing page de alta conversão', preco: 1800, unidade: 'projeto' },
  { id: 'cat-3', nome: 'Gestão de tráfego pago (mensal)', preco: 2500, unidade: 'mês' },
  { id: 'cat-4', nome: 'Identidade visual completa', preco: 4200, unidade: 'projeto' },
  { id: 'cat-5', nome: 'SEO e conteúdo (mensal)', preco: 1600, unidade: 'mês' },
  { id: 'cat-6', nome: 'Automação de CRM', preco: 2900, unidade: 'projeto' },
];

export const propostas: Proposta[] = [
  {
    id: 'pr-1',
    numero: 'PRP-0141',
    lead: 'Carlos Mendes',
    empresa: 'Tech Solutions Ltda',
    valor: 6100,
    status: 'rascunho',
    validade: '2026-08-26',
    responsavel: 'Ana (IA)',
    data: '2026-08-12',
    canal: 'WhatsApp',
    descontoPct: 0,
    versao: 1,
    itens: [
      { id: 'it-1', nome: 'Landing page de alta conversão', quantidade: 1, preco: 1800 },
      { id: 'it-2', nome: 'Gestão de tráfego pago (mensal)', quantidade: 1, preco: 2500 },
      { id: 'it-3', nome: 'Automação de CRM', quantidade: 1, preco: 1800 },
    ],
  },
  {
    id: 'pr-2',
    numero: 'PRP-0140',
    lead: 'Roberto Alves',
    empresa: 'Farmácia Bem Estar',
    valor: 2800,
    status: 'enviada',
    validade: '2026-08-25',
    responsavel: 'João Vendedor',
    data: '2026-08-11',
    canal: 'E-mail',
    descontoPct: 0,
    versao: 1,
    itens: [
      { id: 'it-4', nome: 'Landing page de alta conversão', quantidade: 1, preco: 1800 },
      { id: 'it-5', nome: 'SEO e conteúdo (mensal)', quantidade: 1, preco: 1000 },
    ],
  },
  {
    id: 'pr-3',
    numero: 'PRP-0139',
    lead: 'Patrícia Lima',
    empresa: 'Clínica Vida Saudável',
    valor: 3200,
    status: 'visualizada',
    validade: '2026-08-23',
    responsavel: 'Marina Sales',
    data: '2026-08-09',
    canal: 'WhatsApp',
    descontoPct: 0,
    versao: 1,
    itens: [
      { id: 'it-6', nome: 'Site institucional', quantidade: 1, preco: 3200 },
    ],
  },
  {
    id: 'pr-4',
    numero: 'PRP-0138',
    lead: 'Juliana Costa',
    empresa: 'Agência Criativa',
    valor: 6800,
    status: 'aceita',
    validade: '2026-08-20',
    responsavel: 'Marina Sales',
    data: '2026-08-08',
    canal: 'WhatsApp',
    descontoPct: 5,
    versao: 1,
    itens: [
      { id: 'it-7', nome: 'Identidade visual completa', quantidade: 1, preco: 4200 },
      { id: 'it-8', nome: 'Gestão de tráfego pago (mensal)', quantidade: 1, preco: 2600 },
    ],
  },
  {
    id: 'pr-5',
    numero: 'PRP-0137',
    lead: 'Fernando Gomes',
    empresa: 'Alpha Automação',
    valor: 5400,
    status: 'expirada',
    validade: '2026-08-05',
    responsavel: 'João Vendedor',
    data: '2026-07-26',
    canal: 'E-mail',
    descontoPct: 0,
    versao: 2,
    itens: [
      { id: 'it-9', nome: 'Automação de CRM', quantidade: 1, preco: 2900 },
      { id: 'it-10', nome: 'SEO e conteúdo (mensal)', quantidade: 1, preco: 2500 },
    ],
  },
  {
    id: 'pr-6',
    numero: 'PRP-0136',
    lead: 'Ricardo Nunes',
    empresa: 'AgroPlanta',
    valor: 22000,
    status: 'aceita',
    validade: '2026-08-01',
    responsavel: 'Marina Sales',
    data: '2026-07-25',
    canal: 'WhatsApp',
    descontoPct: 8,
    versao: 2,
    itens: [
      { id: 'it-11', nome: 'Site institucional', quantidade: 1, preco: 4500 },
      { id: 'it-12', nome: 'Gestão de tráfego pago (mensal)', quantidade: 6, preco: 17500 },
    ],
  },
];

export const vendas: Venda[] = [
  { id: 'vd-1', lead: 'Juliana Costa', empresa: 'Agência Criativa', valor: 6800, metodo: 'PIX', status: 'pago', data: '2026-08-10', comprovante: 'REC-2026-0101', proposta: 'PRP-0138' },
  { id: 'vd-2', lead: 'Ricardo Nunes', empresa: 'AgroPlanta', valor: 22000, metodo: 'Boleto', status: 'pago', data: '2026-08-08', comprovante: 'REC-2026-0098', proposta: 'PRP-0136' },
  { id: 'vd-3', lead: 'Larissa Melo', empresa: 'Energia Solar Brasil', valor: 8800, metodo: 'Cartão', status: 'processando', data: '2026-08-11', comprovante: '—', proposta: 'PRP-0135' },
  { id: 'vd-4', lead: 'Patrícia Lima', empresa: 'Clínica Vida Saudável', valor: 3200, metodo: 'PIX', status: 'pendente', data: '2026-08-11', comprovante: '—', proposta: 'PRP-0139' },
  { id: 'vd-5', lead: 'Eduardo Santos', empresa: 'LogiTrans Express', valor: 15000, metodo: 'Boleto', status: 'pendente', data: '2026-08-09', comprovante: '—', proposta: 'PRP-0134' },
  { id: 'vd-6', lead: 'Camila Duarte', empresa: 'Varejo Top', valor: 5100, metodo: 'Mercado Pago', status: 'pago', data: '2026-08-07', comprovante: 'REC-2026-0092', proposta: 'PRP-0133' },
  { id: 'vd-7', lead: 'Fernando Gomes', empresa: 'Alpha Automação', valor: 5400, metodo: 'Cartão', status: 'estornado', data: '2026-08-05', comprovante: 'REC-2026-0088', proposta: 'PRP-0137' },
];
