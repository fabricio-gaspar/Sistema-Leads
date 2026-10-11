# WayFlex UI Harmonization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar a apresentação do CRM WayFlex, reduzir densidade em telas operacionais e corrigir pontos de responsividade e acessibilidade sem mudar fluxos, rotas, permissões, dados ou integrações.

**Architecture:** O `wf-*` existente continua sendo o único vocabulário compartilhado. Primeiro, o CSS global passa a expor tokens e variantes estáveis; depois cada tela reaproveita essas primitivas, começando pelas áreas de maior densidade. Alterações de interface mantêm URLs, estados e contratos atuais, e não executam chamadas externas.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS, CSS, Vitest.

**Spec:** `docs/DESIGN_SYSTEM_WAYFLEX.md` e a auditoria visual de 2026-10-08 desta conversa.

## Global Constraints

- Preservar comportamento, RBAC, rotas, consulta de dados, banco, Edge Functions, WA-AKG e integrações.
- Não tocar nos arquivos atualmente modificados pelo delta WA-AKG sem revisão específica; não alterar `DashboardLayout.tsx` nesta execução enquanto estiver sujo.
- Reutilizar a identidade WayFlex aprovada: superfícies claras, teal para marca/seleção, raios de 8 px nos controles e 12 px nas superfícies.
- Não adicionar dependências, publicação, migração, chamada de gateway nem mensagens reais.
- Toda mudança de lógica ou componente novo segue RED → GREEN → REFACTOR; mudanças puramente de CSS recebem verificação estática e validação visual manual proporcional.

## Review Focus

- Viewports de 320 px, 768 px, 1024 px e 1440 px não podem criar overflow acidental ou esconder ações primárias.
- Filtros e visualizações atuais devem continuar refletidos na URL e manter seu comportamento após a reorganização visual.
- Usuário sem permissão não pode ganhar ação, painel ou rota por efeito de mudança de layout.
- Teclado deve alcançar abertura, fechamento, foco e ações de Agenda/Kanban sem depender de ponteiro ou arrastar.
- Estados vazios, carregando, falha e textos longos não podem quebrar cards, tabelas ou barras de ação.

---

