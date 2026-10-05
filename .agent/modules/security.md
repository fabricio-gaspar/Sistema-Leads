# Segurança

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
