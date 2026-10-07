# R1 — remediação local de autorização de dados

Data: 2026-10-05. Base auditada: `ef19a6f` (relatórios V3; produto base `8470484`). Escopo: ACH-SEC-001–004. Estado: **implementado e validado em bancos locais sintéticos; não aplicado ao Supabase ou publicado**. Evidências históricas da auditoria permanecem intactas.

## Resultado e rastreabilidade

| Requisito / achado | Antes, catálogo auditado e reprodução local | Depois, teste da migration real | Resultado local |
|---|---|---|---|
| SEC001 / J02 propostas | Vendedor lê/exclui proposta de colega pela policy ALL em OR | T-R1-001–009/060: carteira vinculada ao lead; escrita exige `proposals.manage`; overrides positivos/negativos | APROVADO |
| SEC001 / documentos | Vendedor exclui documento alheio; leitura ignora visibilidade | T-R1-010–021/052/061–063: propriedade/configuração, compartilhamento explícito, chunks acompanham pai | APROVADO |
| SEC002 / Storage | Prefixo da organização basta para mídia privada de outro responsável | T-R1-022–032/053–055/065: proprietário, documento compartilhado com origem compatível, carteira canônica | APROVADO |
| SEC003 / proteção opt-out | Vendedor remove supressão por Data API | T-R1-033–041/064: inclusão por carteira, repetição idempotente, fortalecimento permitido; enfraquecer/remover exige configuração | APROVADO |
| SEC004 / último admin | DELETE direto remove administrador final | T-R1-042–049/056–059 e C01–C09: trigger no banco, cascata organizacional e service role controlados | APROVADO |
| Revogação/empresa/anon | Recorte depende de vínculo ativo e organização atual | T-R1-050/051/060/063: disabled, anon, permissão negada e duas empresas | APROVADO |

Os seis cenários originais de acesso indevido foram executados novamente **antes** da migration no mesmo harness, cada um retornando uma linha indevida. Depois: **65/65 casos** em PGlite e os mesmos **65/65** em PostgreSQL nativo 17.6; adicionalmente **9/9 corridas reais de duas sessões** em PostgreSQL. Total de cenários distintos R1: **74**, não 139; executar os 65 em dois engines não cria 65 casos novos.

- [EV-R1-001-pglite.json](EV-R1-001-pglite.json): antes/depois, SQLSTATE e linhas sintéticas, exit 0.
- [EV-R1-002-postgres-concorrencia.json](EV-R1-002-postgres-concorrencia.json): repetição nativa, bloqueio observado em `pg_stat_activity`, nove disputas, exit 0.
- `supabase/tests/rlsRemediation.integration.mjs`: fixtures mínimas + políticas/helpers **reais do snapshot** da auditoria; aplica o arquivo SQL R1, não uma cópia manual da correção.
- `supabase/tests/rlsRemediation.concurrent.mjs`: cria cluster temporário exclusivo, sem aceitar DSN remoto; encerra o servidor em `finally`.

## Alteração de produto

Único arquivo de produto desta frente: `supabase/migrations/20261005220137_audit_r1_access_hardening.sql`, gerado inicialmente pelo CLI pelo coordenador. Nenhuma Edge Function, frontend, segredo, dependência/lock do produto ou migration histórica foi alterada por R1.

