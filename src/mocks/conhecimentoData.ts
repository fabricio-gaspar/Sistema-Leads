export type CategoriaConhecimento =
  | 'institucional'
  | 'materiais'
  | 'solucoes_e_produtos'
  | 'qualificacao'
  | 'regras_comerciais'
  | 'respostas_aprovadas'
  | 'handoff_humano'
  // Valores legados mantidos somente para leitura de registros históricos.
  | 'faq' | 'objecoes' | 'cases' | 'politicas' | 'produtos';

export interface EntradaConhecimento {
  id: string;
  categoria: CategoriaConhecimento;
  titulo: string;
  pergunta?: string;
  conteudo: string;
  palavrasChave: string[];
  status: 'ativo' | 'rascunho';
  autor: string;
  data: string;
  usos: number;
  fonte?: string;
}

export const categoriasConhecimento: { id: CategoriaConhecimento; nome: string; icone: string; descricao: string; cor: string }[] = [
  {
    id: 'institucional',
    nome: 'Institucional',
    icone: 'ri-building-2-line',
    descricao: 'Identidade, atendimento e atuação da WayFlex.',
    cor: 'bg-primary-100 text-primary-700',
  },
  {
    id: 'materiais',
    nome: 'Materiais',
    icone: 'ri-flask-line',
    descricao: 'Critérios técnicos para borracha, silicone e PU.',
    cor: 'bg-accent-100 text-accent-700',
  },
  {
    id: 'solucoes_e_produtos',
    nome: 'Soluções',
    icone: 'ri-tools-line',
    descricao: 'Famílias de peças e aplicações industriais.',
    cor: 'bg-secondary-100 text-secondary-700',
  },
  {
    id: 'qualificacao',
    nome: 'Qualificação',
    icone: 'ri-list-check-3',
    descricao: 'Perguntas técnicas e dados para orçamento.',
    cor: 'bg-background-200 text-foreground-700',
  },
  {
    id: 'regras_comerciais',
    nome: 'Limites comerciais',
    icone: 'ri-shield-check-line',
    descricao: 'O que a Ana pode dizer ou precisa confirmar.',
    cor: 'bg-primary-100 text-primary-700',
  },
  {
    id: 'respostas_aprovadas',
    nome: 'Respostas aprovadas',
    icone: 'ri-chat-check-line',
    descricao: 'Mensagens institucionais autorizadas.',
    cor: 'bg-secondary-100 text-secondary-700',
  },
  {
    id: 'handoff_humano',
    nome: 'Handoff humano',
    icone: 'ri-user-shared-line',
    descricao: 'Casos em que a Ana deve transferir.',
    cor: 'bg-accent-100 text-accent-700',
  },
];

