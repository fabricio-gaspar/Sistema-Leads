# Revisão independente — R6/R7 e interação com o corte R4

Data: 2026-10-05. Revisor: frente segurança/acessos. Modalidade: leitura da migration/helpers/workers e reexecução SQL local PGlite. Não houve acesso a provedor, mensagem, QR, mutação remota ou publicação.

## Achados intermediários e resolução

| Cenário concreto | Risco encontrado | Resolução final inspecionada |
|---|---|---|
| Corte de vínculo antes do primeiro POST, finish velho e posterior reativação do membro | Finish podia devolver job a failed, e claim ignorar a intenção posterior de deactivate, rearmando provisionamento | Retry exige `desired_action='provision'`; finish superseded antes de qualquer POST cancela o job e preserva o corte. Caso `R6-PROV-cutoff-before-dispatch-never-rearms`. |
| Mudança de dono ou integração durante o último await remoto | Finish verificava revisão/membership, mas não repetia todo o escopo do job; configuração velha podia ser aplicada ao destino alterado | Finish repete organização, conta, provedor, integração, dono, existência da integração e membership ativo. Mudança impede configuração, preserva token e exige revisão após POST. Casos `R6-PROV-finish-rechecks-owner` e `R6-PROV-finish-rechecks-integration`. |

Ambos os achados foram comunicados ao autor, corrigidos por ele e reinspecionados nesta revisão. A mudança de integração do teste é exercitada pelo job divergente; não é uma homologação de toda a jornada de transferência de conta.

## Invariantes finais conferidas

- Claim/check/finish compartilham o ledger de lifecycle com ações manuais; RPCs de provisionamento têm EXECUTE somente para `service_role`, com `search_path` vazio.
- Checkpoint antecede cada etapa mutante; `registerWebhook` repete o checkpoint entre GET e eventual POST. `saveSecret` verifica o ticket e grava na mesma transação, mantendo locks de conta/integração.
- Token incerto não expira para autorizar novo POST: órfão é classificado `needs_review`. Falha da transação de finish não transforma efeito possivelmente aceito em retry seguro.
- Finish não abre controles de negócio; conta permanece desativada e integração pausada/desativada.
- Recovery exige autoridade administrativa, revisão exata, motivo e observação recente produzida no servidor. Limita-se a operações cujo contrato completo era de leitura (`activate`/`refresh_status`); GET não comprova terminalidade de POST anterior. A reconciliação mantém o corte local.
- O cliente WA-AKG usa namespace organização+conta, exige identidade e webhook vinculados para sessão preexistente, recusa adoção por nome/409 e comprova segurança por GET antes de prosseguir. Esta conclusão é da leitura do cliente local; a pesquisa do upstream fixado está documentada pelo autor em R7.md.

## Evidência verificada

Reexecutado independentemente:

```text
/Users/fabriciogaspar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node supabase/tests/messagingRecoveryR6.sql.mjs /tmp/wayflex-security-audit.vU7Foe/node_modules/@electric-sql/pglite/dist/index.js
PGlite 0.3.14: 40/40 casos novos aprovados.
```

O setup executa ainda os 28 casos base R2; não estão somados aos 40. A evidência do autor `EV-R6-002-postgres.json` foi inspecionada: 40 sequenciais + 9 concorrentes = 49 aprovados em PostgreSQL 17.6. Esses 49 **não foram reexecutados pelo revisor** nesta passagem final. Fixtures são sintéticas e reduzidas, com constraints relevantes e trigger legado, não replay integral do ambiente Supabase.

## Resultado e limites

**APROVADO no escopo local revisado**, sem contraexemplo bloqueante remanescente nos dois deltas apontados. Não é prova de entrega exactly-once: corte local não cancela POST já entregue; efeito incerto continua em revisão. A recuperação de mutações remotas não foi artificialmente desbloqueada. O upstream WA-AKG examinado permanece NO-GO operacional conforme R7.md, até existir revisão compatível e homologação. Nenhum gateway, credencial ou destino real foi usado.

As skills Supabase/PostgreSQL orientaram a revisão de grants, locks, escopo e CAS; não substituem homologação e não autorizam deploy.
