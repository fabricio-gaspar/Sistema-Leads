# EV-SEC-008 — comandos e execução

Data 05/10/2026, HEAD 847048429a86294aa10fa54ffdd750c04447d4fb. Projeto remoto somente SELECT de catálogo. Sem mensagens ou dados reais alterados.

## Provas novas

```sh
/Users/fabriciogaspar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node docs/auditoria/2026-10-05-v3/EVIDENCIAS/seguranca/provas-rls.mjs /tmp/wayflex-security-audit.vU7Foe/node_modules/@electric-sql/pglite/dist/index.js
/Users/fabriciogaspar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node docs/auditoria/2026-10-05-v3/EVIDENCIAS/seguranca/provas-codigo.mjs
```

Ambos exit 0 (instrumentos executaram); resultados de negócio individuais incluem REPROVADO, não são escondidos no exit code. Saídas preservadas EV-SEC-004/005. PGlite contém SQL real extraído, schema mínimo e fixtures A/B. Handler JS contém código real transpilado, Auth/transportes stub. Não se declara E2E Supabase real.

T-SEC-013 e T-SEC-015 verificam duas condições da mesma invocação sintética reset_password: alvo compartilhado e ator aal1 com política MFA. Não são duas chamadas nem cobertura de duas combinações diferentes. O teste de MFA não homologa GoTrue/AAL real; demonstra ausência de enforcement no handler examinado.

Tentativas iniciais dos instrumentos: caminho npm-cli não existente (usado pnpm bundled); variável SQL audit.user inválida (alterada somente no harness para audit.user_id); root URL do harness JS com um nível excedente (corrigida). Não foram falhas do produto.

## Regressão focal existente

```sh
/Users/fabriciogaspar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/lib/organization.test.ts src/lib/crm/currentAccessRepository.test.ts src/lib/crm/teamMembersRepository.test.ts supabase/tests/anaEvolutionInternalAuth.test.ts --configLoader runner
```

Vitest v3.2.7: 4 arquivos passaram, 8 testes passaram, duração 482 ms; processo final exit 0. Trata-se de testes preexistentes e independentes dos 16 cenários adversariais. O agente principal executa a baseline completa.

Busca dirigida: `rg -l 'SUPABASE_SERVICE_ROLE_KEY|sb_secret_|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|ghp_[A-Za-z0-9]{30}|github_pat_' src .github --hidden` não retornou hits. Primeira busca incluía diretório public inexistente; repetida somente nos diretórios existentes. Não foram abertas credenciais ou consultado conteúdo do Vault. Busca não substitui scanner de todo o histórico Git.

`git diff --check`: exit 0. Produto não alterado por esta frente.

## Segunda revisão independente de mensageria

- ACH-MSG-001 confirmado estaticamente por esta frente: `wa-akg/index.ts:92–100` permite connect ao dono com channels.connect_own; dispatcher usa esse nível em 347; activate em 406–422 grava controls organizacionais inbound/send/automation=true, kill_switch=false. Não há check canManage nesse ramo; somente save_controls exige canManage em 435. Portanto a prova T-MSG-001 do agente mensageria tem correspondência direta no código. P1: viola emergência/admin, mas não afirmar envio real ou todas barreiras da Ana removidas.
- ACH-MSG-017 confirmado em leitura independente: catálogo remoto devolveu `v_at timestamptz := pg_catalog.coalesce(p_occurred_at, pg_catalog.now());`. `select pg_catalog.coalesce(null::timestamptz, now()) as audit_pure_expression` retornou SQLSTATE 42883 function ... does not exist. A expressão é executada antes do corpo de conciliação; P1 para recibos, compartilhado por provedores. Nenhuma RPC de negócio foi chamada.
- ACH-MSG-015 namespace seller_UUID sem organization_id confirmado em `wa-akg/index.ts:25–26` e migration WA-AKG:175. Colisão é determinística se mesmo UUID usa mesmo gateway entre organizações; não é vazamento real comprovado. Snapshot remoto mostra zero identidades multiorg, então manter P1 condicional. Gate de credencial/gateway por organização e política de sessão compartilhada exigem decisão/contrato; namespace sozinho não resolve migração de sessão existente.

## Limpeza

Os dois PGlite foram fechados, sem persistência de banco. Nenhuma fixture remota. Dependência PGlite instalada isoladamente em /tmp/wayflex-security-audit.vU7Foe permanece apenas para reprodução; sem alteração package.json/lock do produto. Nenhum job externo ou convite pendente criado.
