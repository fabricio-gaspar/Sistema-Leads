# Prompt de Sistema — Reconstrução Fiel do LeadAI

> Este documento descreve, de forma completa e minuciosa, o sistema LeadAI para que qualquer agente/IA possa reproduzi-lo fielmente (layout, cores, campos, ícones, fluxos e interações). Idioma padrão: **Português (pt-BR)**.

---

## PARTE A — Identidade e Contexto

Você está reconstruindo o **LeadAI**, uma plataforma SaaS B2B de prospecção automática com IA. O agente de IA interno se chama **"Ana"** (assistente virtual que busca leads, faz abordagem, qualifica, atende e gera propostas).

**Stack obrigatória:** React 19 + TypeScript + Tailwind CSS 3.4 + Vite 8 + React Router v7. Ícones via **Remix Icon** (`ri-*`) e **Font Awesome** (`fa-*`) por CDN. Fontes **Plus Jakarta Sans** (títulos) e **Inter** (corpo) via Google Fonts.

---

## PARTE B — Sistema de Design (obrigatório)

### B.1 Cores — 5 papéis (escala 50–950, em OKLCH)
Use APENAS tokens Tailwind destes 5 papéis (nunca hex/rgb soltos):

- `background` → base de página / cards / painéis (warm white). Página = `bg-background-50`, alternância = `bg-background-100`.
- `primary` → **verde-petróleo** (marca + CTA principal). `bg-primary-500 text-background-50`.
- `accent` → **âmbar** (destaque direto). `bg-accent-500`.
- `secondary` → **cinza-pedra** (ações de suporte, filtros, chips). `bg-secondary-500`.
- `foreground` → texto/neutro. `text-foreground-950` (principal), `text-foreground-600/700` (suave), `text-foreground-400/500` (muted).

**Regras de hierarquia:**
- 1 CTA dominante por seção (`primary-500`).
- Ao menos 1 momento `accent-500` direto por página (badge, stat, marcador).
- `secondary-500` para filtros/chips/controles repetidos.
- Cards: `bg-background-50 border border-background-200/70 rounded-xl`.
- Borda/divisor: `border-background-200/70`, `border-background-100`.
- Sidebar e footer escuros: `bg-background-950`.
- **Proibido azul e roxo. Proibido sombras pesadas** (máx. `hover:shadow-sm`).

### B.2 Tipografia
- Títulos: `font-heading` (Plus Jakarta Sans), pesos `font-bold`/`font-extrabold`.
- Corpo/labels: `font-sans`/`font-body` (Inter).
- Escala: títulos de página `text-2xl md:text-3xl`, subtítulos `text-sm text-foreground-600`, cards `text-sm`, metadados `text-xs`/`text-[10px]`.

### B.3 Forma, Espaço, Interação
- `rounded-xl` (cards/containers), `rounded-lg` (botões/inputs), `rounded-full` (pills/avatares/badges).
- `cursor-pointer` em todo elemento clicável. `whitespace-nowrap` em botões com texto.
- Animações sutis: `transition-all duration-200/300`, `animate-pulse` (dot online), `animate-spin` (loading).
- Layout desktop-first (mín. 1024px), breakpoints `sm`/`md`/`lg`. Tabelas com `overflow-x-auto`.

---

## PARTE C — Estrutura de Arquivos

```
src/
├── components/feature/  → DashboardLayout, FilterChips, SavedViewsControl
├── hooks/               → useAuth, useLocalStorageState, useSavedViews
├── mocks/               → leadsData, propostasData, dashboardData, businessData,
│                          atendimentoData, frontendAdvancedData, users
├── pages/
│   ├── landing/ login/ register/ (públicas)
│   └── dashboard/ (14 páginas, cada uma em /page.tsx)
├── router/config.tsx    → rotas (element = <Component/> JSX, nunca lazy)
├── index.css            → tokens OKLCH + @tailwind + .field-alternate (honeypot)
└── tailwind.config.ts   → 5 papéis × escala 50–950 + fontFamily
```

