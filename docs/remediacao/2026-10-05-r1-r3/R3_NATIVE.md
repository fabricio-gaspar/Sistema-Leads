# Adendo R3 — PostgreSQL nativo e concorrência

05/10/2026, validação adicional ao R3.md, sem alterar produto/migration/teste SQL anterior. Nenhum commit/push/deploy feito por esta frente; banco remoto e clientes intactos.

Resultado: **14/14 cenários SQL reexecutados em PostgreSQL 17.6 e nove/nove disputas multi-sessão aprovadas**. Os 14 são repetição da mesma cobertura PGlite, não 14 novos requisitos. Somente as nove corridas acrescentam modalidade concorrente, ainda em schema reduzido/dados sintéticos.

Evidência: `EVIDENCIAS/R3-native.json`. Runner: `r3-native.mjs`. O runner carrega `supabase/tests/receiptReconciliationR3.pglite.mjs` e adapta somente imports, construção/fechamento do engine e metadados da saída, preservando todos SQL/assertions. O SHA-256 do arquivo fonte está no JSON; o teste original não foi editado para a reexecução.

As corridas usam duas conexões reais e confirmam espera por Lock via `pg_stat_activity` antes de liberar a primeira transação. Combinações: read versus delivered, delivered versus read, read versus failed, em READ COMMITTED, REPEATABLE READ e SERIALIZABLE. Resultado final read em todas; mesmo provider_message_id em outra conta/empresa continua sent. Em isolamento de snapshot, o perdedor recebe SQLSTATE40001 e a conciliação é repetida numa transação nova; isso é retry de recibo, não repetição de envio externo.

```sh
/Users/fabriciogaspar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node docs/remediacao/2026-10-05-r1-r3/r3-native.mjs /tmp/wayflex-security-audit.vU7Foe/node_modules/@embedded-postgres/darwin-arm64/native/bin /tmp/wayflex-security-audit.vU7Foe/node_modules/pg/lib/index.js
```

Dependências locais já instaladas pela frente R1: `@embedded-postgres/darwin-arm64` 17.6.0-beta.15 e `pg` 8.16.3. Nenhum pacote/lock do projeto foi alterado. O engine reporta PostgreSQL17.6 x86_64; não se presume binário ARM por causa do nome do pacote.

Cluster criado por mkdtemp com socket Unix privado 0700 e sem TCP; não aceita DSN remoto. Encerrado no finally. Verificação posterior com `pg_ctl -D <diretório>/data status` retornou `no server running` (exit3 esperado). Arquivos/log sintéticos ficaram em `/var/folders/ts/wxslxg794g31zvbyfd69k1s80000gn/T/wayflex-r3-pg-mdoATz` para reprodução; nenhum dado do usuário apagado.

Limite: estas provas encerram a lacuna específica de concorrência SQL sintética do R3.md para as nove combinações descritas. Não equivalem a Supabase/PostgREST/JWT, gateway, webhook real, reinício de provider, migração remota ou jornada E2E. Demais gates de homologação permanecem.
