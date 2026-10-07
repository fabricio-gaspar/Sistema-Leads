# Índice de evidências

Auditoria WAYFLEX-V3-20261005. Datas/versões/limites em cada arquivo e no relatório. Provas locais não são efeitos em clientes reais.

Na preparação para Git, somente espaços finais e linhas vazias finais dos arquivos de texto foram normalizados. Conteúdo, resultados e números de linha dos trechos foram preservados; o manifesto foi gerado depois dessa formatação. Os hashes de fonte nos probes continuam relativos aos arquivos de produto originais.

| ID / arquivo | Conteúdo / modalidade |
|---|---|
| [baseline-results.json](baseline-results.json) | Sete comandos/exit0 e duração |
| [vitest-baseline.json](vitest-baseline.json) | 77 arquivos/421 testes; resultados individuais |
| T-BASE-001.log a T-BASE-007.log | stdout/stderr: tipos app, tipos Edge selecionados, lint, Vitest, build, artifact, smoke |
| [EV-ENV-001](EV-ENV-001-remote-inventory.json) | Metadados Sitev168/deploy, Supabase, funções/migrations |
| [EV-ENV-002](EV-ENV-002-operational-snapshot.json) | Configuração não secreta agregada e comparação de fontes |
| [EV-ENV-003](EV-ENV-003-queue-health.json) | Cron/HTTP200, seis runs failed, filas WA vazias; somente SELECT |
| [EV-ENV-004](EV-ENV-004-schema-coverage.json) | Índices/catálogo consultados |
| [EV-ENV-005](EV-ENV-005-typecheck-expanded.txt) | Typecheck integral exit2/nove diagnósticos |
| [EV-ENV-006](EV-ENV-006-receipt-sql.json) | SQL inválido/definição implantada; comparação Meta normalizada |
| [EV-ENV-007](EV-ENV-007-schedule-config.json) | Agenda ativa sem cidade obrigatória, sem valores privados |
| [EV-ENV-008](EV-ENV-008-git-baseline.json) | Ref remoto e árvores idênticas no início |
| [EV-LIVE-001](EV-LIVE-001-ui.json) | Cinco casos de UI admin em produção, não mutantes |
| [ui/central-v168-sem-conta.jpg](ui/central-v168-sem-conta.jpg) | Central com canal não provisionado e0 conversas |
| ui/wizard-criterios-{320,390,1024,1440,desktop}.jpg | Capturas responsivas;320 estável substitui frame de transição, não defeito |
| [EV-MSG-001](mensageria/EV-MSG-001-vitest.txt) | Primeira rodada12 casos; preservada, não somar à final |
| [EV-MSG-002](mensageria/EV-MSG-002-vitest-meta.txt) | Rodada final13 casos;1 aprovação/12 reprovações |
| [EV-MSG-003](mensageria/EV-MSG-003-FONTES.md) | Contratos/versionamento upstream/limitações |
| [EV-UI-001](produto/EV-UI-001-probes.json) | 11 probes JS sintéticas;2 aprovações/9 reprovações; hashes fonte |
| [EV-UI-002](produto/EV-UI-002-fontes-estaticas.txt) | Trechos/linhas fonte, não execução operacional |
| [EV-SEC-001](seguranca/EV-SEC-001-politicas-remotas.json) | Catálogo de policies/helpers |
| [EV-SEC-002](seguranca/EV-SEC-002-trigger-remoto.json) | Corpo Auth trigger/papéis remotos |
| [EV-SEC-003](seguranca/EV-SEC-003-rpcs-handoff.json) | Corpos de RPCs, não handoff real |
| [EV-SEC-004](seguranca/EV-SEC-004-provas-rls.json) | 12 provas PostgreSQL WASM locais (4 aprovadas/8 reprovadas) |
| [EV-SEC-005](seguranca/EV-SEC-005-provas-codigo.json) | Quatro assertivas JS reais com transportes simulados, reprovadas |
| [EV-SEC-006](seguranca/EV-SEC-006-inventario-remoto.json) | 106 tabelas/grants/enum e contagens agregadas |
| [EV-SEC-007](seguranca/EV-SEC-007-catalogo-advisors.json) | Catálogo view/buckets/definer/advisor |
| [EV-SEC-008](seguranca/EV-SEC-008-execucao.md) | Reprodução, códigos de saída e suíte focal |
| [Manifesto SHA-256](manifest-sha256.json) | Hash/bytes de documentos e provas; exclui manifesto/resultado verificador/final Git para evitar autorreferência |
| [Verificação dos artefatos](EV-AUDIT-001-verification.json) | JSON/CSV/presença e busca limitada de formatos de segredo, sem valores |

O hash final de salvamento GitHub é comprovado por ls-remote no encerramento da conversa; não é deployment nem hash do produto homologado.

Scripts reproduzíveis: run-baseline.mjs, verify-audit.mjs, mensageria/audit.test.ts+vitest.config.ts, produto/probes-produto.mjs, seguranca/provas-rls.mjs+provas-codigo.mjs. Configuração tsconfig-edge-all.json é apenas instrumento da auditoria.

## Casos de ambiente

- T-ENV-001: consultar versão Site/deploy/Supabase — APROVADO apenas identificação.
- T-ENV-002: cron/heartbeat/HTTP sem browser — APROVADO apenas disparo servidor.
- T-ENV-003: runs/configuração de prospecção — REPROVADO, cidade ausente e erro registrado.
- T-ENV-004: typecheck integral — REPROVADO, nove diagnósticos.
- T-ENV-005: expressão SQL e corpo de recibos — REPROVADO,42883; RPC operacional não executada.
- T-ENV-006: GitHub/local antes da auditoria — APROVADO, tree igual.

Tentativas de consulta com nome de coluna inadequado falharam em leitura e foram corrigidas após schema. Não contam como bugs do produto. Instrumentação inicial corrigida pelos agentes está descrita nos seus relatórios. Nenhuma falha de instrumento foi convertida em aprovação de negócio.
