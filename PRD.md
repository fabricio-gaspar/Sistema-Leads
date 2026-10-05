# LeadAI — Documento de Requisitos do Produto (PRD)

> **Versão:** 1.0 · **Última atualização:** 2026-08-14 · **Status:** UI completa (mock), backend não conectado

---

## 1. Visão Geral do Produto

**LeadAI** é uma plataforma SaaS B2B que automatiza todo o funil de prospecção de clientes usando Inteligência Artificial. Cobre desde o cadastro da empresa, configuração de regras de busca de leads, abordagem multicanal, atendimento inteligente (chatbot "Ana"), geração de orçamentos/propostas, conversão de vendas, pagamentos e um dashboard completo de métricas.

**Público-alvo:** Empresas B2B que querem escalar prospecção de forma automatizada.

**Valor principal:** Reduzir o custo de aquisição (CAC) e aumentar a eficiência do time comercial.

**Agente de IA central:** "Ana" — assistente virtual que busca leads, faz abordagem multicanal, qualifica, atende via chat, gera propostas e agenda compromissos.

---

## 2. Stack Técnica

| Camada | Tecnologia |
|---|---|
| Framework | React 19 + TypeScript |
| Estilo | Tailwind CSS 3.4 (tokens OKLCH) |
| Build | Vite 8 |
| Roteamento | React Router v7 (BrowserRouter + `basename`) |
| i18n | i18next + react-i18next (estrutura pronta; textos hardcoded pt-BR) |
| Ícones | Remix Icon (`ri-*`) + Font Awesome (`fa-*`) via CDN |
| Fontes | Plus Jakarta Sans (títulos) + Inter (corpo) — Google Fonts |
| Gráficos | Barras custom (divs) + recharts/lucide-react em dependências |
| Auth | **Mock** — `localStorage` (`leadai_session`), arquivo `src/mocks/users.ts` |
| Backend | **Não conectado** (Supabase/Readdy Backend previsto) |
| Integrações | **Não conectadas** (WhatsApp Z-API, Resend, OpenAI, Stripe, etc.) |

> **Nota importante:** Todo o sistema está em versão MOCKADA. Dados vêm de `src/mocks/*.ts`. A base real (Supabase) e integrações serão conectadas posteriormente.

---

## 3. Sistema de Design (Design Tokens)

### 3.1 Paleta de Cores (OKLCH — 5 papéis, escala 50–950)

| Papel | Descrição | Cor âncora (500) |
|---|---|---|
| `background` | Branco quente / base de página | `--background-50` |
| `primary` | Verde-petróleo (marca / CTA principal) | `--primary-500` |
| `accent` | Âmbar quente (destaque secundário) | `--accent-500` |
| `secondary` | Cinza-pedra (ações de suporte) | `--secondary-500` |
| `foreground` | Texto / neutro mais escuro | `--foreground-950` |

**Uso de âncoras:**
- Página base: `bg-background-50`
- CTA principal: `bg-primary-500 text-background-50`
- Destaque direto: `bg-accent-500`
- Ações de suporte: `bg-secondary-500`
- Texto principal: `text-foreground-950`; texto suave: `text-foreground-600/700`
- Cards/painéis: `bg-background-50` com `border-background-200/70`
- Seções alternadas: `bg-background-100`

### 3.2 Tipografia

| Token | Fonte | Uso |
|---|---|---|
| `font-heading` / `font-sans`(heading) | Plus Jakarta Sans | Títulos, logos, botões de destaque |
| `font-body` / `font-label` | Inter | Corpo, labels, formulários |

- Tamanhos: corpo 14–16px (`text-sm`/`text-base`), títulos `text-2xl`→`text-3xl`, cards `text-sm`, metadados `text-xs`/`text-[10px]`.

### 3.3 Forma, Espaçamento e Estética

- Cantos: cards/containers `rounded-xl` (8px), botões/inputs `rounded-lg` (6px), pills/avatares `rounded-full`.
- **Sem sombras** (estética limpa, sombra apenas `hover:shadow-sm` pontual em cards de arrasto).
- **Sem azul/roxo.** Animações sutis (`transition-all`, `animate-pulse`, `animate-spin`).
- Todo elemento clicável tem `cursor-pointer`. Botões com texto têm `whitespace-nowrap`.
- Layout desktop-first (mín. 1024px), com breakpoints `sm`/`md`/`lg`.

---

## 4. Rotas e Estrutura de Navegação