### Task 1: Consolidar o contrato visual global

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/feature/wayflex-visual.css`
- Modify: `src/components/feature/wayflex-redesign.css`
- Create: `src/styles/wayflexVisualContract.test.ts`

**Interfaces:**
- Consumes: classes públicas `wf-page`, `wf-surface`, `wf-toolbar`, `wf-btn-primary`, `wf-btn-secondary`, `wf-icon-button`, `wf-tabs` e `wf-table-shell`.
- Produces: tokens CSS e variantes únicas para as superfícies e controles compartilhados.

- [ ] **Step 1: Escrever o teste de contrato visual em vermelho**

  Exigir que o CSS raiz declare tokens de raio, sombra, foco e superfície; e que a folha final não use `transition: all` em seletor WayFlex.

- [ ] **Step 2: Executar o teste para confirmar a falha esperada**

  Run: `node node_modules/vitest/vitest.mjs run src/styles/wayflexVisualContract.test.ts`

  Expected: FAIL porque os tokens e a regra de transição ainda não existem de forma canônica.

- [ ] **Step 3: Definir tokens e consolidar as variantes `wf-*`**

  Manter somente uma definição final por primitiva compartilhada, substituindo sobreposições por variáveis CSS e transições de propriedades explícitas. Não mudar texto, rotas ou handlers.

- [ ] **Step 4: Executar o teste de contrato e type-check**

  Run: `node node_modules/vitest/vitest.mjs run src/styles/wayflexVisualContract.test.ts && npm run type-check`

  Expected: PASS sem alterar comportamento de aplicação.

### Task 2: Tornar Kanban e Agenda progressivos por viewport

**Files:**
- Modify: `src/pages/dashboard/kanban/page.tsx`
- Modify: `src/pages/dashboard/agenda/page.tsx`
- Create: `src/pages/dashboard/agenda/agendaAccessibility.test.ts`
- Modify: `src/pages/dashboard/kanban/page.tsx` (testar por renderização existente ou teste focado novo)

**Interfaces:**
- Consumes: query params, `AgendaViewKind`, `updateFilters`, `CalendarGrid`, `MonthGrid` e `KanbanPortfolioFilters` existentes.
- Produces: hierarquia visual de filtros e controles sem alterar valores, ações ou serialização da URL.

- [ ] **Step 1: Escrever testes em vermelho para interações da Agenda**

  Cobrir que intervalos criáveis e compromissos possuem controles semânticos distintos, operáveis por Enter e Space, e que o mês não coloca ação dentro de outro botão.

- [ ] **Step 2: Executar o teste para confirmar a falha esperada**

  Run: `node node_modules/vitest/vitest.mjs run src/pages/dashboard/agenda/agendaAccessibility.test.ts`

  Expected: FAIL pelas células `div role=button` e spans clicáveis atuais.

- [ ] **Step 3: Reorganizar somente a apresentação de filtros e grids**

  Colocar filtros avançados em uma área progressiva, preservar filtros rápidos e chips, oferecer hierarquia compacta nas larguras pequenas e trocar as interações não semânticas da Agenda por controles nativos. Não alterar a lógica de busca, filtros, drag/drop, agendamento ou URL.

- [ ] **Step 4: Executar testes focados e type-check**

  Run: `node node_modules/vitest/vitest.mjs run src/pages/dashboard/agenda/agendaAccessibility.test.ts src/lib/crm/appointmentsRepository.test.ts src/lib/crm/kanbanLeadVisibility.test.ts && npm run type-check`

  Expected: PASS; comportamento de Agenda e Kanban preservado.

### Task 3: Harmonizar a hierarquia das telas comerciais e administrativas limpas

**Files:**
- Modify: `src/pages/dashboard/busca-leads/page.tsx`
- Modify: `src/pages/dashboard/leads/page.tsx`
- Modify: `src/pages/dashboard/orcamentos/page.tsx`
- Modify: `src/pages/dashboard/equipe/page.tsx`
- Modify: `src/pages/dashboard/configuracoes/page.tsx`
- Modify: `src/pages/dashboard/configuracoes/command-center.css`

**Interfaces:**
- Consumes: dados, hooks, rotas, permissões e ações de cada página já existentes.
- Produces: cabeçalho, toolbar, métrica, tabela e vazio com o mesmo vocabulário `wf-*`.

- [ ] **Step 1: Registrar testes focados antes das mudanças de componentes**

  Identificar e executar os testes existentes de lead, proposta, equipe e configurações; criar apenas teste de renderização que cubra qualquer nova extração de componente.

- [ ] **Step 2: Refatorar a apresentação em lotes de uma página**

  Trocar somente combinações locais repetidas por componentes/classes compartilhados; manter cada handler, texto operacional, condição de permissão e endpoint intactos.

- [ ] **Step 3: Verificar cada lote**

  Run: `npm test -- --runInBand` is not used; run the Vitest files identificados no Step 1 and `npm run type-check` after each lot.

  Expected: PASS sem mudança de contratos ou chamadas externas.

### Task 4: Validar responsividade, foco e regressão visual

**Files:**
- Modify: `src/components/feature/DashboardLayout.tsx` only after the existing WA-AKG delta is reviewed or committed separately.
- Modify: `src/components/feature/DashboardLayout.test.ts` only with the same safeguard.
- Optional Create: `docs/auditoria/2026-10-08-ui-harmonization-validation.md`

**Interfaces:**
- Consumes: shell atual, permissões e itens de navegação.
- Produces: validação rastreável de viewport, foco, overflow, estados e permissões; nenhuma mudança de integração.

- [ ] **Step 1: Executar a matriz de aceite**

  Registrar AC-001 shell/navegação, AC-002 Agenda, AC-003 Kanban, AC-004 tabelas/desktop-mobile, AC-005 permissões e AC-006 estados vazios/falha. Classificar cada item como TESTADO, NÃO TESTADO ou BLOQUEADO.

- [ ] **Step 2: Executar validação técnica completa**

  Run: `npm test && npm run lint && npm run type-check && npm run build`

  Expected: resultados reportados separadamente; nenhuma publicação ou chamada real.

- [ ] **Step 3: Fazer revisão visual manual local**

  Conferir os viewports definidos no Review Focus, navegação por Tab/Shift+Tab e overflow nos fluxos de maior densidade. Não enviar mensagens, habilitar automações ou salvar dados reais.
