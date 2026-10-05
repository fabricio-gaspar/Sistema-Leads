-- Prefer the Evolution GO seller channel only when choosing an account.
-- Existing lead/account bindings are never rewritten by this migration.
-- Guard every source fragment so an unexpected remote function revision fails
-- atomically instead of silently replacing a different access-control path.
do $migration$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(to_regprocedure('public.resolve_lead_whatsapp_account(uuid,uuid)'))
    into v_definition;
  v_old := $old$       case when account.connection_status = 'connected' then 0 else 1 end,
       account.updated_at desc$old$;
  v_new := $new$       case when account.connection_status = 'connected' then 0 else 1 end,
       case when account.provider = 'evolution_go' then 0 else 1 end,
       account.updated_at desc$new$;
  if v_definition is null or length(v_definition) - length(replace(v_definition, v_old, '')) <> length(v_old) then
    raise exception 'resolve_lead_whatsapp_account_source_changed';
  end if;
  execute replace(v_definition, v_old, v_new);

  select pg_get_functiondef(to_regprocedure('public.central_list_transfer_targets(uuid)'))
    into v_definition;
  v_old := $old$       order by candidate.updated_at desc$old$;
  v_new := $new$       order by
         case when candidate.enabled and candidate.connection_status = 'connected' then 0 else 1 end,
         case when candidate.provider = 'evolution_go' then 0 else 1 end,
         candidate.updated_at desc$new$;
  if v_definition is null or length(v_definition) - length(replace(v_definition, v_old, '')) <> length(v_old) then
    raise exception 'central_list_transfer_targets_source_changed';
  end if;
  execute replace(v_definition, v_old, v_new);

  select pg_get_functiondef(to_regprocedure('public.assign_human_handoff(uuid,text,text,uuid)'))
    into v_definition;
  v_old := $old$   order by account.updated_at desc$old$;
  v_new := $new$   order by
     case when account.enabled and account.connection_status = 'connected' then 0 else 1 end,
     case when account.provider = 'evolution_go' then 0 else 1 end,
     account.updated_at desc$new$;
  if v_definition is null or length(v_definition) - length(replace(v_definition, v_old, '')) <> length(v_old) then
    raise exception 'assign_human_handoff_source_changed';
  end if;
  execute replace(v_definition, v_old, v_new);
end;
$migration$;
