// ================= STATE & DATABASE SEED =================
const state = {
  activeUser: { id: 'u1', name: 'Fabrício Admin', role: 'Administrador', avatar: 'F', email: 'comercial@wfdigital.com.br' },
  
  users: [
    { id: 'u1', name: 'Fabrício Admin', email: 'comercial@wfdigital.com.br', phone: '(11) 99000-0001', role: 'Administrador', leads: 0, canUseIA: true, discountLimit: 'Sem limite', active: true, avatar: 'F' },
    { id: 'u2', name: 'Marina Vendas', email: 'marina@wfdigital.com.br', phone: '(11) 99000-0002', role: 'Vendedor', leads: 4, canUseIA: true, discountLimit: '10%', active: true, avatar: 'M' },
    { id: 'u3', name: 'Roberto KA', email: 'roberto@wfdigital.com.br', phone: '(11) 99000-0003', role: 'Vendedor', leads: 2, canUseIA: true, discountLimit: '5%', active: true, avatar: 'R' },
    { id: 'u4', name: 'Carlos SDR', email: 'carlos@wfdigital.com.br', phone: '(11) 99000-0004', role: 'Vendedor', leads: 0, canUseIA: false, discountLimit: 'Até 5%', active: true, avatar: 'C' },
    { id: 'u5', name: 'Patrícia CX', email: 'patricia@wfdigital.com.br', phone: '(11) 99000-0005', role: 'Vendedor', leads: 0, canUseIA: true, discountLimit: 'Até 10%', active: true, avatar: 'P' },
    { id: 'u_ia', name: 'Ana (IA)', email: 'ana@wfdigital.com.br', phone: '(11) 99000-9999', role: 'Vendedor Virtual', leads: 6, canUseIA: true, discountLimit: '10%', active: true, avatar: '◈' }
  ],
  
  services: [
    { id: 's1', name: 'Assessoria de IA Comercial', category: 'Tecnologia', desc: 'Implantação de vendedor virtual integrado ao WhatsApp Business API.', price: 5000, unit: 'projeto', term: '15 dias', maxDiscount: 10 },
    { id: 's2', name: 'Mensalidade Vendedor Virtual', category: 'Recorrente', desc: 'Disponibilização da IA Ana rodando 24h e hospedagem Supabase.', price: 490, unit: 'mês', term: 'Mensal', maxDiscount: 5 },
    { id: 's3', name: 'Curadoria de Base de Conhecimento', category: 'Consultoria', desc: 'Alimentação e correção de perguntas da IA por especialista.', price: 1500, unit: 'projeto', term: '7 dias', maxDiscount: 15 },
    { id: 's4', name: 'Setup de Integração CRM', category: 'Tecnologia', desc: 'Conectar funil a ERP de saída e gateways de faturamento.', price: 2000, unit: 'projeto', term: '10 dias', maxDiscount: 10 }
  ],
  
  objections: [
    { id: 'o1', trigger: 'Está caro / Não tenho dinheiro', response: 'A Ana reposiciona o valor demonstrando que o custo mensal da IA é menor que 10% do custo de um SDR ou vendedor CLT júnior, além de trabalhar 24h.' },
    { id: 'o2', trigger: 'Vou pensar / Retorno depois', response: 'A Ana concorda, envia o catálogo completo em formato PDF e agenda uma tarefa comercial automática para follow-up amigável em 3 dias.' },
    { id: 'o3', trigger: 'Já tenho fornecedor / Já faço isso', response: 'A Ana propõe um teste piloto de 14 dias sem compromisso, indexando a base com 5 perguntas frequentes deles para provar a assertividade.' }
  ],
  
  leads: [
    { id: 'l1', company: 'Aço Vale', contact: 'Renato Souza', title: 'Diretor Comercial', phone: '(11) 98231-4402', segment: 'Indústrias Metalúrgicas', uf: 'SP', distance: 12, score: 91, temp: 'hot', stage: 'Negociação', value: 8500, owner: 'ia', staleHours: 4, escalated: true, escalationReason: 'Pediu 18% de desconto; a alçada da IA é 10%', slaInfo: '⚠ escalado', lastContact: 'Hoje, 12:40', assignedTo: null },
    { id: 'l2', company: 'Sabor Mineiro', contact: 'Gisele Santos', title: 'Proprietária', phone: '(31) 97723-5599', segment: 'Serviços Médicos', uf: 'MG', distance: 340, score: 78, temp: 'hot', stage: 'Proposta', value: 5000, owner: 'ia', staleHours: 1, escalated: false, escalationReason: '', slaInfo: 'sugestão pronta', lastContact: 'Hoje, 10:15', assignedTo: null },
    { id: 'l3', company: 'Ápice Contábil', contact: 'Marcos Silva', title: 'Sócio', phone: '(11) 96655-1122', segment: 'Tecnologia', uf: 'SP', distance: 8, score: 85, temp: 'hot', stage: 'Qualificado', value: 5000, owner: 'ia', staleHours: 49, escalated: false, escalationReason: '', slaInfo: '3d parado', lastContact: 'Há 3 dias', assignedTo: null },
    { id: 'l4', company: 'TechFrota', contact: 'Júlia Mendes', title: 'Gerente Comercial', phone: '(21) 99881-2244', segment: 'Tecnologia', uf: 'RJ', distance: 410, score: 82, temp: 'hot', stage: 'Prospecção', value: 7000, owner: 'ia', staleHours: 0, escalated: false, escalationReason: '', slaInfo: 'vence hoje', lastContact: 'Hoje, 09:30', assignedTo: null },
    { id: 'l5', company: 'Corpo em Movimento', contact: 'Dr. Fabiano', title: 'Diretor', phone: '(11) 98822-7711', segment: 'Serviços Médicos', uf: 'SP', distance: 15, score: 71, temp: 'warm', stage: 'Proposta', value: 5490, owner: 'human', ownerName: 'Marina Vendas', staleHours: 24, escalated: false, escalationReason: '', slaInfo: '8 dias', lastContact: 'Ontem, 15:40', assignedTo: null },
    { id: 'l6', company: 'Rota Sul Cargas', contact: 'Eduardo Lima', title: 'CEO', phone: '(51) 95532-6633', segment: 'Tecnologia', uf: 'RS', distance: 950, score: 64, temp: 'warm', stage: 'Negociação', value: 12000, owner: 'human', ownerName: 'Marina Vendas', staleHours: 52, escalated: false, escalationReason: '', slaInfo: '3d parado', lastContact: 'Há 3 dias', assignedTo: null },
    { id: 'l7', company: 'Semente Ouro', contact: 'Amanda Costa', title: 'Comercial', phone: '(62) 94411-9988', segment: 'Outro', uf: 'GO', distance: 880, score: 55, temp: 'warm', stage: 'Qualificado', value: 6500, owner: 'human', ownerName: 'Marina Vendas', staleHours: 12, escalated: false, escalationReason: '', slaInfo: '8 dias', lastContact: 'Hoje, 08:00', assignedTo: null },
    { id: 'l8', company: 'Farmácias Vida Plena', contact: 'Roberto Albuquerque', title: 'Diretor Compras', phone: '(11) 93322-8877', segment: 'Serviços Médicos', uf: 'SP', distance: 20, score: 88, temp: 'hot', stage: 'Fechado', value: 7000, owner: 'human', ownerName: 'Marina Vendas', staleHours: 0, escalated: false, escalationReason: '', slaInfo: '✓ pedido', lastContact: 'Ontem, 17:30', assignedTo: null },
    { id: 'l9', company: 'Bella Napoli', contact: 'Giovanni', title: 'Sócio', phone: '(11) 92211-5544', segment: 'Outro', uf: 'SP', distance: 5, score: 48, temp: 'warm', stage: 'Prospecção', value: 2490, owner: 'human', ownerName: 'Roberto KA', staleHours: 6, escalated: false, escalationReason: '', slaInfo: '8 dias', lastContact: 'Hoje, 14:10', assignedTo: null },
    { id: 'l10', company: 'Alicerce Forte', contact: 'Carlos Ramos', title: 'Engenheiro Chefe', phone: '(21) 91100-3322', segment: 'Indústrias Metalúrgicas', uf: 'RJ', distance: 430, score: 62, temp: 'warm', stage: 'Negociação', value: 15000, owner: 'human', ownerName: 'Roberto KA', staleHours: 36, escalated: false, escalationReason: '', slaInfo: '8 dias', lastContact: 'Ontem, 09:15', assignedTo: null },
    { id: 'l11', company: 'Sorriso Prime', contact: 'Dra. Sandra', title: 'Diretora Clínicas', phone: '(11) 97766-4433', segment: 'Serviços Médicos', uf: 'SP', distance: 18, score: 82, temp: 'hot', stage: 'Pedido', value: 10000, owner: 'ia', staleHours: 0, escalated: false, escalationReason: '', slaInfo: '✓ pedido', lastContact: 'Ontem, 11:30', assignedTo: null },
    { id: 'l12', company: 'Global Talk', contact: 'Peter Jordan', title: 'CEO', phone: '(11) 96655-4422', segment: 'Tecnologia', uf: 'SP', distance: 10, score: 38, temp: 'cold', stage: 'Perdido', value: 5000, owner: 'ia', staleHours: 0, escalated: false, escalationReason: '', slaInfo: 'descartado', lastContact: '08/07/2026', lostReason: 'Preço', assignedTo: null }
  ],
  
  proposals: [
    { id: 'pr1', number: '#0142', leadId: 'l1', client: 'Aço Vale', items: 'Assessoria de IA + 12m Mensalidade', value: 10880, discount: '18% — acima da alçada', creator: 'ia', status: '⚠ Precisa da sua aprovação', needApproval: true },
    { id: 'pr2', number: '#0143', leadId: 'l2', client: 'Sabor Mineiro', items: 'Assessoria de IA Comercial', value: 5000, discount: '0% — dentro da alçada', creator: 'ia', status: 'Aguardando cliente', needApproval: false },
    { id: 'pr3', number: '#0144', leadId: 'l5', client: 'Corpo em Movimento', items: 'Assessoria de IA + Setup', value: 7000, discount: '5% — dentro da alçada', creator: 'Marina Vendas', status: 'Aguardando cliente', needApproval: false },
    { id: 'pr4', number: '#0145', leadId: 'l8', client: 'Farmácias Vida Plena', items: 'Assessoria de IA Comercial', value: 5000, discount: '10% — dentro da alçada', creator: 'Marina Vendas', status: 'Aceita', needApproval: false }
  ],
  
  orders: [
    { id: 'o_2026_041', number: '#2026-041', company: 'Farmácias Vida Plena', seller: 'Marina Vendas', sellerType: 'human', date: '10/07/2026', items: 'Assessoria de IA Comercial', value: 4500, payment: 'Pix à vista', contract: '✓ Assinado', status: 'Pago' },
    { id: 'o_2026_042', number: '#2026-042', company: 'Sorriso Prime', seller: 'Ana (IA)', sellerType: 'ia', date: '10/07/2026', items: 'Assessoria + Setup CRM', value: 7000, payment: 'Boleto faturado', contract: '✓ Assinado', status: 'Em execução · 40%' },
    { id: 'o_2026_043', number: '#2026-043', company: 'Aço Vale', seller: 'Ana (IA)', sellerType: 'ia', date: 'Hoje', items: 'Assessoria + 12m Mensalidade', value: 8920, payment: 'Cartão 6x', contract: 'Aguardando assinatura', status: 'Aguardando pagamento' },
    { id: 'o_2026_044', number: '#2026-044', company: 'Semente Ouro', seller: 'Marina Vendas', sellerType: 'human', date: '08/07/2026', items: 'Setup de Integração CRM', value: 2000, payment: 'Pix à vista', contract: '✓ Assinado', status: '⚠ Vencido há 3 dias' }
  ],
  
  docs: [
    { id: 'd1', name: 'Apresentacao_Corporativa_WF_2026.pdf', type: 'Institucional', date: '01/07/2026', size: '1.8 MB', uses: 24, status: '✓ Indexado' },
    { id: 'd2', name: 'Tabela_Precos_Modelos_Agentes.xlsx', type: 'Catálogo', date: '01/07/2026', size: '420 KB', uses: 48, status: '✓ Indexado' },
    { id: 'd3', name: 'Politica_Seguranca_LGPD_Dados.pdf', type: 'Jurídico', date: '05/07/2026', size: '1.1 MB', uses: 8, status: '✓ Indexado' },
    { id: 'd4', name: 'Folder_Tecnico_Integracoes_ERP.pdf', type: 'Técnico', date: '06/07/2026', size: '2.5 MB', uses: 2, status: 'Processando...' }
  ],
  
  unanswered: [
    { id: 'q1', text: 'Vocês têm integração nativa com o ERP SAP Business One?', count: 8 },
    { id: 'q2', text: 'A homologação do número na Meta é por conta de vocês?', count: 5 },
    { id: 'q3', text: 'É possível fazer disparo ativo sem risco de banimento?', count: 3 }
  ],
  
  tasks: [
    { id: 't1', text: 'Enviar proposta revisada para Aço Vale', time: '14:30', owner: 'Fabrício Admin', completed: false },
    { id: 't2', text: 'Ligar para Sabor Mineiro confirmando recebimento', time: '16:00', owner: 'Ana (IA)', completed: false },
    { id: 't3', text: 'Homologar contrato assinado Farmácias Vida Plena', time: '17:00', owner: 'Marina Vendas', completed: true }
  ],
  
  auditLogs: [
    { time: '12:40', actor: 'Ana (IA)', actorType: 'ia', action: 'Pausou negociação com Aço Vale', detail: 'Desconto solicitado de 18% ultrapassou a alçada de 10% do vendedor virtual.', rule: 'regra: alçada de desconto' },
    { time: '12:15', actor: 'Ana (IA)', actorType: 'ia', action: 'Enviou proposta comercial para Sabor Mineiro', detail: 'Orçamento #0143 de R$ 5.000,00 gerado de acordo com catálogo.', rule: 'catálogo + regra de preço' },
    { time: '10:05', actor: 'Marina Vendas', actorType: 'human', action: 'Assumiu atendimento de Corpo em Movimento', detail: 'Cliente solicitou falar com atendente humano.', rule: 'intervenção humana' },
    { time: 'Ontem', actor: 'Fabrício Admin', actorType: 'human', action: 'Alterou desconto máximo da IA no catálogo', detail: 'Ajustou desconto limite do serviço s2 de 10% para 5%.', rule: 'parâmetros do sistema' },
    { time: 'Ontem', actor: 'Ana (IA)', actorType: 'ia', action: 'Registrou venda e gerou pedido #2026-041', detail: 'Contrato enviado eletronicamente e Pix emitido.', rule: 'aceite de proposta comercial' }
  ],
  
  chatHistory: {
    'l1': [
      { sender: 'ia', senderName: 'Ana (IA)', type: 'ia', text: 'Olá, Renato! Sou a Ana da WF Digital. Vi que a Aço Vale atua no segmento de Indústrias Metalúrgicas em Volta Redonda. Nós ajudamos indústrias a automatizar a prospecção B2B de forma 100% autônoma. Teria 5 minutos para conversarmos sobre como estruturar sua máquina comercial?', time: '12:30' },
      { sender: 'client', senderName: 'Renato Souza', type: 'client', text: 'Olá, Ana. Sim, estamos buscando algo desse tipo. Nosso time comercial gasta muito tempo prospectando. Qual o valor da ferramenta?', time: '12:32' },
      { sender: 'ia', senderName: 'Ana (IA)', type: 'ia', text: 'Perfeito! Para indústrias, costumamos implantar nossa Assessoria de IA Comercial para configurar o agente com seu tom de voz e base de conhecimento, além do licenciamento mensal. O valor do projeto de assessoria é R$ 5.000,00 (taxa única) e a licença comercial é R$ 490,00/mês.', time: '12:35' },
      { sender: 'client', senderName: 'Renato Souza', type: 'client', text: 'Legal, mas se fecharmos a assessoria mais 12 meses de mensalidade fechado, consegue fazer um desconto bom? Se fizer por R$ 8.920,00 fechamos agora.', time: '12:38' },
      { sender: 'ia', senderName: 'Ana (IA)', type: 'ia-escalated', text: 'Renato, esse desconto totaliza 18% sobre o valor de tabela (R$ 10.880,00). Vou verificar essa margem especial com nosso diretor comercial e retorno em instantes com a aprovação formal do orçamento. Pode ser?', time: '12:40' }
    ],
    'l2': [
      { sender: 'ia', senderName: 'Ana (IA)', type: 'ia', text: 'Olá, Gisele! Vi que a Sabor Mineiro atua no ramo alimentício em BH. Nós ajudamos a mapear leads qualificados. Teria interesse?', time: '10:00' },
      { sender: 'client', senderName: 'Gisele Santos', type: 'client', text: 'Sim, qual é o preço da assessoria de implantação?', time: '10:10' }
    ],
    'l3': [
      { sender: 'ia', senderName: 'Ana (IA)', type: 'ia', text: 'Olá, Marcos! Sou a Ana da WF Digital. Escritórios contábeis como o Ápice têm reduzido em 60% o tempo de prospecção com nosso vendedor virtual. Posso te mostrar como funciona?', time: 'Há 3 dias' },
      { sender: 'client', senderName: 'Marcos Silva', type: 'client', text: 'Pode enviar mais detalhes por aqui mesmo.', time: 'Há 3 dias' },
      { sender: 'ia', senderName: 'Ana (IA)', type: 'ia', text: 'Claro! Enviei nossa apresentação em PDF. O projeto de implantação é R$ 5.000 + licença de R$ 490/mês. Qual seria o melhor dia para uma demonstração de 20 minutos?', time: 'Há 3 dias' }
    ],
    'l5': [
      { sender: 'human', senderName: 'Marina Vendas', type: 'human', text: 'Dr. Fabiano, boa tarde! Segue a proposta #0144 revisada com o setup incluso, conforme conversamos.', time: 'Ontem, 15:40' },
      { sender: 'client', senderName: 'Dr. Fabiano', type: 'client', text: 'Recebido, Marina. Vou analisar com meu sócio e retorno até sexta.', time: 'Ontem, 16:02' }
    ],
    'l11': [
      { sender: 'ia', senderName: 'Ana (IA)', type: 'ia', text: 'Dra. Sandra, contrato assinado e pedido #2026-042 gerado! Nossa equipe técnica inicia o setup amanhã. Obrigada pela confiança!', time: 'Ontem, 11:30' },
      { sender: 'client', senderName: 'Dra. Sandra', type: 'client', text: 'Perfeito, Ana! Ficamos no aguardo do cronograma.', time: 'Ontem, 11:45' }
    ]
  },
  
  activeLeadId: 'l1',
  aiPaused: false,

  // --- PORTAL DO VENDEDOR: sessao ativa e historico de tempo conectado ---
  vendorSession: { loggedIn: false, userId: null, startedAt: null, otp: null, token: null },
  vendorSessions: [
    { userId: 'u2', userName: 'Marina Vendas', start: '08:12', end: '12:04', minutes: 232, date: '11/07/2026' },
    { userId: 'u3', userName: 'Roberto KA',    start: '09:30', end: '11:15', minutes: 105, date: '11/07/2026' }
  ],
  vendorActiveLeadId: null,
  weights: {
    segment: 30,
    whatsapp: 20,
    site: 15,
    porte: 15,
    google: 10,
    regiao: 10
  }
};

