# Revisão independente — consumers e typecheck da frente principal

05/10/2026; inspeção estática e testes de contratos na árvore em andamento, sem editar os componentes examinados. Última repetição às 19:18:23 America/Sao_Paulo. Não inclui navegador/renderização real.

## Avaliação

- `channelLifecycle.ts` bloqueia mutações/QR em pending, in_flight, needs_review e failed; permite inspeção por list/status/my_account. Formato antigo sem lifecycle continua compatível, decisão explícita dos testes.
- `whatsappAccountsRepository.ts` checa lifecycle mesmo em HTTP 202 com ok=true. HTTP 409 é lido em `FunctionsHttpError.context.clone()`, sem consumir o corpo usado pelo fallback; mensagem de erro não vira sucesso.
- Helpers de onboarding WA/Evolution exigem conta+integração+gates inbound/send/killSwitch e lifecycle não bloqueado; Ana continua decisão independente. A navegação WA não usa só connectionStatus.
- Ajustes typecheck: glob cobre todas Functions; caminho de shared imports do enviar-email passa a apontar a diretório existente; predicado cleanup mantém forma inferida da linha; diagnostics usa tipos de campos reais e configuração dinâmica explícita; declaração EdgeRuntime é somente tipo. Sem mudança de autoridade de negócio identificada nesses nove reparos.

## Observações iniciais encaminhadas à frente principal

1. **P2 UX, confirmado por inspeção**: quando disconnect retorna 202 com corte local já persistido, o repository lança `account_lifecycle_pending` e os `run()` dos painéis apenas mostram notice. O selected anterior não é substituído. Se era Operacional, o badge pode continuar Operacional até Atualizar, embora o backend tenha fechado a conta. Sugerido recarregar estado read-only ao receber lifecycle error ou transportar o status na exceção; não declarar o corte concluído sem consulta. O backend permanece protegido, portanto isso não demonstra reenvio real.
2. **Melhoria menor**: `WaAkgPanel.requestPairing` não possuía o guard lifecycle de loadQr e botões de pareamento podiam permanecer habilitados; backend/repository recusam a operação, sem escalada. Recomendada consistência de disabled+motivo. QR/código anterior também deve ser limpo ao atualizar um estado bloqueado.

## Reavaliação após as correções

As duas observações foram tratadas pela frente principal e relidas nesta frente. **Sem bloqueio novo identificado no delta examinado.**

- `refreshAfterLifecycleError` faz uma leitura canônica, nunca repete a mutação. Também trata falha de provider/rede, pois o corte pode ter sido gravado antes de um HTTP400 ou perda da resposta; só denegações preflight inequívocas dispensam recarga.
- Ambos `run()` e fluxos QR/pair usam essa recuperação; refresh elimina QR/código anterior.
- `statusUnconfirmed` começa true e é definido antes da recarga. Falha da recarga não limpa esse estado; somente retorno canônico bem-sucedido o faz. Assim, reload falhando não conserva badge Operacional nem usa o snapshot antigo para anunciar conexão/Ana/tráfego.
- Na Evolution, badge da lista e do detalhe, campos Conexão/Roteamento/Entrada-saída e statusDetail respeitam a incerteza. No WA, Conexão/Ana apresentam Não confirmado (não confundem desconhecido com protegido).
- Guardas de QR/pair, autoQR/poll e helpers de disponibilidade evitam tratar lifecycle pendente/estado não confirmado como prontidão. A instrução de habilitar conta separa conexão individual da liberação administrativa de entrada/envio/Ana.

Reexecução independente final: **41/41 testes, quatro arquivos, exit0**. `channelLifecycle.test.ts`14, `whatsappAccountsRepository.test.ts`14, `waAkgOnboarding.test.ts`6, `evolutionGoOnboarding.test.ts`7. O primeiro conjunto verifica seis classes de erro com uma única recarga e nenhuma repetição da ação. Repository verifica 202 e 409, inclusive preservação do corpo da resposta. `git diff --check` também exit0.

```sh
/Users/fabriciogaspar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/lib/crm/channelLifecycle.test.ts src/lib/crm/whatsappAccountsRepository.test.ts src/lib/crm/waAkgOnboarding.test.ts src/lib/crm/evolutionGoOnboarding.test.ts --configLoader runner
```

Limites: testes de helpers/repository não renderizam React e não são E2E. Falha de recarga foi revisada no fluxo de estados do código; interação visual/teclado, troca de conta durante resposta tardia e operação em duas abas ainda exigem teste de integração/UI isolado. Botões que visualmente permanecem acionáveis apesar de um guard interno são refinamento de UX futuro, não evidência de bypass de backend. Nenhum provedor, QR real ou cliente foi acionado.
