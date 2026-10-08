-- A failed disconnect remains unsafe to retry.  It can be closed only when a
-- fresh provider GET proves the very same session is still confirmed+connected.
-- This keeps the account disabled and writes an administrator audit event.
create or replace function public.diagnose_whatsapp_account_lifecycle(p_organization_id uuid,p_account_id uuid,p_provider text,p_actor_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare l private.whatsapp_account_lifecycle%rowtype;
begin
  perform private.assert_whatsapp_lifecycle_access(p_organization_id,p_account_id,p_provider,p_actor_id,'manage');
  select * into l from private.whatsapp_account_lifecycle where account_id=p_account_id;
  return pg_catalog.jsonb_build_object('state',coalesce(l.state,'idle'),'revision',coalesce(l.revision,0),
    'desired_action',l.desired_action,'operation_action',l.operation_action,'error_code',l.error_code,
    'can_reconcile_read_only',coalesce(l.operation_id is not null and l.operation_action in ('activate','refresh_status'),false),
    'can_reconcile_if_connected',coalesce(l.operation_id is not null and l.operation_action='disconnect',false),
    'reason',case when l.operation_id is null then 'no_pending_operation' when l.operation_action in ('activate','refresh_status') then 'read_only_operation'
      when l.operation_action='disconnect' then 'disconnect_requires_connected_proof' else 'external_mutation_terminality_unproven' end);
end $$;

create or replace function public.reconcile_whatsapp_account_lifecycle(p_organization_id uuid,p_account_id uuid,p_provider text,p_actor_id uuid,
  p_expected_revision bigint,p_reason text,p_observation jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare l private.whatsapp_account_lifecycle%rowtype; a public.whatsapp_accounts%rowtype; v_connected boolean; v_preserved_disconnect boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('whatsapp-lifecycle:'||p_organization_id::text,0));
  perform private.assert_whatsapp_lifecycle_access(p_organization_id,p_account_id,p_provider,p_actor_id,'manage');
  select * into strict a from public.whatsapp_accounts where id=p_account_id for update;
  perform 1 from public.integrations where id=a.integration_id and organization_id=p_organization_id for update;
  select * into strict l from private.whatsapp_account_lifecycle where account_id=p_account_id for update;
  if l.revision is distinct from p_expected_revision then raise exception 'account_lifecycle_revision_changed'; end if;
  if p_reason is null or pg_catalog.length(pg_catalog.btrim(p_reason)) not between 8 and 500
    or p_observation->>'confirmed' is distinct from 'true' or pg_catalog.jsonb_typeof(p_observation->'connected') is distinct from 'boolean'
    or nullif(p_observation->>'observed_at','') is null
    or (p_observation->>'observed_at')::timestamptz < pg_catalog.now()-interval '1 minute'
    or (p_observation->>'observed_at')::timestamptz > pg_catalog.now()+interval '5 seconds' then
    raise exception 'account_lifecycle_recovery_evidence_invalid'; end if;
  v_connected := (p_observation->>'connected')::boolean;
  v_preserved_disconnect := l.operation_id is not null and l.operation_action='disconnect' and v_connected;
  if l.operation_id is null or l.operation_action is null
    or (l.operation_action not in ('activate','refresh_status') and not v_preserved_disconnect) then
    raise exception 'account_lifecycle_terminality_unproven'; end if;
  update public.integrations set enabled=false,paused=true,connected=v_connected,last_tested_at=pg_catalog.now(),
    status_detail=case when v_preserved_disconnect then 'Desligamento anterior não foi aplicado; sessão confirmada preservada. Uso local permanece desativado.'
      else 'Operação de leitura reconciliada por administrador; uso local permanece desativado.' end,updated_at=pg_catalog.now()
    where id=a.integration_id and organization_id=p_organization_id;
  update public.whatsapp_accounts set enabled=false,is_default=false,connection_status=case when v_connected then 'connected' else 'disconnected' end,
    status_checked_at=pg_catalog.now(),updated_at=pg_catalog.now() where id=p_account_id;
  update private.whatsapp_account_lifecycle set revision=revision+1,state='completed',desired_action='reconciled_disabled',requested_by=p_actor_id,
    operation_id=null,operation_revision=null,operation_action=null,operation_actor_id=null,operation_started_at=null,error_code=null,updated_at=pg_catalog.now()
    where account_id=p_account_id returning * into l;
  insert into public.audit_logs(organization_id,actor_id,actor_name,actor_type,action,detail,entity_table,entity_id,event_data)
    values(p_organization_id,p_actor_id,'Administrador','user',case when v_preserved_disconnect then 'whatsapp.account_disconnect_preserved_reconciled' else 'whatsapp.account_read_only_reconciled' end,pg_catalog.btrim(p_reason),
      'whatsapp_accounts',p_account_id,pg_catalog.jsonb_build_object('provider',p_provider,'previous_revision',p_expected_revision,'revision',l.revision,
      'connected_observed',v_connected,'observed_at',p_observation->>'observed_at','enabled',false,'preserved_disconnect',v_preserved_disconnect));
  return pg_catalog.jsonb_build_object('state',l.state,'revision',l.revision,'desired_action',l.desired_action,'error_code',null);
end $$;