// ================= INITIALIZATION & ROUTING =================
document.addEventListener("DOMContentLoaded", () => {
  // Check if session is already logged in for dev convenience, otherwise show overlay
  renderAll();
});

function handleLogin() {
  const overlay = document.getElementById("login-overlay");
  overlay.style.opacity = "0";
  setTimeout(() => {
    overlay.style.display = "none";
    showNotification("Seja bem-vindo, Fabrício Admin!");
  }, 300);
}

function handleLogout() {
  const overlay = document.getElementById("login-overlay");
  overlay.style.display = "flex";
  setTimeout(() => {
    overlay.style.opacity = "1";
    showNotification("Sessão comercial encerrada.");
  }, 50);
}

function switchPanel(panelId, element) {
  // Hide all panels
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  
  // Show target panel
  const target = document.getElementById(`panel-${panelId}`);
  if (target) {
    target.classList.add("active");
    target.classList.add("fade-in");
  }
  
  // Update sidebar active state
  document.querySelectorAll(".sidebar-link").forEach(l => l.classList.remove("active"));
  if (element) {
    element.classList.add("active");
  } else {
    // Find link by click handler pattern or manual index matching
    const links = document.querySelectorAll(".sidebar-nav a");
    links.forEach(l => {
      if (l.getAttribute("onclick").includes(`'${panelId}'`)) {
        l.classList.add("active");
      }
    });
  }
  
  // Update page header titles
  const title = document.getElementById("page-title");
  const subtitle = document.getElementById("page-subtitle");
  
  const headers = {
    'dashboard': ['Dashboard', 'Saudação comercial e indicadores diários'],
    'company': ['Minha Empresa', 'Os dados configurados aqui alimentam o score de leads e o vendedor virtual'],
    'prospecting': ['Prospecção Comercial B2B', 'Busque empresas, analise a probabilidade de negócio e converta em leads comerciais'],
    'leads': ['Gestão de Leads Comerciais', 'Pipeline de leads e interações comerciais'],
    'lead-detail': ['Detalhe do Lead Comercial', 'Histórico completo de negociações e chat integrado'],
    'central': ['Central de Contatos', 'Fila de interações e escalonamentos da IA Ana'],
    'budgets': ['Orçamentos e Precificação', 'Gestão de propostas, catálogo de serviços e base de conhecimento da IA'],
    'vendor-portal': ['Portal do Vendedor', 'Visão personalizada de performance comercial e metas comerciais'],
    'orders': ['Pedidos Comerciais', 'Acompanhamento pós-fechamento do funil comercial'],
    'reports': ['Relatórios Comerciais', 'Performance comercial detalhada e insights de negócio'],
    'settings': ['Configurações do Sistema', 'Usuários, integrações, limites da IA e logs de auditoria comercial']
  };
  
  if (headers[panelId]) {
    title.innerText = headers[panelId][0];
    subtitle.innerText = headers[panelId][1];
  }
  
  // Specific panel triggers
  if (panelId === 'dashboard') renderDashboard();
  if (panelId === 'leads') renderLeadsBoard();
  if (panelId === 'lead-detail') renderLeadDetail();
  if (panelId === 'central') renderCentral();
  if (panelId === 'budgets') renderBudgets();
  if (panelId === 'vendor-portal') renderVendorPortal();
  if (panelId === 'orders') renderOrders();
  if (panelId === 'reports') renderReports();
  if (panelId === 'settings') renderSettings();
  if (panelId === 'company') renderCompany();
}

function switchSubTab(parentPanel, tabId, element) {
  // Hide all tab panels
  document.querySelectorAll(`#panel-${parentPanel} .tab-panel`).forEach(tp => tp.classList.remove("active"));
  // Show active
  const activeTabPanel = document.getElementById(`tab-${parentPanel}-${tabId}`);
  if (activeTabPanel) {
    activeTabPanel.classList.add("active");
    activeTabPanel.classList.add("fade-in");
  }
  
  // Set tab link active styling
  document.querySelectorAll(`#panel-${parentPanel} .tab-link`).forEach(tl => tl.classList.remove("active"));
  if (element) element.classList.add("active");
}

// ================= CORE RENDERING ENGINE =================
function renderAll() {
  renderDashboard();
  renderCompany();
  renderLeadsBoard();
  renderCentral();
  renderBudgets();
  renderVendorPortal();
  renderOrders();
  renderReports();
  renderVendorSessions();
  renderSettings();
  updateSidebarCounters();
}

function updateSidebarCounters() {
  const escalatedCount = state.leads.filter(l => l.escalated && l.stage !== 'Perdido' && l.stage !== 'Pedido').length;
  const activeLeadsCount = state.leads.filter(l => l.stage !== 'Perdido' && l.stage !== 'Pedido').length;
  
  const escBadge = document.getElementById("sidebar-escalated-count");
  const leadsBadge = document.getElementById("sidebar-leads-count");
  const dashboardBadge = document.getElementById("alert-escalation-count");
  const kpiNeedsHuman = document.getElementById("kpi-needs-human");
  
  if (escBadge) escBadge.innerText = escalatedCount;
  if (leadsBadge) leadsBadge.innerText = activeLeadsCount;
  if (dashboardBadge) dashboardBadge.innerText = `${escalatedCount} pendentes`;
  if (kpiNeedsHuman) kpiNeedsHuman.innerText = escalatedCount;
}

// ================= TOAST ALERTS =================
function showNotification(text) {
  const toast = document.getElementById("crm-toast");
  const toastText = document.getElementById("crm-toast-text");
  toastText.innerText = text;
  toast.style.display = "flex";
  
  setTimeout(() => {
    toast.style.opacity = "1";
  }, 10);
  
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      toast.style.display = "none";
    }, 300);
  }, 3500);
}

// ================= TELA 01 · DASHBOARD =================
function renderDashboard() {
  // Update salutation based on user
  document.getElementById("dashboard-salutation").innerText = `Boa tarde, ${state.activeUser.name} 👋`;
  
  // Update summary numbers
  const iaConversations = state.leads.filter(l => l.owner === 'ia' && l.stage !== 'Perdido').length;
  const humanRequired = state.leads.filter(l => l.escalated && l.stage !== 'Perdido').length;
  document.getElementById("dashboard-summary-text").innerText = `A IA conduziu ${iaConversations} conversas hoje. ${humanRequired} precisam de você agora.`;
  
  // Escalations List
  const listBody = document.getElementById("dashboard-escalations-list");
  listBody.innerHTML = "";
  const escalated = state.leads.filter(l => l.escalated && l.stage !== 'Perdido');
  
  if (escalated.length === 0) {
    listBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-ter); padding: 24px;">Nenhum lead precisa de intervenção no momento!</td></tr>`;
  } else {
    escalated.forEach(lead => {
      const tr = document.createElement("tr");
      tr.className = "row-alert";
      tr.innerHTML = `
        <td>
          <div class="d-flex align-items-center gap-2">
            <span class="user-avatar avatar-ia" style="width: 24px; height: 24px; font-size: 10px;">◈</span>
            <div class="d-flex flex-column">
              <strong>${lead.company}</strong>
              <span style="font-size: 11px; color: var(--text-sec);">${lead.contact}</span>
            </div>
          </div>
        </td>
        <td>
          <span class="badge badge-hot" style="font-size: 11px;">${lead.escalationReason}</span>
        </td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-purple" onclick="viewLeadDetail('${lead.id}')">Assumir</button>
        </td>
      `;
      listBody.appendChild(tr);
    });
  }
  
  // Funnel Bars
  const funnelContainer = document.getElementById("dashboard-funnel-chart");
  funnelContainer.innerHTML = "";
  const stages = ['Prospecção', 'Qualificado', 'Proposta', 'Negociação', 'Fechado', 'Pedido'];
  const maxCount = Math.max(...stages.map(st => state.leads.filter(l => l.stage === st).length), 1);
  
  stages.forEach(stage => {
    const stageLeads = state.leads.filter(l => l.stage === stage);
    const count = stageLeads.length;
    const value = stageLeads.reduce((acc, c) => acc + c.value, 0);
    const pct = (count / maxCount) * 100;
    
    let color = 'var(--color-cold)';
    if (stage === 'Qualificado') color = 'var(--color-ia)';
    if (stage === 'Proposta') color = 'var(--color-warm)';
    if (stage === 'Negociação') color = '#A78BFA';
    if (stage === 'Fechado') color = 'var(--color-success)';
    if (stage === 'Pedido') color = 'var(--primary)';
    
    const div = document.createElement("div");
    div.innerHTML = `
      <div class="d-flex justify-content-between" style="font-size: 11px; margin-bottom: 2px;">
        <span style="font-weight: 600;">${stage} (${count})</span>
        <span style="color: var(--text-sec);">R$ ${(value / 1000).toFixed(1)}k</span>
      </div>
      <div class="chart-bar-horizontal">
        <div class="chart-bar-fill" style="width: ${pct}%; background-color: ${color};"></div>
      </div>
    `;
    funnelContainer.appendChild(div);
  });
  
  // Tasks List
  const tasksList = document.getElementById("dashboard-tasks-list");
  tasksList.innerHTML = "";
  if (state.tasks.length === 0) {
    tasksList.innerHTML = `<span style="font-size:12px; color: var(--text-ter); text-align: center;">Nenhuma tarefa pendente comercial.</span>`;
  } else {
    state.tasks.forEach(task => {
      const div = document.createElement("div");
      div.className = "d-flex justify-content-between align-items-center";
      div.innerHTML = `
        <label class="d-flex align-items-center gap-2" style="cursor: pointer; font-size:12.5px;">
          <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${task.id}')">
          <span style="${task.completed ? 'text-decoration: line-through; color: var(--text-ter);' : ''}">${task.text}</span>
        </label>
        <span style="font-size:11px; color: var(--text-sec);">${task.time} · <strong>${task.owner}</strong></span>
      `;
      tasksList.appendChild(div);
    });
  }
  
  // Timeline Activities
  const timeline = document.getElementById("dashboard-timeline");
  timeline.innerHTML = "";
  state.auditLogs.slice(0, 4).forEach(log => {
    const item = document.createElement("div");
    item.className = "timeline-item";
    
    let markerClass = log.actorType === 'ia' ? 'ia' : 'human';
    if (log.action.includes('Pedido') || log.action.includes('venda')) markerClass = 'success';
    
    item.innerHTML = `
      <div class="timeline-marker ${markerClass}"></div>
      <div class="timeline-content">
        <strong style="font-size:12.5px; color: var(--text-title);">${log.action}</strong>
        <span style="font-size: 11px; color: var(--text-sec); margin-top: 2px;">${log.detail}</span>
        <span class="timeline-time">${log.time} · ${log.rule}</span>
      </div>
    `;
    timeline.appendChild(item);
  });
  
  // Main KPIs
  document.getElementById("kpi-ia-active").innerText = state.leads.filter(l => l.owner === 'ia' && l.stage !== 'Pedido' && l.stage !== 'Perdido').length;
  document.getElementById("kpi-leads-total").innerText = state.leads.length;
  document.getElementById("kpi-leads-hot").innerText = state.leads.filter(l => l.temp === 'hot').length;
  
  // Calculate forecast: weighted value (hot: 80%, warm: 50%, cold: 10%, closed: 100%)
  let forecastVal = 0;
  state.leads.forEach(l => {
    if (l.stage === 'Perdido') return;
    let multiplier = 0.1;
    if (l.stage === 'Fechado' || l.stage === 'Pedido') multiplier = 1.0;
    else if (l.temp === 'hot') multiplier = 0.8;
    else if (l.temp === 'warm') multiplier = 0.5;
    forecastVal += l.value * multiplier;
  });
  document.getElementById("kpi-forecast").innerText = `R$ ${(forecastVal/1000).toFixed(1)}k`;
  
  const closedVal = state.leads.filter(l => l.stage === 'Fechado' || l.stage === 'Pedido').reduce((acc, c) => acc + c.value, 0);
  document.getElementById("kpi-closed-value").innerText = `R$ ${(closedVal/1000).toFixed(1)}k`;
}

function toggleTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (task) {
    task.completed = !task.completed;
    showNotification(`Tarefa comercial atualizada!`);
    renderDashboard();
  }
}

function addNewTask() {
  crmPrompt("Nova tarefa comercial", [
    { id: 'text', label: 'Descrição da tarefa', placeholder: 'ex: Ligar para o cliente X às 15h' }
  ], v => {
    if (!v.text) return;
    state.tasks.unshift({
      id: `t${Date.now()}`,
      text: v.text,
      time: 'Hoje, ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      owner: state.activeUser.name,
      completed: false
    });
    showNotification("Tarefa comercial agendada!");
    renderDashboard();
  }, "Agendar");
}

// ================= TELA 02-05 · MINHA EMPRESA =================
function renderCompany() {
  // Aba 3 Services list
  const servicesBody = document.getElementById("company-services-list");
  servicesBody.innerHTML = "";
  
  state.services.forEach(serv => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <strong>${serv.name}</strong><br>
        <span class="badge badge-gray" style="font-size:10px; margin-top:2px;">${serv.category}</span>
      </td>
      <td style="font-size: 12px; color: var(--text-sec); max-width: 250px;">${serv.desc}</td>
      <td>R$ ${serv.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / ${serv.unit}</td>
      <td>${serv.term}</td>
      <td>
        <span class="badge badge-ia">${serv.maxDiscount}% desconto</span>
      </td>
      <td style="text-align: right;">
        <button class="btn btn-sm btn-icon" onclick="editService('${serv.id}')">✏</button>
      </td>
    `;
    servicesBody.appendChild(tr);
  });
  
  // Aba 4 Objections list
  const objBody = document.getElementById("company-objections-list");
  objBody.innerHTML = "";
  
  state.objections.forEach(obj => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong style="color: var(--text-title); font-size:12.5px;">"${obj.trigger}"</strong></td>
      <td style="font-size: 12px; color: var(--text-sec);">${obj.response}</td>
      <td style="text-align: right;">
        <button class="btn btn-sm btn-icon" onclick="removeObjection('${obj.id}')">🗑</button>
      </td>
    `;
    objBody.appendChild(tr);
  });
}

