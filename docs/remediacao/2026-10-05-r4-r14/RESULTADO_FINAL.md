# Continuação R4–R14 — resultado consolidado

05/10/2026. **Remediação local validada; liberação de produção BLOQUEADA (NO-GO).** Mesmo checkout e branch main. Base local `aeeb24b2f9970b7b36b32b661c4534a368357662`; GitHub inicial `118b131b47d56cda8615f24b00c332eabe3d2805`, com árvore igual à base. Não houve criação de projeto, branch ou worktree.

## Resultado por requisito

Os estados abaixo são do requisito completo, não apenas da existência de código. “Local concluído” não significa implantado nem homologado com serviços reais.

| Requisito | Estado | Entrega e limite remanescente |
|---|---|---|
| R4 — acesso/convites | PARCIAL | Convites revisionados, aceite explícito, papéis e remoção apenas do vínculo implementados e testados. MFA obrigatório real, SMTP/Auth e duas organizações reais ainda não homologados. Ver R4.md. |
| R5 — contexto/cache | PARCIAL | Isolamento por usuário/organização/geração, descarte de respostas antigas e serialização de escritas concluídos localmente. Provas adversariais incluem adapters reais; falta jornada Auth/PostgREST com duas sessões reais. Ver R5.md. |
| R6 — recuperação/filas | PARCIAL | Ledger compartilhado no provisionamento, entrada idempotente, leases, revisão administrativa por GET + CAS e UI explícita concluídos localmente. Resultado de POST incerto não libera repetição cega; gateway real pendente. Ver R6.md. |
| R7 — WA-AKG | BLOQUEADO | Namespace/identidade/credenciais corrigidos; bot não desabilitável no upstream examinado impede conexão segura. Necessários gateway corrigido, versão fixada, hospedagem HTTPS e homologação. VPS sozinho não resolve. Ver R7.md. |
| R8 — Ana/conhecimento | PARCIAL | Política/fonte/documento canônicos, snapshot no dispatcher e revalidação antes de efeitos; template padrão único. Preço, desconto, condições finais e Ganho humanos. Ferramentas externas e recuperação Calendar ainda exigem homologação. Ver R8.md. |
| R9 — CSV/Agenda/métrica | PARCIAL | Parser/exportação, próxima ação atômica com duração/fuso/CAS/RLS e indicador de período concluídos localmente. REST/RLS/trigger reais e outros formulários legados de timezone fora desta prova. Ver R9.md. |
| R10 — reprodutibilidade | PARCIAL | 21 verificações e manifesto estável; divergência de bundles e histórico de migrations identificada, não reconciliada por deploy/replay. Ver R10_R13_R14.md. |
| R11 — configuração/diagnóstico | PARCIAL | Cidade/UF/termo validados na UI, handler e banco; aprovação usa agenda real do run. Métricas observadas com amostra explícita, sem falsa prontidão. Proteção Auth de senhas vazadas ainda advertida pelo advisor. Ver R11.md. |
| R12 — interação/acessibilidade | PARCIAL | Tooltip, foco de diálogo, CSV, recovery e guardas do Wizard corrigidos; 11 provas no Chrome. Não é certificação WCAG nem cobertura completa de todas as telas/leitores. Ver R12.md. |
| R13 — oferta SaaS | BLOQUEADO | Falta decisão de CRM interno versus SaaS e regras de autoridade, planos, suporte e ciclo de clientes. Não foram inventadas regras comerciais. |
| R14 — homologação/release | PARCIAL | Validação local e revisões independentes CONCLUÍDAS. Release BLOQUEADA por infraestrutura/contratos e homologação integrada pendentes. |

## Validação final

Runner `run-checks.mjs`, iniciado em `2026-10-05T23:22:49.320Z`: **21/21 comandos aprovados**, **579 fontes com hashes estáveis**, `changedDuringRun=[]`. Evidência canônica: `checks/results.json`; logs completos `checks/T-CONT-001.txt` a `T-CONT-021.txt`.

