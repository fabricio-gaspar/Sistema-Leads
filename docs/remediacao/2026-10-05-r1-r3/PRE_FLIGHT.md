# R1/R2/R3 — remediação autorizada em 05/10/2026

Baseline: auditoria V3 de `847048429a86294aa10fa54ffdd750c04447d4fb`; checkpoint local `ef19a6f56438af0064a28fd94dbc97fee447fab4`. Reutilizar as provas históricas sem sobrescrevê-las. Mesmo checkout e branch `main`; sem projeto/branch/worktree novo.

Autorização: “Esta autorizado!” após o plano de remediação. Este lote implementa e valida localmente e salva no GitHub. Não aplica migrations, publica Edge/Site, modifica clientes, opera gateways, reprocessa callbacks nem envia mensagens. A produção já existente não será desligada silenciosamente.

| Requisito | Delta e impacto | Aceite local |
| --- | --- | --- |
| REM-R1 | Carteira de propostas, documentos/chunks/Storage, supressões e último administrador | Negativos e positivos em PostgreSQL isolado; compartilhamento legítimo e upsert preservados |
| REM-R2 | Conta WA/Evolution, corte local antes do gateway, política global separada, revisão/CAS | Falhas de persistência, resposta obsoleta, emergência e permissões; 202/409 não representam sucesso na UI |
| REM-R3 | Parser/dedupe e recibos tardios, SQL válido e escopo por conta | Duplicata e ordem invertida monotônicas; outra org/conta bloqueada; zero despacho Ana/saída |
| REM-VALIDACAO | Cobertura integral de tipos das Edge Functions, correções de imports/declarações | Todos os entrypoints de `supabase/functions/**/*.ts` checados, além de lint/testes/build |

Risco elevado por autorização e concorrência: migrations geradas pelo CLI oficial, execução somente em dados sintéticos, revisão independente antes do GitHub. As alterações de tipo/importação não modificam regras comerciais. Recomendação de roteamento: SOL para segurança/transações; não se afirma troca de modelo.

Fora deste lote: demais R4–R14 (exceto a ampliação técnica de tipos), E2E real, hospedagem WA-AKG, remediação de todas as filas, convite, caches e liberação comercial. Manter NO-GO para publicação/ativação integral até resolver os bloqueadores e homologar.