function removeChip(btn) {
  btn.parentElement.remove();
}

function addChip(containerId) {
  crmPrompt("Nova tag comercial", [
    { id: 'text', label: 'Nome da tag', placeholder: 'ex: Clínicas Odontológicas' }
  ], v => {
    if (!v.text) return;
    const container = document.getElementById(containerId);
    const addBtn = container.querySelector(".chip-add");
    const span = document.createElement("span");
    span.className = "chip";
    span.innerHTML = `${v.text}<button class="chip-remove" onclick="removeChip(this)">×</button>`;
    container.insertBefore(span, addBtn);
  }, "Adicionar");
}

function updateScoreWeightVal(slider) {
  const label = slider.nextElementSibling;
  label.innerText = slider.value;
  
  // Re-sum weights
  const sliders = document.querySelectorAll(".score-slider-input");
  let sum = 0;
  sliders.forEach(s => sum += parseInt(s.value));
  
  const sumLabel = document.getElementById("score-weights-sum");
  sumLabel.innerText = `${sum} / 100`;
  
  if (sum === 100) {
    sumLabel.style.color = "var(--primary)";
  } else {
    sumLabel.style.color = "var(--color-error)";
  }
}

function openNewServiceModal() {
  openModal("modal-novo-servico");
}

function saveNewService() {
  const name = document.getElementById("new-service-name").value;
  const cat = document.getElementById("new-service-cat").value;
  const desc = document.getElementById("new-service-desc").value;
  const price = parseFloat(document.getElementById("new-service-price").value);
  const unit = document.getElementById("new-service-unit").value;
  const discount = parseInt(document.getElementById("new-service-discount").value);
  const term = document.getElementById("new-service-term").value;
  
  state.services.push({
    id: `s${Date.now()}`,
    name, category: cat, desc, price, unit, maxDiscount: discount, term
  });
  
  closeModal("modal-novo-servico");
  showNotification("Novo serviço cadastrado com sucesso!");
  renderCompany();
}

function addNewObjectionRow() {
  crmPrompt("Nova objeção comercial", [
    { id: 'trigger', label: 'Quando o cliente disser:', placeholder: 'ex: Está caro / Não tenho verba' },
    { id: 'response', label: 'A Ana deve responder:', type: 'textarea', placeholder: 'Como a IA reposiciona o valor...' }
  ], v => {
    if (!v.trigger || !v.response) { showNotification("Preencha os dois campos."); return; }
    state.objections.push({ id: `o${Date.now()}`, trigger: v.trigger, response: v.response });
    renderCompany();
    showNotification("Objeção cadastrada!");
  }, "Cadastrar");
}

function removeObjection(id) {
  state.objections = state.objections.filter(o => o.id !== id);
  renderCompany();
  showNotification("Objeção excluída.");
}

// Mini Chat Simulator Logic
function handleMiniChatSend() {
  const input = document.getElementById("mini-chat-input");
  const msg = input.value.trim();
  if (!msg) return;
  
  const box = document.getElementById("mini-chat-messages-box");
  
  // Add User bubble
  const uBubble = document.createElement("div");
  uBubble.className = "chat-bubble chat-bubble-in";
  uBubble.style.fontSize = "11px";
  uBubble.style.padding = "6px 10px";
  uBubble.innerHTML = `<div class="chat-bubble-author">Você</div>${msg}`;
  box.appendChild(uBubble);
  
  input.value = "";
  box.scrollTop = box.scrollHeight;
  
  // Ana answers simulated
  setTimeout(() => {
    let response = "Interessante sua dúvida comercial. De acordo com o catálogo da WF Digital, nós conseguimos implantar sua automação de prospecção em até 15 dias.";
    if (msg.toLowerCase().includes("caro") || msg.toLowerCase().includes("preço") || msg.toLowerCase().includes("desconto")) {
      response = state.objections[0].response;
    } else if (msg.toLowerCase().includes("pensar") || msg.toLowerCase().includes("retorno")) {
      response = state.objections[1].response;
    } else if (msg.toLowerCase().includes("concorrente") || msg.toLowerCase().includes("fornecedor")) {
      response = state.objections[2].response;
    }
    
    const iaBubble = document.createElement("div");
    iaBubble.className = "chat-bubble chat-bubble-out-ia";
    iaBubble.style.fontSize = "11px";
    iaBubble.style.padding = "6px 10px";
    iaBubble.innerHTML = `<div class="chat-bubble-author">Ana (IA)</div>${response}`;
    box.appendChild(iaBubble);
    box.scrollTop = box.scrollHeight;
  }, 1000);
}

// ================= TELA 06 · PROSPECÇÃO =================
const mockProspects = [
  { name: 'Ápice Odontologia', cnpj: '21.092.311/0001-02', segment: 'Serviços Médicos', porte: 'EPP', uf: 'SP', city: 'São Paulo', distance: 15, whasapp: '(11) 98822-6611', score: 88, inBase: false, googleRating: 4.8 },
  { name: 'Cargill Logística', cnpj: '11.002.392/0001-99', segment: 'Logística', porte: 'Grande', uf: 'SP', city: 'Campinas', distance: 95, whasapp: '(19) 97722-1100', score: 71, inBase: false, googleRating: 4.2 },
  { name: 'Metalúrgica Vulcan', cnpj: '45.111.222/0001-09', segment: 'Indústrias Metalúrgicas', porte: 'Média', uf: 'SP', city: 'São Bernardo', distance: 22, whasapp: '(11) 91122-3344', score: 81, inBase: true, inBaseBy: 'Roberto KA', googleRating: 3.9 },
  { name: 'Salles Advocacia', cnpj: '08.991.312/0001-50', segment: 'Advocacia B2B', porte: 'ME', uf: 'SP', city: 'São Paulo', distance: 4, whasapp: '', score: 32, inBase: false, googleRating: 4.5 }
];

function triggerProspectSearch() {
  const table = document.getElementById("prospecting-results-table");
  table.innerHTML = "";
  
  const segment = document.getElementById("prosp-segment").value || "Clínicas Médicas";
  const city = document.getElementById("prosp-city").value || "São Paulo";
  const stateVal = document.getElementById("prosp-state").value || "SP";
  
  document.getElementById("prosp-results-header").innerText = `${mockProspects.length} resultados encontrados para "${segment}" em ${city} - ${stateVal}`;
  
  mockProspects.forEach((item, index) => {
    // Dynamic score breakdown computation
    const baseScore = item.score;
    const scoreExpid = `score-exp-${index}`;
    
    const tr = document.createElement("tr");
    if (item.inBase) tr.className = "crm-table-dimmed";
    
    tr.innerHTML = `
      <td><input type="checkbox" class="prospect-select-check" value="${index}" ${item.inBase ? 'disabled' : ''}></td>
      <td>
        <div class="d-flex flex-column">
          <strong>${item.name}</strong>
          <span style="font-size:11px; color: var(--text-sec);">${item.cnpj}</span>
        </div>
      </td>
      <td>
        <div class="d-flex flex-column">
          <span>${item.segment}</span>
          <span style="font-size:11px; color: var(--text-sec);">${item.porte}</span>
        </div>
      </td>
      <td>
        <div class="d-flex flex-column">
          <span>${item.city} - ${item.uf}</span>
          <span style="font-size:11px; color: var(--text-sec);">${item.distance} km de distância</span>
        </div>
      </td>
      <td>${item.whasapp || '<span style="color: var(--color-error)">Sem WhatsApp</span>'}</td>
      <td>
        <div class="d-flex flex-column">
          <div class="d-flex align-items-center gap-2">
            <span class="badge ${baseScore >= 75 ? 'badge-hot' : baseScore >= 45 ? 'badge-warm' : 'badge-cold'}">${baseScore >= 75 ? '🔥 Alta chance' : baseScore >= 45 ? '◐ Média' : '❄ Baixa'} · ${baseScore}</span>
          </div>
          <button class="btn-text" style="font-size:11px; text-align: left; margin-top:2px;" onclick="toggleScoreExplain('${scoreExpid}')">ver por quê ▾</button>
        </div>
      </td>
      <td style="text-align: right;">
        ${item.inBase ? `
          <button class="btn btn-sm btn-secondary" disabled>Duplicado</button>
        ` : `
          <div class="d-flex gap-2 justify-content-end">
            <button class="btn btn-sm btn-purple" ${!item.whasapp ? 'disabled' : ''} onclick="sendProspectToCRM(${index}, 'ia')">◈ IA</button>
            <button class="btn btn-sm btn-primary" onclick="sendProspectToCRM(${index}, 'human')">◑ Humano</button>
          </div>
        `}
      </td>
    `;
    
    table.appendChild(tr);
    
    // Add detail calculations row (hidden by default)
    const trDetail = document.createElement("tr");
    trDetail.id = scoreExpid;
    trDetail.style.display = "none";
    trDetail.innerHTML = `
      <td colspan="7" style="background-color: #FAFAFA; padding: 12px 24px;">
        <div class="score-explainable-box">
          <h4 style="font-weight:600; margin-bottom:8px; color: var(--text-title);">Cálculo do Score de Negócio</h4>
          <div class="score-row-item">
            <span>Segmento compatível com alvos do ICP:</span>
            <span>+ ${item.segment === 'Serviços Médicos' || item.segment === 'Indústrias Metalúrgicas' ? '30 pontos' : '10 pontos'}</span>
          </div>
          <div class="score-row-item">
            <span>Contato possui WhatsApp válido:</span>
            <span>+ ${item.whasapp ? '20 pontos' : '0 pontos'}</span>
          </div>
          <div class="score-row-item">
            <span>Site ativo de fácil contato:</span>
            <span>+ 15 pontos</span>
          </div>
          <div class="score-row-item">
            <span>Porte da empresa atende perfil:</span>
            <span>+ ${item.porte === 'EPP' || item.porte === 'Média' ? '15 pontos' : '5 pontos'}</span>
          </div>
          <div class="score-row-item">
            <span>Reputação (Google Business):</span>
            <span>+ ${item.googleRating >= 4.0 ? '10 pontos' : '5 pontos'}</span>
          </div>
          <div class="score-row-item">
            <span>Região de abrangência comercial:</span>
            <span>+ 10 pontos</span>
          </div>
          <div class="score-row-item" style="font-weight:700;">
            <span>Pontuação Total:</span>
            <span>${baseScore} / 100</span>
          </div>
        </div>
      </td>
    `;
    table.appendChild(trDetail);
  });
  
  showNotification("Busca comercial concluída! Resultados carregados.");
}

function toggleScoreExplain(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === "none" ? "table-row" : "none";
}

function toggleSelectAllProspects(masterCheck) {
  const checks = document.querySelectorAll(".prospect-select-check");
  checks.forEach(c => {
    if (!c.disabled) c.checked = masterCheck.checked;
  });
}

function sendProspectToCRM(index, ownerType) {
  const p = mockProspects[index];
  if (!p) return;
  
  const leadId = `l${Date.now()}`;
  const owner = ownerType === 'ia' ? 'ia' : 'human';
  const ownerName = ownerType === 'ia' ? 'Ana (IA)' : 'Marina Vendas';
  
  state.leads.push({
    id: leadId,
    company: p.name,
    contact: 'Responsável Comercial',
    title: 'Comercial',
    phone: p.whasapp || '(11) 99999-0000',
    segment: p.segment,
    uf: p.uf,
    distance: p.distance,
    score: p.score,
    temp: p.score >= 75 ? 'hot' : p.score >= 45 ? 'warm' : 'cold',
    stage: 'Prospecção',
    value: 5000,
    owner: owner,
    ownerName: ownerName,
    staleHours: 0,
    escalated: false,
    escalationReason: '',
    slaInfo: 'vence hoje',
    lastContact: 'Hoje, recém enviado'
  });
  
  // Set chat template
  state.chatHistory[leadId] = [
    { sender: 'ia', senderName: 'Ana (IA)', type: 'ia', text: `Olá! Sou a Ana da WF Digital. Vi que a ${p.name} atua no segmento de ${p.segment} em ${p.city}. Nós ajudamos indústrias e empresas a automatizar a prospecção B2B de forma 100% autônoma. Teria 5 minutos para conversarmos sobre como estruturar sua máquina comercial?`, time: 'Agora mesmo' }
  ];
  
  // Save log
  state.auditLogs.unshift({
    time: 'Agora',
    actor: ownerType === 'ia' ? 'Ana (IA)' : 'Fabrício Admin',
    actorType: ownerType === 'ia' ? 'ia' : 'human',
    action: `Lead comercial ${p.name} adicionado via prospecção`,
    detail: `Vendedor responsável definido como ${ownerName}.`,
    rule: 'prospecção ativa'
  });
  
  updateSidebarCounters();
  showNotification(`Lead ${p.name} enviado para o pipeline (${ownerName})!`);
  
  // Mark duplicate or greyed out in result
  p.inBase = true;
  triggerProspectSearch();
}

function handleBulkSend(ownerType) {
  const checked = [];
  document.querySelectorAll(".prospect-select-check:checked").forEach(cb => {
    checked.push(parseInt(cb.value));
  });
  
  if (checked.length === 0) {
    showNotification("Nenhuma empresa selecionada para enviar.");
    return;
  }
  
  const created = [];
  checked.forEach(idx => {
    sendProspectToCRM(idx, ownerType);
    const last = state.leads[state.leads.length - 1];
    if (last) created.push(last.id);
  });

  // Vendedor humano: perguntar PARA QUEM enviar (o lead cai no Portal do Vendedor)
  if (ownerType === 'human') {
    showNotification(`${checked.length} lead(s) importados. Escolha o vendedor de destino.`);
    openEnviarVendedorModal(created);
    return;
  }

  showNotification(`${checked.length} leads importados em massa com sucesso!`);
}

// ================= TELA 07 · LEADS · KANBAN =================
let leadsViewMode = 'kanban';

function toggleLeadsView(mode) {
  leadsViewMode = mode;
  document.getElementById("btn-view-kanban").style.background = mode === 'kanban' ? 'white' : 'transparent';
  document.getElementById("btn-view-kanban").style.color = mode === 'kanban' ? 'var(--text-title)' : 'var(--text-sec)';
  document.getElementById("btn-view-list").style.background = mode === 'list' ? 'white' : 'transparent';
  document.getElementById("btn-view-list").style.color = mode === 'list' ? 'var(--text-title)' : 'var(--text-sec)';
  
  document.getElementById("leads-kanban-view").style.display = mode === 'kanban' ? 'flex' : 'none';
  document.getElementById("leads-list-view").style.display = mode === 'list' ? 'block' : 'none';
  
  renderLeadsBoard();
}