**Regras de código:**
- Import cross-dir: `@/` (proibido `../`). Arquivos ≤ 500 linhas. Componentes por módulo.
- Mocks: `export const` (sem default, sem função, sem import). Arquivos `.ts`.
- Rota usa `<Component />` em `element` (nunca `lazy()`). `BrowserRouter basename={__BASE_PATH__}`.
- Proibido `window.location.href`, `alert`, `float`, `require`, SVG custom, `@apply border-border`.

---

## PARTE D — Layout Base (DashboardLayout)

**Sidebar** (esquerda, `bg-background-950`, `w-64` ↔ `w-20` colapsável):
- Logo: quadrado `bg-primary-500` com `ri-flashlight-line` + "LeadAI".
- 14 itens (ícone + label), ativo = `bg-primary-500/20 text-primary-400`:
  `ri-dashboard-line`(Dashboard), `ri-store-2-line`(Configuração do Negócio), `ri-search-eye-line`(Busca de Leads), `ri-message-3-line`(Abordagem), `ri-robot-line`(Apresentação IA), `ri-customer-service-2-line`(Atendimento), `ri-user-search-line`(Leads), `ri-layout-masonry-line`(Kanban), `ri-arrow-down-line`(Funil), `ri-file-list-3-line`(Orçamentos), `ri-shopping-bag-3-line`(Vendas), `ri-bar-chart-grouped-line`(Relatórios), `ri-calendar-event-line`(Agenda), `ri-settings-4-line`(Configurações).
- Usuário: avatar círculo `bg-accent-500` com inicial + dropdown (e-mail, empresa, "Sair" `ri-logout-box-r-line`).

**Top header:**
- Busca global (`ri-search-line`, placeholder "Buscar leads, orçamentos...").
- Pill "Ana está online" (`bg-primary-100`, dot `bg-primary-500 animate-pulse`).
- Sino `ri-notification-3-line` + badge não-lidas `bg-accent-500`; dropdown com tipos (ícones: lead `ri-user-search-line`/primary, proposta `ri-file-list-3-line`/accent, venda `ri-money-dollar-circle-line`/secondary, sistema `ri-settings-4-line`, alerta `ri-error-warning-line`).
- Ajuda `ri-question-line`.

---

## PARTE E — Especificação Página a Página (com campos, ícones, cores e interações)

### E.1 Landing (`/`)
**Navbar** fixa transparente → branca ao rolar. Links âncora: `#funcionalidades`, `#preços`, `#cases`, `#faq`. Botões "Entrar" e "Começar Grátis" (`bg-primary-500`).

**Hero** com imagem de fundo + overlay escuro `bg-gradient-to-b from-foreground-950/70`. Badge "IA de ponta para prospecção B2B" (dot `bg-accent-500`). H1 com span `text-accent-400`. CTAs "Começar Agora" (`bg-accent-500`) e "Ver Demonstração" (outline). Selos: Dados seguros, Setup 5 min, Atualização diária, Suporte 24/7.

**Stats** (card flutuante): 50K+, 98%, 3.2x, 24h.
**Funcionalidades**: 6 cards (ícones `ri-search-eye-line`, `ri-message-3-line`, `ri-robot-line`, `ri-file-text-line`, `ri-bar-chart-box-line`, `ri-shield-check-line`).
**Como Funciona**: 4 passos numerados (`ri-building-line`, `ri-radar-line`, `ri-send-plane-line`, `ri-trophy-line`).
**Depoimentos**: 3 cards, 5 estrelas `ri-star-fill text-accent-400`, avatar inicial.
**Preços**: Starter R$297, Pro R$697 (destaque `bg-primary-600` + badge "Mais Popular" `bg-accent-500`), Enterprise.
**FAQ**: `<details>` com `ri-add-line`/`ri-subtract-line`.
**CTA final**: `bg-background-950`.
**Contato**: formulário (Nome*, E-mail* `name="email"`, Empresa, WhatsApp, Mensagem* máx.500; honeypot `company_alt` com classe `field-alternate`; submit via fetch x-www-form-urlencoded com tratamento de `code`/`meta.message`/`meta.detail`/spam; feedback in-page).
**Footer**: `bg-background-950`, 4 colunas + redes (`ri-linkedin-fill`, `ri-instagram-line`, `ri-twitter-x-line`, `ri-youtube-line`).