### 4.1 Área Pública
| Rota | Página |
|---|---|
| `/` | Landing Page |
| `/login` | Login |
| `/register` | Cadastro (2 etapas) |
| `*` | 404 (não customizada) |

### 4.2 Área Autenticada (`/dashboard` — dentro de `DashboardLayout`)
| Rota | Página |
|---|---|
| `/dashboard` | Dashboard (métricas) |
| `/dashboard/configuracao` | Configuração do Negócio |
| `/dashboard/busca-leads` | Busca de Leads |
| `/dashboard/abordagem` | Abordagem |
| `/dashboard/apresentacao` | Apresentação IA |
| `/dashboard/atendimento` | Central de Atendimento |
| `/dashboard/leads` | Gestão de Leads |
| `/dashboard/kanban` | Kanban CRM |
| `/dashboard/funil` | Funil de Conversão |
| `/dashboard/orcamentos` | Orçamentos e Propostas |
| `/dashboard/vendas` | Vendas e Pagamentos |
| `/dashboard/relatorios` | Relatórios |
| `/dashboard/agenda` | Agenda |
| `/dashboard/configuracoes` | Configurações |

---

## 5. Layout Base (DashboardLayout)

### 5.1 Sidebar (lateral esquerda, `bg-background-950`, escuro)
- **Logo:** ícone `ri-flashlight-line` em quadrado `bg-primary-500` + texto "LeadAI".
- **Toggle colapsar:** botão com `ri-arrow-left-s-line`/`ri-arrow-right-s-line` (largura `w-64` ↔ `w-20`).
- **14 itens de navegação** (ícone + label). Ativo: `bg-primary-500/20 text-primary-400`.

| Label | Ícone (Remix) |
|---|---|
| Dashboard | `ri-dashboard-line` |
| Configuração do Negócio | `ri-store-2-line` |
| Busca de Leads | `ri-search-eye-line` |
| Abordagem | `ri-message-3-line` |
| Apresentação IA | `ri-robot-line` |
| Atendimento | `ri-customer-service-2-line` |
| Leads | `ri-user-search-line` |
| Kanban | `ri-layout-masonry-line` |
| Funil | `ri-arrow-down-line` |
| Orçamentos | `ri-file-list-3-line` |
| Vendas | `ri-shopping-bag-3-line` |
| Relatórios | `ri-bar-chart-grouped-line` |
| Agenda | `ri-calendar-event-line` |
| Configurações | `ri-settings-4-line` |

- **Rodapé da sidebar (usuário):** avatar (círculo `bg-accent-500` com inicial), nome + cargo. Dropdown ao clicar: e-mail + empresa + botão "Sair" (`ri-logout-box-r-line`).

### 5.2 Top Header (barra superior)
- **Busca global:** input com `ri-search-line`, placeholder "Buscar leads, orçamentos..." (width `w-72`).
- **Status "Ana está online":** pill `bg-primary-100` com dot verde pulsante.
- **Notificações:** sino `ri-notification-3-line` com badge de não-lidas (`bg-accent-500`). Dropdown (`w-80`) com lista + "Marcar todas como lidas".
  - Ícones por tipo: lead `ri-user-search-line` (primary), proposta `ri-file-list-3-line` (accent), venda `ri-money-dollar-circle-line` (secondary), sistema `ri-settings-4-line`, alerta `ri-error-warning-line` (accent).
- **Ajuda:** botão `ri-question-line`.

---

## 6. Especificação Detalhada por Página

### 6.1 Landing Page (`/`)

**Navbar** (fixa, transparente no topo → `bg-background-50/95 backdrop-blur` ao rolar):
- Logo LeadAI + links de âncora: Funcionalidades (`#funcionalidades`), Preços (`#preços`), Cases (`#cases`), FAQ (`#faq`).
- Botões: "Entrar" (→ `/login`) e "Começar Grátis" (→ `/register`, `bg-primary-500`).
- Menu mobile (hambúrguer `ri-menu-line`).

**Hero** (fundo com imagem gerada + overlay escuro):
- Badge: "IA de ponta para prospecção B2B" (dot `bg-accent-500`).
- H1: "Prospecção Inteligente / no Piloto Automático" (destaque `text-accent-400`).
- Subtítulo + 2 CTAs: "Começar Agora" (`bg-accent-500`) e "Ver Demonstração" (outline).
- Selos de confiança: Dados seguros, Setup em 5 minutos, Atualização diária, Suporte 24/7.

