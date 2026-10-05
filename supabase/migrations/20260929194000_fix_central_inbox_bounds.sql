-- Corrige a qualificação inválida de greatest() nas funções da Central.
-- PostgreSQL trata greatest como construção nativa; pg_catalog.greatest não
-- existe. A falha acontecia antes de a lista ou o detalhe da conversa lerem
-- qualquer dado, deixando a Central vazia para usuários autenticados.

begin;

do $$
declare
  definition text;
begin
  select pg_get_functiondef(
    'public.central_list_conversations(text,jsonb,integer,integer)'::regprocedure
  ) into definition;

  if definition is null then
    raise exception 'central_list_conversations_not_found';
  end if;

  execute replace(definition, 'pg_catalog.greatest(', 'greatest(');

  select pg_get_functiondef(
    'public.central_get_conversation_detail(uuid,timestamp with time zone,integer)'::regprocedure
  ) into definition;

  if definition is null then
    raise exception 'central_get_conversation_detail_not_found';
  end if;

  execute replace(definition, 'pg_catalog.greatest(', 'greatest(');
end;
$$;

commit;