function renderLeadsBoard() {
  const searchVal = document.getElementById("leads-filter-search").value.toLowerCase();
  const ownerVal = document.getElementById("leads-filter-responsible").value;
  const tempVal = document.getElementById("leads-filter-temp").value;
  
  // Filter leads list
  const filteredLeads = state.leads.filter(lead => {
    const matchesSearch = lead.company.toLowerCase().includes(searchVal) || lead.contact.toLowerCase().includes(searchVal);
    
    let matchesOwner = true;
    if (ownerVal === 'ia') matchesOwner = lead.owner === 'ia';
    if (ownerVal === 'human') matchesOwner = lead.owner !== 'ia';
    
    let matchesTemp = true;
    if (tempVal) matchesTemp = lead.temp === tempVal;
    
    return matchesSearch && matchesOwner && matchesTemp;
  });
  
  // Render Kanban view
  if (leadsViewMode === 'kanban') {
    const kanban = document.getElementById("leads-kanban-view");
    kanban.innerHTML = "";
    
    const columns = ['Prospecção', 'Qualificado', 'Proposta', 'Negociação', 'Fechado', 'Pedido', 'Perdido'];
    
    columns.forEach(col => {
      const colLeads = filteredLeads.filter(l => l.stage === col);
      const sum = colLeads.reduce((acc, c) => acc + c.value, 0);
      
      const colDiv = document.createElement("div");
      colDiv.className = "kanban-column";
      colDiv.setAttribute("ondragover", "event.preventDefault()");
      colDiv.setAttribute("ondrop", `handleDropCard(event, '${col}')`);
      
      let headerBorderClass = 'kanban-header-prospec';
      if (col === 'Qualificado') headerBorderClass = 'kanban-header-qualif';
      if (col === 'Proposta') headerBorderClass = 'kanban-header-propos';
      if (col === 'Negociação') headerBorderClass = 'kanban-header-negoc';
      if (col === 'Fechado') headerBorderClass = 'kanban-header-fechad';
      if (col === 'Pedido') headerBorderClass = 'kanban-header-pedido';
      if (col === 'Perdido') headerBorderClass = 'kanban-header-perdido';
      
      colDiv.innerHTML = `
        <div class="kanban-header ${headerBorderClass}">
          <div class="kanban-col-title">
            <span>${col}</span>
            <span class="kanban-col-count">${colLeads.length}</span>
          </div>
          <span class="kanban-col-value">R$ ${(sum/1000).toFixed(1)}k</span>
        </div>
        <div class="kanban-cards-list"></div>
      `;
      
      const list = colDiv.querySelector(".kanban-cards-list");
      
      if (colLeads.length === 0) {
        list.innerHTML = `<div style="text-align: center; color: var(--text-ter); font-size: 11px; padding: 16px;">Vazio</div>`;
      } else {
        colLeads.forEach(lead => {
          const card = document.createElement("div");
          card.className = `kanban-card ${lead.escalated ? 'card-escalado' : ''}`;
          card.setAttribute("draggable", "true");
          card.setAttribute("ondragstart", `handleDragCardStart(event, '${lead.id}')`);
          card.onclick = () => viewLeadDetail(lead.id);
          
          let tempPill = '';
          if (lead.temp === 'hot') tempPill = '<span class="badge badge-hot">🔥 Quente</span>';
          if (lead.temp === 'warm') tempPill = '<span class="badge badge-warm">◐ Morno</span>';
          if (lead.temp === 'cold') tempPill = '<span class="badge badge-cold">❄ Frio</span>';
          
          let ownerPill = lead.owner === 'ia' ? `<span class="badge badge-ia" style="padding:2px 6px;">◈ Ana</span>` : `<span class="badge badge-human" style="padding:2px 6px;">◑ ${lead.ownerName.split(' ')[0]}</span>`;
          
          let slaClass = lead.slaInfo.includes('3d') || lead.slaInfo.includes('escalado') ? 'alert-text' : '';
          
          card.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
              <span class="kanban-card-title">${lead.company}</span>
              ${tempPill}
            </div>
            <div class="kanban-card-info">${lead.contact} · ${lead.segment}</div>
            
            <div class="kanban-score-bar" title="Score de Negócio: ${lead.score}">
              <div class="kanban-score-fill" style="width: ${lead.score}%;"></div>
            </div>
            
            <div class="kanban-card-footer">
              <div class="d-flex align-items-center gap-2">
                ${ownerPill}
                <span style="font-weight:600; font-size:12px;">R$ ${(lead.value/1000).toFixed(1)}k</span>
              </div>
              <span class="kanban-sla-badge ${slaClass}">${lead.slaInfo}</span>
            </div>
          `;
          list.appendChild(card);
        });
      }
      
      kanban.appendChild(colDiv);
    });
  } else {
    // List view rendering
    const listBody = document.getElementById("leads-list-table-body");
    listBody.innerHTML = "";
    
    filteredLeads.forEach(lead => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${lead.company}</strong></td>
        <td>${lead.contact}</td>
        <td><span class="badge ${lead.temp === 'hot' ? 'badge-hot' : lead.temp === 'warm' ? 'badge-warm' : 'badge-cold'}">${lead.temp === 'hot' ? '🔥 Quente' : lead.temp === 'warm' ? '◐ Morno' : '❄ Frio'}</span></td>
        <td><span class="badge badge-human">${lead.stage}</span></td>
        <td><strong>${lead.score}/100</strong></td>
        <td>${lead.owner === 'ia' ? '◈ Ana (IA)' : `◑ ${lead.ownerName}`}</td>
        <td>R$ ${lead.value.toLocaleString('pt-BR')}</td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-secondary" onclick="viewLeadDetail('${lead.id}')">Ver Detalhe</button>
        </td>
      `;
      listBody.appendChild(tr);
    });
  }
  
  // Render metrics counters
  document.getElementById("leads-kpi-total").innerText = state.leads.length;
  document.getElementById("leads-kpi-hot").innerText = state.leads.filter(l => l.temp === 'hot').length;
  document.getElementById("leads-kpi-ia").innerText = state.leads.filter(l => l.owner === 'ia' && l.stage !== 'Perdido').length;
  document.getElementById("leads-kpi-human").innerText = state.leads.filter(l => l.owner !== 'ia' && l.stage !== 'Perdido').length;
  document.getElementById("leads-kpi-stale").innerText = state.leads.filter(l => l.slaInfo.includes('3d')).length;
  
  const totalVal = state.leads.reduce((acc, c) => acc + c.value, 0);
  document.getElementById("leads-kpi-value").innerText = `R$ ${(totalVal/1000).toFixed(1)}k`;
}

let draggedLeadId = null;

function handleDragCardStart(event, leadId) {
  draggedLeadId = leadId;
}

function handleDropCard(event, targetColumnName) {
  event.preventDefault();
  if (!draggedLeadId) return;
  
  const lead = state.leads.find(l => l.id === draggedLeadId);
  if (!lead) return;
  
  if (lead.stage === targetColumnName) return;
  
  if (targetColumnName === 'Perdido') {
    // Open reason dialog
    document.getElementById("lost-lead-id").value = lead.id;
    openModal("modal-perdido");
  } else if (targetColumnName === 'Fechado') {
    lead.stage = targetColumnName;
    crmConfirm("Lead fechado! 🎉",
      `Deseja criar o <strong>Pedido automático pós-venda</strong> para ${lead.company}? O contrato e o link Pix serão emitidos.`,
      () => { createOrderFromLead(lead); }, "Criar pedido");
    lead.slaInfo = '✓ pedido';
    
    // Save log
    state.auditLogs.unshift({
      time: 'Agora',
      actor: state.activeUser.name,
      actorType: 'human',
      action: `Lead comercial ${lead.company} fechado com sucesso`,
      detail: `Contrato em geração e link Pix de faturamento emitido.`,
      rule: 'intervenção humana'
    });
    
    renderLeadsBoard();
    updateSidebarCounters();
  } else {
    lead.stage = targetColumnName;
    
    // Add log
    state.auditLogs.unshift({
      time: 'Agora',
      actor: state.activeUser.name,
      actorType: 'human',
      action: `Mapeou lead ${lead.company} para etapa ${targetColumnName}`,
      detail: `Etapa comercial de pipeline alterada.`,
      rule: 'remanejamento de funil'
    });
    
    showNotification(`Lead ${lead.company} movido para ${targetColumnName}`);
    renderLeadsBoard();
    updateSidebarCounters();
  }
  
  draggedLeadId = null;
}

function submitLeadLostReason() {
  const leadId = document.getElementById("lost-lead-id").value;
  const reason = document.getElementById("lost-reason-select").value;
  const lead = state.leads.find(l => l.id === leadId);
  
  if (lead) {
    lead.stage = 'Perdido';
    lead.lostReason = reason;
    lead.slaInfo = 'descartado';
    lead.escalated = false;
    
    // Log
    state.auditLogs.unshift({
      time: 'Agora',
      actor: state.activeUser.name,
      actorType: 'human',
      action: `Lead comercial ${lead.company} perdido`,
      detail: `Motivo selecionado: ${reason}.`,
      rule: 'descarte comercial'
    });
    
    closeModal("modal-perdido");
    showNotification(`Lead ${lead.company} marcado como perdido.`);
    renderLeadsBoard();
    updateSidebarCounters();
  }
}

function openNewLeadModal() {
  crmPrompt("Novo lead manual", [
    { id: 'company', label: 'Nome da Empresa', placeholder: 'ex: Aço Vale' },
    { id: 'contact', label: 'Contato Principal', placeholder: 'ex: Renato Souza' },
    { id: 'phone',   label: 'WhatsApp', placeholder: '(11) 90000-0000' },
    { id: 'segment', label: 'Segmento', type: 'select', options: ['Tecnologia', 'Indústrias Metalúrgicas', 'Serviços Médicos', 'Advocacia B2B', 'Logística', 'Outro'] }
  ], v => {
    const company = v.company, contact = v.contact, phone = v.phone, segment = v.segment;
    if (!(company && contact && phone)) { showNotification("Empresa, contato e WhatsApp são obrigatórios."); return; }
    {
    const leadId = `l${Date.now()}`;
    state.leads.unshift({
      id: leadId,
      company,
      contact,
      title: 'Responsável',
      phone,
      segment: segment || 'Outro',
      uf: 'SP',
      distance: 10,
      score: 75,
      temp: 'warm',
      stage: 'Prospecção',
      value: 5000,
      owner: 'ia',
      staleHours: 0,
      escalated: false,
      escalationReason: '',
      slaInfo: 'vence hoje',
      lastContact: 'Criado agora'
    });
    
    state.chatHistory[leadId] = [
      { sender: 'ia', senderName: 'Ana (IA)', type: 'ia', text: `Olá! Sou a Ana da WF Digital. Nós ajudamos a estruturar sua máquina comercial. Teria 5 minutos para conversarmos?`, time: 'Agora mesmo' }
    ];
    
    showNotification("Novo lead cadastrado e IA comercial ativada!");
    renderLeadsBoard();
    updateSidebarCounters();
    }
  }, "Criar lead");
}

// ================= TELA 08 · LEADS · DETALHE DO LEAD =================
function viewLeadDetail(leadId) {
  state.activeLeadId = leadId;
  switchPanel('lead-detail');
}

function renderLeadDetail() {
  const lead = state.leads.find(l => l.id === state.activeLeadId);
  if (!lead) return;
  
  // Header
  const headerInfo = document.getElementById("detail-header-info");
  let tempPill = lead.temp === 'hot' ? '<span class="badge badge-hot">🔥 Quente</span>' : lead.temp === 'warm' ? '<span class="badge badge-warm">◐ Morno</span>' : '<span class="badge badge-cold">❄ Frio</span>';
  let respPill = lead.owner === 'ia' ? '<span class="badge badge-ia">◈ Vendedor Virtual (IA)</span>' : `<span class="badge badge-human">◑ Responsável: ${lead.ownerName}</span>`;
  
  headerInfo.innerHTML = `
    <h2 style="font-size: 20px; font-weight: 700; color: var(--text-title);">${lead.company}</h2>
    <span class="badge badge-gray">${lead.stage}</span>
    ${tempPill}
    <span class="badge badge-gray">Score: ${lead.score}/100</span>
    ${respPill}
  `;
  
  // Stepper
  const stepper = document.getElementById("detail-stepper");
  stepper.innerHTML = "";
  const stages = ['Prospecção', 'Qualificado', 'Proposta', 'Negociação', 'Fechado', 'Pedido', 'Perdido'];
  
  stages.forEach((st, idx) => {
    const isDone = stages.indexOf(lead.stage) >= idx;
    const isActive = lead.stage === st;
    
    const step = document.createElement("div");
    step.className = `stepper-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`;
    step.onclick = () => {
      lead.stage = st;
      showNotification(`Lead comercial atualizado para ${st}`);
      renderLeadDetail();
      renderLeadsBoard();
    };
    
    step.innerHTML = `
      <span class="stepper-num">${idx + 1}</span>
      <span>${st}</span>
    `;
    stepper.appendChild(step);
    
    if (idx < stages.length - 1) {
      const div = document.createElement("div");
      div.className = "stepper-divider";
      stepper.appendChild(div);
    }
  });
  
  // Company Card
  document.getElementById("detail-card-company").innerHTML = `
    <div><span style="color:var(--text-sec);">CNPJ:</span> <strong>${lead.cnpj || '45.182.902/0001-22'}</strong></div>
    <div><span style="color:var(--text-sec);">Segmento:</span> <strong>${lead.segment}</strong></div>
    <div><span style="color:var(--text-sec);">Localização:</span> <strong>Volta Redonda - RJ (${lead.distance} km)</strong></div>
    <div><span style="color:var(--text-sec);">Data Entrada:</span> <strong>08/07/2026</strong></div>
    <div><span style="color:var(--text-sec);">Dias no Funil:</span> <strong>3 dias úteis</strong></div>
  `;
  
  // Contact Card
  document.getElementById("detail-card-contact").innerHTML = `
    <div><span style="color:var(--text-sec);">Nome:</span> <strong>${lead.contact}</strong></div>
    <div><span style="color:var(--text-sec);">Cargo:</span> <strong>${lead.title}</strong></div>
    <div><span style="color:var(--text-sec);">WhatsApp:</span> <strong>${lead.phone}</strong></div>
  `;
  
  // Proposal Card
  const prop = state.proposals.find(p => p.leadId === lead.id);
  const propCard = document.getElementById("detail-card-proposal");
  if (prop) {
    propCard.innerHTML = `
      <div class="d-flex justify-content-between align-items-center" style="margin-bottom:8px;">
        <strong>Orçamento ${prop.number}</strong>
        <span class="badge ${prop.needApproval ? 'badge-hot' : 'badge-success'}">${prop.status}</span>
      </div>
      <div style="font-size:12.5px; color:var(--text-sec); margin-bottom:8px;">${prop.items}</div>
      <div class="d-flex justify-content-between align-items-center">
        <span style="font-weight:700; font-size:15px;">R$ ${prop.value.toLocaleString('pt-BR')}</span>
        <button class="btn btn-sm btn-secondary" onclick="insertProposalInChat('${prop.id}')">Inserir no chat</button>
      </div>
    `;
  } else {
    propCard.innerHTML = `
      <p style="font-size:12px; color:var(--text-ter); text-align:center; padding: 12px 0;">Nenhum orçamento vinculado.</p>
      <button class="btn btn-sm btn-primary" style="width:100%;" onclick="openNewProposalModal()">+ Gerar Proposta Comercial</button>
    `;
  }
  
  // Tasks
  const taskCard = document.getElementById("detail-card-tasks");
  taskCard.innerHTML = "";
  const leadTasks = state.tasks.filter(t => t.owner === lead.ownerName || (lead.owner === 'ia' && t.owner === 'Ana (IA)'));
  if (leadTasks.length === 0) {
    taskCard.innerHTML = `<p style="font-size:12px; color:var(--text-ter); text-align:center;">Sem tarefas comerciais.</p>`;
  } else {
    leadTasks.forEach(t => {
      const taskDiv = document.createElement("div");
      taskDiv.className = "d-flex justify-content-between align-items-center";
      taskDiv.style.padding = "4px 0";
      taskDiv.innerHTML = `
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTask('${t.id}')">
          <span style="${t.completed ? 'text-decoration:line-through; color:var(--text-ter);' : ''}">${t.text}</span>
        </label>
      `;
      taskCard.appendChild(taskDiv);
    });
  }
  
  // Timeline
  const logCard = document.getElementById("detail-card-timeline");
  logCard.innerHTML = "";
  const logs = state.auditLogs.filter(l => l.detail.includes(lead.company) || l.action.includes(lead.company));
  
  if (logs.length === 0) {
    logCard.innerHTML = `<p style="font-size:12px; color:var(--text-ter); text-align:center;">Nenhuma transação comercial registrada.</p>`;
  } else {
    const list = document.createElement("div");
    list.className = "timeline";
    logs.forEach(l => {
      const item = document.createElement("div");
      item.className = "timeline-item";
      item.innerHTML = `
        <div class="timeline-marker ${l.actorType === 'ia' ? 'ia' : 'human'}"></div>
        <div class="timeline-content">
          <strong>${l.action}</strong>
          <span style="font-size:10px; color:var(--text-ter);">${l.time} · ${l.rule}</span>
        </div>
      `;
      list.appendChild(item);
    });
    logCard.appendChild(list);
  }
  
  // WhatsApp simulated chat
  renderChatBox();
}

function renderChatBox() {
  const lead = state.leads.find(l => l.id === state.activeLeadId);
  const chatMessages = state.chatHistory[lead.id] || [];
  
  const box = document.getElementById("chat-messages-box");
  box.innerHTML = "";
  
  // Renders chat title/avatar
  document.getElementById("chat-avatar").innerText = lead.company.substring(0,2).toUpperCase();
  document.getElementById("chat-contact-name").innerText = lead.contact;
  
  // Control bar state
  const controlBar = document.getElementById("chat-control-bar");
  const controlText = document.getElementById("chat-control-text");
  const controlAction = document.getElementById("chat-control-action-btn");
  const copilotUI = document.getElementById("chat-copilot-suggestion");
  
  if (lead.owner === 'ia') {
    controlBar.style.backgroundColor = "var(--bg-ia)";
    controlText.style.color = "#5B21B6";
    
    if (lead.escalated) {
      controlText.innerHTML = `◈ A Ana <strong>escalou</strong> esta conversa (desconto acima de alçada)`;
      controlAction.innerText = "Assumir Conversa";
      controlAction.className = "btn btn-sm btn-purple";
    } else {
      controlText.innerHTML = `◈ A Ana (Vendedor Virtual) está atendendo autonomamente`;
      controlAction.innerText = "Intervir";
      controlAction.className = "btn btn-sm btn-secondary";
    }
  } else {
    controlBar.style.backgroundColor = "var(--primary-light)";
    controlText.style.color = "var(--primary)";
    controlText.innerHTML = `◑ Atendimento <strong>humano</strong> ativo no canal`;
    controlAction.innerText = "Devolver p/ IA";
    controlAction.className = "btn btn-sm btn-primary";
  }
  
  // Render Day divider
  const dayDiv = document.createElement("div");
  dayDiv.className = "chat-day-divider";
  dayDiv.innerHTML = `<span>HOJE</span>`;
  box.appendChild(dayDiv);
  
  // Renders messages bubbles
  chatMessages.forEach(msg => {
    const bubble = document.createElement("div");
    
    let bubbleClass = 'chat-bubble-in';
    let label = msg.senderName;
    
    if (msg.sender === 'ia') {
      bubbleClass = 'chat-bubble-out-ia';
    } else if (msg.sender === 'human') {
      bubbleClass = 'chat-bubble-out-human';
    } else if (msg.sender === 'ia-escalated') {
      bubbleClass = 'chat-bubble-escalated';
    }
    
    bubble.className = `chat-bubble ${bubbleClass}`;
    bubble.innerHTML = `
      <div class="chat-bubble-author">${label}</div>
      <div>${msg.text}</div>
      <div class="chat-bubble-meta">
        <span>${msg.time}</span>
        ${msg.sender !== 'client' ? '<span style="color:var(--primary);">✓✓</span>' : ''}
      </div>
    `;
    box.appendChild(bubble);
  });
  
  box.scrollTop = box.scrollHeight;
  
  // Copilot suggestions
  if (lead.owner === 'ia' && !lead.escalated) {
    copilotUI.style.display = "flex";
    document.getElementById("copilot-suggestion-text").innerText = `Olá, ${lead.contact}! Entendemos seu posicionamento. Conseguimos facilitar a assessoria em até 3 parcelas de R$ 1.660,00 via boleto faturado. O que acha?`;
  } else {
    copilotUI.style.display = "none";
  }
}

function sendChatMessage() {
  const input = document.getElementById("chat-input-field");
  const text = input.value.trim();
  if (!text) return;
  
  const lead = state.leads.find(l => l.id === state.activeLeadId);
  const history = state.chatHistory[lead.id] || [];
  
  const senderType = lead.owner === 'ia' ? 'ia' : 'human';
  const senderName = lead.owner === 'ia' ? 'Ana (IA)' : state.activeUser.name;
  
  history.push({
    sender: senderType,
    senderName: senderName,
    text: text,
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  });
  
  state.chatHistory[lead.id] = history;
  input.value = "";
  
  // Save log
  state.auditLogs.unshift({
    time: 'Agora',
    actor: senderName,
    actorType: senderType,
    action: `Mensagem comercial enviada para ${lead.company}`,
    detail: `Corpo: "${text.substring(0, 30)}..."`,
    rule: senderType === 'ia' ? 'vendedor virtual autônomo' : 'resposta humana manual'
  });
  
  renderLeadDetail();
  
  // Simulated customer reply (after 2s)
  if (senderType === 'human') {
    setTimeout(() => {
      history.push({
        sender: 'client',
        senderName: lead.contact,
        text: 'Obrigado pelo retorno. Vamos avaliar essa proposta aqui internamente e te aviso amanhã.',
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      });
      state.chatHistory[lead.id] = history;
      renderLeadDetail();
    }, 2000);
  }
}

function toggleHandoffState() {
  const lead = state.leads.find(l => l.id === state.activeLeadId);
  if (!lead) return;
  
  if (lead.owner === 'ia') {
    // Human assumes
    lead.owner = 'human';
    lead.ownerName = state.activeUser.name;
    lead.escalated = false;
    
    state.auditLogs.unshift({
      time: 'Agora',
      actor: state.activeUser.name,
      actorType: 'human',
      action: `Assumiu atendimento de ${lead.company}`,
      detail: `Controle da conversa do WhatsApp transferido da IA para o vendedor.`,
      rule: 'intervenção humana manual'
    });
    
    showNotification(`Atendimento comercial assumido por ${state.activeUser.name}`);
  } else {
    // Return to IA
    document.getElementById("devolver-lead-id").value = lead.id;
    openModal("modal-devolver-ia");
  }
  
  renderLeadDetail();
  updateSidebarCounters();
}

function submitDevolverIA() {
  const leadId = document.getElementById("devolver-lead-id").value;
  const context = document.getElementById("devolver-ia-context").value;
  const lead = state.leads.find(l => l.id === leadId);
  
  if (lead) {
    lead.owner = 'ia';
    lead.ownerName = 'Ana (IA)';
    lead.escalated = false;
    
    state.auditLogs.unshift({
      time: 'Agora',
      actor: state.activeUser.name,
      actorType: 'human',
      action: `Devolveu atendimento de ${lead.company} para IA`,
      detail: `Contexto repassado: "${context}"`,
      rule: 'retomada do assistente virtual'
    });
    
    // IA shoots automated contextual message
    const history = state.chatHistory[lead.id] || [];
    setTimeout(() => {
      history.push({
        sender: 'ia',
        senderName: 'Ana (IA)',
        text: `Entendido! Retomei o contato. Conforme combinamos comercialmente: ${context}. Vamos prosseguir?`,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      });
      state.chatHistory[lead.id] = history;
      renderLeadDetail();
    }, 1500);
    
    closeModal("modal-devolver-ia");
    showNotification("Atendimento comercial devolvido para a IA Ana!");
    renderLeadDetail();
    updateSidebarCounters();
  }
}

function approveCopilotSuggestion() {
  const lead = state.leads.find(l => l.id === state.activeLeadId);
  const text = document.getElementById("copilot-suggestion-text").innerText;
  
  const history = state.chatHistory[lead.id] || [];
  history.push({
    sender: 'ia',
    senderName: 'Ana (IA)',
    text: text,
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  });
  
  state.chatHistory[lead.id] = history;
  
  state.auditLogs.unshift({
    time: 'Agora',
    actor: state.activeUser.name,
    actorType: 'human',
    action: `Aprovou sugestão da IA para ${lead.company}`,
    detail: `Texto enviado via copiloto.`,
    rule: 'copiloto de vendas aprovado'
  });
  
  showNotification("Sugestão comercial enviada!");
  renderLeadDetail();
}

function editCopilotSuggestion() {
  const text = document.getElementById("copilot-suggestion-text").innerText;
  crmPrompt("Editar sugestão da Ana", [
    { id: 'text', label: 'Sugestão de resposta', type: 'textarea', value: text }
  ], v => {
    if (v.text) document.getElementById("copilot-suggestion-text").innerText = v.text;
  }, "Salvar edição");
}

function insertProposalInChat(propId) {
  const prop = state.proposals.find(p => p.id === propId);
  if (prop) {
    const input = document.getElementById("chat-input-field");
    input.value = `Olá! Conforme alinhado comercialmente, segue o link da Proposta comercial ${prop.number}: R$ ${prop.value.toLocaleString('pt-BR')} (${prop.items}).`;
    showNotification("Texto da proposta inserido na caixa de texto.");
  }
}

// ================= TELA 09 · CENTRAL =================
function renderCentral() {
  // Escalated queue
  const escBody = document.getElementById("central-escalated-threads");
  escBody.innerHTML = "";
  const escalated = state.leads.filter(l => l.escalated && l.stage !== 'Perdido' && l.stage !== 'Pedido');
  
  if (escalated.length === 0) {
    escBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-ter); padding: 24px;">Nenhuma conversa escalada no momento!</td></tr>`;
  } else {
    escalated.forEach(lead => {
      const tr = document.createElement("tr");
      tr.className = "row-alert";
      tr.innerHTML = `
        <td>
          <div class="d-flex align-items-center gap-2">
            <span class="user-avatar avatar-ia" style="width:24px; height:24px; font-size:10px;">◈</span>
            <div class="d-flex flex-column">
              <strong>${lead.company}</strong>
              <span style="font-size:11px; color: var(--text-sec);">${lead.contact}</span>
            </div>
          </div>
        </td>
        <td><span class="badge badge-hot" style="font-size:11px;">${lead.escalationReason}</span></td>
        <td><span class="badge badge-error">Aguardando há 2h</span></td>
        <td style="text-align: right;">
          <div class="d-flex gap-2 justify-content-end">
            <button class="btn btn-sm btn-secondary" onclick="viewLeadDetail('${lead.id}')">Ver conversa</button>
            <button class="btn btn-sm btn-purple" onclick="assumeLeadCentral('${lead.id}')">Assumir</button>
          </div>
        </td>
      `;
      escBody.appendChild(tr);
    });
  }
  
  // All threads
  filterCentralThreads();
}

function filterCentralThreads() {
  const ownerVal = document.getElementById("central-filter-owner").value;
  const stageVal = document.getElementById("central-filter-stage").value;
  
  const allBody = document.getElementById("central-all-threads");
  allBody.innerHTML = "";
  
  const filtered = state.leads.filter(lead => {
    let matchesOwner = true;
    if (ownerVal === 'ia') matchesOwner = lead.owner === 'ia';
    if (ownerVal === 'human') matchesOwner = lead.owner !== 'ia';
    
    let matchesStage = true;
    if (stageVal) matchesStage = lead.stage === stageVal;
    
    return matchesOwner && matchesStage && lead.stage !== 'Pedido' && lead.stage !== 'Perdido';
  });
  
  if (filtered.length === 0) {
    allBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-ter); padding: 24px;">Nenhuma conversa encontrada comercial.</td></tr>`;
  } else {
    filtered.forEach(lead => {
      const tr = document.createElement("tr");
      
      let ownerPill = lead.owner === 'ia' ? `<span class="badge badge-ia">◈ Ana (IA)</span>` : `<span class="badge badge-human">◑ Vendedor</span>`;
      let statusPill = `<span class="badge badge-gray">aguardando lead</span>`;
      
      if (lead.escalated) {
        statusPill = `<span class="badge badge-error">2h — escalado</span>`;
      } else if (lead.slaInfo.includes('3d')) {
        statusPill = `<span class="badge badge-error">3 dias sem resposta</span>`;
      }
      
      tr.innerHTML = `
        <td>
          <div class="d-flex flex-column">
            <strong>${lead.company}</strong>
            <span style="font-size:11px; color: var(--text-sec);">${lead.contact}</span>
          </div>
        </td>
        <td><span class="badge badge-gray">${lead.stage}</span></td>
        <td>${ownerPill}</td>
        <td>${lead.lastContact}</td>
        <td>${statusPill}</td>
        <td><strong>R$ ${lead.value.toLocaleString('pt-BR')}</strong></td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-primary" onclick="viewLeadDetail('${lead.id}')">Abrir Chat</button>
        </td>
      `;
      allBody.appendChild(tr);
    });
  }
}

function assumeLeadCentral(leadId) {
  const lead = state.leads.find(l => l.id === leadId);
  if (lead) {
    lead.owner = 'human';
    lead.ownerName = state.activeUser.name;
    lead.escalated = false;
    
    state.auditLogs.unshift({
      time: 'Agora',
      actor: state.activeUser.name,
      actorType: 'human',
      action: `Assumiu atendimento de ${lead.company} via Central`,
      detail: `Intervenção realizada de forma manual.`,
      rule: 'intervenção humana'
    });
    
    showNotification(`Atendimento comercial de ${lead.company} transferido para você.`);
    renderCentral();
    updateSidebarCounters();
  }
}

// ================= TELAS 10-12 · ORÇAMENTOS =================
function renderBudgets() {
  // Tab 1: Proposals table
  const pBody = document.getElementById("proposals-list-table");
  pBody.innerHTML = "";
  
  state.proposals.forEach(p => {
    const tr = document.createElement("tr");
    if (p.needApproval) tr.className = "row-alert";
    
    let discPill = `<span class="badge badge-success">${p.discount}</span>`;
    if (p.needApproval) discPill = `<span class="badge badge-error">${p.discount}</span>`;
    
    let creatorPill = p.creator === 'ia' ? `<span class="badge badge-ia">◈ Ana</span>` : `<span class="badge badge-human">◑ Marina</span>`;
    let statusPill = `<span class="badge badge-gray">${p.status}</span>`;
    if (p.status.includes('Precisa')) statusPill = `<span class="badge badge-hot">⚠ Pendente</span>`;
    else if (p.status.includes('Aceita')) statusPill = `<span class="badge badge-success">Aceita</span>`;
    
    tr.innerHTML = `
      <td>
        <strong>${p.number}</strong><br>
        <span style="font-size:11px; color:var(--text-sec);">${p.client}</span>
      </td>
      <td style="font-size:12px; color: var(--text-sec);">${p.items}</td>
      <td><strong>R$ ${p.value.toLocaleString('pt-BR')}</strong></td>
      <td>${discPill}</td>
      <td>${creatorPill}</td>
      <td>${statusPill}</td>
      <td style="text-align: right;">
        ${p.needApproval ? `
          <button class="btn btn-sm btn-purple" onclick="approveProposal('${p.id}')">Revisar e Aprovar</button>
        ` : `
          <button class="btn btn-sm btn-secondary" onclick="showNotification('Proposta impressa!')">Abrir PDF</button>
        `}
      </td>
    `;
    pBody.appendChild(tr);
  });
  
  // Tab 2: Pricing catalog
  const cBody = document.getElementById("catalog-items-pricing-table");
  cBody.innerHTML = "";
  state.services.forEach(serv => {
    const tr = document.createElement("tr");
    const margin = Math.round(((serv.price - 1200) / serv.price) * 100); // Mock cost margin computation
    
    tr.innerHTML = `
      <td><strong>${serv.name}</strong></td>
      <td>${serv.unit}</td>
      <td><strong>R$ ${serv.price.toLocaleString('pt-BR')}</strong></td>
      <td>R$ 1.200,00</td>
      <td><span class="badge badge-success">${margin}%</span></td>
      <td><span class="badge badge-ia">${serv.maxDiscount}%</span></td>
      <td style="text-align: right;">
        <button class="btn btn-sm btn-icon" onclick="showNotification('Item editado!')">✏</button>
      </td>
    `;
    cBody.appendChild(tr);
  });
  
  // Tab 3: Knowledge documents
  const dBody = document.getElementById("knowledge-documents-table");
  dBody.innerHTML = "";
  state.docs.forEach(doc => {
    const tr = document.createElement("tr");
    let statusClass = doc.status.includes('✓') ? 'badge-success' : doc.status.includes('Falhou') ? 'badge-error' : 'badge-warm';
    
    tr.innerHTML = `
      <td>
        <strong>${doc.name}</strong><br>
        <span style="font-size:10px; color:var(--text-sec);">${doc.size}</span>
      </td>
      <td>${doc.type}</td>
      <td>${doc.date}</td>
      <td>${doc.uses} conversas</td>
      <td><span class="badge ${statusClass}">${doc.status}</span></td>
      <td style="text-align: right;">
        <button class="btn btn-sm btn-secondary" onclick="showNotification('Documento baixado!')">Ver</button>
      </td>
    `;
    dBody.appendChild(tr);
  });
  
  // Tab 3: Unanswered questions
  const qBody = document.getElementById("knowledge-unanswered-list");
  qBody.innerHTML = "";
  state.unanswered.forEach(q => {
    const div = document.createElement("div");
    div.className = "d-flex flex-column gap-1";
    div.style.padding = "8px";
    div.style.backgroundColor = "#F8FAFC";
    div.style.border = "1px solid var(--border-card)";
    div.style.borderRadius = "8px";
    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-start" style="font-size:12.5px;">
        <strong style="color:var(--text-title);">"${q.text}"</strong>
        <span class="badge badge-hot" style="font-size:10px;">${q.count}x ocorridos</span>
      </div>
      <button class="btn btn-sm btn-primary" style="align-self: flex-end; margin-top:6px; font-size:10.5px;" onclick="answerQuestion('${q.id}')">Responder e Indexar</button>
    `;
    qBody.appendChild(div);
  });
  
  // Renders KPIs
  document.getElementById("proposal-kpi-open").innerText = state.proposals.filter(p => p.status === 'Aguardando cliente').length;
  const sumPropVal = state.proposals.reduce((acc, c) => acc + c.value, 0);
  document.getElementById("proposal-kpi-value").innerText = `R$ ${(sumPropVal/1000).toFixed(1)}k`;
  
  const needsApprCount = state.proposals.filter(p => p.needApproval).length;
  document.getElementById("proposal-kpi-needs-approval").innerText = needsApprCount;
  
  const kpiCardApproval = document.getElementById("proposal-kpi-card-approval");
  if (needsApprCount > 0) {
    kpiCardApproval.style.borderColor = "var(--color-hot)";
    kpiCardApproval.style.backgroundColor = "var(--bg-hot)";
  } else {
    kpiCardApproval.style.borderColor = "var(--border-card)";
    kpiCardApproval.style.backgroundColor = "white";
  }
}

function approveProposal(propId) {
  const prop = state.proposals.find(p => p.id === propId);
  if (prop) {
    crmConfirm("Aprovar proposta escalada",
      `Aprovar a proposta <strong>${prop.number}</strong> de <strong>${prop.client}</strong> com o desconto solicitado (${prop.discount})?<br><br>Ao aprovar, a <span style="color:var(--color-ia);">◈ Ana</span> retoma a negociação e envia a proposta aprovada ao cliente automaticamente.`,
      () => {
      prop.needApproval = false;
      prop.status = 'Aguardando cliente';
      
      const lead = state.leads.find(l => l.id === prop.leadId);
      if (lead) {
        lead.escalated = false;
        lead.slaInfo = 'proposta aprovada';
        
        // MELHORIA DE FLUXO: a Ana retoma a conversa com o cliente após a aprovação
        const history = state.chatHistory[lead.id] || [];
        history.push({
          sender: 'ia',
          senderName: 'Ana (IA)',
          type: 'ia',
          text: `Ótima notícia, ${lead.contact.split(' ')[0]}! Nosso diretor comercial aprovou a condição especial. Segue a proposta ${prop.number} no valor de R$ ${prop.value.toLocaleString('pt-BR')} (${prop.items}). Posso emitir o contrato para assinatura eletrônica?`,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        });
        state.chatHistory[lead.id] = history;
      }
      
      state.auditLogs.unshift({
        time: 'Agora',
        actor: state.activeUser.name,
        actorType: 'human',
        action: `Aprovou proposta comercial ${prop.number}`,
        detail: `Desconto de 18% aprovado manualmente pelo diretor comercial.`,
        rule: 'alçada de aprovação'
      });
      
      showNotification(`Proposta ${prop.number} aprovada! A Ana retomou o contato.`);
      renderBudgets();
      renderLeadsBoard();
      updateSidebarCounters();
      }, "Aprovar desconto");
  }
}

function openNewProposalModal() {
  crmPrompt("Nova proposta comercial", [
    { id: 'client', label: 'Empresa', placeholder: 'ex: Aço Vale' },
    { id: 'items',  label: 'Serviços contratados', placeholder: 'ex: Assessoria de IA + Setup' },
    { id: 'value',  label: 'Valor total (R$)', type: 'number', placeholder: '5000' }
  ], v => {
    const client = v.client, items = v.items, value = v.value;
    if (!(client && items && value)) { showNotification("Preencha todos os campos."); return; }
    state.proposals.unshift({
      id: `pr${Date.now()}`,
      number: `#01${Math.floor(100 + Math.random()*900)}`,
      leadId: 'l1',
      client,
      items,
      value: parseFloat(value),
      discount: '0% — dentro da alçada',
      creator: state.activeUser.name,
      status: 'Aguardando cliente',
      needApproval: false
    });
    
    showNotification("Orçamento e proposta cadastrados com sucesso!");
    renderBudgets();
  }, "Criar proposta");
}

