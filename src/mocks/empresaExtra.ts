// ============================================================
// IDENTIDADE E OPERAÇÃO DA EMPRESA — conteúdo que alimenta a Ana
// Dados complementares para a página "Empresa".
// Sem preços: produtos/serviços variam por cliente (projeto personalizado).
// ============================================================

export type CategoriaServico = 'Borracha' | 'Silicone' | 'Poliuretano' | 'Vedações' | 'Acessórios' | 'Sob Medida';

export interface TipoServico {
  id: string;
  nome: string;
  categoria: CategoriaServico;
  tipo: 'Serviço' | 'Produto';
  descricao: string;
  inclui: string[];
}

export const categoriasServicos: { id: CategoriaServico; icone: string }[] = [
  { id: 'Borracha', icone: 'ri-shape-line' },
  { id: 'Silicone', icone: 'ri-flask-line' },
  { id: 'Poliuretano', icone: 'ri-hammer-line' },
  { id: 'Vedações', icone: 'ri-shield-check-line' },
  { id: 'Acessórios', icone: 'ri-tools-line' },
  { id: 'Sob Medida', icone: 'ri-ruler-line' },
];

// Catálogo de TIPOS de produtos e serviços (apresentação, sem preço).
export const tiposServicos: TipoServico[] = [
  {
    id: 'ts-1',
    nome: 'Perfis de Borracha Sob Medida',
    categoria: 'Borracha',
    tipo: 'Produto',
    descricao: 'Perfis extrudados e moldados em borracha para vedações, calhas, juntas, guarnições e acabamentos.',
    inclui: ['Análise de desenho ou amostra', 'Seleção do material ideal', 'Desenvolvimento de ferramenta', 'Extrusão ou moldagem', 'Controle de qualidade'],
  },
  {
    id: 'ts-2',
    nome: 'Juntas de Dilatação',
    categoria: 'Borracha',
    tipo: 'Produto',
    descricao: 'Juntas de dilatação em borracha para pontes, viadutos e grandes estruturas civis.',
    inclui: ['Projeto estrutural', 'Seleção de elastômero', 'Fabricação sob medida', 'Testes de resistência', 'Entrega com laudo'],
  },
  {
    id: 'ts-3',
    nome: 'Gaxetas e Vedações Industriais',
    categoria: 'Vedações',
    tipo: 'Produto',
    descricao: 'Gaxetas, O-rings, retentores e anéis de vedação em diversos elastômeros.',
    inclui: ['Análise da aplicação', 'Seleção do material', 'Conformidade dimensional', 'Testes de estanqueidade', 'Certificado de qualidade'],
  },
  {
    id: 'ts-4',
    nome: 'Peças Técnicas em Poliuretano (PU)',
    categoria: 'Poliuretano',
    tipo: 'Produto',
    descricao: 'Raspadores, buchas, placas, rodas e peças especiais em poliuretano de alta resistência.',
    inclui: ['Desenvolvimento de projeto', 'Seleção de dureza', 'Usinagem ou moldagem', 'Controle dimensional', 'Entrega sob demanda'],
  },
  {
    id: 'ts-5',
    nome: 'Silicone Atóxico e Técnico',
    categoria: 'Silicone',
    tipo: 'Produto',
    descricao: 'Peças em silicone atóxico para aplicações alimentícias e médicas, e silicone de alta temperatura.',
    inclui: ['Conformidade sanitária', 'Resistência térmica', 'Desenvolvimento de molde', 'Prototipagem', 'Validação do cliente'],
  },
  {
    id: 'ts-6',
    nome: 'Mangueiras e Tubos de Borracha',
    categoria: 'Borracha',
    tipo: 'Produto',
    descricao: 'Mangueiras industriais para ar, água, óleo e fluidos diversos.',
    inclui: ['Seleção de bitola', 'Reforço textil ou espiral', 'Resistência a pressão', 'Cortes sob medida', 'Testes de pressão'],
  },
  {
    id: 'ts-7',
    nome: 'Lençóis e Placas de Borracha',
    categoria: 'Borracha',
    tipo: 'Produto',
    descricao: 'Lençóis e placas em todos os compostos e espessuras para pisos, revestimentos e proteção.',
    inclui: ['Corte sob medida', 'Diversas espessuras', 'Compostos específicos', 'Acabamento liso ou antiderrapante', 'Entrega rápida'],
  },
  {
    id: 'ts-8',
    nome: 'Acessórios de Manutenção Industrial',
    categoria: 'Acessórios',
    tipo: 'Produto',
    descricao: 'Correias, acoplamentos, rolamentos, espumas adesivas e itens de reposição.',
    inclui: ['Catálogo de acessórios', 'Agilidade na entrega', 'Reposição para diversos segmentos', 'Atendimento técnico', 'Consultoria de aplicação'],
  },
  {
    id: 'ts-9',
    nome: 'Desenvolvimento de Peças Moldadas',
    categoria: 'Sob Medida',
    tipo: 'Serviço',
    descricao: 'Serviço completo de desenvolvimento de peças moldadas em borracha, silicone e PU.',
    inclui: ['Análise de engenharia', 'Desenvolvimento de ferramenta', 'Prototipagem', 'Validação e aprovação', 'Produção em série'],
  },
  {
    id: 'ts-10',
    nome: 'Consultoria Técnica de Aplicação',
    categoria: 'Sob Medida',
    tipo: 'Serviço',
    descricao: 'Apoio técnico especializado na escolha do material e projeto da peça ideal.',
    inclui: ['Análise da aplicação', 'Seleção de elastômero', 'Cálculo de vida útil', 'Recomendação de projeto', 'Suporte pós-venda'],
  },
];

