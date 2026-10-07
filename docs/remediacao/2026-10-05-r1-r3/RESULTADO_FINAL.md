# Resultado — remediação R1/R2/R3 — 05/10/2026

**Resultado local aprovado para os deltas descritos abaixo e código salvo no GitHub. Não é liberação para produção: o parecer global continua NO-GO.** Autorização e limites em [PRE_FLIGHT.md](PRE_FLIGHT.md). Mantidos o checkout original e a branch `main`, sem projeto/repositório/branch/worktree adicional.

## Entrega e rastreabilidade

| Lote | Resultado implementado | Commit local | Snapshot GitHub `main` |
| --- | --- | --- | --- |
| R1 | Carteira/Storage/documentos/supressão e proteção concorrente do último administrador | `1e802151688e3f7e82fc1111c4acd67e4d27066c` | `eca4c433422a3539f60943cfb0d4dd800f2075dc` |
| R3 | SQL de recibos válido; identidade por organização/conta/provedor; estados monotônicos e callbacks tardios sem reabrir transporte | `861f6b7c973e2b5a3fb660b8b0dd0e01b65e9a00` | `9daabbdeaa0c583455b382c02df95fa1f757ea3f` |
| R2 e consumidores | Corte local anterior ao gateway, revisão/token/CAS, política global separada, provisionamento manual cercado por etapa e UI sem falso sucesso | `596837a5f9590dc67188a24e035308e7a07da8d5` | `a07409610e2cac48882f6c6975ed3d516a0a615b` |
| R10, subconjunto técnico | Type-check de todas as Edge Functions e correção dos nove diagnósticos de tipo/importação, sem alteração de regra comercial | `2a48e6546bcbeef3b935fc5d77cd81c5ac65900d` | `a07409610e2cac48882f6c6975ed3d516a0a615b` |

O [snapshot de produto no GitHub](https://github.com/fabricio-gaspar/Sistema-Leads/commit/a07409610e2cac48882f6c6975ed3d516a0a615b) foi enviado sem force e confirmado por `ls-remote`; sua árvore `31593132256627504d49666438c11b4f77c215b5` é igual à árvore do commit local de produto. As DAGs local e GitHub já eram diferentes: os snapshots preservam o pai remoto, sem empurrar o histórico Sites. O commit documental final, posterior a este snapshot, fica identificado no histórico e na entrega ao usuário, evitando autorreferência de hash.

## Testes executados

Rodada integrada em 05/10/2026, 22:19:53–22:20:25 UTC: **13 comandos aprovados**. [Manifesto e resultados](checks/results.json), logs `checks/T-REM-001.txt` a `T-REM-013.txt` e [resultado Vitest](checks/vitest.json).

- **500/500 testes Vitest, 79 arquivos**, nenhum teste reprovado ou ignorado na rodada final.
- Type-check frontend e **todas** as Edge Functions; lint do frontend sem avisos; build Vite e geração local do artefato Sites aprovados. Gerar artefato não significa publicar.
- **17 verificações determinísticas** comerciais aprovadas.
- SQL isolado: R1 = 65 sequenciais + 9 disputas; R2 = 28 sequenciais + 6 disputas; R3 = 14 sequenciais + 9 disputas. **131 casos distintos, incluindo 24 disputas concorrentes em PostgreSQL real**. Os 107 sequenciais foram também executados em PGlite; a repetição entre engines não foi contada duas vezes. R3 inclui uma reprodução controlada do defeito anterior.
- Manifesto SHA-256 de **534 arquivos**, sem mudança durante a rodada. Embora `headAtRun` ainda fosse o commit R3, o manifesto inclui exatamente as alterações R2 e de tipos então não commitadas e posteriormente salvas nos commits acima.
- Revisões independentes de [R1](REVISAO_R1.md), [R2](REVISAO_R2.md) e [consumidores](REVISAO_CONSUMIDORES.md). `git diff --check` aprovado.

Uma rodada anterior falhou em uma expectativa textual antiga da UI (`Ativar canal`). O teste passou a conferir `Habilitar conta` **e a preservação da ação/gates**, com caso adicional para estado desconhecido. O registro anterior está em `checks/first-run-failure.json`; não foi apagado nem apresentado como sucesso. As evidências históricas da auditoria V3 permanecem intactas.

Reprodução: `node docs/remediacao/2026-10-05-r1-r3/run-checks.mjs <modulo-PGlite> <binarios-PostgreSQL> <modulo-pg>`. Dependências temporárias fora do produto: PGlite 0.3.14, embedded-postgres 17.6.0-beta.15 e pg 8.16.3. Dados sintéticos, clusters descartáveis sem TCP, socket privado e encerramento em `finally`. Nenhum DSN remoto usado. As orientações das skills Supabase e Postgres determinaram privilégio mínimo, grants explícitos e testes de concorrência; não houve atualização da stack.

## LOCAL / APLICADO / PUBLICADO

| Destino | Estado deste lote |
| --- | --- |
| Código e validação local | Implementados e aprovados no escopo acima |
| GitHub | Produto salvo e árvore confirmada; evidências/checkpoint acrescentados no fechamento documental |
| Banco Supabase de produção | **Não aplicado**: as três migrations `20261005220137/38/39` são locais |
| Edge Functions de produção | **Não publicadas** nesta etapa |
| Site oficial | **Não publicado** nesta etapa; última versão verificada continua sendo v168, fonte isolada `87b9b8309eb8fc0fa4d47611c7a1315598fc4f76` |

[Site oficial](https://leadai-crm-preview.fabricio926564.chatgpt.site). Não foi feita nova inspeção remota da versão neste lote. Nenhuma mensagem real, busca paga, QR/pareamento, reprocessamento, disparo de automação ou alteração de cliente. A configuração operacional previamente existente não foi modificada; isso não afirma que todas as automações de produção estejam desligadas. Os arquivos preexistentes `pnpm-lock.yaml` e `pnpm-workspace.yaml` permanecem fora dos commits.

## Limitações e próxima etapa

1. **R2 não conclui recuperação operacional:** `needs_review`/token órfão ficam bloqueados, sem reset/expiração/retry cego. Recuperação humana com confirmação externa e CAS ainda precisa ser implementada. Provisionamento automático não participa deste ledger: integração e exclusão mútua pertencem ao R6. Um POST já enviado não pode ser cancelado por uma transação local.
2. Schema sintético e HTTP simulado não substituem clone completo, teste real de gateway, contrato upstream, QR ou E2E React no navegador. O teste frontend desta etapa cobre lógica e contrato estático, não uma jornada React real.
3. Storage legado sem proprietário/mapeamento confiável deve permanecer restrito até reconciliação controlada. Compatibilidade de migration → handlers → consumidores precisa ser homologada antes de liberação seletiva; a publicação do Site v168 não recebeu estas correções.
4. Permanecem os demais itens R4–R14 do [plano histórico](../../auditoria/2026-10-05-v3/PLANO_DE_REMEDIACAO.md), exceto o subconjunto de tipos de R10 entregue aqui. Não se afirma correção de todos os achados V3 ou GO comercial.

Próxima etapa: R4 (acesso/convites e decisão de autoridade/MFA), R5 (isolamento de caches por contexto) e R6 (recuperação controlada/provisionamento automático), sem repetir auditoria integral. Homologação externa depende de staging, gateway persistente HTTPS, perfis e destinos consentidos. Publicação seletiva e operação real exigem autorização e critérios de aceite próprios; não publicar indiscriminadamente a `main`.
