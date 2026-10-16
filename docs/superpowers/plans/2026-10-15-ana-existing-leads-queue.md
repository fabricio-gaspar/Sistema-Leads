# Carteira Existente da Ana — Plano de Implementação

> **Para agentes:** antes de executar, use `superpowers:subagent-driven-development` ou `superpowers:executing-plans`. As etapas usam caixas de seleção para acompanhamento.

**Objetivo:** permitir que Ana reserve e trate, no máximo, dez leads já autorizados por rodada interna, sem busca paga, duplicidade, fuga de controle humano ou envio automático não autorizado.

**Arquitetura:** a carteira existente será uma política e uma fila próprias, separadas da prospecção Apify. Um ledger no banco seleciona itens por transação, vincula cada item a um único `ana_job` e agenda os itens espaçadamente. Mensagem recebida preempta seleção proativa pendente do mesmo lead; antes de modelo e antes de efeito, uma guarda server-side valida novamente identidade WA-AKG, proteção do contato, snapshot de inbound, canal e política. `ana-run` continua sendo a única autoridade para decisão/efeito; browser só configura a política e lê agregados sem PII.

**Stack:** Supabase Postgres/RLS/RPC, Edge Functions Deno, React/TypeScript, Vitest e banco local descartável quando disponível.

**Especificação:** `docs/superpowers/specs/2026-10-15-csv-import-and-ana-existing-leads-design.md`

## Restrições globais

- Sem Apify, Google/Google Maps, busca de novos leads, consumo de créditos, QR, reconexão de dispositivo, segredo, mensagem real ou mutação remota nos testes.
- A funcionalidade inicia desativada. Selecionar um lead não altera aprovação, modo humano, estágio, Kanban, dados comerciais ou cria saída.
- A carteira existente não depende de localização, chave Apify ou readiness de prospecção paga. Sua guarda usa apenas organização/IA, versão ativa da Ana, política própria, WA-AKG, controles/kill switch e autorização do contato.
- O browser nunca escolhe IDs autoritativos, chama RPC de reserva/fila ou recebe payload de job, diretório de contatos, texto de mensagem ou credenciais.
- Um candidato exige: mesma organização; não arquivado; estágio/outcome não-terminal conforme política centralizada; owner/assignee ativo; IA ativa, não pausada/não opt-out; contato explicitamente aprovado; identidade WA-AKG canônica permitida; conta/integration/controle WA-AKG conectado e habilitado; sem handoff, job, outbox ou reserva ativa; e prova de próxima ação explicitamente autorizada.
- V1 não inicia uma primeira abordagem. Sem uma ação permitida pela política e evidência de histórico compatível, o item vai para `needs_review` antes de modelo/outbox. O modo padrão da política é `review_only`.
- Toda ausência de prova falha fechada. Mudança após seleção gera `needs_review`/`cancelled`, nunca envio não verificado.
- SQL novo é aditivo em migração datada. Não editar migrations históricas. Preflight, deploy, publicação e envio continuam etapas separadas com autorização específica.
- Não tocar em `supabase/.temp/cli-latest` nem alterações preexistentes. Arquivos de teste/Busca de Leads já estão sujos; não fazer commits por tarefa até reconciliar baseline e hunks próprios.

## Foco da revisão

- Dois workers não podem reservar o mesmo lead, ultrapassar dez, duplicar batch ou deixar ledger/job em estados divergentes após crash, retry, lease expirada ou cancelamento.
- Inbound posterior não pode ficar atrás de trabalho proativo do mesmo lead: cancela o proativo queued/retry de forma atômica e revalida a versão inbound antes de modelo e efeito. Inbounds mantêm FIFO entre si.
- Identidade ausente, telefone não normalizado, conta WA-AKG ausente/mudada/desconectada, controles desligados ou contato protegido/não classificado bloqueiam seleção e efeito, sem fallback para conta corporativa.
- Um tick do worker não pode disparar dez itens: reserva pode conter até dez, mas itens recebem `run_at` espaçado e o drain processa no máximo um `existing_lead.selected` por invocação, depois de inbound/recovery.
- A política de carteira não deve habilitar a prospecção paga nem depender dela.

