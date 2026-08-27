export type SocialNetwork = 'LINKEDIN' | 'INSTAGRAM' | 'FACEBOOK';

export type AccountStatus =
  | 'DISCONNECTED'
  | 'CONNECTED'
  | 'EXPIRED'
  | 'ERROR'
  | 'AWAITING_AUTH';

export interface SocialAccount {
  id: string;
  network: SocialNetwork;
  accountType: string;
  externalAccountId: string;
  accountName: string;
  status: AccountStatus;
  scopes: string[];
  connectedBy: string;
  lastSyncAt: string | null;
  tokenExpiresAt: string | null;
}

export type PostStatus =
  | 'RASCUNHO'
  | 'AGUARDANDO_APROVACAO'
  | 'APROVADA'
  | 'AGENDADA'
  | 'PUBLICANDO'
  | 'PUBLICADA'
  | 'FALHOU'
  | 'CANCELADA';

export type PostObjetivo =
  | 'reconhecimento'
  | 'trafego'
  | 'geracao_leads'
  | 'autoridade'
  | 'relacionamento'
  | 'oferta';

export interface SocialMedia {
  id: string;
  nomeArquivo: string;
  tipo: 'imagem' | 'video' | 'carrossel' | 'documento';
  mimeType: string;
  tamanho: string;
  largura: number;
  altura: number;
  altText: string;
}

export interface SocialPost {
  id: string;
  nomeInterno: string;
  campanha: string;
  objetivo: PostObjetivo;
  redes: SocialNetwork[];
  contasPorRede: { network: SocialNetwork; accountId: string }[];
  dataHora: string;
  timezone: string;
  status: PostStatus;
  responsavel: string;
  aprovador: string;
  tags: string[];
  tema: string;
  mensagemBase: string;
  cta: string;
  link: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  hashtags: string[];
  mencoes: string[];
  conteudoPorRede: {
    LINKEDIN: string;
    INSTAGRAM: string;
    FACEBOOK: string;
  };
  midia: SocialMedia[];
  aprovadoEm: string | null;
  publicadoEm: string | null;
  erro: string | null;
  tentativas: number;
  criadoEm: string;
}

export const campanhasSociais = [
  { id: 'camp-1', nome: 'Lançamento novo site' },
  { id: 'camp-2', nome: 'Geração de leads - Automação' },
  { id: 'camp-3', nome: 'Autoridade - Marketing Digital' },
  { id: 'camp-4', nome: 'Relacionamento - Cases' },
  { id: 'camp-5', nome: 'Oferta - Implantação' },
];

export const socialAccounts: SocialAccount[] = [
  {
    id: 'sa-linkedin',
    network: 'LINKEDIN',
    accountType: 'Company Page',
    externalAccountId: '',
    accountName: 'Wayflex',
    status: 'DISCONNECTED',
    scopes: ['w_organization_social', 'r_organization_social', 'rw_organization_admin'],
    connectedBy: '',
    lastSyncAt: null,
    tokenExpiresAt: null,
  },
  {
    id: 'sa-instagram',
    network: 'INSTAGRAM',
    accountType: 'Instagram Business',
    externalAccountId: '',
    accountName: '@wayflex.borrachas',
    status: 'DISCONNECTED',
    scopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement'],
    connectedBy: '',
    lastSyncAt: null,
    tokenExpiresAt: null,
  },
  {
    id: 'sa-facebook',
    network: 'FACEBOOK',
    accountType: 'Facebook Page',
    externalAccountId: '',
    accountName: 'Wayflex Artefatos de Borracha',
    status: 'DISCONNECTED',
    scopes: ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'],
    connectedBy: '',
    lastSyncAt: null,
    tokenExpiresAt: null,
  },
];

