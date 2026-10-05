# Revisão independente — R8, autoridade da Ana antes dos efeitos

Data: 2026-10-05. Revisor: frente segurança/acessos. Escopo: `anaEffectFence.ts`, `anaKnowledgeFence.ts`, `commercialCatalogPolicy.ts`, seus callouts em `ana-run/index.ts`, guard de dispatch em `automation-worker/index.ts` e o helper novo `anaMeetingRequest.ts`.

Modalidade: leitura do código em desenvolvimento, comunicação de achados ao autor e execução dos testes locais somente após confirmação de freeze. Nenhuma alteração de produto feita pelo revisor; nenhum modelo, Calendar, provedor, cliente ou banco remoto acionado.

## Achados concretos incorporados pelo autor

| Achado | Evidência/cenário | Correção conferida |
|---|---|---|
| A vinculação inicial WhatsApp invalidava o próprio snapshot | A RPC canônica `resolve_lead_whatsapp_account` grava `whatsapp_account_id` e `updated_at` quando o lead está sem vínculo. A versão intermediária mantinha `effectExpected` antigo e a comparação posterior recusava a execução saudável. | A resolução ocorre antes do modelo, após precheck. Releitura aceita somente o delta próprio comprovado de conta/timestamp; mudança em pausa, modo, opt-out, responsável, canal, contato ou etapa aborta. T-R8-012 positivo e negativo. |
| Data literal inválida era normalizada para outro dia | `Date.UTC(2026,10,31)` converte 31/11/2026 em 01/12/2026; o modelo poderia fornecer esse dia normalizado e passar a comparação anterior. | Round-trip de ano/mês/dia rejeita o literal impossível antes de autorizar o horário. T-R8-015. |

A suspeita inicial de ausência de precheck pós-modelo foi refutada: ele já existia imediatamente após a decisão na versão inspecionada. Não é contada como achado. O problema de documento importado sem item de catálogo foi encontrado pelo coordenador, não por esta frente; a correção por `metadata.source_id` canônico foi conferida e exercitada em T-R8-013.

## Invariantes conferidas

- Após espera pelo modelo, relê lead, organização, integração IA, configuração runtime, versão da Ana e fingerprint de conhecimento antes de aplicar a decisão.
- Após lookup/freeBusy, repete o guard antes do POST de criação do Calendar e relê a integração Calendar. Pausa, handoff, kill switch e indisponibilidade de calendário impedem a criação nos casos simulados.
- Atualização própria do lead usa CAS por `updated_at` e atualiza o snapshot esperado com o timestamp devolvido pelo banco. `ownHandoff` permite concluir o handoff da própria decisão sem ignorar uma alteração concorrente comparada previamente.
- O contexto do modelo e o fingerprint derivam da mesma releitura canônica de documentos/chunks/itens/fontes. Resultado semântico antigo não injeta texto antigo sob uma autorização nova.
- Fontes importadas exigem vínculo canônico habilitado/saudável; URL isolada não é autoridade. Revogação ou mudança de conteúdo/política invalida o fingerprint. UUIDs e digest, não conteúdo integral, acompanham a fila.
- O worker revalida o snapshot imediatamente antes de iniciar o dispatch da mensagem preparada pela Ana; snapshot legado ausente não é aceito como atual.
- O modelo não recebe a antiga tabela `services` com preços como fallback de conhecimento. Política de catálogo e flags de uso filtram o contexto. Rascunho de orçamento continua vazio, pendente de humano; não há autorização automática de preço, desconto ou ganho.
- Queries examinadas possuem `organization_id` explícito e os campos foram confrontados com definições locais relevantes. Essa inspeção não é execução de PostgREST real.

## Testes reexecutados independentemente após freeze

```text
/Users/fabriciogaspar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run supabase/tests/anaAuthorityR8.test.ts supabase/tests/runtimeHandlers.test.ts

anaAuthorityR8.test.ts: 41/41
runtimeHandlers.test.ts: 118/118
Total: 159/159, 2 arquivos aprovados.
git diff --check: aprovado.
```

Os 118 casos de runtime incluem regressões de outras frentes; não são 118 casos novos R8. Os testes importam o handler/helper reais, mas simulam banco e transporte HTTP. Cobrem antes/depois do modelo/freeBusy, caminho positivo de reunião, operação própria, orçamento, fonte revogada e dispatch com snapshot ausente/alterado. Não são E2E de Supabase/Google/WhatsApp nem prova de aplicação remota.

## Conclusão e limites

**APROVADO no delta local revisado**, sem contraexemplo bloqueante restante identificado. A skill Supabase orientou a revisão de consultas e autoridade canônica. Isso não certifica todas as jornadas: múltiplas requisições não formam uma transação global e um checkpoint não cancela POST já entregue. A recuperação de efeito externo incerto, contratos reais dos provedores, permissões/joins do PostgREST implantado e comportamento integrado de triggers requerem homologação isolada. Nenhuma publicação é autorizada por esta conclusão.