## Convenção de validação

```bash
WAYFLEX_NODE=/Users/fabriciogaspar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
"$WAYFLEX_NODE" node_modules/vitest/vitest.mjs run <arquivos-de-teste>
"$WAYFLEX_NODE" node_modules/eslint/bin/eslint.js src --ext ts,tsx --report-unused-disable-directives --max-warnings 0
"$WAYFLEX_NODE" node_modules/typescript/bin/tsc --noEmit --project tsconfig.app.json
"$WAYFLEX_NODE" node_modules/typescript/bin/tsc --project tsconfig.edge.json
"$WAYFLEX_NODE" node_modules/vite/bin/vite.js build
```

## Áreas e arquivos

| Área | Arquivos |
| --- | --- |
| Correção de autorização individual | `supabase/functions/lead-workflow/index.ts`, `supabase/tests/runtimeHandlers.test.ts` |
| Ledger, jobs e política agendada | nova migration `supabase/migrations/20261015110000_ana_existing_lead_work_queue.sql`, `supabase/tests/anaExistingLeadQueue.test.ts` (novo), `supabase/tests/anaQueue.test.ts`, teste de banco descartável (novo) |
| Execução e cercas | `supabase/functions/_shared/anaQueue.ts`, novo helper de guarda de carteira existente, `runtimeSafety.ts`, `anaEffectFence.ts`, `supabase/functions/ana-run/index.ts`, testes de autoridade/runtime |
| Operação e interface | `automation-worker`, `ana-operations`, settings/validation/repository da Ana, `AnaAutomaticOperation.tsx`, `AnaAutomaticControl.tsx`, testes relacionados |

---

### Tarefa 1: Fechar autorização de `lead-workflow`

**Arquivos:** `supabase/functions/lead-workflow/index.ts`, `supabase/tests/runtimeHandlers.test.ts`.

- [ ] **1. Escrever testes que falham.**
  - Seller/SDR sem `owner_id`/`assigned_to` não opera lead da mesma organização; owner/manager/admin ativo opera lead permitido.
  - Testar papéis reais/aliases normalizados: `owner`, `admin`, `manager`, `seller`, `sdr`, sem depender apenas de rótulos em português.
  - Lead cross-org continua `lead_not_found` por consulta escopada, sem vazamento. Todo caminho negado não atualiza lead/tarefa/auditoria nem chama `ana-run`.
  - Rodar `"$WAYFLEX_NODE" node_modules/vitest/vitest.mjs run supabase/tests/runtimeHandlers.test.ts`; esperado: falha antes do fix.

- [ ] **2. Implementar cerca de owner/role.**
  - Criar `assertLeadWorkflowActorAccess` local: elevados operam dentro da org; seller/SDR só quando `owner_id` ou `assigned_to` for o usuário.
  - Preservar aprovações/handoff existentes e resposta sem dados de outro lead.

- [ ] **3. Verificar.**
  - Repetir teste focado; esperado: aprovado.

### Tarefa 2: Criar ledger transacional, agenda e vínculo job-item

**Arquivos:** nova migration, `anaExistingLeadQueue.test.ts`, `anaQueue.test.ts`, teste de integração de banco descartável.

**Contratos novos:**
- `ana_existing_lead_policies`: `enabled=false` por padrão, `mode` (`review_only` por padrão; somente ação aprovada posterior), `batch_limit` 1–10, delay entre itens, recontact/janela/timezone, versão, `next_run_at`, lease de agendamento e auditoria segura.
- `ana_existing_lead_batches` e `ana_existing_lead_batch_items`: bucket/idempotência, snapshots imutáveis e estados `selected`, `queued`, `processing`, `completed`, `skipped`, `needs_review`, `cancelled`.
- `ana_jobs.existing_lead_batch_item_id`: FK e unicidade que vinculam job ao item. Triggers/funções de claim/finish/fail/lease/cancel sincronizam os estados; não há atualização solta de item no Edge.
- RPCs server-only: `claim_due_existing_lead_policy(...)`, `reserve_existing_leads_for_ana(...)` e uma guarda estreita que retorna apenas `{ allowed, reason, snapshotVersion }`, nunca PII. Revogar execução de `PUBLIC`, `anon` e `authenticated`.