**Seções (ordem):**
1. **Stats** (card flutuante `-mt-16`): 50K+ Leads, 98% Taxa de Entrega, 3.2x Conversões, 24h Setup.
2. **Funcionalidades** (`#funcionalidades`): 6 cards — Busca Inteligente, Abordagem Multicanal, Atendente Virtual IA, Orçamentos Automáticos, Dashboard Completo, Conformidade LGPD.
3. **Como Funciona** (`#cases`, `bg-background-100`): 4 passos — Cadastre, Defina Leads, Automatize, Converta.
4. **Depoimentos**: 3 cards com 5 estrelas, avatar com inicial.
5. **Preços** (`#preços`): 3 planos — Starter (R$297/50 leads), Pro (R$697/200 leads, destaque), Enterprise (Sob Consulta).
6. **FAQ** (`#faq`): 5 perguntas em `<details>` (acordeão).
7. **CTA final** (`bg-background-950`): "Começar Teste Grátis" + "Falar com Vendas".
8. **Contato** (`#contato`): formulário (ver §6.1.1).
9. **Footer** (`bg-background-950`): colunas Produto/Empresa/Legal + redes sociais.

#### 6.1.1 Formulário de Contato (`#contato`)
- **Campos:** Nome completo* (`nome`), E-mail corporativo* (`email`), Empresa (`empresa`), WhatsApp (`telefone`), Mensagem* (`mensagem`, textarea, máx. 500).
- **Anti-spam:** honeypot `company_alt` (classe `field-alternate`).
- **Envio:** `POST` via `fetch` para endpoint de formulário (Readdy), `application/x-www-form-urlencoded`, com tratamento de `code`, `meta.message`, `meta.detail` e detecção de spam.
- **Feedback:** banner de sucesso (`bg-primary-100`) ou erro (`bg-accent-100`) na própria página.

### 6.2 Login (`/login`)
- **Layout:** 2 colunas (formulário à esquerda, painel visual à direita em `lg`).
- **Campos:** E-mail corporativo (`ri-mail-line`), Senha (`ri-lock-line`) com toggle mostrar/ocultar (`ri-eye-line`/`ri-eye-off-line`).
- **"Esqueceu a senha?"** → modal de recuperação (campo e-mail + mensagem de confirmação).
- **Erro:** banner `bg-accent-100` "E-mail ou senha inválidos".
- **Login mock:** valida contra `mockUsers` (ex.: `fabricio@wfdigital.com.br`).
- Painel direito: ícone `ri-dashboard-line` + 4 mini-stats (Leads, Faturamento, Taxa resposta, Convertidos).

### 6.3 Cadastro (`/register`) — 2 etapas
- **Progresso:** indicador de 2 passos ("Dados da Empresa" → "Conta de Acesso").
- **Etapa 1 (Dados da Empresa):** Nome da Empresa*, CNPJ* (valida 14 dígitos), Segmento* (select), Endereço, Telefone, WhatsApp, E-mail*, Site, Redes Sociais (LinkedIn, Instagram, Facebook — inputs com ícone).
- **Etapa 2 (Conta de Acesso):** Senha* (mín. 6), Confirmar Senha*, resumo do cadastro (Empresa/CNPJ/Segmento/E-mail).
- **Botões:** Continuar / Voltar / Finalizar Cadastro.
- **Sucesso:** tela de confirmação com "Ir para o Dashboard".

### 6.4 Dashboard (`/dashboard`)
- **4 KPIs:** Leads Encontrados, Leads Abordados, Convertidos, Faturamento (com trend % e ícone).
- **Gráfico "Evolução de Leads"** (barras horizontais por mês) + seletor de período (Últimos 6 meses / Último ano / Este mês).
- **Indicadores:** Taxa de Resposta, Taxa de Fechamento (barras de progresso), Ticket Médio, Leads Qualificados, Taxa de Qualificação.
- **Leads Recentes** (tabela) + **Vendas Recentes** (tabela), com links "Ver todos"/"Ver todas".

### 6.5 Configuração do Negócio (`/dashboard/configuracao`)
Seções em cards, cada uma com ícone próprio:
1. **Ramo de atividade** (`ri-store-2-line`): Segmento principal (select), Faixa de preço (select).
2. **Produtos e serviços** (`ri-box-3-line`): chips removíveis + input "Adicionar".
3. **Diferenciais competitivos** (`ri-star-line`): chips removíveis + input "Adicionar".
4. **Região e público-alvo** (`ri-map-pin-line`): Região de atendimento (select), Público-alvo (textarea).
- **Botão "Salvar configurações"** (`ri-save-line`).

