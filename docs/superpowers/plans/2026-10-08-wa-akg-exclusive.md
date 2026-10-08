# WA-AKG Exclusivo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover o Evolution GO do funcionamento ativo e deixar o WA-AKG como único transporte WhatsApp sem alterar produção ou o delta local WA-AKG já validado.

**Architecture:** A seleção canônica de contas, provisionamento de vendedor e os workers passam a aceitar somente `wa_akg`. Funções, webhooks, UI e providers exclusivos de Evolution GO são eliminados; o histórico de migrations permanece imutável e uma migration nova apenas desativa registros Evolution existentes quando for autorizada para homologação.

**Tech Stack:** React/Vite, TypeScript, Vitest, Supabase Edge Functions (Deno), PostgreSQL migrations e PGlite.

**Spec:** `docs/superpowers/specs/2026-10-08-wa-akg-exclusive-design.md`

## Global Constraints

- Não aplicar migrations, deploy, chamadas de gateway, QR, pareamento ou mensagens reais.
- Não alterar nem descartar o delta local atual de WA-AKG/Central; alterações nos arquivos protegidos limitam-se à remoção de referências Evolution GO.
- Não apagar migrations históricas ou reescrever histórico Git.
- Toda alteração de comportamento segue RED → GREEN → REFACTOR e cada teste novo precisa falhar pelo motivo esperado antes do código.
- Não registrar segredos, telefone, URL privada ou payload bruto nos testes, logs ou documentação.

## Review Focus

- Troca de organização durante leitura/ação deve impedir que conta WA-AKG de outro tenant seja usada; cobrir no repositório cliente e Edge.
- Resposta HTTP aceita do gateway não pode ser exibida como entregue; cobrir job pendente, falha e recibo.
- Vendedor sem conta WA-AKG não pode acionar QR, conexão ou provisionamento com fallback Evolution.
- Migration de desativação deve conservar conversas, mensagens, recibos, auditoria e contas; cobrir em PGlite.
- Um arquivo/configuração Evolution GO remanescente em código ativo deve fazer a verificação estática falhar.

---

### Task 1: Caracterizar o fluxo WA-AKG e criar a guarda contra Evolution ativo

**Files:**
- Modify: `src/lib/crm/whatsappAccountsRepository.test.ts`
- Modify: `src/lib/crm/waAkgOnboarding.test.ts`
- Modify: `supabase/tests/waAkgProvider.test.ts`
- Create: `supabase/tests/waAkgExclusiveSurface.test.ts`

**Interfaces:**
- Consumes: `loadMyWaAkgAccount`, `runWaAkgAction`, `reviewChannelLifecycle` e `WaAkgProvider` existentes.
- Produces: testes de caracterização que tratam `wa_akg` como único provedor ativo e impedem import/configuração Evolution em superfícies ativas.

- [ ] **Step 1: Escrever testes em vermelho para a superfície exclusiva WA-AKG**

  Cobrir que `reviewChannelLifecycle` aceita apenas `wa_akg`, que a conta do vendedor consulta `wa-akg` e que os diretórios/funções ativos não contêm configuração de Evolution GO.

- [ ] **Step 2: Executar os testes para confirmar falha esperada**

  Run: `node node_modules/vitest/vitest.mjs run src/lib/crm/whatsappAccountsRepository.test.ts supabase/tests/waAkgExclusiveSurface.test.ts`

  Expected: falhas por ainda aceitar `evolution_go` e por existirem funções/configurações Evolution ativas.

- [ ] **Step 3: Manter asserções de segurança WA-AKG existentes**

  Preserve testes de origem HTTPS permitida, segredo fora da URL, bot desabilitado, idempotência e recibos. Não mudar os valores de cadência ou controles atualmente validados.

- [ ] **Step 4: Executar o subconjunto para manter a linha de base verde**

  Run: `node node_modules/vitest/vitest.mjs run src/lib/crm/waAkgOnboarding.test.ts supabase/tests/waAkgProvider.test.ts supabase/tests/waAkgInbound.test.ts`

  Expected: PASS sem acessar gateway externo.

