# WayFlex — etapa 1: proteção e baseline

Data: 25/09/2026. Escopo autorizado: preservar o estado atual, isolar as próximas
alterações, testar a referência e registrar recuperação. Nenhuma correção funcional
das etapas 2–12 foi antecipada.

## Identidade e referência preservada

- Checkout existente: `work/ana-activation-repair`.
- Código validado: `9bdd136eaa9c03a2eb1eca91f67e57d3dac88579`.
- Branch original: `feat/meta-coexistence-foundation-2026-09-24`, preservada.
- Branch de trabalho: `chore/wayflex-stage-1-baseline-2026-09-25`.
- Tag anotada de recuperação: `baseline-wayflex-stage1-20260925`, no código validado.
- Working tree inicial limpo. Não houve sobrescrita de trabalho em andamento.
- O manifesto `.agent/baselines/2026-09-25-stage-1.json` registra commits, versões,
  hashes, testes e leitura operacional sanitizada; não contém credenciais nem conversas.

## Site e GitHub são históricos diferentes

O Site oficial foi confirmado pelo conector como versão **118**, deployment `succeeded`,
commit `a55a0a21c4c1f09cd9b7672f3cf7576ce56bbee2`, audiência pública e URL
`https://leadai-crm-preview.fabricio926564.chatgpt.site`.
O HEAD local só acrescenta documentação em relação à versão publicada; `src`, `supabase`,
scripts, dependências e configuração de build/hosting não têm diferença.

A consulta atual da `main` de `fabricio-gaspar/Sistema-Leads` retornou
`c4733b65c552d53be40c78f0350396432e163609`. O repositório local não é shallow e
`git merge-base github-audit/main HEAD` não encontra ancestral comum. A comparação
contabilizou 625 commits exclusivos no GitHub, 183 no checkout do Site e 604 arquivos
com diferença. Portanto, não é seguro tratar `official/main` local como a main do GitHub:
o remote `official` aponta ao repositório de origem do Site, e seu cache estava desatualizado.
A main remota do Site foi consultada diretamente e está em `a55a0a2`.

A branch `stabilize/production-readiness-2026-09-09` foi apenas identificada e baixada
como referência `585409bb96352458e5797a5f9de29f69363ece1b`; seu conteúdo não foi aplicado.
Nenhuma main, histórico remoto ou versão publicada foi substituída. A futura
sincronização GitHub/Site exige comparação seletiva e revisão própria.

## Estado operacional observado, sem alteração

Projeto Supabase `thgzrkppouoevapjquyu`, nome **Sistema de Leads**, `ACTIVE_HEALTHY`,
região `sa-east-1`, confirmado pelo MCP oficial autenticado.

Leitura da organização Wayflex em 25/09/2026, aproximadamente 12:34–12:37 BRT:

| Item | Evidência |
|---|---|
| Proteção interna | `sandbox_mode=false`, preservado |
| Rotina da Ana | modo `automatic`, porém `ana_operation_enabled=false` |
| Z-API e Meta | entrada, saída e automação desligadas; kill switch ligado |
| Contas | uma Z-API não arquivada, desabilitada, status `error`; nenhuma Meta |
| Dados operacionais | zero leads, mensagens, execuções da Ana e itens nas duas filas |
| Worker | cron ativo a cada minuto; heartbeat às 15:34:01 UTC |
| Apify | cinco execuções manuais em `running` com ID do provedor; cinco em `failed` |
| Validação Apify | última data registrada 11/09/2026; esta leitura não valida o provedor hoje |
| Agenda da rotina | desativada; 09:00, dias úteis, America/Sao_Paulo; sem última execução |
| Realtime | `lead_messages` presente em `supabase_realtime` |
| Backend | 25 Edge Functions e 133 migrations aplicadas inventariadas |

Uma integração marcada `connected` no banco não comprova disponibilidade externa atual.
Os estados desativados foram preservados. O cron existente continuou independente desta
auditoria; nenhum worker, callback, busca, IA ou envio foi acionado pelo agente.

## Verificação reproduzível

Executar a partir do checkout acima, com as dependências locais existentes:

```powershell
node node_modules/typescript/bin/tsc --noEmit --project tsconfig.app.json
node node_modules/typescript/bin/tsc --project tsconfig.edge.json
node node_modules/eslint/bin/eslint.js src --ext ts,tsx --report-unused-disable-directives --max-warnings 0
node node_modules/vitest/vitest.mjs run --configLoader runner
node node_modules/vite/bin/vite.js build --configLoader runner
node scripts/build-sites-artifact.mjs
```

Todos passaram: frontend e Edge type-check, lint sem warnings, **35 arquivos / 238 testes**,
build Vite e artefato Sites. Foram usados diretamente os executáveis dos scripts do
`package.json`, pois `npm` não estava no PATH. `--configLoader runner` é o procedimento
já existente para este Windows. Não houve instalação nem atualização de dependências.

Node `24.19.0`; TypeScript `5.8.3`; Vite `8.2.2`; Vitest `3.2.7`; ESLint `9.39.5`;
Supabase JS `2.57.4`. Versões instaladas conferem com o lockfile.
SHA-256 do `package-lock.json`:
`e7648df1932c58349019ac125a2dddc9b64e40b86246f26214f132aa0ea69208`.

Avisos não bloqueantes: script clássico `/runtime-config.js` não empacotado como módulo
e informação de tempo dos plugins Vite. A configuração pública é entregue pelo Worker
em runtime, por isso mudar o tipo do script apenas para eliminar o aviso não faz parte
desta etapa.

Não executados nesta etapa: E2E autenticado, desktop/mobile visual, envio/recebimento
real, chamada Apify/IA, restauração do banco, concorrência e isolamento entre empresas.
O baseline aprovado não equivale a homologação ponta a ponta.

## Recuperação e limites

Além da tag, foi criado `../../outputs/wayflex-pre-stage-1-20260925.bundle`
(1.796.293 bytes). `git bundle verify` confirmou arquivo válido e histórico completo.
SHA-256: `861a146a9cb589efc13c38eff6f543434802895d92c3130f138da1cbee4cefeb`.
O arquivo fica fora do código publicado e contém a referência anterior às alterações documentais.

Para examinar a referência sem tocar no trabalho atual, crie um worktree separado:

```powershell
git worktree add --detach ../wayflex-stage1-recovery baseline-wayflex-stage1-20260925
```

Para uma regressão futura, comparar o delta e preparar um revert específico em branch
própria; migrations de produção exigem plano de reparo compatível com os dados existentes.
Não executar reset global, force push ou restauração completa de branch.

A tag protege o código e o manifesto registra as versões implantadas. Isso **não é
backup do banco, Storage ou Vault**, nem permite reconstruir credenciais. O Site v118
permanece uma referência de publicação; esta etapa não dispara uma restauração.

## Contratos que as próximas etapas devem preservar

- Supabase como fonte operacional e isolamento por organização/carteira.
- `ana-run` como única autoridade automática; fila auditável para saída humana.
- Matching ambíguo bloqueado, opt-out, handoff humano e idempotência.
- Canal WhatsApp explícito na ativação; nunca inferir autorização de contato do telefone.
- Pipeline Novo → Apresentado → Qualificando → Reunião → Orçamento → Ganho → Perdido.
- Preço, desconto, prazo final e Ganho sob decisão humana; sem Pedido/Venda/Checkout/Recebimentos.
- Provedor aceitou, entregue e lida são evidências diferentes.
- Segredos no backend; Site e Supabase oficiais existentes.

## Próxima etapa

O usuário pediu uma troca manual de agente entre etapas. Ao terminar esta etapa, parar
antes de alterar prospecção e solicitar **GPT-6 Sol · Extra High** para a etapa 2.

Etapa 2: reproduzir o ciclo de busca manual, validar a causa das cinco execuções paradas,
definir recuperação server-side/idempotente e retomada de resultados na interface.
Conferir quais filtros a fonte suporta; não inventar porte, cargo, WhatsApp ou coordenadas.
Não iniciar nova execução paga nem importar/reprocessar resultados antigos implicitamente.