### 6.6 Busca de Leads (`/dashboard/busca-leads`)
- **Localização** (`ri-map-pin-2-line`): País, Estado (select), Cidade, **Raio de atuação** (slider 10–200km).
- **Segmentos e porte** (`ri-filter-3-line`): chips multi-seleção de segmentos (12) e portes (5).
- **Volume diário** (`ri-calendar-check-line`): número de leads/dia (1–500).
- **Botão "Buscar leads agora"** (`ri-search-eye-line`).
- **Resumo da busca** (card escuro `bg-background-950`): Local, Raio, Segmentos, Portes, Volume.
- **Histórico de prospecções** (tabela): Data, Região, Segmentos, Resultados (com duplicados), Status.

### 6.7 Abordagem (`/dashboard/abordagem`)
- **Canais** (multi-seleção): WhatsApp (`ri-whatsapp-line`), E-mail (`ri-mail-line`), Telefone (`ri-phone-line`).
- **Abordagem multicanal** (toggle): sequência WhatsApp → E-mail → Ligação.
- **Mensagens personalizadas** (tabs WhatsApp/E-mail/Telefone): 3 textareas com variáveis `{nome}`, `{empresa}`, `{segmento}`, `{servico}`.
- **Pré-visualização** (card escuro): preview formatado do template.
- **Botão "Salvar abordagem"** (`ri-save-line`).

### 6.8 Apresentação IA (`/dashboard/apresentacao`)
- **Ações:** "Regenerar com IA" (`ri-refresh-line`), "Copiar tudo" (`ri-file-copy-line`).
- **Status de aprovação:** banner + toggle "aprovada/em uso".
- **Seções:** Apresentação institucional (`ri-building-2-line`), Resumo dos serviços (`ri-file-list-3-line`), Benefícios (`ri-gift-line`), Cases de sucesso (`ri-trophy-line`), Argumentos de venda (`ri-chat-3-line`).

### 6.9 Central de Atendimento (`/dashboard/atendimento`)
- **Status da Ana:** botão toggle "Ana ativa"/"Ana pausada".
- **Lista de conversas** (coluna esquerda): busca, cards com contato, última mensagem, status, canal, contador de não-lidas.
- **Chat** (coluna direita): header com protocolo/empresa/SLA, mensagens (bolhas: vendedor `bg-primary-500` à direita, Ana `bg-secondary-100` à esquerda, sistema/nota interna centralizada `bg-accent-100`).
- **Ações do chat:** "Registrar opt-out" (`ri-forbid-2-line`), "Transferir" (handoff, `ri-user-add-line`).
- **Respostas rápidas** (chips).
- **Input:** nota interna (`ri-lock-line`), campo de texto, enviar (`ri-send-plane-fill`).

### 6.10 Gestão de Leads (`/dashboard/leads`)
- **Botão "Novo Lead"** (`ri-add-line`) → modal (Nome*, Empresa*, E-mail, Telefone/WhatsApp, Segmento, Cidade, UF).
- **Filtros:** busca (nome/empresa/segmento), etapa (select), segmento (select).
- **Ações em massa:** checkbox + "Mover para etapa..." + "Limpar seleção".
- **Tabela:** Lead/Empresa, Segmento, Score (com `ri-fire-line` por temperatura), Etapa (select inline colorido), Responsável, ação (olho `ri-eye-line`).
- **Modal de detalhes:** etapa, score, temperatura, CNPJ, Porte, E-mail, WhatsApp, Localização, Origem, Tags + "Abrir conversa" (→ atendimento).

### 6.11 Kanban CRM (`/dashboard/kanban`)
- **Filtros:** busca, Responsável, Segmento, Etapa, Temperatura, Criado de/até (datas), atalhos (Hoje/Esta semana/Este mês), "Limpar filtros".
- **Visões salvas + Chips de filtros** (componentes reutilizáveis).
- **7 colunas** (etapas): Prospecção, Qualificado, Proposta, Negociação, Pedido, Fechado, Perdido. Cada coluna com contagem e soma de valores.
- **Cards arrastáveis** (drag & drop): nome, `ri-fire-line` (temperatura), empresa, score, última interação, segmento·cidade.
- **Modal de detalhes** (ao clicar no card): mesmos campos + "Abrir conversa".