function uploadKnowledgeDoc() {
  crmPrompt("Upload de documento comercial", [
    { id: 'name', label: 'Nome do arquivo', placeholder: 'ex: Tabela_Precos_2026.pdf' },
    { id: 'type', label: 'Categoria', type: 'select', options: ['Institucional', 'Catálogo', 'Técnico', 'Jurídico', 'FAQ', 'Geral'] }
  ], v => {
    const name = v.name, type = v.type;
    if (!name) { showNotification("Informe o nome do arquivo."); return; }
    state.docs.unshift({
      id: `d${Date.now()}`,
      name,
      type: type || 'Geral',
      date: 'Hoje',
      size: '1.2 MB',
      uses: 0,
      status: 'Processando...'
    });
    showNotification("Documento comercial enviado para processamento no Supabase.");
    renderBudgets();
    
    setTimeout(() => {
      const doc = state.docs[0];
      if (doc) doc.status = '✓ Indexado';
      renderBudgets();
      showNotification("Documento comercial indexado e pronto para a IA!");
    }, 4000);
  }, "Enviar documento");
}

function answerQuestion(qId) {
  const q = state.unanswered.find(un => un.id === qId);
  crmPrompt("Ensinar a Ana", [
    { id: 'text', label: `Resposta padrão para: "${q.text}"`, type: 'textarea', placeholder: 'A resposta será indexada e a Ana passará a usá-la.' }
  ], v => {
    const text = v.text;
    if (text) {
    state.unanswered = state.unanswered.filter(un => un.id !== qId);
    state.docs.unshift({
      id: `d${Date.now()}`,
      name: `FAQ_Resposta_${qId}.txt`,
      type: 'FAQ',
      date: 'Hoje',
      size: '12 KB',
      uses: 1,
      status: '✓ Indexado'
    });
    
    state.auditLogs.unshift({
      time: 'Agora',
      actor: state.activeUser.name,
      actorType: 'human',
      action: `FAQ comercial indexado`,
      detail: `Resposta adicionada para a pergunta: "${q.text}".`,
      rule: 'base de conhecimento atualizada'
    });
    
    showNotification("Resposta indexada com sucesso!");
    renderBudgets();
    }
  }, "Indexar resposta");
}

