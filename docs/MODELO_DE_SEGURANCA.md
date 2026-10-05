# Modelo de segurança

## Limites de confiança

- O navegador é um cliente não confiável: nunca decide permissão, tenant ou
  envio externo.
- O banco impõe isolamento por `organization_id` via RLS.
- Edge Functions que atendem usuários exigem JWT e verificam a associação do
  usuário com a organização solicitada.
- O webhook é público somente por necessidade do provedor; exige segredo
  compartilhado, conexão identificada e deduplicação por evento. Se o provedor
  não assinar ou não permitir o header configurado, um gateway controlado pela
  empresa deve fazer essa autenticação antes da Edge Function.
- A chave de serviço só existe em Edge Functions e nunca é enviada ao browser.

## Ações sensíveis

| Ação | Quem pode solicitar | Quem executa |
|---|---|---|
| Criar organização | usuário autenticado | RPC transacional |
| Alterar organização e conexões | owner/admin | RLS + Edge Function |
| Criar/editar CRM | owner/admin/manager/seller | RLS |
| Enviar mensagem externa | owner/admin/manager/seller | Edge Function + outbox worker |
| Consultar auditoria | membro ativo | RLS |
| Escrever auditoria/webhooks | somente servidor | service role |

## Regras de operação

1. O modo Demo permanece sem efeitos externos.
2. Sandbox usa conexões separadas e contatos de teste aprovados.
3. Produção só é habilitada depois de RLS, webhook, outbox e testes de
   isolamento aprovados.
4. Qualquer opt-out cancela mensagens futuras antes de o worker enviar.
5. A IA sugere; regras comerciais e handoff humano decidem ações irreversíveis.