### 6.12 Funil de Conversão (`/dashboard/funil`)
- **Seletor de período:** Últimos 7/30/90 dias, Este ano.
- **4 KPIs:** Total de leads, Fechados, Taxa de conversão, Valor total em pipeline.
- **Funil visual** (barras horizontais por etapa, com valor e % da base).
- **Gargalos do funil** (perdas entre etapas).
- **Temperatura por etapa** (barras empilhadas Quente/Morno/Frio).

### 6.13 Orçamentos (`/dashboard/orcamentos`)
- **Botão "Nova Proposta"** (`ri-add-line`) → modal (Lead select, Itens do catálogo multi-seleção, Validade, Total).
- **Tabela:** Número, Lead/Empresa, Valor, Validade, Status, ação (olho).
- **Modal de detalhes:** status, itens (com quantidade), total, validade, canal, "Gerar PDF" (`ri-file-pdf-line`) e "Enviar" (`ri-send-plane-line`).
- **Catálogo (6 itens):** Site institucional, Landing page, Gestão de tráfego, Identidade visual, SEO e conteúdo, Automação de CRM.

### 6.14 Vendas (`/dashboard/vendas`)
- **Seletor de período.**
- **4 KPIs:** Faturamento (pago), Vendas realizadas, Ticket médio, Pendente de receber.
- **Filtros de status** (pills): Todos, Pago, Pendente, Processando, Estornado.
- **Tabela:** Lead/Empresa, Proposta, Valor, Método, Status, Data.
- **Métodos de pagamento:** PIX (`ri-qr-code-line`), Cartão (`ri-bank-card-line`), Boleto (`ri-barcode-line`), Mercado Pago (`ri-wallet-3-line`).

### 6.15 Relatórios (`/dashboard/relatorios`)
- **Filtros:** Responsável, Segmento, período (select), "Exportar CSV" (`ri-download-line`), Visões salvas + Chips.
- **4 abas** (pill tabs): Visão Geral, Leads, Vendas, Equipe.
  - **Visão Geral:** 4 KPIs + Evolução de leads + Leads por segmento.
  - **Leads:** tabela detalhada (Lead, Segmento, Etapa, Score, Valor, Responsável).
  - **Vendas:** 3 KPIs + tabela de vendas.
  - **Equipe:** performance por responsável (leads, convertidos, taxa, valor convertido).

### 6.16 Agenda (`/dashboard/agenda`)
- **Botão "Novo compromisso"** (`ri-add-line`) → modal (Título, Data, Horário, Lead, Tipo, Canal, Observações).
- **Filtros:** busca, Responsável, Segmento, Data de/até, atalhos de período, Visões salvas + Chips.
- **Calendário semanal:** seletor de dia (7 dias) + timeline por hora (08:00–18:00).
- **Sidebar:** "Próximos compromissos" + "Resumo da semana" (Reuniões, Ligações, Follow-ups, Propostas).
- **Modal de detalhes:** tipo, canal, data, horário, responsável, status, observações + "Marcar como realizado".

### 6.17 Configurações (`/dashboard/configuracoes`)
**5 abas (pill tabs):**
1. **Perfil** (`ri-user-line`): dados da organização (empresa, CNPJ, e-mail, site) + "Salvar alterações".
2. **Integrações** (`ri-plug-line`): grid de cards (WhatsApp Z-API, Resend, Instagram/Meta, VoIP, Google Calendar, OpenAI) com status (Conectado/Pendente/Sandbox/Erro), "Testar" e "Configurar".
3. **Equipe** (`ri-team-line`): tabela de membros + "Convidar membro" (modal: Nome, E-mail, Cargo).
4. **Documentos** (`ri-folder-line`): base de conhecimento RAG + "Enviar documento" (modal: Nome, Arquivo).
5. **Supressão (LGPD)** (`ri-shield-line`): lista de opt-out + "Adicionar" (modal: Contato, Canal, Motivo).

---

## 7. Componentes Reutilizáveis

| Componente | Caminho | Função |
|---|---|---|
| `DashboardLayout` | `src/components/feature/` | Sidebar + top header + `<Outlet/>` |
| `FilterChips` | `src/components/feature/` | Chips de filtros ativos removíveis |
| `SavedViewsControl` | `src/components/feature/` | Visões salvas (salvar/renomear/excluir/carregar) |

| Hook | Caminho | Função |
|---|---|---|
| `useAuth` | `src/hooks/` | Contexto de autenticação mock (login/register/logout) |
| `useLocalStorageState` | `src/hooks/` | Estado persistido em localStorage |
| `useSavedViews` | `src/hooks/` | CRUD de visões salvas (filtros nomeados) |