### Task 2: Tornar a seleção de contas e lifecycle exclusivamente WA-AKG

**Files:**
- Modify: `src/lib/crm/whatsappAccountsRepository.ts`
- Modify: `src/lib/crm/channelLifecycle.test.ts`
- Modify: `src/components/feature/ChannelLifecycleRecovery.tsx`
- Modify: `supabase/functions/whatsapp-accounts/index.ts`
- Test: `src/lib/crm/whatsappAccountsRepository.test.ts`
- Test: `supabase/tests/runtimeHandlers.test.ts`

**Interfaces:**
- Consumes: contrato existente `wa-akg` e `ChannelLifecycle`.
- Produces: `WhatsappAccount` e `WhatsappProviderControl` sem variante Evolution ativa; `reviewChannelLifecycle(provider: 'wa_akg', ...)` invoca somente a Edge `wa-akg`.

- [ ] **Step 1: Escrever testes em vermelho para filtragem e lifecycle WA-AKG**

  Testar que `whatsapp-accounts` lista/controle somente `wa_akg`, ações legadas retornam erro explícito e o cliente nunca seleciona `evolution-go`.

- [ ] **Step 2: Confirmar a falha antes da edição**

  Run: `node node_modules/vitest/vitest.mjs run src/lib/crm/whatsappAccountsRepository.test.ts src/lib/crm/channelLifecycle.test.ts supabase/tests/runtimeHandlers.test.ts`

  Expected: falha porque o endpoint usa `ACTIVE_WHATSAPP_PROVIDER = 'evolution_go'` e o lifecycle aceita ambos.

- [ ] **Step 3: Implementar a troca mínima do provedor canônico**

  Em `whatsapp-accounts`, definir `ACTIVE_WHATSAPP_PROVIDER = 'wa_akg'`, recusar ações Evolution e preservar os gates por organização/role. No cliente e `ChannelLifecycleRecovery`, restringir o tipo e invocação a WA-AKG. Remover apenas exports/interfaces Evolution; não sobrescrever as adições locais WA-AKG.

- [ ] **Step 4: Rodar os testes do contrato alterado**

  Run: `node node_modules/vitest/vitest.mjs run src/lib/crm/whatsappAccountsRepository.test.ts src/lib/crm/channelLifecycle.test.ts supabase/tests/runtimeHandlers.test.ts`

  Expected: PASS; nenhuma invocação para `evolution-go`.

### Task 3: Substituir onboarding, navegação e Canais pelo fluxo WA-AKG preservado

**Files:**
- Modify: `src/components/feature/DashboardLayout.tsx`
- Modify: `src/components/feature/DashboardLayout.test.ts`
- Modify: `src/components/feature/WhatsappChannelsWorkspace.tsx`
- Modify: `src/pages/dashboard/configuracoes/components/UsersAccessWorkspace.tsx`
- Modify: `src/pages/dashboard/configuracoes/components/WhatsAppSiteEntry.tsx`
- Delete: `src/components/feature/EvolutionGoPanel.tsx`
- Delete: `src/lib/crm/evolutionGoOnboarding.ts`
- Delete: `src/lib/crm/evolutionGoOnboarding.test.ts`
- Delete: `src/lib/crm/evolutionGoServerError.ts`

**Interfaces:**
- Consumes: `loadMyWaAkgAccount`, `waAkgSellerNeedsOnboarding`, `WaAkgPanel` e permissões já existentes.
- Produces: Dashboard e Configurações sem import, copy ou redirecionamento Evolution GO; vendedor é encaminhado apenas à Central WA-AKG quando a sessão própria exige atenção.

- [ ] **Step 1: Escrever testes em vermelho para onboarding WA-AKG e ausência de Evolution**

  Atualizar `DashboardLayout.test.ts` para esperar `loadMyWaAkgAccount` e `waAkgOnboardingSessionKey`; adicionar teste de workspace sem label ou componente Evolution.

