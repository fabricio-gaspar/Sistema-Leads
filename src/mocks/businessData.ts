export interface CampoIntegracao {
  id: string;
  rotulo: string;
  tipo: 'texto' | 'senha' | 'selecao';
  placeholder?: string;
  ajuda?: string;
  obrigatorio?: boolean;
  opcoes?: string[];
}

export interface Integracao {
  id: string;
  nome: string;
  icone: string;
  categoria: string;
  status: 'conectado' | 'pendente' | 'sandbox' | 'erro';
  ultimoTeste: string;
  descricao: string;
  campos: CampoIntegracao[];
  credenciais?: Record<string, string>;
}

export interface Membro {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  avatar: string;
  status: 'ativo' | 'inativo';
  departamento: string;
}

export interface Documento {
  id: string;
  nome: string;
  categoria: string;
  formato: string;
  tamanho: string;
  versao: string;
  autor: string;
  data: string;
  status: 'rascunho' | 'processando' | 'pronto' | 'ativo' | 'arquivado' | 'erro';
  tags: string[];
}

export interface Supressao {
  id: string;
  contato: string;
  canal: 'WhatsApp' | 'E-mail' | 'Telefone' | 'Instagram';
  motivo: string;
  data: string;
  ator: string;
  origem: string;
  status: 'ativo' | 'reativado';
}

export const produtosServicos = [
  'Perfis de borracha extrudados e moldados sob medida',
  'Juntas de dilatação para pontes e viadutos',
  'Gaxetas, O-rings e vedações industriais',
  'Peças técnicas em poliuretano (PU)',
  'Silicone atóxico e de alta temperatura',
  'Mangueiras, lençóis e placas de borracha',
  'Acessórios de manutenção industrial',
  'Desenvolvimento e fabricação de peças moldadas customizadas',
];

export const diferenciais = [
  'Mais de 6 anos de experiência em artefatos de borracha, silicone e PU',
  'Equipe de engenharia para apoio técnico no projeto',
  'Certificação ISO 9001:2015',
  'Fabricação 100% sob medida conforme desenho ou amostra',
  'Ampla variedade de materiais: EPDM, SBR, nitrílica, neoprene, silicone, PU, Viton',
  'Atendimento técnico especializado e agilidade na entrega',
];

export const regioesAtendimento = [
  'São Paulo e região metropolitana',
  'Todo o Brasil (remoto)',
  'Sul e Sudeste do Brasil',
];

export const apresentacao = {
  institucional:
    'A Wayflex é uma empresa especializada em soluções técnicas de alta qualidade em borracha, silicone e poliuretano. Com mais de 6 anos de experiência, nos consolidamos como referência no mercado de artefatos de borracha. Nossa equipe de engenheiros e técnicos especializados trabalha em conjunto com os clientes para desenvolver peças personalizadas conforme desenho, amostra ou especificação técnica.',
  servicos:
    'Oferecemos perfis de borracha, juntas de dilatação, gaxetas, vedações, peças técnicas em poliuretano, silicone atóxico e de alta temperatura, mangueiras industriais, lençóis e placas, além de acessórios de manutenção. Cada produto é desenvolvido sob medida para atender às necessidades específicas de cada cliente e aplicação.',
  beneficios: [
    'Maior durabilidade e resistência dos componentes',
    'Redução de manutenção corretiva e paradas',
    'Conformidade com normas técnicas e sanitárias',
    'Atendimento técnico especializado desde o projeto',
    'Rastreabilidade e qualidade garantida pela ISO 9001:2015',
  ],
  cases: [
    {
      cliente: 'Construtora São Paulo Estruturas',
      segmento: 'Construção Civil',
      resultado: 'Juntas de dilatação em EPDM reduziram manutenção em 40% em viadutos',
    },
    {
      cliente: 'Montadora ABC Autopeças',
      segmento: 'Automotivo',
      resultado: 'Vedações em nitrílica aumentaram vida útil em 60% na linha de montagem',
    },
    {
      cliente: 'Processadora Alimentos Prima',
      segmento: 'Alimentício',
      resultado: 'Silicone atóxico aprovado em auditoria de qualidade, eliminando retrabalho',
    },
  ],
  argumentos: [
    'Fabricação 100% sob medida com apoio de engenharia',
    'Ampla carteira de materiais para toda aplicação industrial',
    'Certificação ISO 9001:2015 e conformidade com normas técnicas',
    'Rastreabilidade completa da matéria-prima à entrega',
    'Mais de 6 anos de experiência no mercado de artefatos de borracha',
  ],
};

