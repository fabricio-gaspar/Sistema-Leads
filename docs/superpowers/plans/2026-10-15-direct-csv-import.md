# Importação CSV Direta — Plano de Implementação

> **Para agentes:** antes de executar, use `superpowers:subagent-driven-development` ou `superpowers:executing-plans`. As etapas usam caixas de seleção para acompanhamento.

**Objetivo:** permitir selecionar um CSV em um clique e abrir a lista exata confirmada após a importação, sem enfraquecer o fluxo transacional, a autorização ou a proteção contra replay.

**Arquitetura:** a página Busca de Leads será dona do `<input type=file>` quando o importador for de leads, para que o botão visível abra o seletor nativo no mesmo gesto. `CsvImportModal` recebe arquivo/revisão e pode pedir que a página abra novamente o seletor; o seletor interno continua como fallback do consumidor Produtos. Depois de RPC confirmada **e** dos stores atualizados, um helper puro constrói a rota de Leads por `listaId` — nunca por nome de lista.

**Stack:** React 19/Vite/TypeScript, React Router, Supabase RPC, Vitest.

**Especificação:** `docs/superpowers/specs/2026-10-15-csv-import-and-ana-existing-leads-design.md`

## Restrições globais

- Preservar os limites atuais de parser, mapeamento, lote de 100, importação atômica, replay pendente, sessão de organização e a autorização `leads.create` do servidor.
- O seletor nativo abre apenas por clique direto. Nenhum `effect`, timeout ou `await` pode separar o clique da abertura do arquivo.
- Carregar a decisão de acesso antes do clique. Acesso desconhecido ou sem `leads.create` bloqueia o seletor/FileReader; a RPC continua sendo a autoridade final.
- Só navegar após RPC confirmada e atualização bem-sucedida dos stores. Em erro ou replay pendente, manter o usuário na tela atual.
- `listaId` é o filtro autoritativo: nomes de listas podem se repetir e um lead pode participar de mais de uma lista. `lista` permanece apenas como compatibilidade/exibição.
- CSV importado mantém `contact_approval_status = pending`; este fluxo não inicia Ana, busca fonte, envia mensagem nem chama provedor.
- Não tocar em `supabase/.temp/cli-latest` nem alterações preexistentes. Como `busca-leads/page.tsx` já está sujo, não fazer commits por tarefa: só um commit lógico depois de reconciliar o baseline e isolar os hunks da funcionalidade.

## Foco da revisão

- O mesmo arquivo deve poder ser escolhido novamente; o replay pendente abre o modal sem tentar abrir o seletor.
- Dois nomes iguais e memberships N:N devem continuar filtráveis pelo UUID correto.
- Importação recuperada por replay pode abrir a lista existente, mas não pode ser apresentada como nova importação.
- CSV somente duplicado falha antes da RPC e não deve oferecer conclusão/navegação.
- RPC confirmada com refresh local falho precisa expor estado de recuperação, nunca uma navegação com store desatualizado.
- A suíte atual é Node/estática, não E2E de navegador. Testes automatizados cobrem contratos; a validação de gesto nativo será manual em navegador e será reportada separadamente.

## Convenção de validação

```bash
WAYFLEX_NODE=/Users/fabriciogaspar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
"$WAYFLEX_NODE" node_modules/vitest/vitest.mjs run <arquivos-de-teste>
"$WAYFLEX_NODE" node_modules/eslint/bin/eslint.js src --ext ts,tsx --report-unused-disable-directives --max-warnings 0
"$WAYFLEX_NODE" node_modules/typescript/bin/tsc --noEmit --project tsconfig.app.json
"$WAYFLEX_NODE" node_modules/vite/bin/vite.js build
```

## Áreas e arquivos

| Área | Arquivos |
| --- | --- |
| Contrato de resultado e filtro por lista | `src/lib/crm/csvImportNavigation.ts` (novo), teste correspondente, `src/lib/crm/prospectingBatchRepository.ts`, teste correspondente, `src/pages/dashboard/leads/page.tsx`, teste focado de filtro |
| Gesto do arquivo e tela de sucesso | `src/pages/dashboard/busca-leads/page.tsx`, `src/components/feature/CsvImportModal.tsx`, `src/pages/dashboard/busca-leads/csvImportFlow.test.ts` (novo) |

---

### Tarefa 1: Contrato de lista confirmada e filtro por UUID

**Arquivos:**
- Criar `src/lib/crm/csvImportNavigation.ts` e `src/lib/crm/csvImportNavigation.test.ts`.
- Alterar `src/lib/crm/prospectingBatchRepository.ts` e teste.
- Alterar `src/pages/dashboard/leads/page.tsx` e criar/alterar o teste de filtro mais próximo.

**Contratos:**
- `buildImportedLeadsHref({ listId, imported, recovered? })` retorna rota apenas para UUID válido e quantidade positiva, usando `listaId` e `origem=Importação CSV` complementar.
- O resultado de UI contém `listId`, `listName`, contagem e estado recuperado somente após a resposta RPC ser validada; não inventa lista a partir de falha ou resposta ambígua.

