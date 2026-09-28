-- Contagens reais dos filtros rápidos da Central. A função reaproveita a
-- consulta paginada e RLS existentes, sem carregar todas as conversas no browser.

begin;

create or replace function public.central_get_inbox_counts(
  p_query text default null,
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb) - 'view';
begin
  return pg_catalog.jsonb_build_object(
    'all', coalesce((public.central_list_conversations(p_query, v_filters || '{"view":"all"}'::jsonb, 1, 0) ->> 'total')::integer, 0),
    'unread', coalesce((public.central_list_conversations(p_query, v_filters || '{"view":"unread"}'::jsonb, 1, 0) ->> 'total')::integer, 0),
    'waiting', coalesce((public.central_list_conversations(p_query, v_filters || '{"view":"waiting"}'::jsonb, 1, 0) ->> 'total')::integer, 0),
    'mine', coalesce((public.central_list_conversations(p_query, v_filters || '{"view":"mine"}'::jsonb, 1, 0) ->> 'total')::integer, 0)
  );
end;
$function$;

revoke all on function public.central_get_inbox_counts(text, jsonb) from public, anon;
grant execute on function public.central_get_inbox_counts(text, jsonb) to authenticated, service_role;

commit;