---

## 8. Modelo de Dados (entidades)

### Lead
`id, nome, empresa, cnpj, email, telefone, whatsapp, segmento, cidade, estado, porte, score, temperatura (Frio|Morno|Quente), etapa, origem, responsavel, tags[], valor, ultimaInteracao, criadoEm`

**Etapas CRM (7):** Prospecção, Qualificado, Proposta, Negociação, Pedido, Fechado, Perdido
**Segmentos (12):** Tecnologia, Construção Civil, Saúde, Marketing e Publicidade, Alimentação, Varejo, Indústria, Educação, Serviços Financeiros, Logística, Agronegócio, Energia
**Portes (5):** MEI, Micro, Pequeno, Médio, Grande
**Origens:** Google Places, CNPJ Público, LinkedIn, Indicação, CSV Importado, Manual

### Proposta
`id, numero, lead, empresa, valor, status (rascunho|enviada|visualizada|aceita|recusada|expirada), validade, responsavel, data, canal, itens[]`

### ItemProposta
`id, nome, quantidade, preco`

### Venda
`id, lead, empresa, valor, metodo, status (pago|pendente|estornado|processando), data, comprovante, proposta`

### Conversa / Mensagem
Conversa: `id, protocolo, contato, empresa, canal (whatsapp|email|instagram), status (ativo|aguardando|resolvido|transferido), sla, fila, ultimaMensagem, hora, naoLidas, mensagens[]`
Mensagem: `id, autor (cliente|ana|vendedor|sistema), nome, texto, hora, notaInterna?`

### Compromisso
`id, titulo, lead, empresa, data, horaInicio, horaFim, tipo (reuniao|ligacao|followup|proposta), canal (presencial|video|telefone|whatsapp), status (agendado|realizado|cancelado), responsavel, observacoes`

### Notificação
`id, titulo, descricao, tipo (lead|proposta|venda|sistema|alerta), lida, data, link?`

### Outros
- **Membro:** `id, nome, email, cargo, avatar, status, departamento`
- **Documento:** `id, nome, categoria, formato, tamanho, versao, autor, data, status, tags`
- **Supressão:** `id, contato, canal, motivo, data, ator, origem, status`
- **Integração:** `id, nome, icone, categoria, status, ultimoTeste, descricao`

---

## 9. Integrações Planejadas (ainda não conectadas)

| Integração | Uso | Status |
|---|---|---|
| Supabase / Readdy Backend | Auth, DB, Storage, Edge Functions | ❌ não conectado |
| OpenAI (fallback Claude/Gemini) | Apresentação IA, agente Ana | ❌ mock |
| WhatsApp (Z-API) | Mensageria | ❌ mock |
| Resend | E-mail transacional | ❌ mock |
| Instagram / Meta | Direct | ❌ pendente |
| VoIP (Click-to-Call) | Ligações | ❌ sandbox |
| Google Calendar | Disponibilidade | ❌ mock |
| Mercado Pago / Asaas / Stripe | Pagamentos | ❌ mock |

---

## 10. Requisitos Funcionais Pendentes (para conexão de backend)

1. Substituir `mockUsers` por Supabase Auth (login/registro reais).
2. Criar tabelas Postgres com RLS (companies, business_config, lead_search_config, approach_config, leads, proposals, sales, company_presentation, etc.).
3. Conectar Edge Functions para OpenAI (apresentação, agente), WhatsApp (Z-API), Resend (e-mail).
4. Conectar gateways de pagamento (Stripe/Mercado Pago/Asaas) com checkout real.
5. Implementar busca real de leads via APIs públicas.
6. Armazenar logos/PDFs no Supabase Storage.

---

## 11. Regras e Restrições de Implementação

- React 19 (não rebaixar), sem Vue/Angular.
- Código TypeScript + Tailwind, alta reutilização, arquivos ≤ 500 linhas.
- Import cross-dir usa alias `@/` (proibido `../`).
- Mocks em `src/mocks/` com `export const` (sem default export, sem funções).
- Ícones apenas Remix/Font Awesome via CDN (sem npm import).
- Proibido `window.location.href` (usar react-router-dom).
- Proibido SVG custom, `float`, `require`, `alert`.
- Cores apenas via tokens StyleSystem (5 papéis).
- Formulários usam `get_form_url` (nunca simulação); agendamentos usam Booking.