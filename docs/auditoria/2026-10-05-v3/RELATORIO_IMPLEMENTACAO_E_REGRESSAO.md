# Implementação, regressão e preservação

## O que mudou nesta execução

Somente `docs/auditoria/2026-10-05-v3/` e checkpoints em `.agent/`/CONTINUIDADE. Os instrumentos importam fontes reais em ambiente local, com fixtures. **Nenhum arquivo de produto em src, supabase, scripts ou configuração de build foi alterado. Nenhuma migration, Edge Function ou Site foi publicado.**

`pnpm-lock.yaml` e `pnpm-workspace.yaml` já estavam não rastreados e ficaram fora do lote. Produto-base auditado:847048429a86294aa10fa54ffdd750c04447d4fb. Conteúdo inicial idêntico ao GitHub9fdfb554ed5e23b1edc5b7e5250bd8df84cbad7d. Histórico local e remoto são distintos; não usar force-push nem empurrar origin (Sites) para salvar auditoria.

## Execuções e reprodução

Runtime Node instalado: `/Users/fabriciogaspar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`. Executar na raiz do projeto.

- Baseline: `node docs/auditoria/2026-10-05-v3/EVIDENCIAS/run-baseline.mjs`. Sete comandos/exit0, logs e JSON anexos; build cria artefatos locais ignorados.
- Mensageria: comando exato em PROVEDORES_ANA_E_RECUPERACAO.md. 13 casos, exit1 esperado enquanto defeitos existirem.
- Produto: `node docs/auditoria/2026-10-05-v3/EVIDENCIAS/produto/probes-produto.mjs`. 11 casos, exit1 enquanto defeitos existirem.
- Segurança: EV-SEC-008 documenta comandos; PGlite0.3.14 fora do produto, scripts desabilitados na instalação temporária, database em memória. 16 assertivas novas; reset possui duas assertivas sobre a mesma chamada, não duas chamadas externas.
- Typecheck integral: `node node_modules/typescript/bin/tsc --project docs/auditoria/2026-10-05-v3/EVIDENCIAS/tsconfig-edge-all.json`. exit2, nove diagnósticos preservados.
- UI: EV-LIVE-001 e seis capturas; somente admin existente. Não substituir por teste de fixtures.
- Metadados: EV-ENV e EV-SEC registram somente SELECT/catalog/configuração não secreta. Não chamar RPC de negócio para “reproduzir” SQL inválido em produção.

Matrizes CASOS_PRODUTO/CASOS_MENSAGERIA/matriz-seguranca separam testes executados, inspeções e casos futuros bloqueados. Não somar linhas estáticas ou duplicar baseline focal. Nenhuma contagem significa porcentagem homologada de todo o CRM.

## Antes/depois

Antes: defeitos identificados, baseline verde e testes adversariais vermelhos. Depois: **não aplicável; remediação não autorizada/executada**. Não há melhoria operacional atribuída a estes documentos.

Preservados: clientes, leads, propostas, arquivos, contas, sessões, Vault, integrações, crons, políticas remotas, históricos e jobs. Nenhum teste deixou chamada externa incerta. O gateway não foi reiniciado; nenhuma sessão foi desligada. Viewport voltou ao tamanho normal. Banco sintético PGlite/fixtures JS encerrados em memória; pacote temporário de testes permanece documentado fora do projeto, sem daemon.

## Integridade e salvamento

Evidências têm inventário/hash em EVIDENCIAS/manifest-sha256.json. Checkpoints identificam o código auditado e próximo lote. Commits de documentação não mudam o produto nem elevam versão168. O hash final de salvamento no GitHub é confirmado por ls-remote e informado no encerramento da conversa; não confundir esse hash com release homologada nem exigir autorreferência do commit dentro do próprio conteúdo.
