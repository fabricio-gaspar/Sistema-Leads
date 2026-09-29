-- Complementa a correção da Central: least(), assim como greatest(), é uma
-- construção nativa do PostgreSQL e não pode ser chamada como pg_catalog.least.

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
  execute replace(definition, 'pg_catalog.least(', 'least(');

  select pg_get_functiondef(
    'public.central_get_conversation_detail(uuid,timestamp with time zone,integer)'::regprocedure
  ) into definition;
  if definition is null then
    raise exception 'central_get_conversation_detail_not_found';
  end if;
  execute replace(definition, 'pg_catalog.least(', 'least(');
end;
$$;

commit;
