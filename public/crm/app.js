// ================= STATE & DATABASE SEED =================
const state = {
  activeUser: { id: 'u1', name: 'Fabrício Admin', role: 'Administrador', avatar: 'F', email: 'comercial@wfdigital.com.br' },
  
  users: [
    { id: 'u1', name: 'Fabrício Admin', email: 'comercial@wfdigital.com.br', role: 'Administrador', leads: 0, canUseIA: true, discountLimit: 'Sem limite', active: true, avatar: 'F' },
    { id: 'u2', name: 'Marina Vendas', email: 'marina@wfdigital.com.br', role: 'Vendedor', leads: 4, canUseIA: true, discountLimit: '10%', active: true, avatar: 'M' },
    { id: 'u3', name: 'Roberto KA', email: 'roberto@wfdigital.com.br', role: 'Vendedor', leads: 2, canUseIA: true, discountLimit: '5%', active: true, avatar: 'R' },
    { id: 'u4', name: 'Carlos SDR', email: 'carlos@wfdigital.com.br', role: 'Vendedor', leads: 0, canUseIA: false, discountLimit: 'Até 5%', active: true, avatar: 'C' },
    { id: 'u5', name: 'Patrícia CX', email: 'patricia@wfdigital.com.br', role: 'Vendedor', leads: 0, canUseIA: true, discountLimit: 'Até 10%', active: true, avatar: 'P' },
    { id: 'u_ia', name: 'Ana (IA)', email: 'ana@wfdigital.com.br', role: 'Vendedor Virtual', leads: 6, canUseIA: true, discountLimit: '10%', active: true, avatar: '◈' }
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
    { id: 'l1', company: 'Aço Vale', contact: 'Renato Souza', title: 'Diretor Comercial', phone: '(11) 98231-4402', segment: 'Indústrias Metalúrgicas', uf: 'SP', distance: 12, score: 91, temp: 'hot', stage: 'Negociação', value: 8500, owner: 'ia', staleHours: 4, escalated: true, escalationReason: 'Pediu 18% de desconto; a alçada da IA é 10%', slaInfo: '⚠ escalado', lastContact: 'Hoje, 12:40' },
    { id: 'l2', company: 'Sabor Mineiro', contact: 'Gisele Santos', title: 'Proprietária', phone: '(31) 97723-5599', segment: 'Serviços Médicos', uf: 'MG', distance: 340, score: 78, temp: 'hot', stage: 'Proposta', value: 5000, owner: 'ia', staleHours: 1, escalated: false, escalationReason: '', slaInfo: 'sugestão pronta', lastContact: 'Hoje, 10:15' },
    { id: 'l3', company: 'Ápice Contábil', contact: 'Marcos Silva', title: 'Sócio', phone: '(11) 96655-1122', segment: 'Tecnologia', uf: 'SP', distance: 8, score: 85, temp: 'hot', stage: 'Qualificado', value: 5000, owner: 'ia', staleHours: 49, escalated: false, escalationReason: '', slaInfo: '3d parado', lastContact: 'Há 3 dias' },
    { id: 'l4', company: 'TechFrota', contact: 'Júlia Mendes', title: 'Gerente Comercial', phone: '(21) 99881-2244', segment: 'Tecnologia', uf: 'RJ', distance: 410, score: 82, temp: 'hot', stage: 'Prospecção', value: 7000, owner: 'ia', staleHours: 0, escalated: false, escalationReason: '', slaInfo: 'vence hoje', lastContact: 'Hoje, 09:30' },
    { id: 'l5', company: 'Corpo em Movimento', contact: 'Dr. Fabiano', title: 'Diretor', phone: '(11) 98822-7711', segment: 'Serviços Médicos', uf: 'SP', distance: 15, score: 71, temp: 'warm', stage: 'Proposta', value: 5490, owner: 'human', ownerName: 'Marina Vendas', staleHours: 24, escalated: false, escalationReason: '', slaInfo: '8 dias', lastContact: 'Ontem, 15:40' },
    { id: 'l6', company: 'Rota Sul Cargas', contact: 'Eduardo Lima', title: 'CEO', phone: '(51) 95532-6633', segment: 'Tecnologia', uf: 'RS', distance: 950, score: 64, temp: 'warm', stage: 'Negociação', value: 12000, owner: 'human', ownerName: 'Marina Vendas', staleHours: 52, escalated: false, escalationReason: '', slaInfo: '3d parado', lastContact: 'Há 3 dias' },
    { id: 'l7', company: 'Semente Ouro', contact: 'Amanda Costa', title: 'Comercial', phone: '(62) 94411-9988', segment: 'Outro', uf: 'GO', distance: 880, score: 55, temp: 'warm', stage: 'Qualificado', value: 6500, owner: 'human', ownerName: 'Marina Vendas', staleHours: 12, escalated: false, escalationReason: '', slaInfo: '8 dias', lastContact: 'Hoje, 08:00' },
    { id: 'l8', company: 'Farmácias Vida Plena', contact: 'Roberto Albuquerque', title: 'Diretor Compras', phone: '(11) 93322-8877', segment: 'Serviços Médicos', uf: 'SP', distance: 20, score: 88, temp: 'hot', stage: 'Fechado', value: 7000, owner: 'human', ownerName: 'Marina Vendas', staleHours: 0, escalated: false, escalationReason: '', slaInfo: '✓ pedido', lastContact: 'Ontem, 17:30' },
    { id: 'l9', company: 'Bella Napoli', contact: 'Giovanni', title: 'Sócio', phone: '(11) 92211-5544', segment: 'Outro', uf: 'SP', distance: 5, score: 48, temp: 'warm', stage: 'Prospecção', value: 2490, owner: 'human', ownerName: 'Roberto KA', staleHours: 6, escalated: false, escalationReason: '', slaInfo: '8 dias', lastContact: 'Hoje, 14:10' },
    { id: 'l10', company: 'Alicerce Forte', contact: 'Carlos Ramos', title: 'Engenheiro Chefe', phone: '(21) 91100-3322', segment: 'Indústrias Metalúrgicas', uf: 'RJ', distance: 430, score: 62, temp: 'warm', stage: 'Negociação', value: 15000, owner: 'human', ownerName: 'Roberto KA', staleHours: 36, escalated: false, escalationReason: '', slaInfo: '8 dias', lastContact: 'Ontem, 09:15' },
    { id: 'l11', company: 'Sorriso Prime', contact: 'Dra. Sandra', title: 'Diretora Clínicas', phone: '(11) 97766-4433', segment: 'Serviços Médicos', uf: 'SP', distance: 18, score: 82, temp: 'hot', stage: 'Pedido', value: 10000, owner: 'ia', staleHours: 0, escalated: false, escalationReason: '', slaInfo: '✓ pedido', lastContact: 'Ontem, 11:30' },
    { id: 'l12', company: 'Global Talk', contact: 'Peter Jordan', title: 'CEO', phone: '(11) 96655-4422', segment: 'Tecnologia', uf: 'SP', distance: 10, score: 38, temp: 'cold', stage: 'Perdido', value: 5000, owner: 'ia', staleHours: 0, escalated: false, escalationReason: '', slaInfo: 'descartado', lastContact: '08/07/2026', lostReason: 'Preço' }
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
    ]
  },
  
  activeLeadId: 'l1',
  aiPaused: false,
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
  const text = prompt("Digite a descrição da próxima tarefa comercial:");
  if (text) {
    state.tasks.unshift({
      id: `t${Date.now()}`,
      text: text,
      time: 'Hoje, ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      owner: state.activeUser.name,
      completed: false
    });
    showNotification("Tarefa comercial agendada!");
    renderDashboard();
  }
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
  const text = prompt("Digite o nome da nova tag comercial:");
  if (text) {
    const container = document.getElementById(containerId);
    const addBtn = container.querySelector(".chip-add");
    const span = document.createElement("span");
    span.className = "chip";
    span.innerHTML = `${text}<button class="chip-remove" onclick="removeChip(this)">×</button>`;
    container.insertBefore(span, addBtn);
  }
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
  const trigger = prompt("Quando o cliente disser:");
  const response = prompt("A IA Ana deve responder:");
  
  if (trigger && response) {
    state.objections.push({
      id: `o${Date.now()}`,
      trigger, response
    });
    renderCompany();
    showNotification("Objeção cadastrada!");
  }
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
    alert("Nenhuma empresa selecionada para enviar.");
    return;
  }
  
  checked.forEach(idx => {
    sendProspectToCRM(idx, ownerType);
  });
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
    const create = confirm("Mover para Fechado? Deseja criar o Pedido automático pós-venda?");
    lead.stage = targetColumnName;
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
    
    if (create) {
      const orderNum = `#2026-${Math.floor(Math.random()*1000)}`;
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
    }
    
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
  const company = prompt("Nome da Empresa:");
  const contact = prompt("Contato Principal:");
  const phone = prompt("WhatsApp:");
  const segment = prompt("Segmento (Tecnologia, Indústrias Metalúrgicas, Serviços Médicos, Outro):");
  
  if (company && contact && phone) {
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
  const newText = prompt("Edite a sugestão da Ana comercial:", text);
  if (newText) {
    document.getElementById("copilot-suggestion-text").innerText = newText;
  }
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
    const act = confirm(`Aprovar proposta ${prop.number} de ${prop.client} com desconto solicitado?`);
    if (act) {
      prop.needApproval = false;
      prop.status = 'Aguardando cliente';
      
      const lead = state.leads.find(l => l.id === prop.leadId);
      if (lead) {
        lead.escalated = false;
      }
      
      state.auditLogs.unshift({
        time: 'Agora',
        actor: state.activeUser.name,
        actorType: 'human',
        action: `Aprovou proposta comercial ${prop.number}`,
        detail: `Desconto de 18% aprovado manualmente pelo diretor comercial.`,
        rule: 'alçada de aprovação'
      });
      
      showNotification(`Proposta ${prop.number} aprovada! IA retoma contato.`);
      renderBudgets();
      updateSidebarCounters();
    }
  }
}

