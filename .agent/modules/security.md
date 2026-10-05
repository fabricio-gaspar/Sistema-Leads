# Segurança

## 05/10/2026 — R4/R5 e revisão independente locais

Convite possui revisão, expiração/cancelamento e aceite por usuário de email confirmado; papéis configurados são validados no backend. Metadata declarativa não concede papel/empresa. Operações sobre senha/identidade global foram removidas da administração de vínculo. MFA de UI não é enforcement Auth; proteção de senha vazada continua aviso remoto. Sessão frontend é cercada por identidade/empresa/geração, sem substituir RLS. Agenda restringe carteira. Nenhuma alteração em Auth/cliente real; ver R4/R5/R9 e revisões em `docs/remediacao/2026-10-05-r4-r14/`.

## 05/10/2026 — Endurecimento local R1/R2/R3, não implantado

Carteira de propostas, proprietário/compartilhamento de documentos/chunks/Storage, proteção de supressão e último admin concorrente corrigidos no escopo R1. R2 separa intenção da conta de gate global administrativo, valida associação/permissão em cada checkpoint e impede retorno obsoleto de reativar flags. R3 revalida organização/conta/provedor antes de conciliar recibos. Revisões independentes e casos negativos/positivos registrados em `docs/remediacao/2026-10-05-r1-r3/`. Convites/MFA/caches e recuperação operacional não foram resolvidos por este lote; NO-GO global permanece.

- Isolamento por `organization_id` e carteira por owner/assigned_to.
- Autorização não usa metadata editável pelo usuário.
- `service_role` e credenciais de provedores nunca saem do backend.
- Updates protegidos exigem `USING` e `WITH CHECK`; funções privilegiadas não ficam públicas
  sem revogação e validação explícita de identidade.
- Opt-out, kill switch, sandbox, modo humano e política de risco são revalidados antes da saída.

## Meta Coexistence — 24/09/2026

- Webhook Meta exige `X-Hub-Signature-256` válido com comparação constante antes de processar.
- Tokens/app secret ficam no Vault/backend; logs e tabelas recebem somente hash, IDs públicos e
  erro sanitizado. O payload integral do webhook não é persistido.
- Feature flag, gates independentes e kill switch começam fechados. Endpoints administrativos
  exigem JWT/permissão; worker exige token interno. Provas sem assinatura/sessão/token retornaram
  401/403 e não criaram eventos, sessão ou outbox.