export interface ObjecaoFAQ {
  id: string;
  objecao: string;
  resposta: string;
  prioridade: 'alta' | 'media' | 'baixa';
}

export const objecoesFAQ: ObjecaoFAQ[] = [
  {
    id: 'obj-1',
    objecao: 'Está caro',
    prioridade: 'alta',
    resposta:
      'Entendo que o investimento precisa ser avaliado com cuidado. Como cada peça é desenvolvida sob medida, o valor reflete a qualidade do material, a precisão dimensional e o suporte técnico envolvido. Posso detalhar o que está incluso no escopo para que você compare o custo-benefício com clareza.',
  },
  {
    id: 'obj-2',
    objecao: 'Já tenho fornecedor',
    prioridade: 'alta',
    resposta:
      'Que ótimo que você já tem uma base de fornecedores. A Wayflex pode ser uma segunda fonte qualificada ou complementar em pontos específicos onde houver espaço para ganho de qualidade, prazo ou custo. Se fizer sentido, faço uma análise comparativa rápida e sem compromisso.',
  },
  {
    id: 'obj-3',
    objecao: 'Me manda uma apresentação',
    prioridade: 'alta',
    resposta:
      'Com prazer! Para a apresentação ser realmente útil, preciso entender um pouco do seu segmento e aplicação. Posso fazer três perguntas rápidas para preparar algo que faça sentido para a sua necessidade?',
  },
  {
    id: 'obj-4',
    objecao: 'Não é para agora',
    prioridade: 'media',
    resposta:
      'Sem problema! Respeito o seu tempo. Deixo meu contato à disposição e, quando fizer sentido, é só chamar. Se quiser, posso te mandar um material curto sobre nossos materiais e aplicações para você avaliar com calma.',
  },
  {
    id: 'obj-5',
    objecao: 'Preciso falar com meu engenheiro/sócio',
    prioridade: 'media',
    resposta:
      'Faz todo sentido alinhar com quem decide. Posso preparar um resumo técnico com as especificações do material, desenho e amostra para facilitar essa conversa com a engenharia. Quer que eu envie algo objetivo por e-mail ou WhatsApp?',
  },
  {
    id: 'obj-6',
    objecao: 'Qual a garantia de durabilidade?',
    prioridade: 'media',
    resposta:
      'Boa pergunta. A durabilidade depende do material escolhido, da aplicação e das condições de operação (temperatura, pressão, exposição química). Nossa equipe técnica calcula a vida útil estimada antes da produção, e garantimos a conformidade com as especificações aprovadas. Posso explicar como funciona na sua aplicação?',
  },
  {
    id: 'obj-7',
    objecao: 'Como funciona o atendimento?',
    prioridade: 'baixa',
    resposta:
      'Você tem um especialista comercial dedicado acompanhando de perto, com suporte técnico da nossa engenharia. Eu, Ana, cuido do primeiro contato e da qualificação; depois um humano assume para conduzir o projeto, orçamento e acompanhamento pós-venda.',
  },
];

