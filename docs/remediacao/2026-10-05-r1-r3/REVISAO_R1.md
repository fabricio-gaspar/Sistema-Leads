# Revisão independente — R1

05/10/2026, mesma árvore de trabalho, por frente diferente da autora de R1. Revisão somente; nenhum arquivo R1 alterado nesta frente.

Resultado: **sem bloqueio novo identificado no escopo R1 examinado**. Não é autorização para produção nem declaração de auditoria completa.

Inspecionados:

- `supabase/migrations/20261005220137_audit_r1_access_hardening.sql`: remoção das policies permissivas sobrepostas; guards de carteira/propostas, documents/chunks, Storage por dono/compartilhamento/carteira; supressão não enfraquecível; serialização de último admin por escrita MVCC na organização; revogação de TRUNCATE.
- `supabase/tests/rlsRemediation.integration.mjs`: fonte das funções/policies corresponde ao snapshot remoto somente leitura da auditoria; schema e dados reduzidos sintéticos; papéis reais PostgreSQL e RLS ligados; rollback por caso.
- `supabase/tests/rlsRemediation.concurrent.mjs`: cluster local isolado sem TCP, duas conexões e verificação de espera por lock; READ COMMITTED/REPEATABLE READ/SERIALIZABLE; cleanup em finally. Não há DSN remoto aceito pelo harness.

Reprodução independente executada:

```sh
/Users/fabriciogaspar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node supabase/tests/rlsRemediation.integration.mjs /tmp/wayflex-security-audit.vU7Foe/node_modules/@electric-sql/pglite/dist/index.js
```

Resultado final: **65 aprovados, zero reprovados, exit 0**. A primeira execução durante adição de testes apontou T-R1-052 (CTE único upload→document→chunk), 64/65. Foi informado ao autor que um helper SQL STABLE consulta o snapshot do statement e não vê o documento criado no mesmo CTE. O autor ajustou a fixture para três chamadas sequenciais, que representam o consumer real; não removeu a política nem afrouxou sua expectativa de autorização. A repetição independente confirmou 65/65.

Pontos conferidos explicitamente: campo owner_id confiável do objeto e fallback legado, ponteiro forjado de documento sem transferência de autoridade sobre bytes, carteira mesmo para antigo dono de mídia canônica, compartilhamento somente leitura, organização ativa, company/lead reassignment impedido para supressão e rollback de remoção/demotion do último admin.

Limites: a frente autora informa 65/65 casos em PostgreSQL nativo e nove corridas multi-sessão aprovadas. Esta revisão leu o script concorrente, mas **não reexecutou** o PostgreSQL nativo. PGlite é teste SQL sintético de sessão única; não substitui PostgREST, Storage API, JWT/refresh reais ou teste de integração no Supabase isolado após aplicar migration. Migração não aplicada remotamente; dados/arquivos de clientes intactos.