function openNewProposalModal() {
  const client = prompt("Qual o nome da empresa comercial?");
  const items = prompt("Digite os serviços contratados:");
  const value = prompt("Valor total da proposta comercial (R$):");
  
  if (client && items && value) {
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
  }
}

function uploadKnowledgeDoc() {
  const name = prompt("Nome do arquivo para upload comercial:");
  const type = prompt("Categoria (Institucional, Catálogo, Técnico, Jurídico):");
  if (name) {
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
  }
}

function answerQuestion(qId) {
  const q = state.unanswered.find(un => un.id === qId);
  const text = prompt(`Escreva a resposta padrão para:\n"${q.text}"`);
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
}

// ================= TELA 13 · PORTAL DO VENDEDOR =================
function renderVendorPortal() {
  const leadsQueue = document.getElementById("vendor-portal-leads-queue");
  leadsQueue.innerHTML = "";
  
  // Custom filter queue for sales reps
  const vendorLeads = state.leads.filter(l => l.stage !== 'Fechado' && l.stage !== 'Pedido' && l.stage !== 'Perdido');
  
  if (vendorLeads.length === 0) {
    leadsQueue.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:16px;">Sem pendências na sua fila comercial hoje!</td></tr>`;
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
          <button class="btn btn-sm btn-primary" onclick="viewLeadDetail('${lead.id}')">Atender</button>
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
  const name = document.getElementById("new-user-name").value;
  const email = document.getElementById("new-user-email").value;
  const password = document.getElementById("new-user-password").value;
  const role = document.getElementById("new-user-role").value;
  
  state.users.push({
    id: `u${Date.now()}`,
    name, email, role, leads: 0, canUseIA: true, discountLimit: '5%', active: true, avatar: name.substring(0,1).toUpperCase()
  });
  
  document.getElementById("new-user-form").reset();
  showNotification(`Vendedor ${name} cadastrado!`);
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