1. **Propostas:** elimina as policies permissivas anteriores e exige a carteira quando há `lead_id`; `owner_id` próprio não permite reivindicar lead alheio. Sem lead, dono ou `leads.read_all`. Escritas exigem `proposals.manage`, inclusive para um override explicitamente negado. Administrador continua com o comportamento canônico do helper existente.
2. **Documentos e chunks:** dono/configuração pode escrever; `team` compartilha leitura com membros ativos; `sellers` com vendedor/SDR; `ai` e `restricted` não concedem compartilhamento humano geral. `configuration.manage` delegado funciona. `knowledge_chunks` tinha somente `org_active_access` no snapshot; a substituição remove esse caminho indireto. Vinculação ao pai exige a mesma organização.
3. **Storage:** buckets/MIME/tamanho/privacidade permanecem inalterados. `owner_id` é principal, `owner` legado apenas fallback. Upload antes do registro do documento e limpeza de órfão próprio continuam válidos. Leitura compartilhada exige documento com `storage_path` correspondente e `uploaded_by` igual ao proprietário real do objeto: um documento criado pelo atacante apontando ao arquivo alheio não concede acesso. Compartilhar leitura não concede overwrite/delete. Permissões são reavaliadas depois de mudança de visibilidade, carteira ou vínculo.
4. **Supressões:** a Central mantém INSERT/upsert no lead gerenciável, com SELECT limitado à carteira. Para não gerentes de configuração, trigger impede trocar identidade, hash, lead ou enfraquecer canal; repetir os mesmos valores e ampliar para `all` são permitidos. Exclusão ou alteração que retira proteção exige `configuration.manage`, preservando o painel e o audit trigger existente. Service role preserva os fluxos automáticos legítimos.
5. **Administrador final:** trigger `VOLATILE SECURITY DEFINER` protege DELETE, desativação, demotion e movimento de vínculo para outra empresa. Uma escrita real, ainda que sem mudança intencional de valor, em `organizations.updated_at` cria a barreira MVCC antes da contagem. Sem contador duplicado. TRUNCATE foi revogado das roles de aplicação, pois não executa triggers de linha nem RLS e não é parte do workflow de equipe. Exclusão legítima da própria organização com cascata continua possível; service role não contorna a proteção do administrador final.

Helpers novos ficam no schema `private`, com `search_path=''`, identidade derivada de `auth.uid()`, sem parâmetro de usuário arbitrário; PUBLIC/anon não executam. Authenticated recebe EXECUTE dos helpers necessários às policies, não das funções de trigger. Não foi criado RPC público novo. Índices cobrem `documents(organization_id,storage_path)` e administradores ativos por organização.

## Concorrência demonstrada

Dois administradores sintéticos abrem transações/snapshots independentes. A primeira desativação/demotion/exclusão fica sem commit; a segunda inicia e seu bloqueio em lock é confirmado via catálogo local. Só então a primeira confirma. Resultado:

| Isolamento | Desativar | Rebaixar | Excluir | Estado final |
|---|---|---|---|---|
| READ COMMITTED | segunda operação 23514 | 23514 | 23514 | 1 admin ativo |
| REPEATABLE READ | segunda operação 40001 | 40001 | 40001 | 1 admin ativo |
| SERIALIZABLE | segunda operação 40001 | 40001 | 40001 | 1 admin ativo |

Um mero advisory lock ou SELECT FOR UPDATE sem escrita do pai não demonstraria a mesma barreira em snapshots antigos. Os consumidores devem tratar `40001` com nova transação/revalidação, nunca insistir na operação antiga sem checar o administrador remanescente.

## Reprodução e dependências temporárias

No checkout autorizado:

```sh
/Users/fabriciogaspar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node supabase/tests/rlsRemediation.integration.mjs /tmp/wayflex-security-audit.vU7Foe/node_modules/@electric-sql/pglite/dist/index.js
/Users/fabriciogaspar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node supabase/tests/rlsRemediation.concurrent.mjs /tmp/wayflex-security-audit.vU7Foe/node_modules/@embedded-postgres/darwin-arm64/native/bin /tmp/wayflex-security-audit.vU7Foe/node_modules/pg/lib/index.js
```

Dependências **fora do repositório**, em `/tmp/wayflex-security-audit.vU7Foe`, instaladas via pnpm com versões exatas e `--ignore-scripts`:

| Dependência | Versão | Proveniência / licença |
|---|---|---|
| `@electric-sql/pglite` | 0.3.14 | registry.npmjs.org; [Electric SQL PGlite](https://github.com/electric-sql/pglite), Apache-2.0; já usada na auditoria |
| `@embedded-postgres/darwin-arm64` | 17.6.0-beta.15 | registry.npmjs.org; [embedded-postgres](https://github.com/leinelissen/embedded-postgres), wrapper MIT; binários upstream Zonky/PostgreSQL, PostgreSQL License e licenças das bibliotecas empacotadas |
| `pg` | 8.16.3 | registry.npmjs.org; [node-postgres](https://github.com/brianc/node-postgres), MIT |

O pacote PostgreSQL publicou `postgres (PostgreSQL) 17.6`; o engine identifica arquitetura x86_64 em execução no host arm64, portanto não se presume compilação ARM nativa só pelo nome do pacote. Foi lido integralmente `scripts/hydrate-symlinks.js` e seu manifesto antes de executá-lo: apenas links relativos de bibliotecas dentro do diretório temporário, sem download adicional. Nenhum postinstall foi habilitado no projeto. Scripts `initdb/pg_ctl` geram apenas o cluster sintético em diretório criado por `mkdtemp`, com socket Unix 0700, `listen_addresses=''`, sem porta TCP aberta. O cluster da evidência foi parado; arquivos sintéticos/log ficaram no caminho temporário registrado no JSON (não se excluiu dado do usuário).

Referências técnicas consultadas: [Supabase Storage ownership](https://supabase.com/docs/guides/storage/security/ownership), [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html). As skills Supabase/Postgres orientaram privilégio mínimo, identidade em schema privado, indexes de RLS e prova de concorrência real.

## Limites, compatibilidade e liberação futura

- **Não é E2E remoto.** Schema reduzido com definições reais da auditoria; não é restauração integral das 106 tabelas, dos triggers de negócio, Auth, PostgREST e servidor Storage. Não se chamou Supabase remoto, provider, modelo, mensagem, automação ou cliente real. Não houve deploy/push/commit por esta frente.
- O ciclo frontend documentado é upload → chamada para documento → chamada para chunk, em statements sucessivos; T052 reproduz esse contrato. Uma experiência com CTE data-modifying único falhou porque o helper STABLE usa o snapshot do statement; esse CTE não é usado pelos consumers e foi substituído no teste pelo fluxo real, sem alterar a regra de segurança.
- **Mídia legada:** caminhos arbitrários sem vínculo confiável ficam somente dono/configuração. Não se inferiu origem a partir de referência editável pelo cliente em attachments. O caminho canônico `org/leads/uuid/arquivo` habilita carteira, inclusive cortando acesso do antigo proprietário após transferência. Antes de liberar em produção, inventariar os objetos legados e homologar somente associações confiáveis. Não houve migração/movimentação de arquivos.
- Documento explicitamente compartilhado cujo arquivo foi enviado por service role sem `owner_id/owner` fica restrito à configuração, pois não há correspondência confiável uploader→objeto. Isso é fail-closed intencional, não prova de migração de todo legado. Documento textual `team` continua compartilhado.
- `sellers` significa vendedor/SDR, não CX; `team` preserva CX. A configuração administrativa mantém acesso global na empresa ativa. Falhas preexistentes de administração de identidade/convites (R4) não são resolvidas por este lote.
- A barreira no pai pode disparar os triggers existentes de `organizations.updated_at`/auditoria; não muda campos de negócio nem inicia automação. Homologar esses efeitos e os planos dos índices em clone completo antes da publicação. Organizações que já não tenham admin não são automaticamente reparadas; o trigger impede remover um admin ativo existente.
- O fluxo Edge de exclusão de usuário ainda possui outras etapas antes do Auth delete. O banco agora impede perda do último admin na concorrência; não se afirma atomicidade de toda limpeza externa, que pertence à remediação do ciclo de identidade.
- UI atual pode apresentar erro genérico nas negações (por exemplo, repetir `whatsapp` sobre supressão `all` não enfraquece o bloqueio e pode retornar 42501). Não se altera silenciosamente consentimento para fazer a tela parecer bem-sucedida.
- Rollback não deve restaurar policies permissivas amplas. Uma reversão exige migration revisada que preserve a fronteira de acesso; esta migration não exclui dados e não exige restaurar registros.

Aceite R1 local atendido. Liberação pública e correção global do sistema continuam condicionadas aos demais lotes e homologação integrada autorizada.