### E.2 Login (`/login`)
2 colunas. Campos E-mail (`ri-mail-line`), Senha (`ri-lock-line`) + toggle `ri-eye-line`/`ri-eye-off-line`. Link "Esqueceu a senha?" → modal de recuperação. Erro `bg-accent-100`. Painel direito com 4 mini-stats.

### E.3 Cadastro (`/register`) — 2 etapas
Indicador de progresso 2 passos. Etapa 1: Nome*, CNPJ* (14 dígitos), Segmento* (select), Endereço, Telefone, WhatsApp, E-mail*, Site, Redes (LinkedIn/Instagram/Facebook). Etapa 2: Senha* (mín 6), Confirmar*, resumo. Botões Continuar/Voltar/Finalizar. Tela de sucesso.

### E.4 Dashboard (`/dashboard`)
4 KPIs (ícone + trend `bg-primary-100 text-primary-600`). Gráfico barras horizontais "Evolução de Leads" + seletor período. Indicadores (taxas com barras). Tabelas "Leads Recentes" e "Vendas Recentes".

### E.5 Configuração do Negócio
4 cards com ícone e chips removíveis (produtos `bg-secondary-100`, diferenciais `bg-primary-100`) + inputs "Adicionar". Botão "Salvar configurações" `ri-save-line`.

### E.6 Busca de Leads
Localização (País/Estado select/Cidade) + slider raio. Segmentos (12 chips, ativo `bg-primary-500`) e portes (5 chips, ativo `bg-secondary-500`). Volume leads/dia. Botão "Buscar leads agora" `ri-search-eye-line`. Card resumo `bg-background-950`. Histórico em tabela.

### E.7 Abordagem
Canais (3, toggle), toggle multicanal, 3 textareas (tabs) com variáveis `{nome}` `{empresa}` `{segmento}` `{servico}`, pré-visualização em card escuro. Botão "Salvar abordagem".

### E.8 Apresentação IA
Botões "Regenerar com IA" `ri-refresh-line` e "Copiar tudo" `ri-file-copy-line`. Toggle de aprovação. 5 seções (institucional, serviços, benefícios, cases, argumentos).

### E.9 Atendimento
Toggle "Ana ativa/pausada". Coluna esquerda: busca + lista de conversas (status, canal, não-lidas). Coluna direita: chat com bolhas (vendedor `bg-primary-500` dir, Ana `bg-secondary-100` esq, sistema `bg-accent-100` centro). Ações: opt-out `ri-forbid-2-line`, transferir `ri-user-add-line`. Respostas rápidas. Input com nota interna `ri-lock-line` + enviar `ri-send-plane-fill`.

### E.10 Leads
Botão "Novo Lead" `ri-add-line` → modal (Nome*, Empresa*, E-mail, Telefone/WhatsApp, Segmento, Cidade, UF). Filtros busca/etapa/segmento. Checkbox + ações em massa. Tabela com select de etapa inline colorido e score com `ri-fire-line` (Frio `text-foreground-400`, Morno `text-accent-600`, Quente `text-accent-500`). Modal detalhes + "Abrir conversa".

### E.11 Kanban
Filtros (busca, responsável, segmento, etapa, temperatura, datas, atalhos Hoje/Semana/Mês, limpar). **Visões salvas** (`ri-bookmark-line`) + **chips de filtros removíveis**. 7 colunas drag&drop com contagem + soma. Cards arrastáveis (nome, `ri-fire-line`, empresa, score, interação, segmento·cidade). Modal detalhes + "Abrir conversa".

### E.12 Funil
Seletor período. 4 KPIs. Barras horizontais por etapa (com valor e %). Gargalos. Temperatura por etapa (barras Quente `bg-accent-500`/Morno `bg-primary-400`/Frio `bg-background-300`).