- [ ] **Step 2: Confirmar que os testes falham pelo contrato antigo**

  Run: `node node_modules/vitest/vitest.mjs run src/components/feature/DashboardLayout.test.ts src/lib/crm/waAkgOnboarding.test.ts src/pages/dashboard/configuracoes/components/WhatsAppEntriesTab.test.ts`

  Expected: falha por imports e cópias Evolution existentes.

- [ ] **Step 3: Migrar somente a superfície ativa para WA-AKG**

  Reusar o onboarding WA-AKG e a rota Central. Remover painel, mensagens de erro e entradas de UI Evolution. Preservar as mudanças locais não commitadas em `WaAkgPanel.tsx`, `AtendimentoEntry.tsx`, `page.tsx` e `WhatsAppEntriesTab.tsx`.

- [ ] **Step 4: Verificar navegação e Central**

  Run: `node node_modules/vitest/vitest.mjs run src/components/feature/DashboardLayout.test.ts src/lib/crm/waAkgOnboarding.test.ts src/pages/dashboard/atendimento/page.evolutionGo.test.ts src/pages/dashboard/configuracoes/components/WhatsAppEntriesTab.test.ts`

  Expected: PASS após renomear/remover testes cuja finalidade era Evolution; Central continua sendo o destino único.

### Task 4: Trocar o lifecycle de vendedor e exclusão por WA-AKG

**Files:**
- Modify: `supabase/functions/team-members/index.ts`
- Modify: `src/lib/crm/teamMembersRepository.ts`
- Modify: `src/pages/dashboard/configuracoes/components/UsersAccessWorkspace.tsx`
- Modify: `supabase/tests/teamDirectCreate.sql.mjs`
- Delete: `supabase/functions/team-member-evolution-removal/index.ts`
- Delete: `supabase/tests/teamMemberEvolutionRemoval.test.ts`
- Create: `supabase/functions/team-member-wa-akg-removal/index.ts`
- Create: `supabase/tests/teamMemberWaAkgRemoval.test.ts`

**Interfaces:**
- Consumes: `wa_akg_seller_provisioning_jobs`, `wa-akg-worker`, `team_direct_create_attach` e as proteções atuais de identidade/dados compartilhados.
- Produces: criação de vendedor que acorda somente o worker WA-AKG e remoção que encerra o vínculo WA-AKG sem apagar dados compartilhados.

- [ ] **Step 1: Escrever testes em vermelho de criação e remoção WA-AKG**

  Cobrir vendedor criado com job WA-AKG por organização, remoção que recusa autoexclusão/último administrador/dados compartilhados e ausência de chamada Evolution.

- [ ] **Step 2: Executar para demonstrar falha atual**

  Run: `node node_modules/vitest/vitest.mjs run supabase/tests/teamMemberWaAkgRemoval.test.ts supabase/tests/runtimeHandlers.test.ts && node supabase/tests/teamDirectCreate.sql.mjs <pglite-path>`

  Expected: falha pois `team-members` consulta/aciona `evolution_go_seller_provisioning_jobs` e não há handler WA-AKG de remoção.

- [ ] **Step 3: Implementar adapter WA-AKG de provisionamento e remoção**

  Usar somente job/função WA-AKG, preservar transações de Auth, recibo administrativo sem PII e bloqueios de dados compartilhados. Não executar a função contra usuários reais.

- [ ] **Step 4: Rodar testes de isolamento e integridade**

  Run: `node node_modules/vitest/vitest.mjs run supabase/tests/teamMemberWaAkgRemoval.test.ts supabase/tests/runtimeHandlers.test.ts && node supabase/tests/teamDirectCreate.sql.mjs <pglite-path>`

  Expected: PASS; criação/remoção não citam Evolution e não fazem I/O remoto.

### Task 5: Consolidar envio, automação, webhook e configuração em WA-AKG