- [ ] **1. Escrever testes que falham.**
  - Migration amplia atomica e explicitamente os constraints/allow-lists de `ana_jobs`, `agent_runs`, `enqueue_ana_job` e `ana-run` para `existing_lead.selected` interno.
  - `batch_limit <= 10`, política desativada, grants/RLS corretos, FK/índice único de item ativo, bucket idempotente, lease/recovery do scheduler e retorno determinístico para rodada manual já aberta.
  - Concorrência real: duas reservas/claims concorrentes não sobrepõem leads nem excedem limite; retries/dead-letter/lease expirada/cancelamento mantêm job e item consistentes.
  - Elegibilidade exclui archived, terminal normalizado, owner/assignee inativo, humano/pausado/opt-out, pending/rejected, handoff/outbox/job ativo, outra org, contato protegido/não classificado, WA-AKG sem conta/telefone/controle conectado e ausência de ação/histórico aprovados.
  - Inbound novo cancela somente `existing_lead.selected` queued/retry do mesmo lead e marca o item para revisão; nunca cancela inbound/humano.
  - Rodar testes de contrato e banco descartável. Se ambiente local Supabase/Docker não estiver disponível, marcar esse subteste como bloqueado — testes mock/estáticos não provam advisory lock, `SKIP LOCKED`, RLS ou trigger.

- [ ] **2. Implementar migration aditiva.**
  - Criar tables/índices/RLS/GRANTs e snapshots, incluindo identidade/canal/política/revisão inbound necessários para revalidação.
  - Centralizar predicado terminal, owner ativo, ação permitida e ordenação estável com tie-breaker; não duplicar strings arbitrárias em handlers.
  - Estender `enqueue_ana_job` com `run_at` interno validado. Ao reservar, espaçar os itens conforme a política e gravar um `batch_item_id` único; não criar saída, alterar lead ou aprovar contato.
  - Ao enfileirar inbound, transacionar a preempção do trabalho proativo pendente do mesmo lead. Manter FIFO entre jobs inbound/normais.
  - Usar `current_user`/padrão de segurança existente para serviço; ação manual chega ao SQL só depois de Edge validar `configuration.manage`. Scheduler usa ator de sistema, não ID vindo do navegador.

- [ ] **3. Verificar.**
  - Rodar contratos, identidade WA-AKG e teste de banco descartável quando disponível; esperado: candidatos inseguros não entram e reserva não tem efeito outbound.

### Tarefa 3: Passar o evento pela autoridade canônica, com cerca própria

**Arquivos:** `anaQueue.ts`, novo helper server-side para guarda de carteira, `runtimeSafety.ts`, `anaEffectFence.ts`, `ana-run/index.ts`, testes de fila/runtime/autoridade.

- [ ] **1. Escrever testes que falham.**
  - Job válido com item/lote compatíveis chega uma vez a `ana-run`; contexto ausente ou de outra org falha antes de modelo.
  - Política desativada, ação `review_only`, contato não aprovado/protegido/não classificado, snapshot inbound alterado, handoff, opt-out, mudança de modo, conta/canal WA-AKG alterado/desligado: zero modelo, draft, mutação ou outbox; status seguro é `needs_review`/`cancelled`.
  - Corrida de mesmo lead: inbound após reserva cancela queued; inbound durante job running é visto na guarda antes de modelo e novamente no effect/outbox.
  - A carteira funciona/bloqueia apenas por IA/canal/política própria com Apify ausente, e nunca chama `processAnaOperations`/`prospectar-leads`.

- [ ] **2. Implementar comportamento canônico.**
  - Adicionar evento somente às validações necessárias; nunca alias para `lead.created`, `manual.run` ou inbound.
  - `ana-run` valida job↔item↔batch/policy/state e chama a guarda de contato/canal própria antes de carregar contexto/modelo. A guarda exige conta WA-AKG e telefone normalizado/canônico, conta/integration conectadas, controles de envio/automação e snapshot sem alteração.
  - Criar `assertExistingLeadWorkEffectAllowed` separado de readiness de prospecção paga. Reutilizar as garantias genéricas de runtime/effect, sem exigir localização/Apify; reconsultar proteção canônica v2 e inbound na última fronteira antes do outbox.
  - Transições item/job ocorrem em função/RPC transacional associada à lease; nenhum handler Edge faz atualização solta depois de `finish_ana_job`.
  - Sem próxima ação aprovada e histórico correspondente, registrar somente `needs_review`; não enviar apresentação inicial.

