# Banco de dados

- Postgres/Supabase é a fonte da verdade.
- Todas as tabelas públicas precisam de RLS e índices nos filtros/relacionamentos usados.
- Registros operacionais principais: leads, mensagens, execuções, filas, integrações,
  propostas, agenda, tarefas, handoffs, auditoria e base de conhecimento.
- Migrations devem ser versionadas, aplicadas, consultadas e verificadas. DDL local sem
  aplicação não conta como mudança de banco.
- `lead_messages` participa da publicação `supabase_realtime` desde a migration
  `20260911180000_enable_lead_messages_realtime`. O frontend filtra os eventos por organização;
  a mesma RLS que protege a leitura da Central governa a entrega de alterações Postgres.
