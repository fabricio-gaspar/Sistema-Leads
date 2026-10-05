-- O Dashboard acompanha apenas alterações das mensagens da própria organização,
-- sempre sujeitas às políticas RLS já existentes na tabela.
alter publication supabase_realtime add table public.lead_messages;