export const assinaturaCta = {
  assinatura:
    'Atenciosamente,\nAna — Assistente virtual da Wayflex\nSoluções em borracha, silicone e poliuretano.',
  ctas: [
    { id: 'cta-1', nome: 'Link de agendamento', icone: 'ri-calendar-check-line', link: 'https://www.wayflex.ind.br/contato', descricao: 'Usado quando o lead quer marcar uma conversa.' },
    { id: 'cta-2', nome: 'Link de orçamento', icone: 'ri-file-text-line', link: 'https://www.wayflex.ind.br/contato', descricao: 'Usado quando o lead pede uma proposta.' },
    { id: 'cta-3', nome: 'WhatsApp', icone: 'ri-whatsapp-line', link: 'https://wa.me/5511932884074', descricao: 'Canal principal de conversa.' },
    { id: 'cta-4', nome: 'Instagram', icone: 'ri-instagram-line', link: 'https://instagram.com/wayflex', descricao: 'Provas sociais e portfólio.' },
    { id: 'cta-5', nome: 'Site institucional', icone: 'ri-global-line', link: 'https://www.wayflex.ind.br', descricao: 'Apresentação completa da empresa.' },
  ],
};

export const identidadeAna = {
  nome: 'Ana',
  funcao: 'Assistente virtual comercial da Wayflex.',
  corBalao: 'primary',
  saudacao: 'Olá, tudo bem? Sou a Ana, da Wayflex.',
  corBalaoOpcoes: [
    { id: 'primary', label: 'Marca (primária)' },
    { id: 'accent', label: 'Destaque (accent)' },
    { id: 'secondary', label: 'Neutra (secondary)' },
  ],
};

export interface MetaProspeccao {
  id: string;
  nome: string;
  alvo: number;
  unidade: string;
  atual: number;
  icone: string;
}

export const metasProspeccao: MetaProspeccao[] = [
  { id: 'meta-1', nome: 'Leads por dia', alvo: 20, unidade: 'leads', atual: 14, icone: 'ri-user-add-line' },
  { id: 'meta-2', nome: 'Leads por mês', alvo: 500, unidade: 'leads', atual: 380, icone: 'ri-user-line' },
  { id: 'meta-3', nome: 'Reuniões por mês', alvo: 40, unidade: 'reuniões', atual: 28, icone: 'ri-calendar-check-line' },
  { id: 'meta-4', nome: 'Taxa de qualificação', alvo: 35, unidade: '%', atual: 28, icone: 'ri-filter-line' },
];

export const complianceLgpd = {
  consentimento:
    'Ao continuar esta conversa, você concorda em receber comunicações da Wayflex sobre nossos produtos e serviços. Seus dados são tratados com segurança e utilizados apenas para fins de atendimento comercial.',
  baseLegal: 'Consentimento e legítimo interesse',
  dpo: 'Wayflex — contato@wayflex.ind.br',
  retencaoDias: 180,
  direitosTitular: [
    'Acesso e confirmação da existência de tratamento',
    'Correção de dados incompletos ou desatualizados',
    'Anonimização, bloqueio ou eliminação de dados desnecessários',
    'Portabilidade dos dados para outro fornecedor',
    'Revogação do consentimento a qualquer momento',
  ],
  palavraDescadastro: 'Não quero mais receber contato',
  acaoDescadastro: 'Ao identificar opt-out, a Ana encerra o contato e registra a supressão.',
};