- Type-check frontend e todas as Edge Functions; lint src sem warnings; build Vite de produção e artefato Sites local aprovados.
- Vitest: **91 arquivos, 732 testes aprovados, zero falhas** (`checks/vitest.json`). Não somar novamente os testes focados dos relatórios individuais.
- Smoke comercial determinístico: **17/17**.
- SQL: **245 casos sequenciais únicos** e **54 corridas concorrentes reais**, sem somar reexecução do mesmo caso em PGlite e PostgreSQL. R1:65+9; R2:28+6; R3:14+9; R4:47+12; R6:40+9; R9:31+9; R11:20+0. Destes, 279 casos foram exercitados em PostgreSQL nativo; R11 usa PGlite. Esquemas reduzidos e dados sintéticos, não restauração integral de produção.
- Chrome real: **11/11**, zero page errors, perfil temporário e rede bloqueada fora de localhost. Componentes React reais de tooltip/dialog/CSV/recovery com fixtures sintéticas; não é login/E2E de todo o CRM.
- `git diff --check` de fontes/documentação aprovado. No staging, somente os dois logs brutos `checks*/T-CONT-004.txt` foram excluídos dessa regra: o próprio Vitest emitiu espaço no quadro de erro e linhas vazias finais; os bytes originais foram preservados como evidência. Revisão de segredos por padrões não identificou segredo real nos arquivos alterados/evidências; não equivale a certificação de segurança do repositório inteiro.

A primeira rodada permanece em `checks-primeira-rodada/`: 20/21 comandos, Vitest 725/727. Duas expectativas antigas do Evolution GO omitiam o novo campo `confirmed`; foram atualizadas mantendo igualdade exata e adicionando cinco casos de evidência ausente/malformada/desconectada. Não se retirou a guarda do produto para fazer o teste passar. Toda a rodada foi repetida.

Revisões independentes: `REVISAO_R5_R11.md`, `REVISAO_R6_R7.md`, `REVISAO_R8.md`, `REVISAO_R9_MVCC.md`. O contraexemplo RR de Agenda com pais diferentes foi preservado e corrigido por barreira MVCC org/responsável; não se promete exclusividade global para compromissos invisíveis por RLS.

## Estado remoto e segurança operacional

Nenhuma migration, Edge Function, configuração Auth, cron ou publicação do Site foi aplicada neste lote. Nenhum QR, mensagem real, automação, busca paga, callback histórico, dado de cliente ou evento Calendar real foi acionado. Não se afirma que a operação anteriormente habilitada foi desligada. GitHub guarda código/evidências; não é deploy. O workflow GitHub versionado apenas valida, não publica.

Última publicação histórica verificada do Site: **v168**, fonte isolada `87b9b8309eb8fc0fa4d47611c7a1315598fc4f76`, em https://leadai-crm-preview.fabricio926564.chatgpt.site. O Site não foi reinspecionado nesta rodada.

Consultas remotas deste lote foram somente de metadados: schema/grants, bundle ana-operations v5, migrations e advisors. Inventário em `R10_R11_DEPLOYMENT_READONLY.json`: 128 migrations locais e 171 registros remotos, com timestamps históricos divergentes. Isso **não autoriza db push, repair, reset nem replay integral**. Quatro migrations novas permanecem locais.

## Próxima ação exata

1. Obter ambiente de homologação isolado compatível e acesso protegido, identidades e destinos consentidos. Não solicitar senhas/tokens em chat.
2. Corrigir/homologar o contrato WA-AKG de bot desligado antes de hospedar/conectar. Nunca reutilizar a URL Evolution GO como WA-AKG nem gerar QR para testar em clientes.
3. Definir formalmente CRM interno versus SaaS, regras de autoridade/MFA e escopo de homologação.
4. Comparar definições reais e preparar aplicação seletiva coordenada de banco/Edge/frontend, com plano de compensação. R5 depende de R4; Agenda da RPC R9; mensageria de R2/R6; Ana e worker devem usar o mesmo snapshot R8. Não publicar só o frontend novo.
5. Executar jornadas integradas seguras e rever o parecer de release somente após resolver os bloqueios. Reutilizar este baseline; não repetir auditoria completa nem reimplementar deltas já validados.

Commits efetivamente recebidos pelo GitHub serão registrados no checkpoint `.agent/audit-state.json` e na continuidade, após push não forçado e conferência da árvore. Arquivos pnpm preexistentes permanecem fora dos commits.