export const integracoes: Integracao[] = [
  {
    id: 'int-1',
    nome: 'WhatsApp (Z-API)',
    icone: 'ri-whatsapp-line',
    categoria: 'Mensageria',
    status: 'conectado',
    ultimoTeste: 'há 10 min',
    descricao: 'Envio e recebimento de mensagens via Z-API. Modo produção.',
    campos: [
      { id: 'instancia_id', rotulo: 'ID da Instância', tipo: 'texto', placeholder: 'ex.: 3C8D2F1A...', obrigatorio: true, ajuda: 'Identificador da sua instância no painel Z-API.' },
      { id: 'token', rotulo: 'Token da Instância', tipo: 'senha', placeholder: 'Cole o token secreto', obrigatorio: true, ajuda: 'Token da instância, que entra na URL de integração da Z-API.' },
      { id: 'client_token', rotulo: 'Client Token', tipo: 'senha', placeholder: 'Cole o client token', obrigatorio: true, ajuda: 'Chave obrigatória enviada no header Client-Token, disponível em Segurança no painel da Z-API.' },
      { id: 'numero_origem', rotulo: 'Número de origem', tipo: 'texto', placeholder: 'ex.: 5511999999999', ajuda: 'Número do WhatsApp conectado, com DDI + DDD.' },
      { id: 'url_base', rotulo: 'URL base (opcional)', tipo: 'texto', placeholder: 'https://api.z-api.io', ajuda: 'Deixe em branco para usar o padrão da Z-API.' },
    ],
  },
  {
    id: 'int-2',
    nome: 'E-mail (Resend)',
    icone: 'ri-mail-send-line',
    categoria: 'E-mail',
    status: 'conectado',
    ultimoTeste: 'há 1h',
    descricao: 'Disparo transacional com eventos de bounce e resposta.',
    campos: [
      { id: 'api_key', rotulo: 'API Key', tipo: 'senha', placeholder: 're_...', obrigatorio: true, ajuda: 'Chave de API gerada no painel do Resend.' },
      { id: 'dominio_envio', rotulo: 'Domínio de envio', tipo: 'texto', placeholder: 'ex.: suaempresa.com', obrigatorio: true, ajuda: 'Domínio verificado no Resend para enviar os e-mails.' },
      { id: 'remetente', rotulo: 'E-mail remetente', tipo: 'texto', placeholder: 'ex.: noreply@suaempresa.com', ajuda: 'Endereço que aparecerá como remetente.' },
    ],
  },
  {
    id: 'int-3',
    nome: 'Instagram / Meta',
    icone: 'ri-instagram-line',
    categoria: 'Social',
    status: 'pendente',
    ultimoTeste: 'nunca',
    descricao: 'Atendimento via Direct. Requer aprovação da Meta.',
    campos: [
      { id: 'app_id', rotulo: 'App ID', tipo: 'texto', placeholder: 'ID do app Meta', obrigatorio: true, ajuda: 'Identificador do aplicativo no Meta for Developers.' },
      { id: 'app_secret', rotulo: 'App Secret', tipo: 'senha', placeholder: 'Segredo do app', obrigatorio: true, ajuda: 'Segredo do aplicativo, disponível no painel da Meta.' },
      { id: 'access_token', rotulo: 'Access Token', tipo: 'senha', placeholder: 'Token de acesso', obrigatorio: true, ajuda: 'Token de longa duração com permissão de mensagens.' },
      { id: 'pagina_id', rotulo: 'ID da Página / IG Business', tipo: 'texto', placeholder: 'ID da página conectada', ajuda: 'Página do Instagram vinculada para o Direct.' },
    ],
  },
  {
    id: 'int-4',
    nome: 'VoIP (Click-to-Call)',
    icone: 'ri-phone-line',
    categoria: 'Telefonia',
    status: 'sandbox',
    ultimoTeste: 'há 3 dias',
    descricao: 'Ligações com log e gravação mediante consentimento.',
    campos: [
      { id: 'provedor', rotulo: 'Provedor', tipo: 'selecao', opcoes: ['Twilio', 'Vonage', 'TotalVoice'], obrigatorio: true, ajuda: 'Plataforma de telefonia que fará as chamadas.' },
      { id: 'account_sid', rotulo: 'Account SID / Usuário', tipo: 'texto', placeholder: 'Account SID da conta', obrigatorio: true, ajuda: 'Identificador da sua conta no provedor.' },
      { id: 'auth_token', rotulo: 'Auth Token / Senha', tipo: 'senha', placeholder: 'Token de autenticação', obrigatorio: true, ajuda: 'Credencial de autenticação do provedor.' },
      { id: 'numero_origem', rotulo: 'Número de origem', tipo: 'texto', placeholder: 'ex.: +55 11 99999-9999', obrigatorio: true, ajuda: 'Número contratado que aparecerá nas ligações.' },
    ],
  },
  {
    id: 'int-5',
    nome: 'Google Calendar',
    icone: 'ri-calendar-line',
    categoria: 'Agenda',
    status: 'conectado',
    ultimoTeste: 'há 5 min',
    descricao: 'Verificação de disponibilidade real antes de confirmar reuniões.',
    campos: [
      { id: 'client_id', rotulo: 'Client ID', tipo: 'texto', placeholder: 'Client ID OAuth', obrigatorio: true, ajuda: 'Identificador OAuth no Google Cloud Console.' },
      { id: 'client_secret', rotulo: 'Client Secret', tipo: 'senha', placeholder: 'Segredo OAuth', obrigatorio: true, ajuda: 'Segredo OAuth do seu projeto Google.' },
      { id: 'refresh_token', rotulo: 'Refresh Token', tipo: 'senha', placeholder: 'Token de atualização', ajuda: 'Token para renovar o acesso automaticamente.' },
      { id: 'calendario_id', rotulo: 'ID do calendário', tipo: 'texto', placeholder: 'primary', ajuda: 'Use "primary" para o calendário principal.' },
    ],
  },
  {
    id: 'int-6',
    nome: 'IA da Ana (OpenAI e Claude)',
    icone: 'ri-brain-line',
    categoria: 'Inteligência',
    status: 'conectado',
    ultimoTeste: 'há 2 min',
    descricao: 'Motor comercial da Ana. Configure OpenAI e/ou Claude; as chaves ficam somente no cofre do Backend.',
    campos: [
      { id: 'provedor_principal', rotulo: 'Provedor principal', tipo: 'selecao', opcoes: ['OpenAI', 'Claude'], obrigatorio: true, ajuda: 'Escolha qual IA a Ana usa primeiro.' },
      { id: 'openai_key', rotulo: 'API Key OpenAI (opcional)', tipo: 'senha', placeholder: 'sk-...', ajuda: 'OpenAI é o provedor principal quando configurado.' },
      { id: 'openai_model', rotulo: 'Modelo OpenAI', tipo: 'selecao', opcoes: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini'], ajuda: 'Modelo usado quando OpenAI for escolhida.' },
      { id: 'claude_key', rotulo: 'API Key Claude (opcional)', tipo: 'senha', placeholder: 'sk-ant-...', ajuda: 'Claude é usado quando a OpenAI não estiver configurada ou estiver indisponível.' },
      { id: 'claude_model', rotulo: 'Modelo Claude', tipo: 'selecao', opcoes: ['claude-sonnet-5', 'claude-haiku-4-5', 'claude-opus-5'], ajuda: 'Modelo usado quando Claude for escolhida.' },
    ],
  },
  {
    id: 'int-7',
    nome: 'Apify — Google Maps',
    icone: 'ri-map-pin-search-line',
    categoria: 'Busca de Leads',
    status: 'pendente',
    ultimoTeste: 'nunca',
    descricao: 'Busca empresas no Google Maps usando um Actor ou Task autorizado no Apify.',
    campos: [
      { id: 'api_token', rotulo: 'API Token', tipo: 'senha', placeholder: 'apify_api_...', obrigatorio: true, ajuda: 'Token criado no painel do Apify. Fica armazenado somente no cofre do Backend.' },
      { id: 'actor_id', rotulo: 'Actor ID (ou Task ID)', tipo: 'texto', placeholder: 'ex.: compass~crawler-google-places', ajuda: 'Informe o Actor ID. Para usar uma Task, deixe este campo vazio e use Task ID.' },
      { id: 'task_id', rotulo: 'Task ID (opcional)', tipo: 'texto', placeholder: 'ex.: sua-conta~minha-task', ajuda: 'Use Task ID quando sua busca já estiver configurada como uma Task no Apify.' },
      { id: 'input_json', rotulo: 'Entrada adicional (JSON opcional)', tipo: 'texto', placeholder: '{"language":"pt-BR"}', ajuda: 'Parâmetros extras específicos do seu Actor. Os filtros da tela sempre têm prioridade.' },
    ],
  },
  {
    id: 'int-8',
    nome: 'Google Places',
    icone: 'ri-google-line',
    categoria: 'Busca de Leads',
    status: 'pendente',
    ultimoTeste: 'nunca',
    descricao: 'Busca textual de empresas por atividade e localização usando a API do Google Places.',
    campos: [
      { id: 'api_key', rotulo: 'API Key', tipo: 'senha', placeholder: 'AIza...', obrigatorio: true, ajuda: 'Chave do Google Cloud com a Places API (New) habilitada. Fica armazenada no Backend.' },
    ],
  },
];

export const equipe: Membro[] = [
  { id: 'm-1', nome: 'Administrador', email: 'admin@wayflex.ind.br', cargo: 'Administrador', avatar: 'A', status: 'ativo', departamento: 'Direção' },
  { id: 'm-2', nome: 'Comercial Wayflex', email: 'comercial@wayflex.ind.br', cargo: 'Gestor Comercial', avatar: 'C', status: 'ativo', departamento: 'Comercial' },
  { id: 'm-3', nome: 'Vendedor Wayflex', email: 'vendas@wayflex.ind.br', cargo: 'Vendedor', avatar: 'V', status: 'ativo', departamento: 'Comercial' },
  { id: 'm-4', nome: 'Prospecção Wayflex', email: 'prospecao@wayflex.ind.br', cargo: 'SDR', avatar: 'P', status: 'ativo', departamento: 'Prospecção' },
  { id: 'm-5', nome: 'Atendimento Wayflex', email: 'atendimento@wayflex.ind.br', cargo: 'CX', avatar: 'X', status: 'inativo', departamento: 'Atendimento' },
];

export const documentos: Documento[] = [
  { id: 'doc-1', nome: 'Catálogo Wayflex 2021', categoria: 'Catálogo', formato: 'PDF', tamanho: '4,2 MB', versao: 'v1', autor: 'Comercial Wayflex', data: '2026-08-10', status: 'ativo', tags: ['catálogo', 'produtos'] },
  { id: 'doc-2', nome: 'Lista de produtos Wayflex', categoria: 'Catálogo', formato: 'XLSX', tamanho: '1,1 MB', versao: 'v1', autor: 'Comercial Wayflex', data: '2026-08-09', status: 'ativo', tags: ['produtos', 'lista'] },
  { id: 'doc-3', nome: 'FAQ de objeções comerciais', categoria: 'Vendas', formato: 'DOCX', tamanho: '380 KB', versao: 'v2', autor: 'Vendedor Wayflex', data: '2026-08-08', status: 'pronto', tags: ['objeções', 'vendas'] },
  { id: 'doc-4', nome: 'Política de privacidade (LGPD)', categoria: 'Jurídico', formato: 'PDF', tamanho: '210 KB', versao: 'v1', autor: 'Jurídico Wayflex', data: '2026-08-07', status: 'ativo', tags: ['lgpd', 'legal'] },
  { id: 'doc-5', nome: 'Roteiro de onboarding', categoria: 'Processos', formato: 'MD', tamanho: '24 KB', versao: 'v1', autor: 'Prospecção Wayflex', data: '2026-08-06', status: 'processando', tags: ['onboarding'] },
  { id: 'doc-6', nome: 'Cases de sucesso Wayflex', categoria: 'Provas sociais', formato: 'PDF', tamanho: '3,8 MB', versao: 'v1', autor: 'Comercial Wayflex', data: '2026-08-05', status: 'arquivado', tags: ['cases', 'resultados'] },
];

export const supressao: Supressao[] = [
  { id: 'sup-1', contato: 'contato_3f9a...c21b', canal: 'WhatsApp', motivo: 'Opt-out solicitado pelo lead', data: '2026-08-11', ator: 'Ana (IA)', origem: 'Webhook', status: 'ativo' },
  { id: 'sup-2', contato: 'contato_8b1c...d44e', canal: 'E-mail', motivo: 'Descadastrado via link', data: '2026-08-10', ator: 'Sistema', origem: 'Link de descadastro', status: 'ativo' },
  { id: 'sup-3', contato: 'contato_5e7d...a90f', canal: 'Telefone', motivo: 'Reclamação de contato', data: '2026-08-09', ator: 'Atendimento Wayflex', origem: 'Manual', status: 'reativado' },
  { id: 'sup-4', contato: 'contato_1a2b...f33c', canal: 'Instagram', motivo: 'Pedido para não ser contatado', data: '2026-08-08', ator: 'Ana (IA)', origem: 'Webhook', status: 'ativo' },
];

export const templatesAbordagem = {
  whatsapp:
    'Olá {nome}! Tudo bem? Aqui é a Ana, assistente virtual da Wayflex.\n\nPercebi que a {empresa} pode se beneficiar com nossas soluções em artefatos de borracha, silicone e poliuretano.\n\nPodemos conversar rapidinho?',
  email:
    'Olá {nome},\n\nMeu nome é Ana, da Wayflex. Vi que a {empresa} atua no segmento de {segmento} e acredito que podemos ajudar com soluções de vedação, peças técnicas e acessórios industriais.\n\nEstou à disposição para uma conversa sem compromisso.\n\nUm abraço,\nAna | Wayflex',
  telefone:
    'Olá, aqui é da Wayflex. Posso falar rapidinho com {nome} sobre uma oportunidade para a {empresa}?',
};
