# Banco de dados

- `20260925194854_import_prospecting_batch_atomic`: RPC SECURITY INVOKER, apenas `authenticated`, com validação de organização/permissão, lista, leads e membros em transação única e identidade de lote idempotente. Testes SQL em transação revertida confirmaram sucesso, rollback e recusa RBAC sem dados persistidos.

- Postgres/Supabase é a fonte da verdade.
- Todas as tabelas públicas precisam de RLS e índices nos filtros/relacionamentos usados.
- Registros operacionais principais: leads, mensagens, execuções, filas, integrações,
  propostas, agenda, tarefas, handoffs, auditoria e base de conhecimento.
- Migrations devem ser versionadas, aplicadas, consultadas e verificadas. DDL local sem
  aplicação não conta como mudança de banco.
- `lead_messages` participa da publicação `supabase_realtime` desde a migration
  `20260911180000_enable_lead_messages_realtime`. O frontend filtra os eventos por organização;
  a mesma RLS que protege a leitura da Central governa a entrega de alterações Postgres.

- A migration `20260916205958_lead_governance_permissions_and_site_whatsapp` cria RLS para
  `team_member_permissions` e `whatsapp_site_entries`, a matriz privada `has_org_permission`,
  e limita Leads, mensagens e integrações às permissões verificadas. As RPCs administrativas
  continuam somente para service_role; o navegador não pode chamar o purge diretamente.

## Meta Coexistence — 24/09/2026

- Migrations aplicadas: `20260924160000_meta_coexistence_foundation`,
  `20260924161500_meta_coexistence_hardening` e
  `20260924163000_meta_coexistence_message_integrity`.
- Novas tabelas: flags, controles de provedor, sessões de onboarding, conversas, eventos de
  webhook/status, outbox, sync state, templates, rate cards e perfis de roteamento. Tabelas de
  serviço negam acesso direto; leituras administrativas usam RLS por organização/permissão.
- `queue_meta_whatsapp_message` cria mensagem e job atomicamente e por idempotência;
  `apply_meta_message_status` mantém o evento original e só avança o estado materializado quando o
  timestamp/precedência permitir.
