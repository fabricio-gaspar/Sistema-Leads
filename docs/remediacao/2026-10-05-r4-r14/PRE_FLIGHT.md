# Continuação autorizada — R4–R14 — 05/10/2026

Autorização direta: “Pode fazer tudo que precisar, voce tem o poder e permisao minha para fazer tudo!”. Continuar os lotes pendentes sem pedir novamente autorização para correções normais. Preservar limites explícitos anteriores: checkout/main existentes, nenhuma mensagem real, automação disparada, modificação de cliente ou publicação indiscriminada. Autoridade ampla não fornece por si só gateway, destinos consentidos ou regras comerciais de SaaS.

Baseline: produto `2a48e6546bcbeef3b935fc5d77cd81c5ac65900d`, fechamento local `aeeb24b2f9970b7b36b32b661c4534a368357662`, GitHub `118b131b47d56cda8615f24b00c332eabe3d2805`; árvores local/remota confirmadas na entrega anterior. 500 testes, 17 smoke e 131 casos SQL, dos quais 24 concorrentes, aprovados. R1/R2/R3 ainda não implantados em produção. Site: última inspeção v168. Arquivos pnpm preexistentes permanecem fora dos commits.

## Requisitos e sequência

| ID | Delta/consumidores | Aceite e limite |
| --- | --- | --- |
| REM-R4 | Convites/vínculos, sessão, papéis e ações administrativas | SQL/handlers com recusa cruzada, convite cancelado/expirado, token antigo; não manipular identidade global de cliente como se fosse vínculo empresarial |
| REM-R5 | AuthContext/stores/cache e consumidores | A→B/organização/logout/duas abas; respostas antigas não expõem nem semeiam dados operacionais |
| REM-R6 | Entrada, leases, retomada e provisionamento manual/automático | Falha por etapa, concorrência e resultado incerto; sem POST cego e sem liberação silenciosa |
| REM-R7 | Contrato e namespace WA-AKG | Testes de contrato local/versionado; gateway externo e QR dependem de infraestrutura/titular |
| REM-R8 | Política comercial, conhecimento e ferramentas Ana | Política canônica consumida; revogação durante operação bloqueia efeito; preço/prazo/ganho humanos |
| REM-R9 | CSV, exportação, Agenda e métricas | Multiline/aspas/BOM/arquivo inválido, fórmula neutralizada no arquivo, duração válida e atomicidade próxima ação; período coerente |
| REM-R10 | Reprodutibilidade complementar | Preservar type-check completo; não confundir migrations locais com remotas |
| REM-R11 | Configuração e diagnóstico | Cidade obrigatória antes de ativação; métricas observadas, não sucesso presumido; recursos Auth dependem do plano |
| REM-R12 | Tooltip/diálogos/CTAs | Escape, foco, conteúdo hoverable e erro acionável; sem alegar WCAG integral por teste unitário |
| REM-R13 | Oferta SaaS | Depende da escolha de produto/regras comerciais; não inventar preços, planos, poder global ou suspensão de empresas |
| REM-R14 | Homologação e release | Suíte integrada e revisão independente; release seletiva só com zero bloqueio no escopo e ambiente/contratos disponíveis |

Risco alto em auth/concorrência. Sequência paralela: segurança R4; frontend R5; mensageria R6/R7; principal R9/R8/R11/R12 e integração. Roteamento recomendado SOL para segurança/concorrência; usar modelo disponível sem alegar troca. Skills Supabase e Postgres aplicadas com privilégios mínimos, transações curtas e provas sintéticas; nenhuma stack nova. Cada lote recebe relatório, testes e checkpoint. Lacuna de infraestrutura/regra não deve impedir correções independentes; impede afirmar homologação completa ou ativar operação.