- [ ] **3. Verificar.**
  - Rodar `anaQueue`, `runtimeSafety`, `anaAuthorityR8`, `runtimeHandlers` e regressões de proteção; esperado: aprovado, com inbounds/cadências atuais preservados.

### Tarefa 4: Configurar e agendar sem tocar na prospecção paga

**Arquivos:** `automation-worker`, `ana-operations`, settings, repository/validation da Ana, testes de operação (novo).

- [ ] **1. Escrever testes que falham.**
  - `get/save` conserva política desativada por padrão, limite 1–10, timezone/intervalo válidos e `review_only` sem saída.
  - Só administrador com `configuration.manage` pode habilitar/executar; seller/SDR não envia org/actor/IDs para o servidor.
  - Worker usa `claim_due_existing_lead_policy`, reserva uma rodada idempotente e nunca chama `prospectar-leads`, Apify ou processo de prospecção.
  - Itens ficam espaçados e, após inbounds/recovery, o drain trata no máximo um `existing_lead.selected` por invocação. Falta de preflight retorna bloqueio factual sem job/outbound.

- [ ] **2. Implementar composição.**
  - Persistir `existingLeadWork` separado das configurações de prospecção paga e expor uma readiness específica de carteira.
  - No worker, processar inbound/recovery primeiro, claimar política com lease e somente então reservar. Ajustar drain com orçamento explícito para parar depois de um item proativo; as demais categorias continuam seu comportamento atual.
  - Registrar apenas agregados/motivos seguros em auditoria e respeitar kill switch.

- [ ] **3. Verificar.**
  - Rodar teste de operação, validation/repository e regressões do worker; esperado: política inativa não causa atividade e Apify não é tocado.

### Tarefa 5: Expor controle administrativo factual

**Arquivos:** `AnaAutomaticOperation.tsx`, `AnaAutomaticControl.tsx`, repository/testes e apresentação focada.

- [ ] **1. Escrever testes que falham.**
  - UI serializa somente campos de política/agregados sem IDs, mensagens ou credenciais.
  - Copy deixa claro: não busca novos leads, começa em revisão e só opera follow-up com autorização explícita.
  - Não gestores não veem/acionam controle; status segue as permissões existentes sem PII.

- [ ] **2. Implementar UI compacta.**
  - Card **Trabalhar carteira existente (até 10 por rodada)** separado da prospecção paga, com default desligado, modo, limite, cadência, última rodada e contagens selected/processing/review/blocked.
  - `Executar rodada` usa a ação protegida; não promete entrega nem inicia uma campanha.

- [ ] **3. Verificar.**
  - Rodar testes de repositório/apresentação e type-check; esperado: aprovado.

### Tarefa 6: Gate local, preflight e commit seguro

- [ ] **1. Rodar a suíte completa da funcionalidade.**
  - Todos os testes das tarefas, `waAkgContactIdentityV2`, `messagingRecoveryR6`, `anaQueue` e testes de banco descartável quando disponível.
- [ ] **2. Rodar qualidade.**
  - `git diff --check`, type-check app/edge, lint, testes e build. Distinguir falha preexistente de regressão desta feature.
- [ ] **3. Executar somente preflight remoto se houver autorização específica.**
  - Ler ledger/migration, grants, inventário de Edge, proteção de contato e política default-disabled. Deploy só após autorização distinta: migration → Edge Functions → frontend → rodada controlada sem envio real.
- [ ] **4. Criar um único commit somente se solicitado.**
  - Reconciliar o baseline, adicionar caminhos/hunks explicitamente, nunca `git add .`, e excluir `supabase/.temp/cli-latest`/alterações de terceiros.
  - Mensagem sugerida: `feat(ana): process authorized existing lead work safely`.