**Files:**
- Modify: `supabase/functions/automation-worker/index.ts`
- Modify: `supabase/functions/enviar-whatsapp/index.ts`
- Modify: `supabase/functions/ana-run/index.ts`
- Modify: `supabase/functions/_shared/accountLifecycle.ts`
- Modify: `supabase/config.toml`
- Delete: `supabase/functions/evolution-go/index.ts`
- Delete: `supabase/functions/evolution-go-worker/index.ts`
- Delete: `supabase/functions/evolution-go-recovery/index.ts`
- Delete: `supabase/functions/webhook-evolution-go/index.ts`
- Delete: `supabase/functions/_shared/evolutionGoInbound.ts`
- Delete: `supabase/functions/_shared/messaging/EvolutionGoProvider.ts`
- Test: `supabase/tests/waAkgInbound.test.ts`
- Test: `supabase/tests/waAkgProvider.test.ts`
- Test: `supabase/tests/receiptReconciliationR3.test.ts`

**Interfaces:**
- Consumes: `WaAkgProvider`, `wa-akg-worker`, `webhook-wa-akg`, durabilidade de `outreach_jobs` e reconciliação de recibos.
- Produces: uma rota única WA-AKG, sem fallback Evolution, com estado de aceite separado de recibo final.

- [ ] **Step 1: Escrever testes em vermelho para a fila e recibos WA-AKG exclusivos**

  Cobrir job aceito que permanece pendente, falha de gateway, recibo `delivered/read`, deduplicação e que scheduler só acorda `wa-akg-worker` após os gates existentes.

- [ ] **Step 2: Executar o conjunto para confirmar a falha**

  Run: `node node_modules/vitest/vitest.mjs run supabase/tests/waAkgInbound.test.ts supabase/tests/waAkgProvider.test.ts supabase/tests/receiptReconciliationR3.test.ts supabase/tests/automationEvolutionRouting.test.ts`

  Expected: falha enquanto dispatch/provider/configuração Evolution existir.

- [ ] **Step 3: Remover os caminhos Evolution e preservar o contrato WA-AKG**

  Eliminar branches, imports, handler configs e testes Evolution. Fazer `ana-run` aceitar somente chave WA-AKG. Não transformar `202 Accepted` em entrega; manter reconciliação de recibos.

- [ ] **Step 4: Validar fila e webhook localmente**

  Run: `node node_modules/vitest/vitest.mjs run supabase/tests/waAkgInbound.test.ts supabase/tests/waAkgProvider.test.ts supabase/tests/receiptReconciliationR3.test.ts supabase/tests/runtimeHandlers.test.ts`

  Expected: PASS; nenhuma chamada de rede externa.

### Task 6: Adicionar migration local de desativação preservadora de dados

**Files:**
- Create: `supabase/migrations/<timestamp>_wa_akg_exclusive_channels.sql`
- Create: `supabase/tests/waAkgExclusiveChannels.sql.mjs`
- Retain: `supabase/migrations/*evolution*` existentes

**Interfaces:**
- Consumes: tabelas `messaging_provider_controls`, `whatsapp_accounts` e `integrations` existentes.
- Produces: migration idempotente que desativa contas/controles/integrações Evolution sem `DELETE`, sem tocar WA-AKG e sem aplicação remota.

- [ ] **Step 1: Escrever teste PGlite em vermelho**

  Inserir uma conta Evolution e uma WA-AKG; exigir que após migration Evolution esteja pausado/desabilitado e todos os registros de conversa, recibo e conta WA-AKG permaneçam.

- [ ] **Step 2: Executar para confirmar falha**

  Run: `node supabase/tests/waAkgExclusiveChannels.sql.mjs <pglite-path>`

  Expected: falha porque ainda não existe migration de desativação WA-AKG exclusiva.

- [ ] **Step 3: Criar migration com a CLI Supabase e implementar somente UPDATEs idempotentes**

  Primeiro descobrir o comando com `supabase migration new --help`; criar o arquivo por `supabase migration new wa_akg_exclusive_channels`; preencher apenas após a criação. Não usar `db push`, `repair`, `reset` ou aplicar remotamente.

- [ ] **Step 4: Rodar o teste PGlite**

  Run: `node supabase/tests/waAkgExclusiveChannels.sql.mjs <pglite-path>`

  Expected: PASS; sem exclusão de registros.