// ================= TELA 13 · PORTAL DO VENDEDOR =================
function renderVendorPortal() {
  // Estado de login do portal (QR + OTP)
  const gate    = document.getElementById("vendor-login-gate");
  const content = document.getElementById("vendor-portal-content");
  if (gate && content) {
    if (!state.vendorSession.loggedIn) {
      gate.style.display = "block";
      content.style.display = "none";
      generateVendorQR();
      return;                      // não renderiza a fila enquanto não logar
    }
    gate.style.display = "none";
    content.style.display = "block";
  }

  const leadsQueue = document.getElementById("vendor-portal-leads-queue");
  leadsQueue.innerHTML = "";

  // A fila mostra APENAS os leads enviados a este vendedor pelo painel principal
  const myId = state.vendorSession.userId;
  const vendorLeads = state.leads.filter(l =>
    l.assignedTo === myId && l.stage !== 'Fechado' && l.stage !== 'Pedido' && l.stage !== 'Perdido'
  );

  if (vendorLeads.length === 0) {
    leadsQueue.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:16px; color:var(--text-ter);">Nenhum lead enviado para você ainda. O admin envia pelo painel principal.</td></tr>`;
  } else {
    vendorLeads.forEach(lead => {
      const tr = document.createElement("tr");
      
      let reasonBadge = '<span class="badge badge-gray">Follow-up pendente</span>';
      if (lead.escalated) {
        reasonBadge = '<span class="badge badge-hot">Aprovação pendente</span>';
      } else if (lead.slaInfo.includes('3d')) {
        reasonBadge = '<span class="badge badge-error">3d parado sem retorno</span>';
      } else if (lead.slaInfo.includes('sugestão')) {
        reasonBadge = '<span class="badge badge-ia">Ana sugeriu resposta</span>';
      }
      
      tr.innerHTML = `
        <td>
          <strong>${lead.company}</strong><br>
          <span style="font-size:11px; color:var(--text-sec);">${lead.contact}</span>
        </td>
        <td>${reasonBadge}</td>
        <td><span class="badge badge-gray">${lead.stage}</span></td>
        <td><strong>R$ ${lead.value.toLocaleString('pt-BR')}</strong></td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-primary" onclick="vendorOpenChat('${lead.id}')">Atender</button>
          <button class="btn btn-sm btn-secondary" onclick="viewLeadDetail('${lead.id}')">Ficha</button>
        </td>
      `;
      leadsQueue.appendChild(tr);
    });
  }
  
  // Metas info
  const myClosed = state.leads.filter(l => (l.stage==='Fechado' || l.stage==='Pedido') && l.owner !== 'ia').reduce((acc,c) => acc+c.value, 0);
  document.getElementById("vendor-meta-value").innerText = `R$ ${myClosed.toLocaleString('pt-BR')},00`;
  const myNegoc = state.leads.filter(l => (l.stage==='Negociação') && l.owner !== 'ia').reduce((acc,c) => acc+c.value, 0);
  document.getElementById("vendor-negoc-value").innerText = `R$ ${myNegoc.toLocaleString('pt-BR')},00`;
  
  const myActiveCount = state.leads.filter(l => l.owner !== 'ia' && l.stage!=='Perdido' && l.stage!=='Pedido').length;
  document.getElementById("vendor-leads-active").innerText = `${myActiveCount} leads ativos`;
  
  // Meta progress bar percentage compute
  const pct = Math.min((myClosed / 60000) * 100, 100);
  document.getElementById("vendor-meta-progress-bar").style.width = `${pct}%`;
  
  // Meta task list
  const tList = document.getElementById("vendor-portal-tasks");
  tList.innerHTML = "";
  state.tasks.forEach(t => {
    const div = document.createElement("div");
    div.innerHTML = `
      <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:12.5px;">
        <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTask('${t.id}'); renderVendorPortal();">
        <span style="${t.completed ? 'text-decoration:line-through; color:var(--text-ter);' : ''}">${t.text}</span>
      </label>
    `;
    tList.appendChild(div);
  });
}

// ================= TELA 14 · PEDIDOS =================
function renderOrders() {
  const oBody = document.getElementById("orders-list-table");
  oBody.innerHTML = "";
  
  state.orders.forEach(o => {
    const tr = document.createElement("tr");
    if (o.status.includes('Vencido')) tr.className = "row-alert";
    
    let statusClass = 'badge-success';
    if (o.status.includes('Vencido')) statusClass = 'badge-error';
    else if (o.status.includes('Aguardando')) statusClass = 'badge-warm';
    
    tr.innerHTML = `
      <td>
        <strong>${o.number}</strong><br>
        <span style="font-size:10px; color:var(--text-sec);">${o.company}</span>
      </td>
      <td style="font-size:12.5px; color:var(--text-sec);">${o.items}</td>
      <td><strong>R$ ${o.value.toLocaleString('pt-BR')}</strong></td>
      <td>${o.payment}</td>
      <td>${o.contract}</td>
      <td><span class="badge ${statusClass}">${o.status}</span></td>
      <td style="text-align: right;">
        ${o.status.includes('Vencido') ? `
          <button class="btn btn-sm btn-danger" onclick="triggerDebtCollection('${o.id}')">Cobrar</button>
        ` : `
          <button class="btn btn-sm btn-secondary" onclick="showNotification('Contrato aberto!')">Contrato</button>
        `}
      </td>
    `;
    oBody.appendChild(tr);
  });
  
  // Dashboard Order KPIs
  document.getElementById("orders-kpi-count").innerText = state.orders.length;
  const faturado = state.orders.filter(o => o.status === 'Pago' || o.status.includes('execução')).reduce((acc, c) => acc + c.value, 0);
  document.getElementById("orders-kpi-value").innerText = `R$ ${faturado.toLocaleString('pt-BR')}`;
  
  const unpaidCount = state.orders.filter(o => o.status.includes('Vencido') || o.status.includes('Aguardando')).length;
  document.getElementById("orders-kpi-unpaid").innerText = unpaidCount;
  
  const unpaidCard = document.getElementById("orders-kpi-card-unpaid");
  if (state.orders.some(o => o.status.includes('Vencido'))) {
    unpaidCard.style.borderColor = "var(--color-error)";
    unpaidCard.style.backgroundColor = "var(--bg-error)";
    document.getElementById("orders-kpi-unpaid").style.color = "var(--color-error)";
  } else {
    unpaidCard.style.borderColor = "var(--border-card)";
    unpaidCard.style.backgroundColor = "white";
  }
  
  // Sidebar info timeline
  const firstOrder = state.orders[0];
  document.getElementById("selected-order-detail-header").innerText = `Status de Automação (Pedido ${firstOrder.number})`;
  
  const timeline = document.getElementById("selected-order-timeline");
  timeline.innerHTML = `
    <div class="timeline-item">
      <div class="timeline-marker success"></div>
      <div class="timeline-content">
        <strong>A proposta comercial foi aceita eletronicamente</strong>
        <span class="timeline-time">${firstOrder.date}</span>
      </div>
    </div>
    <div class="timeline-item">
      <div class="timeline-marker success"></div>
      <div class="timeline-content">
        <strong>A minuta de contrato padrão comercial foi emitida</strong>
        <span class="timeline-time">${firstOrder.date}</span>
      </div>
    </div>
    <div class="timeline-item">
      <div class="timeline-marker ${firstOrder.contract === '✓ Assinado' ? 'success' : 'warning'}"></div>
      <div class="timeline-content">
        <strong>Contrato eletrônico enviado para as partes</strong>
        <span class="timeline-time">${firstOrder.contract}</span>
      </div>
    </div>
    <div class="timeline-item">
      <div class="timeline-marker ${firstOrder.status === 'Pago' ? 'success' : 'warning'}"></div>
      <div class="timeline-content">
        <strong>Link Pix copy-paste gerado via Gateway de faturamento</strong>
        <span class="timeline-time">${firstOrder.status}</span>
      </div>
    </div>
  `;
}

function triggerDebtCollection(orderId) {
  const o = state.orders.find(ord => ord.id === orderId);
  if (o) {
    showNotification(`Link de cobrança reenviado via WhatsApp para ${o.company}!`);
    state.auditLogs.unshift({
      time: 'Agora',
      actor: state.activeUser.name,
      actorType: 'human',
      action: `Disparou cobrança de mensalidade atrasada`,
      detail: `Cobrança enviada para o WhatsApp do responsável de ${o.company}.`,
      rule: 'antispam e cobrança'
    });
  }
}

