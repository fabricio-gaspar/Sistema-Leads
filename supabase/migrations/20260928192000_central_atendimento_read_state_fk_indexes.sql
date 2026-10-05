-- Índices de suporte às referências usadas pela leitura da Central.
create index if not exists conversation_read_states_lead_fk_idx
  on public.conversation_read_states (lead_id);

create index if not exists conversation_read_states_user_fk_idx
  on public.conversation_read_states (user_id);
