# Banco de dados

- Postgres/Supabase é a fonte da verdade.
- Todas as tabelas públicas precisam de RLS e índices nos filtros/relacionamentos usados.
- Registros operacionais principais: leads, mensagens, execuções, filas, integrações,
  propostas, agenda, tarefas, handoffs, auditoria e base de conhecimento.
- Migrations devem ser versionadas, aplicadas, consultadas e verificadas. DDL local sem
  aplicação não conta como mudança de banco.