// ================= TELA 15 · RELATÓRIOS =================
function renderReports() {
  // Volume bar horizontal
  const stages = ['Prospecção', 'Qualificado', 'Proposta', 'Negociação', 'Fechado', 'Pedido'];
  const leadsStageContainer = document.getElementById("report-leads-stage-graph");
  leadsStageContainer.innerHTML = "";
  
  stages.forEach(st => {
    const count = state.leads.filter(l => l.stage === st).length;
    const value = state.leads.filter(l => l.stage === st).reduce((acc, c) => acc + c.value, 0);
    const pct = Math.max((count / 10) * 100, 5); // Max reference 10
    
    const div = document.createElement("div");
    div.innerHTML = `
      <div class="d-flex justify-content-between" style="font-size: 11px; margin-bottom: 2px;">
        <span><strong>${st}</strong> (${count})</span>
        <span style="color:var(--text-sec)">R$ ${value.toLocaleString('pt-BR')}</span>
      </div>
      <div class="chart-bar-horizontal">
        <div class="chart-bar-fill" style="width: ${pct}%; background-color: var(--primary);"></div>
      </div>
    `;
    leadsStageContainer.appendChild(div);
  });
  
  // Performance sales dial ranking bars
  const sellerContainer = document.getElementById("report-vendedores-graph");
  sellerContainer.innerHTML = "";
  const performance = [
    { name: 'Ana (IA)', value: state.leads.filter(l => (l.stage==='Fechado' || l.stage==='Pedido') && l.owner==='ia').reduce((acc,c)=>acc+c.value, 0) },
    { name: 'Marina Vendas', value: state.leads.filter(l => (l.stage==='Fechado' || l.stage==='Pedido') && l.owner!=='ia' && l.ownerName.includes('Marina')).reduce((acc,c)=>acc+c.value,0) },
    { name: 'Roberto KA', value: 0 }
  ];
  
  performance.forEach(rep => {
    const pct = Math.max((rep.value / 25000) * 100, 5);
    const div = document.createElement("div");
    div.innerHTML = `
      <div class="d-flex justify-content-between" style="font-size: 11px; margin-bottom: 2px;">
        <span><strong>${rep.name}</strong></span>
        <span style="color:var(--text-sec)">R$ ${rep.value.toLocaleString('pt-BR')}</span>
      </div>
      <div class="chart-bar-horizontal">
        <div class="chart-bar-fill" style="width: ${pct}%; background-color: ${rep.name.includes('Ana') ? 'var(--color-ia)' : 'var(--primary)'};"></div>
      </div>
    `;
    sellerContainer.appendChild(div);
  });
  
  // Loss distribution bars
  const lossContainer = document.getElementById("report-loss-graph");
  lossContainer.innerHTML = "";
  const reasons = [
    { label: 'Preço alto / Sem verba', value: 45, color: 'var(--color-error)' },
    { label: 'Sem retorno no WhatsApp', value: 25, color: 'var(--color-warm)' },
    { label: 'Fechou com Concorrente', value: 18, color: 'var(--color-cold)' },
    { label: 'Sem orçamento / Outros', value: 12, color: 'var(--text-ter)' }
  ];
  
  reasons.forEach(r => {
    const div = document.createElement("div");
    div.innerHTML = `
      <div class="d-flex justify-content-between" style="font-size: 11px; margin-bottom: 2px;">
        <span>${r.label}</span>
        <span><strong>${r.value}%</strong></span>
      </div>
      <div class="chart-bar-horizontal" style="height:12px;">
        <div class="chart-bar-fill" style="width: ${r.value}%; background-color: ${r.color};"></div>
      </div>
    `;
    lossContainer.appendChild(div);
  });
}

// ================= TELA 16-20 · CONFIGURAÇÕES =================
function renderSettings() {
  // Recalcula contadores de leads (o seed pode divergir dos dados reais)
  state.users.forEach(u => {
    if (u.role === 'Vendedor Virtual') {
      u.leads = state.leads.filter(l => l.owner === 'ia' && !['Perdido'].includes(l.stage)).length;
    } else if (u.role === 'Vendedor') {
      u.leads = state.leads.filter(l => (l.ownerName === u.name || l.assignedTo === u.id) && !['Perdido'].includes(l.stage)).length;
    }
  });

  // Aba 1: Users Grid Commercial Team
  const teamGrid = document.getElementById("settings-team-grid");
  teamGrid.innerHTML = "";
  
  state.users.forEach(u => {
    const isIA = u.role === 'Vendedor Virtual';
    const card = document.createElement("div");
    card.className = "card";
    if (isIA) card.style.borderStyle = "dashed";
    if (isIA) card.style.borderColor = "var(--color-ia)";
    
    card.innerHTML = `
      <div class="card-body d-flex align-items-center gap-3">
        <div class="user-avatar ${isIA ? 'avatar-ia' : ''}" style="width: 44px; height: 44px; font-size: 16px;">${u.avatar}</div>
        <div class="d-flex flex-column">
          <strong style="color:var(--text-title);">${u.name}</strong>
          <span style="font-size:11px; color:var(--text-sec);">${u.role}</span>
          <span style="font-size:10px; color:var(--text-ter); margin-top:2px;">${u.leads} leads sob gerência</span>
        </div>
      </div>
    `;
    teamGrid.appendChild(card);
  });
  
  // Aba 1: Users permissions table list
  const usersTable = document.getElementById("settings-users-table-body");
  usersTable.innerHTML = "";
  state.users.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${u.name}</strong></td>
      <td>${u.email}</td>
      <td>${u.phone ? u.phone : '<span style="color:var(--color-error); font-size:11px;">sem telefone</span>'}</td>
      <td>${formatMinutes(state.vendorSessions.filter(s => s.userId === u.id).reduce((a, s) => a + s.minutes, 0))}</td>
      <td>
        <select class="form-control form-control-sm" style="width:120px;" ${u.id==='u1' ? 'disabled' : ''}>
          <option ${u.role==='Administrador' ? 'selected' : ''}>Administrador</option>
          <option ${u.role==='Gestor' ? 'selected' : ''}>Gestor</option>
          <option ${u.role==='Vendedor' ? 'selected' : ''}>Vendedor</option>
          <option ${u.role==='Vendedor Virtual' ? 'selected' : ''}>Vendedor Virtual</option>
        </select>
      </td>
      <td>${u.leads} leads</td>
      <td>
        <label class="switch-label">
          <span class="switch">
            <input type="checkbox" ${u.canUseIA ? 'checked' : ''} ${u.id==='u1' ? 'disabled' : ''}>
            <span class="slider slider-ia"></span>
          </span>
        </label>
      </td>
      <td>
        <select class="form-control form-control-sm" style="width:110px;" ${u.id==='u1' ? 'disabled' : ''}>
          <option ${u.discountLimit==='Até 5%' ? 'selected' : ''}>Até 5%</option>
          <option ${u.discountLimit==='Até 10%' ? 'selected' : ''}>Até 10%</option>
          <option ${u.discountLimit==='Até 20%' ? 'selected' : ''}>Até 20%</option>
          <option ${u.discountLimit==='Sem limite' ? 'selected' : ''}>Sem limite</option>
        </select>
      </td>
      <td><span class="badge badge-success">Ativo</span></td>
      <td style="text-align: right;">
        <button class="btn btn-sm btn-icon" ${u.id==='u1' ? 'disabled' : ''} onclick="showNotification('Usuário suspenso!')">⊘</button>
      </td>
    `;
    usersTable.appendChild(tr);
  });
  
  // Aba 2: Integrations list
  const integrations = [
    { name: 'WhatsApp Business API (Meta)', desc: 'Canal de comunicação oficial para disparos automatizados.', connected: true },
    { name: 'Modelo de Linguagem Comercial (GPT-4o)', desc: 'Cérebro conversacional para prospecção autônoma.', connected: true },
    { name: 'Google Maps Places Search API', desc: 'Pesquisa ativa de CNPJs e estabelecimentos no mapa.', connected: true },
    { name: 'Asaas Pagamentos Gateway', desc: 'Emissão automática de links Pix copy-paste e cobranças.', connected: true },
    { name: 'Clicksign Assinaturas API', desc: 'Emissão e verificação de assinatura eletrônica do contrato.', connected: true },
    { name: 'Bling ERP / Financeiro', desc: 'Exportação de pedidos e faturamento fiscal.', connected: false },
    { name: 'E-mail Comercial SMTP Relay', desc: 'Disparo de follow-ups institucionais em propostas quentes.', connected: false }
  ];
  
  const intContainer = document.getElementById("integrations-list-container");
  intContainer.innerHTML = "";
  integrations.forEach(int => {
    const div = document.createElement("div");
    div.className = "d-flex align-items-center justify-content-between";
    div.style.padding = "10px 14px";
    div.style.backgroundColor = "#F8FAFC";
    div.style.border = "1px solid var(--border-card)";
    div.style.borderRadius = "10px";
    div.innerHTML = `
      <div class="d-flex flex-column" style="line-height:1.2;">
        <span style="font-weight: 600; font-size: 13px;">${int.name}</span>
        <span style="font-size: 10px; color: var(--text-sec); margin-top:2px;">${int.desc}</span>
      </div>
      <div class="d-flex align-items-center gap-3">
        <span class="badge ${int.connected ? 'badge-success' : 'badge-gray'}">${int.connected ? '✓ Conectado' : 'Não conectado'}</span>
        <button class="btn btn-sm btn-secondary" onclick="toggleIntegrationConn('${int.name}')">${int.connected ? 'Gerenciar' : 'Conectar'}</button>
      </div>
    `;
    intContainer.appendChild(div);
  });
  
  // Aba 5: Audit logs
  filterAuditLogs();
}

function filterAuditLogs() {
  const filterType = document.getElementById("audit-filter-type").value;
  const auditBody = document.getElementById("audit-logs-table-body");
  auditBody.innerHTML = "";
  
  const filtered = state.auditLogs.filter(log => {
    if (filterType === 'ia') return log.actorType === 'ia';
    if (filterType === 'human') return log.actorType === 'human';
    return true;
  });
  
  filtered.forEach(log => {
    const tr = document.createElement("tr");
    let actorLabel = log.actorType === 'ia' ? `<span class="badge badge-ia">◈ ${log.actor}</span>` : `<span class="badge badge-human">◑ ${log.actor}</span>`;
    
    tr.innerHTML = `
      <td><span style="font-family: monospace; font-size:11px;">${log.time}</span></td>
      <td>${actorLabel}</td>
      <td><strong style="color:var(--text-title); font-size:12.5px;">${log.action}</strong><br><span style="font-size:11px; color:var(--text-sec);">${log.detail}</span></td>
      <td><span class="badge badge-gray">${log.rule}</span></td>
    `;
    auditBody.appendChild(tr);
  });
}

function handleAddNewUser() {
  const name  = document.getElementById("new-user-name").value.trim();
  const email = document.getElementById("new-user-email").value.trim();
  const phone = document.getElementById("new-user-phone").value.trim();
  const password = document.getElementById("new-user-password").value;
  const role  = document.getElementById("new-user-role").value;

  if (!name || !email || !phone) {
    showNotification("Nome, e-mail e telefone (WhatsApp) são obrigatórios.");
    return;
  }

  state.users.push({
    id: `u${Date.now()}`,
    name, email, phone, role, leads: 0, canUseIA: true,
    discountLimit: '5%', active: true, avatar: name.substring(0,1).toUpperCase()
  });

  // o <form> virou <div> (submit é bloqueado em iframe), então limpamos manualmente
  ["new-user-name","new-user-email","new-user-phone","new-user-password"]
    .forEach(id => document.getElementById(id).value = "");

  state.auditLogs.unshift({
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    actor: state.activeUser.name, actorType: 'human',
    action: `Vendedor ${name} cadastrado`,
    detail: `Telefone ${phone} habilitado para login no Portal do Vendedor.`,
    rule: 'gestão de usuários'
  });

  showNotification(`Vendedor ${name} cadastrado! WhatsApp: ${phone}`);
  renderSettings();
}

function toggleIntegrationConn(name) {
  showNotification(`Ajustes da integração ${name} abertos!`);
}

function triggerEmergencyPause() {
  state.aiPaused = !state.aiPaused;
  const btn = document.getElementById("emergency-pause-btn");
  
  if (state.aiPaused) {
    btn.innerText = "▶ Retomar Vendas Virtuais da IA";
    btn.className = "btn btn-primary";
    showNotification("⏸ URGENTE: TODA AUTOMAÇÃO DA IA FOI PAUSADA!");
    
    // Log
    state.auditLogs.unshift({
      time: 'Agora',
      actor: state.activeUser.name,
      actorType: 'human',
      action: 'PAUSOU TODA A IA EM EMERGÊNCIA',
      detail: 'Interrupção forçada de todos os disparos e chatbot conversacional da Ana.',
      rule: 'botão de pânico comercial'
    });
  } else {
    btn.innerText = "⏸ Pausar toda a IA agora";
    btn.className = "btn btn-danger";
    showNotification("Vendedor virtual Ana reativado!");
    
    // Log
    state.auditLogs.unshift({
      time: 'Agora',
      actor: state.activeUser.name,
      actorType: 'human',
      action: 'Retomou automações da IA Ana',
      detail: 'Vendedor virtual ativado para conduzir negociações.',
      rule: 'botão de pânico comercial'
    });
  }
  renderSettings();
  renderDashboard();
  renderCentral();
}

// ================= GLOBAL SEARCH FILTER =================
function handleGlobalSearch(term) {
  if (!term.trim()) {
    renderAll();
    return;
  }
  const cleanTerm = term.toLowerCase();
  
  // Dynamic temporary overlay filter or switch views to Leads list to show matches
  switchPanel('leads');
  document.getElementById("leads-filter-search").value = term;
  filterLeadsBoard();
}

function filterLeadsBoard() {
  renderLeadsBoard();
}

// ================= MODALS HANDLERS =================
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("active");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("active");
}

function useMsgTemplate(type) {
  const input = document.getElementById("chat-input-field");
  let val = "";
  if (type === 'Abertura Comercial') {
    val = "Olá! Sou a Ana da WF Digital. Gostaria de entender se sua empresa está buscando automatizar a prospecção B2B de forma 100% autônoma...";
  } else if (type === 'Apresentação de Serviços') {
    val = "Fornecemos assessoria de implantação com vendedor virtual no WhatsApp rodando 24h integrado a bases de conhecimento do Supabase...";
  } else if (type === 'Envio de Proposta') {
    val = "Seguem detalhes da nossa proposta comercial anexada em PDF. Ficamos à disposição para faturamento eletrônico.";
  }
  input.value = val;
  closeModal("modal-templates");
  showNotification("Template copiado!");
}

function openTemplatesModal() {
  openModal("modal-templates");
}

// ================= FUNÇÕES AUSENTES (chamadas pelo HTML, mas não implementadas) =================

// Salvar anotação privada no lead (input #detail-note-input, tela Detalhe do Lead)
function saveLeadNote() {
  const input = document.getElementById("detail-note-input");
  const text = input.value.trim();
  if (!text) {
    showNotification("Digite uma anotação antes de salvar.");
    return;
  }
  const lead = state.leads.find(l => l.id === state.activeLeadId);
  if (!lead) return;

  state.auditLogs.unshift({
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    actor: state.activeUser.name,
    actorType: 'human',
    action: `Anotação registrada em ${lead.company}`,
    detail: text,
    rule: 'nota privada do vendedor'
  });

  input.value = "";
  showNotification("Anotação salva na timeline do lead!");
  renderLeadDetail();
}

// Criar tarefa vinculada ao lead aberto (botão "+ Criar" no card Tarefas do Lead)
function addNewLeadTask() {
  const lead = state.leads.find(l => l.id === state.activeLeadId);
  if (!lead) return;

  crmPrompt(`Nova tarefa · ${lead.company}`, [
    { id: 'text', label: 'Descrição da tarefa', placeholder: 'ex: Enviar proposta revisada até sexta' }
  ], v => {
    if (!v.text) return;
    state.tasks.unshift({
      id: `t${Date.now()}`,
      text: v.text,
      time: 'Hoje, ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      owner: lead.owner === 'ia' ? 'Ana (IA)' : (lead.ownerName || state.activeUser.name),
      completed: false
    });
    showNotification("Tarefa vinculada ao lead!");
    renderLeadDetail();
    renderDashboard();
  }, "Criar tarefa");
}

// Novo item do catálogo (botão "+ Novo item" na aba Catálogo de Orçamentos)
function openNewItemCatalogModal() {
  openModal("modal-novo-servico");
}

// Novo pedido manual (botão "+ Novo pedido" na tela Pedidos)
function createNewOrderModal() {
  crmPrompt("Novo pedido manual", [
    { id: 'company', label: 'Empresa', placeholder: 'ex: Farmácias Vida Plena' },
    { id: 'value',   label: 'Valor do pedido (R$)', type: 'number', placeholder: '5000' }
  ], v => {
    const company = v.company;
    if (!company) { showNotification("Informe a empresa."); return; }
    const value = parseFloat(v.value) || 0;

  const seq = String(state.orders.length + 41).padStart(3, '0');
  state.orders.unshift({
    id: `o_2026_${seq}`,
    number: `#2026-${seq}`,
    company: company,
    seller: state.activeUser.name,
    sellerType: 'human',
    date: 'Hoje',
    items: 'Pedido lançado manualmente',
    value: value,
    payment: 'A definir',
    contract: 'Aguardando assinatura',
    status: 'Aguardando pagamento'
  });

  showNotification(`Pedido #2026-${seq} criado!`);
  renderOrders();
  updateSidebarCounters();
  }, "Criar pedido");
}

// Sino de notificações da topbar
function toggleNotifications() {
  const pendentes = state.leads.filter(l => l.escalated).length;
  const aprovacoes = state.proposals.filter(p => p.needApproval).length;
  showNotification(`${pendentes} escalonamento(s) da IA · ${aprovacoes} proposta(s) aguardando aprovação`);
}