### E.13 Orçamentos
Botão "Nova Proposta" → modal (Lead, Itens multi-seleção, Validade, Total). Tabela (Número, Lead, Valor, Validade, Status, olho). Modal detalhes com "Gerar PDF" `ri-file-pdf-line` e "Enviar" `ri-send-plane-line`. Catálogo 6 itens.

### E.14 Vendas
Seletor período. 4 KPIs. Filtros status (pills). Tabela. 4 métodos de pagamento (`ri-qr-code-line`, `ri-bank-card-line`, `ri-barcode-line`, `ri-wallet-3-line`).

### E.15 Relatórios
Filtros (responsável, segmento, período, "Exportar CSV" `ri-download-line`, visões salvas + chips). 4 abas pill: Visão Geral / Leads / Vendas / Equipe.

### E.16 Agenda
Botão "Novo compromisso" `ri-add-line` → modal (Título, Data, Horário, Lead, Tipo, Canal, Observações). Filtros + visões salvas + chips. Seletor de dia (7 dias) + timeline 08:00–18:00. Sidebar "Próximos compromissos" + "Resumo da semana". Modal detalhes + "Marcar como realizado".

### E.17 Configurações
5 abas: Perfil (`ri-user-line`), Integrações (`ri-plug-line`), Equipe (`ri-team-line`), Documentos (`ri-folder-line`), Supressão (`ri-shield-line`). Cada aba com tabela/cards e modais de criação.

---

## PARTE F — Dados, Enums e Status

**Etapas CRM:** Prospecção, Qualificado, Proposta, Negociação, Pedido, Fechado, Perdido.
**Temperatura:** Frio, Morno, Quente.
**Status de lead (dashboard):** Novo, Abordado, Qualificado, Convertido, Perdido.
**Status de proposta:** rascunho, enviada, visualizada, aceita, recusada, expirada.
**Status de venda:** pago, pendente, processando, estornado.
**Status de conversa:** ativo, aguardando, resolvido, transferido.
**Tipos de compromisso:** reuniao, ligacao, followup, proposta.
**Canais:** WhatsApp, E-mail, Telefone, Instagram.
**Portes:** MEI, Micro, Pequeno, Médio, Grande.
**Segmentos (12):** Tecnologia, Construção Civil, Saúde, Marketing e Publicidade, Alimentação, Varejo, Indústria, Educação, Serviços Financeiros, Logística, Agronegócio, Energia.
**Origem de lead:** Google Places, CNPJ Público, LinkedIn, Indicação, CSV Importado, Manual.

**Responsáveis (mock):** Ana (IA), João Vendedor, Marina Sales, Paula SDR, Lucas CX.

---

## PARTE G — Interações e Feedback (obrigatórias)

1. **Todos os botões/campos devem funcionar** — nada "morto". Botões de ação abrem modal ou disparam toast.
2. **Toast** (feedback): banner `bg-primary-100 border-primary-200 text-primary-800` com `ri-information-line`, auto-fecha em 3s.
3. **Modais:** overlay `bg-foreground-950/50`, conteúdo `bg-background-50 rounded-xl`, cabeçalho com `ri-close-line`, rodapé com Cancelar + ação primária. Fecham ao clicar fora.
4. **Visões salvas** (Kanban/Agenda/Relatórios): salvar (nomeia filtros atuais), carregar, renomear (`ri-edit-line`), excluir (`ri-delete-bin-line`), persistido em localStorage.
5. **Chips de filtros** removíveis (`ri-close-line`) abaixo da barra de filtros.
6. **Drag & drop** no Kanban para mover etapa.
7. **Forms** usam `get_form_url` (nunca simular envio); booking usa Booking (não Form).

---

## PARTE H — Restrições Finais de Geração

- Proibido azul/roxo, sombras pesadas, `float`, `require`, SVG custom, `alert`, `window.location.href`.
- Cores só via tokens StyleSystem; fontes via `var(--font-heading)`/`var(--font-body)`.
- Import `@/` (nunca `../`). Arquivos ≤ 500 linhas. Mocks com `export const`.
- React 19, sem downgrade. Rotas com `<Component/>`. `basename={__BASE_PATH__}`.
- Após editar, rodar build e validar.