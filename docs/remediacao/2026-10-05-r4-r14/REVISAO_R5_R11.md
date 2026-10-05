# Revisão independente — R5 e R11

Data: 2026-10-05. Revisor: frente segurança/acessos. Modalidade: leitura de fonte e testes locais com dependências simuladas. Nenhuma alteração de produto feita nesta revisão; nenhuma consulta ou escrita remota, mensagem, publicação ou chamada de provedor.

## R5 — duas condições de corrida encontradas e corrigidas pelo autor

1. **Atualizações em fila com base obsoleta.** A versão intermediária de `contextStore.ts` calculava o próximo valor antes da execução da fila. Com `optimistic:false`, duas mudanças independentes partiam do mesmo estado: `{a:0,b:0}` virava `{a:1,b:0}`, depois `{a:0,b:1}`. Reproduzido pelo revisor com a fonte real transpilada e dependências locais simuladas. A versão final calcula o updater dentro da fila a partir de `canonical`, confirmado pela operação anterior. Falha incrementa `mutationEpoch`, cancela as intenções dependentes sem executar seus updaters/saves e preserva o erro até refresh explícito. Casos T-R5-034 e T-R5-035 cobrem modo otimista e não otimista.
2. **Sinal de outra aba revivia logout intencional.** Na versão intermediária, `reason:'refresh'` limpava `signedOutIntentionally`. Durante um `signOut` ainda pendente, o SDK ainda podia retornar a sessão antiga e repovoar identidade/organização. Reproduzido com a fonte real transpilada, evento `storage` e SDK local simulado. A versão final preserva o bloqueio de logout no refresh; só uma nova intenção explícita de login/cadastro pode flexibilizá-lo. Caso T-R5-036 cobre o cenário.

Reexecução independente da versão final:

```text
node node_modules/vitest/vitest.mjs run src/lib/authContextObserverR5.test.ts src/lib/contextIsolationR5.test.ts src/hooks/operationalStoresR5.test.ts
3 arquivos aprovados; 41/41 testes aprovados (7 + 30 + 4).
```

Node utilizado: `/Users/fabriciogaspar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`.

Resultado: **APROVADO no escopo local revisado**. Não foi encontrado novo contraexemplo concreto nos dois deltas finais. Isso não prova sincronização entre browsers reais, revogação global de sessão Auth ou homologação multiempresa em produção.

## R11 — coerência entre validação e proteção no banco

Inspecionados `supabase/functions/ana-operations/settings.ts`, os caminhos save/enable/run_now/approve de `ana-operations/index.ts`, `src/lib/crm/anaOperationValidation.ts` e a migration `20261005225107_audit_r11_prospecting_location_guard.sql`.

- Aplicação e SQL concordam no recorte: cidade textual de 2–120 caracteres, exatamente uma UF brasileira válida e ao menos um termo de atividade/segmento de 2–120 caracteres.
- Aprovação consulta o schedule realmente referenciado pela execução, não presume o último schedule da organização.
- O guard de execuções não simuladas valida schedule e organização e adquire `FOR SHARE`; a validação não depende apenas do formulário.
- Configuração inativa e simulação continuam permitidas sem implicar autorização para efeito externo.

Resultado: **APROVADO por revisão de fonte no delta solicitado**, sem contraexemplo bloqueante encontrado. Os testes SQL/handler R11 são responsabilidade da frente autora e dos checks integrados; não foram contados como reexecução desta revisão. Não se afirma validação geográfica cidade↔UF, exclusividade global de configuração ou uso real de fornecedor de leads.

## Limite da conclusão

As skills Supabase/PostgreSQL orientaram a revisão de autoridade canônica, transações e concorrência. Aprovação local não é autorização de deploy e não elimina os bloqueios de homologação registrados nos relatórios dos lotes.