### Task 7: Limpar referências ativas, documentação operacional e testes Evolution

**Files:**
- Delete: arquivos exclusivos listados nas Tasks 3–5 e `supabase/tests/evolutionGo*.{test.ts,sql.mjs}`
- Modify: `src/lib/tipos.ts`, `src/mocks/atendimentoData.ts`, `src/lib/crm/centralInboxRepository.ts`, `src/lib/crm/conversationsRepository.ts`, `src/lib/crm/humanMessageRepository.ts`, `src/lib/crm/operationalStatusPresentation.ts`, `src/pages/dashboard/atendimento/page.test.ts`, `src/pages/dashboard/meu-whatsapp/page.test.ts`
- Delete: `docs/EVOLUTION_GO_OPERACAO.md`
- Retain: `docs/auditoria/**`, `docs/CONTINUIDADE_WAYFLEX.md`, `.agent/**` e migrations históricas como evidência datada.

**Interfaces:**
- Consumes: resultado das Tasks 2–6.
- Produces: árvore ativa sem referência Evolution, mantendo documentação de auditoria e histórico de banco distinguíveis do produto ativo.

- [ ] **Step 1: Criar teste de varredura em vermelho**

  A varredura deve verificar somente diretórios ativos (`src`, `supabase/functions`, `supabase/config.toml`, testes ativos e documentação operacional), excluindo migrations e evidências históricas explicitamente retidas.

- [ ] **Step 2: Confirmar a falha por referências remanescentes**

  Run: `node node_modules/vitest/vitest.mjs run supabase/tests/waAkgExclusiveSurface.test.ts`

  Expected: FAIL listando referências ativas Evolution GO.

- [ ] **Step 3: Remover imports, tipos, mocks, copy, arquivos e testes exclusivos**

  Não modificar os arquivos WA-AKG protegidos além das referências Evolution. Remover documento operacional Evolution; não apagar evidência de auditoria nem migrations aplicadas.

- [ ] **Step 4: Executar a varredura e os testes de frontend afetados**

  Run: `node node_modules/vitest/vitest.mjs run supabase/tests/waAkgExclusiveSurface.test.ts src/pages/dashboard/atendimento/page.test.ts src/pages/dashboard/meu-whatsapp/page.test.ts`

  Expected: PASS; a exceção de histórico está explicitamente documentada no teste.

### Task 8: Verificação integrada e preparação de homologação futura

**Files:**
- Modify: `docs/CONTINUIDADE_WAYFLEX.md`
- Modify: `.agent/known-issues.md`
- Modify: `.agent/audit-state.json`
- Modify: `.agent/test-baseline.json`

**Interfaces:**
- Consumes: resultados reais das Tasks 1–7.
- Produces: continuidade atualizada que separa validação local, commit, deploy, estado de gateway, recibo externo e pendências de staging/MFA.

- [ ] **Step 1: Rodar verificações proporcionais**

  Run: `node node_modules/vitest/vitest.mjs run` seguido dos comandos existentes de type-check, lint e build definidos em `package.json`.

  Expected: resultados documentados por comando; qualquer falha pré-existente é registrada por nome.

- [ ] **Step 2: Verificar qualidade do diff**

  Run: `git diff --check && rg -n -i 'evolution[ _-]?go|evolution-go|evolution_go' src supabase/functions supabase/config.toml docs/EVOLUTION_GO_OPERACAO.md`

  Expected: nenhuma referência em superfícies ativas; ausência esperada do documento operacional. Migrations e evidências históricas são verificadas separadamente e não apagadas.

- [ ] **Step 3: Atualizar continuidade com fatos, não previsões**

  Registrar arquivos removidos, testes executados, hash de commit, que não houve deploy/mensagem/QR, e que staging, gateway homologado, MFA e decisão CRM interno/SaaS continuam pendentes.

- [ ] **Step 4: Commit por unidade revisável**

  Usar `git add` explícito por task. Nunca usar `git add .`; confirmar que os oito arquivos locais protegidos não foram incluídos sem revisão específica.