export const socialPosts: SocialPost[] = [
  {
    id: 'sp-1',
    nomeInterno: 'Lançamento - Novo site Wayflex',
    campanha: 'Lançamento novo site',
    objetivo: 'reconhecimento',
    redes: ['LINKEDIN', 'INSTAGRAM', 'FACEBOOK'],
    contasPorRede: [
      { network: 'LINKEDIN', accountId: 'sa-linkedin' },
      { network: 'INSTAGRAM', accountId: 'sa-instagram' },
      { network: 'FACEBOOK', accountId: 'sa-facebook' },
    ],
    dataHora: '2026-08-25T09:00:00',
    timezone: 'America/Sao_Paulo',
    status: 'RASCUNHO',
    responsavel: 'Fabrício',
    aprovador: 'Carlos Mendes',
    tags: ['lançamento', 'site'],
    tema: 'Lançamento do novo site institucional',
    mensagemBase: 'Nosso novo site está no ar! Uma experiência mais rápida, moderna e focada em gerar resultados.',
    cta: 'Acesse e conheça',
    link: 'https://www.wayflex.ind.br',
    utmSource: 'linkedin',
    utmMedium: 'social',
    utmCampaign: 'lancamento_site',
    hashtags: ['wayflex', 'borrachaindustrial'],
    mencoes: [],
    conteudoPorRede: {
      LINKEDIN: 'É com muita satisfação que anunciamos o novo site da Wayflex. Navegue pelo nosso catálogo completo de soluções em borracha, silicone e poliuretano.',
      INSTAGRAM: 'Novo site no ar! Conheça nossas soluções industriais de borracha e PU.',
      FACEBOOK: 'Nosso novo site está no ar! Conheça a Wayflex e todas as nossas soluções.',
    },
    midia: [],
    aprovadoEm: null,
    publicadoEm: null,
    erro: null,
    tentativas: 0,
    criadoEm: '2026-08-18T14:30:00',
  },
  {
    id: 'sp-2',
    nomeInterno: 'Case - Clínica OrtoPrime',
    campanha: 'Relacionamento - Cases',
    objetivo: 'autoridade',
    redes: ['LINKEDIN', 'INSTAGRAM'],
    contasPorRede: [
      { network: 'LINKEDIN', accountId: 'sa-linkedin' },
      { network: 'INSTAGRAM', accountId: 'sa-instagram' },
    ],
    dataHora: '2026-08-22T10:00:00',
    timezone: 'America/Sao_Paulo',
    status: 'AGUARDANDO_APROVACAO',
    responsavel: 'Marina Sales',
    aprovador: 'Carlos Mendes',
    tags: ['case', 'saúde'],
    tema: 'Como a OrtoPrime organizou seus processos digitais',
    mensagemBase: 'A OrtoPrime reduziu o tempo de resposta aos pacientes com automação de atendimento.',
    cta: 'Leia o case completo',
    link: 'https://www.wayflex.ind.br',
    utmSource: 'linkedin',
    utmMedium: 'social',
    utmCampaign: 'case_ortoprime',
    hashtags: ['caso', 'automacao', 'saude'],
    mencoes: [],
    conteudoPorRede: {
      LINKEDIN: 'Confira como a Clínica OrtoPrime reduziu o tempo de resposta aos pacientes com automação de atendimento.',
      INSTAGRAM: 'A OrtoPrime transformou o atendimento com automação. Veja como!',
      FACEBOOK: '',
    },
    midia: [],
    aprovadoEm: null,
    publicadoEm: null,
    erro: null,
    tentativas: 0,
    criadoEm: '2026-08-17T11:00:00',
  },
  {
    id: 'sp-3',
    nomeInterno: 'Dica - Automação de follow-up',
    campanha: 'Autoridade - Marketing Digital',
    objetivo: 'autoridade',
    redes: ['LINKEDIN'],
    contasPorRede: [{ network: 'LINKEDIN', accountId: 'sa-linkedin' }],
    dataHora: '2026-08-21T08:30:00',
    timezone: 'America/Sao_Paulo',
    status: 'APROVADA',
    responsavel: 'Paula SDR',
    aprovador: 'Patrícia Lima',
    tags: ['dica', 'follow-up'],
    tema: 'A importância de um follow-up bem feito',
    mensagemBase: 'Um follow-up bem estruturado pode dobrar sua taxa de resposta em vendas.',
    cta: 'Quer saber como?',
    link: '',
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
    hashtags: ['vendas', 'followup'],
    mencoes: [],
    conteudoPorRede: {
      LINKEDIN: 'Um follow-up bem estruturado pode dobrar sua taxa de resposta. A chave está na cadência e na personalização.',
      INSTAGRAM: '',
      FACEBOOK: '',
    },
    midia: [],
    aprovadoEm: '2026-08-18T09:00:00',
    publicadoEm: null,
    erro: null,
    tentativas: 0,
    criadoEm: '2026-08-16T16:00:00',
  },
  {
    id: 'sp-4',
    nomeInterno: 'Reel - Bastidores do time',
    campanha: 'Relacionamento - Cases',
    objetivo: 'relacionamento',
    redes: ['INSTAGRAM'],
    contasPorRede: [{ network: 'INSTAGRAM', accountId: 'sa-instagram' }],
    dataHora: '2026-08-20T18:00:00',
    timezone: 'America/Sao_Paulo',
    status: 'AGENDADA',
    responsavel: 'Fabrício',
    aprovador: 'Carlos Mendes',
    tags: ['reel', 'bastidores'],
    tema: 'Um dia na fábrica da Wayflex',
    mensagemBase: 'Conheça um pouco dos bastidores da nossa produção.',
    cta: '',
    link: '',
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
    hashtags: ['bastidores', 'time'],
    mencoes: [],
    conteudoPorRede: {
      LINKEDIN: '',
      INSTAGRAM: 'Um dia na fábrica da Wayflex ✨ #borracha #industrial',
      FACEBOOK: '',
    },
    midia: [
      {
        id: 'md-1',
        nomeArquivo: 'reel-bastidores.mp4',
        tipo: 'video',
        mimeType: 'video/mp4',
        tamanho: '24 MB',
        largura: 1080,
        altura: 1920,
        altText: 'Vídeo dos bastidores da fábrica da Wayflex',
      },
    ],
    aprovadoEm: '2026-08-19T08:00:00',
    publicadoEm: null,
    erro: null,
    tentativas: 0,
    criadoEm: '2026-08-15T10:00:00',
  },
  {
    id: 'sp-5',
    nomeInterno: 'Institucional 2026',
    campanha: 'Lançamento novo site',
    objetivo: 'reconhecimento',
    redes: ['FACEBOOK', 'LINKEDIN'],
    contasPorRede: [
      { network: 'FACEBOOK', accountId: 'sa-facebook' },
      { network: 'LINKEDIN', accountId: 'sa-linkedin' },
    ],
    dataHora: '2026-08-18T09:00:00',
    timezone: 'America/Sao_Paulo',
    status: 'PUBLICADA',
    responsavel: 'Marina Sales',
    aprovador: 'Carlos Mendes',
    tags: ['institucional'],
    tema: 'Quem somos e o que fazemos',
    mensagemBase: 'A Wayflex desenvolve soluções de borracha, silicone e poliuretano sob medida para a indústria.',
    cta: 'Saiba mais',
    link: 'https://www.wayflex.ind.br/sobre',
    utmSource: 'facebook',
    utmMedium: 'social',
    utmCampaign: 'institucional',
    hashtags: ['wayflex', 'borracha'],
    mencoes: [],
    conteudoPorRede: {
      LINKEDIN: 'A Wayflex desenvolve soluções de borracha, silicone e poliuretano sob medida para a indústria. Conheça quem somos.',
      INSTAGRAM: '',
      FACEBOOK: 'A Wayflex desenvolve soluções de borracha, silicone e poliuretano sob medida para a indústria.',
    },
    midia: [],
    aprovadoEm: '2026-08-17T10:00:00',
    publicadoEm: '2026-08-18T09:00:00',
    erro: null,
    tentativas: 1,
    criadoEm: '2026-08-14T09:00:00',
  },
  {
    id: 'sp-6',
    nomeInterno: 'Oferta - Desconto de implantação',
    campanha: 'Oferta - Implantação',
    objetivo: 'oferta',
    redes: ['FACEBOOK'],
    contasPorRede: [{ network: 'FACEBOOK', accountId: 'sa-facebook' }],
    dataHora: '2026-08-17T12:00:00',
    timezone: 'America/Sao_Paulo',
    status: 'FALHOU',
    responsavel: 'Paula SDR',
    aprovador: 'Patrícia Lima',
    tags: ['oferta'],
    tema: 'Condição especial de implantação',
    mensagemBase: 'Condição especial de implantação por tempo limitado.',
    cta: 'Fale conosco',
    link: '',
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
    hashtags: ['oferta'],
    mencoes: [],
    conteudoPorRede: {
      LINKEDIN: '',
      INSTAGRAM: '',
      FACEBOOK: 'Condição especial de implantação por tempo limitado. Fale com a nossa equipe!',
    },
    midia: [
      {
        id: 'md-2',
        nomeArquivo: 'banner-oferta.png',
        tipo: 'imagem',
        mimeType: 'image/png',
        tamanho: '1,4 MB',
        largura: 1200,
        altura: 628,
        altText: 'Banner de oferta de implantação',
      },
    ],
    aprovadoEm: '2026-08-16T15:00:00',
    publicadoEm: null,
    erro: 'Mídia inválida: dimensões fora do padrão recomendado pela plataforma.',
    tentativas: 3,
    criadoEm: '2026-08-15T14:00:00',
  },
];