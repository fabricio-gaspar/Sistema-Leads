# Segurança

- Isolamento por `organization_id` e carteira por owner/assigned_to.
- Autorização não usa metadata editável pelo usuário.
- `service_role` e credenciais de provedores nunca saem do backend.
- Updates protegidos exigem `USING` e `WITH CHECK`; funções privilegiadas não ficam públicas
  sem revogação e validação explícita de identidade.
- Opt-out, kill switch, sandbox, modo humano e política de risco são revalidados antes da saída.
