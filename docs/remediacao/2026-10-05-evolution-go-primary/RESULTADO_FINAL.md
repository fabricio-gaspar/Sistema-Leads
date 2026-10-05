# Evolution GO como canal principal — checkpoint local

05/10/2026. Checkout existente, branch `main`. Produto local `5671f44`.

## Escopo e estado

| Requisito | Estado | Evidência e limite |
|---|---|---|
| EGO-01 — vendedor | PARCIAL | O aceite de convite chama `enqueue_evolution_go_seller_provisioning` e desperta `evolution-go-worker`; registros locais começam desabilitados. Contrato e privilégio `service_role` conferidos no catálogo remoto. Não foi criado vendedor real. |
| EGO-02 — pareamento e Central | PARCIAL | Primeiro acesso consulta somente a conta própria Evolution GO; Central apresenta o painel individual com QR/código e guardas de conexão existentes. WA-AKG continua acessível somente como contingência administrativa. Sem QR ou conexão real neste lote. |
| EGO-03 — Ana, saída e entrada | PARCIAL | `webhook-evolution-go`/worker, `ana-run` e `automation-worker` já suportavam a conta Evolution GO. A nova preferência SQL vale somente na escolha de conta de um lead não vinculado e nas listas/ações de transferência. Vínculo de número existente não é reatribuído; controles de envio, automação, opt-out, handoff e snapshots da Ana permanecem. Sem mensagem real ou callback novo. |
| EGO-04 — estado operacional | PARCIAL | Configurações mostra Evolution GO primeiro; status específico não herda o check genérico de WhatsApp. Disponibilidade, credencial, webhook e entrega não foram homologados em ambiente externo. |
| EGO-05 — release | BLOQUEADO | O banco, as Edge Functions e o Site não receberam este delta. Histórico de migrations e bundles remotos divergem do checkout; falta homologação isolada do fluxo completo. Não publicar apenas o frontend nem executar `db push` integral. |

## Segurança da seleção

A migration `20261005234602_prefer_evolution_go_for_new_lead_bindings.sql` modifica apenas a ordenação das funções existentes: conta individual conectada primeiro, Evolution GO antes de outra conta de vendedor equivalente, depois `updated_at`; na transferência, conta habilitada/conectada precede a preferência. Cada substituição exige exatamente o trecho de definição verificado no catálogo remoto e falha atomicamente se a função mudou. As permissões anteriores e o `search_path` são preservados. Não há `UPDATE` de leads/contas na migration; uma chamada futura do resolvedor ainda pode fixar a conta de um lead novo conforme o fluxo normal.

## Validação local

- Vitest: **733 testes / 91 arquivos**, zero falhas; inclusive convite, roteamento Evolution GO e guardas da Ana/worker.
- SQL sintético em PGlite: **7 verificações** (três definições e quatro cenários de seleção), sem conexão remota. Confirma Evolution GO em lead novo, vínculo existente intocado, fallback com Evolution GO desabilitada e conta corporativa.
- Type-check frontend e todas as Edge Functions, lint sem warnings, build de produção e artefato Sites local aprovados; `git diff --check` aprovado.
- Consulta remota somente de metadados: RPC de provisionamento existente com assinatura esperada, `EXECUTE` restrito a `service_role`; definições de seleção compatíveis com o patch. Edge Functions Evolution GO, webhook e worker aparecem ativas no catálogo. Não houve leitura de segredos nem chamada ao gateway.

## Estado de implantação e próxima ação

**LOCAL validado; SUPABASE/SITE NÃO APLICADOS; produção NO-GO.** O Site oficial não foi alterado neste lote. Não houve envio real, automação disparada, QR solicitado, dado de cliente alterado ou reprocessamento de callback. Arquivos pnpm preexistentes permanecem fora do commit.

Próxima ação: disponibilizar homologação isolada com identidades/números consentidos; reconciliar seletivamente a migration e os bundles R1–R12 necessários; testar provisionamento, QR, callback, Ana/humano, recibos e cortes de segurança. Só então planejar uma release coordenada de banco + Edge + frontend, com rollback/reconciliação. GitHub guarda o código; não equivale a deploy.