export const conhecimentoInicial: EntradaConhecimento[] = [
  {
    id: 'con-1',
    categoria: 'faq',
    titulo: 'Quais materiais a Wayflex trabalha?',
    pergunta: 'Vocês trabalham com quais tipos de borracha?',
    conteudo:
      'A Wayflex trabalha com borracha natural e sintética, EPDM, SBR, neoprene, nitrílica, silicone (inclusive atóxico para aplicações alimentícias e médicas), poliuretano (PU) e Viton. Cada material é selecionado conforme a aplicação, resistência térmica, química e mecânica exigida pelo cliente.',
    palavrasChave: ['materiais', 'borracha', 'EPDM', 'SBR', 'silicone', 'poliuretano', 'Viton', 'elastômeros'],
    status: 'ativo',
    autor: 'Comercial Wayflex',
    data: '2026-08-20',
    usos: 145,
  },
  {
    id: 'con-2',
    categoria: 'faq',
    titulo: 'Qual o prazo de entrega?',
    pergunta: 'Quanto tempo leva para entregar?',
    conteudo:
      'O prazo de entrega varia conforme a complexidade e o volume do pedido. Para peças padrão, o prazo médio é de 5 a 10 dias úteis. Peças customizadas ou sob medida levam de 10 a 20 dias úteis, pois passam por análise de engenharia, desenvolvimento de molde e aprovação. Projetos especiais são avaliados caso a caso, com cronograma transparente.',
    palavrasChave: ['prazo', 'entrega', 'tempo', 'quando', 'dias úteis'],
    status: 'ativo',
    autor: 'Comercial Wayflex',
    data: '2026-08-19',
    usos: 112,
  },
  {
    id: 'con-3',
    categoria: 'faq',
    titulo: 'Vocês fazem peças sob medida?',
    pergunta: 'Conseguem fabricar conforme desenho?',
    conteudo:
      'Sim! A Wayflex desenvolve peças técnicas 100% personalizadas conforme desenho, amostra ou especificação do cliente. Contamos com equipe de engenharia e técnica especializada para apoiar no projeto, desde a escolha do material até a validação da peça final.',
    palavrasChave: ['sob medida', 'personalizado', 'desenho', 'amostra', 'customizado', 'projeto'],
    status: 'ativo',
    autor: 'Engenharia Wayflex',
    data: '2026-08-18',
    usos: 98,
  },
  {
    id: 'con-4',
    categoria: 'faq',
    titulo: 'A Wayflex possui certificação?',
    pergunta: 'Vocês são certificados?',
    conteudo:
      'Sim, a Wayflex é certificada ISO 9001:2015, garantindo processos padronizados, rastreabilidade completa e controle de qualidade em toda a cadeia produtiva. Nossos produtos em silicone atóxico também seguem normas sanitárias para aplicações alimentícias e médicas.',
    palavrasChave: ['certificação', 'ISO 9001', 'qualidade', 'rastreabilidade', 'normas'],
    status: 'ativo',
    autor: 'Qualidade Wayflex',
    data: '2026-08-17',
    usos: 76,
  },
  {
    id: 'con-5',
    categoria: 'faq',
    titulo: 'Como solicitar um orçamento?',
    pergunta: 'Como faço para pedir um orçamento?',
    conteudo:
      'Você pode solicitar um orçamento pelo telefone (11) 93288-4074, pelo e-mail contato@wayflex.ind.br ou pelo formulário de contato em nosso site. Para agilizar, envie o desenho, amostra ou descrição da peça, material desejado, quantidade e aplicação. Retornamos em até 24h úteis.',
    palavrasChave: ['orçamento', 'cotação', 'preço', 'como pedir', 'contato', 'solicitar'],
    status: 'ativo',
    autor: 'Comercial Wayflex',
    data: '2026-08-16',
    usos: 134,
  },
  {
    id: 'con-6',
    categoria: 'objecoes',
    titulo: 'Objeção: está caro',
    conteudo:
      'Entendo que o investimento precisa ser avaliado com cuidado. O valor reflete a qualidade do material, a precisão dimensional e o desenvolvimento técnico envolvido. Posso detalhar o que está incluso no escopo — material, acabamento, prazo e quantidade — para que você compare o custo-benefício com clareza?',
    palavrasChave: ['caro', 'preço', 'valor', 'orçamento', 'investimento'],
    status: 'ativo',
    autor: 'Comercial Wayflex',
    data: '2026-08-15',
    usos: 68,
  },
  {
    id: 'con-7',
    categoria: 'objecoes',
    titulo: 'Objeção: já tenho fornecedor',
    conteudo:
      'Compreendo que você já tem uma base de fornecedores. A Wayflex não vem para substituir — podemos ser uma segunda fonte qualificada ou complementar em pontos específicos onde houver espaço para ganho de qualidade, prazo ou custo. Se fizer sentido, posso fazer uma análise comparativa rápida e sem compromisso.',
    palavrasChave: ['fornecedor', 'já tenho', 'concorrente', 'base', 'segunda fonte'],
    status: 'ativo',
    autor: 'Comercial Wayflex',
    data: '2026-08-15',
    usos: 55,
  },
  {
    id: 'con-8',
    categoria: 'objecoes',
    titulo: 'Objeção: preciso pensar / falar com engenharia',
    conteudo:
      'Sem problema, é uma decisão técnica importante. Posso preparar um resumo com as especificações do material, desenho técnico e amostra para facilitar a conversa com a engenharia. Quer que eu envie um resumo objetivo por e-mail ou WhatsApp?',
    palavrasChave: ['pensar', 'engenharia', 'depois', 'avaliar', 'decidir', 'técnico'],
    status: 'ativo',
    autor: 'Comercial Wayflex',
    data: '2026-08-14',
    usos: 71,
  },
  {
    id: 'con-9',
    categoria: 'cases',
    titulo: 'Case: Indústria de Construção Civil',
    conteudo:
      'Fornecimento de juntas de dilatação e perfis de vedação para uma grande construtora em São Paulo. As peças em EPDM e neoprene atenderam às exigências de resistência UV, dilatação térmica e durabilidade em viadutos e pontes, reduzindo manutenção corretiva em 40%.',
    palavrasChave: ['construção civil', 'juntas de dilatação', 'EPDM', 'neoprene', 'viadutos', 'pontes'],
    status: 'ativo',
    autor: 'Comercial Wayflex',
    data: '2026-08-13',
    usos: 48,
  },
  {
    id: 'con-10',
    categoria: 'cases',
    titulo: 'Case: Indústria Automotiva',
    conteudo:
      'Desenvolvimento de peças técnicas em borracha nitrílica e silicone para linha de montagem automotiva. As vedações e gaxetas customizadas melhoraram a resistência a óleos e solventes, aumentando a vida útil em relação ao componente anterior em 60%.',
    palavrasChave: ['automotiva', 'nitrílica', 'silicone', 'gaxetas', 'vedação', 'óleo', 'resistência'],
    status: 'ativo',
    autor: 'Comercial Wayflex',
    data: '2026-08-12',
    usos: 42,
  },
  {
    id: 'con-11',
    categoria: 'cases',
    titulo: 'Case: Indústria Alimentícia',
    conteudo:
      'Fornecimento de perfis e peças em silicone atóxico para equipamentos de processamento de alimentos. A conformidade com normas sanitárias e a resistência a altas temperaturas garantiram aprovação em auditoria de qualidade do cliente, eliminando retrabalho.',
    palavrasChave: ['alimentícia', 'silicone atóxico', 'sanitário', 'temperatura', 'normas'],
    status: 'ativo',
    autor: 'Comercial Wayflex',
    data: '2026-08-11',
    usos: 38,
  },
  {
    id: 'con-12',
    categoria: 'politicas',
    titulo: 'Política de privacidade e LGPD',
    conteudo:
      'A Wayflex trata os dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD). Dados coletados em conversas e formulários são usados apenas para atendimento e prospecção comercial, com consentimento explícito. O titular pode solicitar correção ou exclusão a qualquer momento pelo canal oficial de suporte.',
    palavrasChave: ['lgpd', 'privacidade', 'dados', 'consentimento', 'lei', 'proteção'],
    status: 'ativo',
    autor: 'Jurídico Wayflex',
    data: '2026-08-10',
    usos: 33,
  },
  {
    id: 'con-13',
    categoria: 'politicas',
    titulo: 'Condições de contrato e garantia',
    conteudo:
      'A Wayflex garante a conformidade das peças com as especificações técnicas aprovadas. Reclamações por defeito de fabricação devem ser comunicadas em até 30 dias após o recebimento. As condições de pagamento, prazos e entregas são detalhadas em proposta comercial antes da confirmação do pedido, garantindo transparência total.',
    palavrasChave: ['contrato', 'garantia', 'condições', 'reclamação', 'defeito', 'pagamento', 'prazo'],
    status: 'ativo',
    autor: 'Jurídico Wayflex',
    data: '2026-08-09',
    usos: 41,
  },
  {
    id: 'con-14',
    categoria: 'produtos',
    titulo: 'Perfis de Borracha Sob Medida',
    conteudo:
      'A Wayflex desenvolve perfis de borracha extrudados e moldados para vedações, calhas, juntas, guarnições e acabamentos. Trabalhamos com borracha natural, EPDM, SBR, neoprene e silicone. Cada perfil é desenvolvido conforme desenho ou amostra, com precisão dimensional e acabamento adequado à aplicação.',
    palavrasChave: ['perfis', 'borracha', 'extrudados', 'vedação', 'calha', 'guarnição', 'juntas'],
    status: 'ativo',
    autor: 'Engenharia Wayflex',
    data: '2026-08-08',
    usos: 88,
  },
  {
    id: 'con-15',
    categoria: 'produtos',
    titulo: 'Juntas de Dilatação e Vedações',
    conteudo:
      'Juntas de dilatação em borracha para pontes, viadutos, edifícios e estruturas civis. Também fabricamos gaxetas, O-rings, juntas de vedação e retentores em diversos elastômeros. As peças são projetadas para resistir a dilatação térmica, vibração, pressão e agentes químicos.',
    palavrasChave: ['juntas de dilatação', 'gaxetas', 'O-rings', 'retentores', 'vedação', 'pontes', 'viadutos'],
    status: 'ativo',
    autor: 'Engenharia Wayflex',
    data: '2026-08-07',
    usos: 81,
  },
  {
    id: 'con-16',
    categoria: 'produtos',
    titulo: 'Peças Técnicas em Poliuretano (PU)',
    conteudo:
      'Peças de poliuretano com alta resistência mecânica, abrasão e impacto. Raspadores para correia transportadora, buchas, placas, rodas, coxins e peças especiais sob medida. O PU é ideal para aplicações industriais que exigem durabilidade superior e resistência ao desgaste.',
    palavrasChave: ['poliuretano', 'PU', 'raspadores', 'buchas', 'placas', 'resistência', 'abrasão'],
    status: 'ativo',
    autor: 'Engenharia Wayflex',
    data: '2026-08-06',
    usos: 74,
  },
  {
    id: 'con-17',
    categoria: 'produtos',
    titulo: 'Silicone Atóxico e Resistente a Temperatura',
    conteudo:
      'Soluções em silicone atóxico para aplicações alimentícias, médicas e farmacêuticas. Também silicone de alta temperatura para vedações em fornos, autoclaves e equipamentos industriais. Resistente a -60°C até +250°C, com excelente elasticidade e conformidade com normas sanitárias.',
    palavrasChave: ['silicone', 'atóxico', 'alimentício', 'médico', 'temperatura', 'vedação', 'forno'],
    status: 'ativo',
    autor: 'Qualidade Wayflex',
    data: '2026-08-05',
    usos: 67,
  },
  {
    id: 'con-18',
    categoria: 'produtos',
    titulo: 'Acessórios Industriais e Mantas',
    conteudo:
      'Lençóis e placas de borracha em todos os compostos e espessuras, mangueiras para ar, água e óleo, correias industriais, folhas de cortiça, papelão hidráulico, fitas PTFE e espumas adesivas (EPDM, neoprene, PVC, EVA). Tudo para manutenção, vedação e reposição em diversos segmentos.',
    palavrasChave: ['lençóis', 'placas', 'mangueiras', 'correias', 'cortiça', 'PTFE', 'espumas', 'manutenção'],
    status: 'ativo',
    autor: 'Comercial Wayflex',
    data: '2026-08-04',
    usos: 59,
  },
];