- [ ] **1. Escrever testes que falham.**
  - Rota válida contém `listaId`; os testes parseiam `URLSearchParams`, sem depender de `+` versus percent-encoding.
  - UUID ausente/inválido ou zero importado retorna `null`; payload RPC malformado continua lançando `prospecting_import_result_unconfirmed`.
  - Duas listas com mesmo nome e um lead em ambas filtram corretamente por cada UUID; filtros legados por nome continuam somente compatíveis, não autoritativos.
  - Rodar: `"$WAYFLEX_NODE" node_modules/vitest/vitest.mjs run src/lib/crm/csvImportNavigation.test.ts src/lib/crm/prospectingBatchRepository.test.ts <teste-de-filtro-leads>`.
  - Esperado: falha antes da implementação.

- [ ] **2. Implementar o contrato mínimo.**
  - Usar `URLSearchParams`; adicionar/ler `listaId` no Leads e filtrar por `Set` de IDs de memberships, mantendo nomes para rótulos e parâmetros legados.
  - Manter `importProspectingBatch()` como única mutação e validação estrita de UUID/contagens.
  - Retornar metadados para a UI apenas após payload confirmado.

- [ ] **3. Verificar.**
  - Rodar a suíte focada; esperado: aprovada.

### Tarefa 2: Um único dono do seletor de arquivo

**Arquivos:**
- Alterar `src/pages/dashboard/busca-leads/page.tsx`.
- Alterar `src/components/feature/CsvImportModal.tsx`.
- Criar `src/pages/dashboard/busca-leads/csvImportFlow.test.ts`.

**Contratos:**
- Modal aceita opcionalmente `selectedFile`, `selectionRevision`, `onRequestFile`; sem esses props conserva o input interno para Produtos.
- Busca de Leads abre o input da página em handler síncrono e entrega arquivo/revisão ao modal. `Trocar arquivo` reutiliza o mesmo input.

- [ ] **1. Escrever testes que falham.**
  - A página possui input/ref próprio e clique síncrono, condicionado à decisão de acesso já carregada.
  - Arquivo só chega ao modal após `change`; reset do `value` permite selecionar o mesmo arquivo; `Trocar arquivo` usa callback da página.
  - Produtos continua com fallback interno; replay pendente abre modal sem segunda seleção.
  - Acesso desconhecido/negado não inicia FileReader nem RPC.
  - Rodar: `"$WAYFLEX_NODE" node_modules/vitest/vitest.mjs run src/pages/dashboard/busca-leads/csvImportFlow.test.ts src/lib/csv.test.ts`.
  - Esperado: falha antes da mudança.

- [ ] **2. Implementar sem duplicar parser.**
  - Manter parse, limite, cancelamento de `FileReader`, mapeamento e erros no modal.
  - Adicionar os props opcionais de seleção/revisão/callback; não remover o caminho interno de Produtos.
  - Colocar input oculto `accept=.csv,text/csv` junto ao botão da página; resetar valor após handoff e preservar estados desabilitado/pendente.
  - Observar/precarregar a permissão na página sem `await` no clique; não chamar RPC ao selecionar arquivo.

- [ ] **3. Verificar.**
  - Rodar a suíte focada; esperado: aprovada.

### Tarefa 3: Transição somente após confirmação e refresh

**Arquivos:**
- Alterar `CsvImportModal`, Busca de Leads e teste de fluxo.

- [ ] **1. Estender testes que falham.**
  - Importação nova confirmada renderiza `Ver leads importados`.
  - Replay confirmado renderiza a ação com texto de recuperação; CSV só duplicado, rejeição da RPC e lote pendente não renderizam ação.
  - RPC confirmada com refresh falho mostra recuperação/tentar novamente e não navega.
  - Callback fecha modal e chama `navigate(href)` uma vez somente quando helper retorna rota válida.

- [ ] **2. Implementar estado pós-commit.**
  - Montar metadados somente depois de `importProspectingBatch` **e** dos refreshes de Leads/Listas.
  - Diferenciar importação confirmada de store desatualizado. Nunca transformar `catch/finally` em sucesso ou navegar a partir dele.
  - Exibir ação antes do controle genérico apenas para resultado confirmado e navegável.

- [ ] **3. Verificar.**
  - Rodar testes focados e type-check; esperado: aprovado, sem chamada de Ana/provedor.

### Tarefa 4: Validação final e commit seguro

- [ ] **1. Rodar regressões.**
  - `"$WAYFLEX_NODE" node_modules/vitest/vitest.mjs run src/lib/csv.test.ts src/lib/crm/prospectingBatchRepository.test.ts src/lib/crm/csvImportNavigation.test.ts src/pages/dashboard/busca-leads/csvImportFlow.test.ts <teste-de-filtro-leads>`.
- [ ] **2. Rodar qualidade.**
  - `git diff --check`, type-check, lint e build; separar eventual falha preexistente.
- [ ] **3. Validar manualmente no navegador.**
  - Clique inicial abre seletor uma vez; mesmo arquivo pode ser escolhido de novo; replay pendente não abre seletor; sucesso abre a lista exata; acesso negado não abre seletor.
  - Registrar esta evidência como manual, não como E2E automatizado.
- [ ] **4. Criar um único commit somente se solicitado.**
  - Revisar baseline/diff, adicionar apenas paths/hunks CSV e filtro de lista explicitamente, nunca `git add .`; excluir `supabase/.temp/cli-latest` e toda alteração preexistente não relacionada.
  - Mensagem: `feat(csv): streamline import and open exact lead list`.