// ================= PORTAL DO VENDEDOR · LOGIN POR QR PRÓPRIO + OTP NO WHATSAPP =================
// NOTA: o QR é gerado pelo próprio CRM (não é o QR do WhatsApp Web).
// O vendedor lê o QR, recebe um código de 6 dígitos no WhatsApp dele e entra.
// Isso evita as bibliotecas não-oficiais do WhatsApp (risco de banimento do número).

let vendorTimerInterval = null;

function vendorSellers() {
  return state.users.filter(u => u.role === 'Vendedor' && u.phone);
}

// Desenha um QR Code simulado (padrão determinístico a partir do token)
function drawFakeQR(token) {
  const size = 21, cell = 8, pad = 8;
  let seed = 0;
  for (let i = 0; i < token.length; i++) seed = (seed * 31 + token.charCodeAt(i)) >>> 0;
  const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;

  const isFinder = (r, c) =>
    (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);

  let rects = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      let on = false;
      if (isFinder(r, c)) {
        const rr = r >= size - 7 ? r - (size - 7) : r;
        const cc = c >= size - 7 ? c - (size - 7) : c;
        const edge = rr === 0 || rr === 6 || cc === 0 || cc === 6;
        const core = rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4;
        on = edge || core;
      } else {
        on = rnd() > 0.5;
      }
      if (on) rects += `<rect x="${pad + c * cell}" y="${pad + r * cell}" width="${cell}" height="${cell}" fill="#0F172A"/>`;
    }
  }
  const total = size * cell + pad * 2;
  return `<svg width="${total}" height="${total}" viewBox="0 0 ${total} ${total}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${total}" height="${total}" fill="white"/>${rects}</svg>`;
}

function generateVendorQR() {
  // popula o select de vendedores (apenas quem tem telefone cadastrado)
  const sel = document.getElementById("vendor-login-user");
  if (sel && sel.options.length === 0) {
    vendorSellers().forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.text = `${u.name} · ${u.phone}`;
      sel.appendChild(opt);
    });
  }

  const token = 'WF-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  state.vendorSession.token = token;
  state.vendorSession.otp = null;

  document.getElementById("vendor-qr-box").innerHTML = drawFakeQR(token);
  const otpArea = document.getElementById("vendor-otp-area");
  if (otpArea) otpArea.style.display = "none";
}

function simulateQrScan() {
  const sel = document.getElementById("vendor-login-user");
  const user = state.users.find(u => u.id === sel.value);
  if (!user) { showNotification("Cadastre um vendedor com telefone primeiro."); return; }

  // gera o código que "chega" no WhatsApp do vendedor
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  state.vendorSession.otp = otp;
  state.vendorSession.userId = user.id;

  document.getElementById("vendor-otp-phone").innerText = user.phone;
  document.getElementById("vendor-otp-code").innerText = otp;
  document.getElementById("vendor-otp-area").style.display = "block";
  document.getElementById("vendor-otp-input").value = "";
  document.getElementById("vendor-otp-input").focus();

  showNotification(`Código enviado no WhatsApp ${user.phone}`);
}

function verifyVendorOtp() {
  const typed = document.getElementById("vendor-otp-input").value.trim();
  if (typed !== state.vendorSession.otp) {
    showNotification("Código inválido. Confira o WhatsApp.");
    return;
  }

  const user = state.users.find(u => u.id === state.vendorSession.userId);
  state.vendorSession.loggedIn = true;
  state.vendorSession.startedAt = Date.now();

  document.getElementById("vendor-login-gate").style.display = "none";
  document.getElementById("vendor-portal-content").style.display = "block";

  document.getElementById("vendor-session-name").innerText = user.name;
  document.getElementById("vendor-session-phone").innerText = user.phone + " · conectado via QR + WhatsApp";
  document.getElementById("vendor-session-avatar").innerText = user.avatar;

  clearInterval(vendorTimerInterval);
  vendorTimerInterval = setInterval(updateVendorTimer, 1000);
  updateVendorTimer();

  state.auditLogs.unshift({
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    actor: user.name, actorType: 'human',
    action: `${user.name} conectou-se ao Portal do Vendedor`,
    detail: `Autenticação por QR Code do CRM + código enviado ao WhatsApp ${user.phone}.`,
    rule: 'login do portal do vendedor'
  });

  showNotification(`Bem-vindo(a), ${user.name}!`);
  renderVendorPortal();
}

function updateVendorTimer() {
  if (!state.vendorSession.loggedIn) return;
  const s = Math.floor((Date.now() - state.vendorSession.startedAt) / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  const el = document.getElementById("vendor-session-timer");
  if (el) el.innerText = `${hh}:${mm}:${ss}`;
}

function vendorLogout() {
  const user = state.users.find(u => u.id === state.vendorSession.userId);
  const minutes = Math.max(1, Math.round((Date.now() - state.vendorSession.startedAt) / 60000));
  const now = new Date();

  // grava a sessão no histórico visível pelo painel principal
  state.vendorSessions.unshift({
    userId: user.id,
    userName: user.name,
    start: new Date(state.vendorSession.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    end: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    minutes: minutes,
    date: now.toLocaleDateString('pt-BR')
  });

  state.auditLogs.unshift({
    time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    actor: user.name, actorType: 'human',
    action: `${user.name} encerrou a sessão no Portal do Vendedor`,
    detail: `Tempo conectado nesta sessão: ${minutes} minuto(s).`,
    rule: 'controle de jornada do vendedor'
  });

  clearInterval(vendorTimerInterval);
  state.vendorSession = { loggedIn: false, userId: null, startedAt: null, otp: null, token: null };
  state.vendorActiveLeadId = null;

  document.getElementById("vendor-portal-content").style.display = "none";
  document.getElementById("vendor-login-gate").style.display = "block";
  generateVendorQR();

  showNotification(`Sessão encerrada · ${minutes} min trabalhados`);
  renderSettings();
  renderReports();
}

// ================= ENVIO DE LEAD AO PORTAL DO VENDEDOR =================
let enviarVendedorTargets = [];   // ids de leads a enviar

function openEnviarVendedorModal(leadIds) {
  const sellers = vendorSellers();
  if (sellers.length === 0) {
    showNotification("Cadastre um vendedor com telefone em Configurações.");
    return;
  }

  enviarVendedorTargets = leadIds && leadIds.length ? leadIds : [state.activeLeadId];

  const sel = document.getElementById("enviar-vendedor-select");
  sel.innerHTML = "";
  sellers.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.text = `${u.name} — ${u.phone}`;
    sel.appendChild(opt);
  });

  const nomes = enviarVendedorTargets
    .map(id => (state.leads.find(l => l.id === id) || {}).company)
    .filter(Boolean).join(", ");
  document.getElementById("enviar-vendedor-resumo").innerHTML =
    `<strong>${enviarVendedorTargets.length}</strong> lead(s) serão enviados: ${nomes}`;

  updateEnviarVendedorInfo();
  openModal("modal-enviar-vendedor");
}

function updateEnviarVendedorInfo() {
  const u = state.users.find(x => x.id === document.getElementById("enviar-vendedor-select").value);
  if (!u) return;
  document.getElementById("enviar-vendedor-phone").innerText = u.phone;
  document.getElementById("enviar-vendedor-msg").innerText =
    `Olá ${u.name}! Você recebeu ${enviarVendedorTargets.length} novo(s) lead(s) no Portal do Vendedor. Acesse e leia o QR para atender.`;
}

function confirmEnviarVendedor() {
  const u = state.users.find(x => x.id === document.getElementById("enviar-vendedor-select").value);
  if (!u) return;

  enviarVendedorTargets.forEach(id => {
    const lead = state.leads.find(l => l.id === id);
    if (!lead) return;
    lead.assignedTo = u.id;
    lead.owner = 'human';
    lead.ownerName = u.name;

    state.auditLogs.unshift({
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      actor: state.activeUser.name, actorType: 'human',
      action: `Lead ${lead.company} enviado para ${u.name}`,
      detail: `Notificação disparada no WhatsApp ${u.phone}. Lead disponível no Portal do Vendedor.`,
      rule: 'distribuição de leads'
    });
  });

  u.leads = state.leads.filter(l => l.assignedTo === u.id).length;

  closeModal("modal-enviar-vendedor");
  showNotification(`${enviarVendedorTargets.length} lead(s) enviados para ${u.name} (${u.phone})`);
  renderAll();
}

// ================= CHAT DENTRO DO PORTAL (gera histórico no painel principal) =================
function vendorOpenChat(leadId) {
  state.vendorActiveLeadId = leadId;
  const lead = state.leads.find(l => l.id === leadId);

  document.getElementById("vendor-chat-title").innerText = `${lead.company} · ${lead.contact} (${lead.phone})`;
  document.getElementById("vendor-chat-empty").style.display = "none";
  document.getElementById("vendor-chat-wrapper").style.display = "block";
  renderVendorChat();
}

function renderVendorChat() {
  const leadId = state.vendorActiveLeadId;
  if (!leadId) return;
  const box = document.getElementById("vendor-chat-messages");
  const msgs = state.chatHistory[leadId] || [];
  box.innerHTML = "";

  if (msgs.length === 0) {
    box.innerHTML = `<p style="font-size:11px; color:var(--text-sec); text-align:center;">Nenhuma mensagem ainda. Inicie a conversa.</p>`;
    return;
  }

  msgs.forEach(m => {
    const mine = m.sender !== 'client';
    const bg = m.sender === 'client' ? 'white' : (m.type === 'ia' || m.sender === 'ia' ? '#F1ECFE' : '#DCF8C6');
    const div = document.createElement("div");
    div.style.cssText = `align-self:${mine ? 'flex-end' : 'flex-start'}; max-width:75%; background:${bg}; padding:8px 10px; border-radius:8px; box-shadow:0 1px 1px rgba(0,0,0,.08);`;
    div.innerHTML = `
      <div style="font-size:10px; color:var(--text-sec); margin-bottom:2px;">${m.senderName}</div>
      <div style="font-size:12px; color:var(--text-body);">${m.text}</div>
      <div style="font-size:9px; color:var(--text-ter); text-align:right; margin-top:2px;">${m.time}</div>`;
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}

function vendorSendMessage() {
  const input = document.getElementById("vendor-chat-input");
  const text = input.value.trim();
  if (!text || !state.vendorActiveLeadId) return;

  const lead = state.leads.find(l => l.id === state.vendorActiveLeadId);
  const user = state.users.find(u => u.id === state.vendorSession.userId);
  const history = state.chatHistory[lead.id] || [];

  history.push({
    sender: 'human',
    senderName: `${user.name} (Portal do Vendedor)`,
    type: 'human',
    text: text,
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  });
  state.chatHistory[lead.id] = history;

  state.auditLogs.unshift({
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    actor: user.name, actorType: 'human',
    action: `Mensagem enviada a ${lead.company} pelo Portal do Vendedor`,
    detail: text,
    rule: 'atendimento via WhatsApp Business API'
  });

  lead.lastContact = 'Hoje, ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  input.value = "";
  renderVendorChat();
}


// Formata minutos em "3h 42min"
function formatMinutes(min) {
  if (!min) return '<span style="color:var(--text-ter);">—</span>';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h ${m}min` : `${m}min`;
}

// ================= RELATÓRIOS · JORNADA DOS VENDEDORES =================
function renderVendorSessions() {
  const body = document.getElementById("vendor-sessions-body");
  if (!body) return;
  body.innerHTML = "";

  const sessions = [...state.vendorSessions];

  // sessão em andamento aparece ao vivo
  if (state.vendorSession.loggedIn) {
    const u = state.users.find(x => x.id === state.vendorSession.userId);
    sessions.unshift({
      userId: u.id, userName: u.name,
      start: new Date(state.vendorSession.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      end: null,
      minutes: Math.max(0, Math.round((Date.now() - state.vendorSession.startedAt) / 60000)),
      date: new Date().toLocaleDateString('pt-BR'),
      live: true
    });
  }

  if (sessions.length === 0) {
    body.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:16px; color:var(--text-ter);">Nenhuma sessão registrada.</td></tr>`;
  } else {
    sessions.forEach(s => {
      const leadsQtd = state.leads.filter(l => l.assignedTo === s.userId).length;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${s.userName}</strong></td>
        <td>${s.date}</td>
        <td>${s.start}</td>
        <td>${s.end ? s.end : '<span class="badge badge-success">● online agora</span>'}</td>
        <td><strong>${formatMinutes(s.minutes)}</strong></td>
        <td>${leadsQtd} lead(s)</td>`;
      body.appendChild(tr);
    });
  }

  const total = sessions.reduce((a, s) => a + s.minutes, 0);
  const totalEl = document.getElementById("vendor-sessions-total");
  if (totalEl) totalEl.innerText = `Total: ${formatMinutes(total) === '—' ? '0min' : formatMinutes(total).replace(/<[^>]*>/g,'')}`;
}

// ================= SISTEMA DE DIÁLOGO PRÓPRIO =================
// prompt(), confirm() e alert() nativos são bloqueados em iframes sandboxed.
// crmConfirm / crmPrompt substituem todos com um modal do próprio CRM.

let _crmDialogOnOk = null;

function crmConfirm(title, message, onOk, okText = "Confirmar", danger = false) {
  document.getElementById("crm-dialog-title").innerText = title;
  document.getElementById("crm-dialog-body").innerHTML =
    `<p style="font-size:13px; color:var(--text-body); line-height:1.5;">${message}</p>`;
  const okBtn = document.getElementById("crm-dialog-ok");
  okBtn.innerText = okText;
  okBtn.className = danger ? "btn btn-danger" : "btn btn-primary";
  _crmDialogOnOk = () => onOk();
  openModal("modal-crm-dialog");
}

// fields: [{ id, label, placeholder, type: 'text'|'number'|'textarea'|'select', options, value }]
function crmPrompt(title, fields, onOk, okText = "Salvar") {
  document.getElementById("crm-dialog-title").innerText = title;
  const body = document.getElementById("crm-dialog-body");
  body.innerHTML = "";

  fields.forEach((f, i) => {
    const group = document.createElement("div");
    group.className = "form-group";
    let control = "";
    if (f.type === "textarea") {
      control = `<textarea class="form-control" id="crm-dlg-${f.id}" rows="4" placeholder="${f.placeholder || ''}">${f.value || ''}</textarea>`;
    } else if (f.type === "select") {
      const opts = (f.options || []).map(o => `<option ${o === f.value ? 'selected' : ''}>${o}</option>`).join("");
      control = `<select class="form-control" id="crm-dlg-${f.id}">${opts}</select>`;
    } else {
      control = `<input type="${f.type || 'text'}" class="form-control" id="crm-dlg-${f.id}" placeholder="${f.placeholder || ''}" value="${f.value || ''}" ${i === fields.length - 1 ? `onkeydown="if(event.key==='Enter') crmDialogOk()"` : ''}>`;
    }
    group.innerHTML = `<label class="form-label">${f.label}</label>${control}`;
    body.appendChild(group);
  });

  const okBtn = document.getElementById("crm-dialog-ok");
  okBtn.innerText = okText;
  okBtn.className = "btn btn-primary";

  _crmDialogOnOk = () => {
    const values = {};
    fields.forEach(f => values[f.id] = document.getElementById(`crm-dlg-${f.id}`).value.trim());
    onOk(values);
  };

  openModal("modal-crm-dialog");
  setTimeout(() => { const first = document.getElementById(`crm-dlg-${fields[0].id}`); if (first) first.focus(); }, 60);
}

function crmDialogOk() {
  const fn = _crmDialogOnOk;
  closeModal("modal-crm-dialog");
  _crmDialogOnOk = null;
  if (fn) fn();
}

function crmDialogCancel() {
  _crmDialogOnOk = null;
  closeModal("modal-crm-dialog");
}


// Cria pedido a partir de um lead fechado (chamado pelo crmConfirm do kanban)
function createOrderFromLead(lead) {
  const orderNum = `#2026-${Math.floor(Math.random() * 1000)}`;
  state.orders.unshift({
    id: `o_${Date.now()}`,
    number: orderNum,
    company: lead.company,
    seller: lead.owner === 'ia' ? 'Ana (IA)' : lead.ownerName,
    sellerType: lead.owner === 'ia' ? 'ia' : 'human',
    date: 'Hoje',
    items: 'Assessoria de IA Comercial',
    value: lead.value,
    payment: 'Pix à vista',
    contract: 'Aguardando assinatura',
    status: 'Aguardando pagamento'
  });
  showNotification(`Pedido ${orderNum} gerado com sucesso para ${lead.company}!`);
  renderOrders();
  updateSidebarCounters();
}
