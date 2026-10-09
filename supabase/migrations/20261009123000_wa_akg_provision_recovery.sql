-- Close only a WA-AKG provision whose remote result is proven by the Edge
-- function. This is intentionally narrower than generic lifecycle recovery:
-- it never starts a session, creates a QR, changes a webhook, or opens a gate.
create function public.diagnose_wa_akg_provision_recovery(
  p_organization_id uuid,p_account_id uuid,p_provider text,p_actor_id uuid
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare l private.whatsapp_account_lifecycle%rowtype;
begin
  perform private.assert_whatsapp_lifecycle_access(p_organization_id,p_account_id,p_provider,p_actor_id,'manage');
  if p_provider <> 'wa_akg' then raise exception 'wa_akg_provision_recovery_provider_required'; end if;
  select * into l from private.whatsapp_account_lifecycle where account_id=p_account_id;
  return pg_catalog.jsonb_build_object(
    'state',coalesce(l.state,'idle'),'revision',coalesce(l.revision,0),'desired_action',l.desired_action,'error_code',l.error_code,
    'can_reconcile_provision',coalesce(l.state='needs_review' and l.operation_id is not null and l.operation_action='provision'
      and l.error_code='wa_akg_provision_job_complete_failed',false),
    'reason',case
      when l.state='needs_review' and l.operation_id is not null and l.operation_action='provision'
        and l.error_code='wa_akg_provision_job_complete_failed' then 'provision_completion_observed'
      when l.operation_action='provision' then 'external_mutation_terminality_unproven'
      else 'lifecycle_not_recoverable'
    end
  );
end $$;

create function public.reconcile_wa_akg_provision_recovery(
  p_organization_id uuid,p_account_id uuid,p_provider text,p_actor_id uuid,
  p_expected_revision bigint,p_reason text,p_observation jsonb
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare l private.whatsapp_account_lifecycle%rowtype; a public.whatsapp_accounts%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('whatsapp-lifecycle:'||p_organization_id::text,0));
  perform private.assert_whatsapp_lifecycle_access(p_organization_id,p_account_id,p_provider,p_actor_id,'manage');
  if p_provider <> 'wa_akg' then raise exception 'wa_akg_provision_recovery_provider_required'; end if;
  select * into strict a from public.whatsapp_accounts where id=p_account_id and organization_id=p_organization_id and provider='wa_akg' and archived_at is null for update;
  perform 1 from public.integrations where id=a.integration_id and organization_id=p_organization_id for update;
  if not found then raise exception 'account_lifecycle_integration_missing'; end if;
  select * into strict l from private.whatsapp_account_lifecycle where account_id=p_account_id for update;
  if l.revision is distinct from p_expected_revision then raise exception 'account_lifecycle_revision_changed'; end if;
  if l.state<>'needs_review' or l.operation_id is null or l.operation_action<>'provision'
    or l.error_code<>'wa_akg_provision_job_complete_failed' then
    raise exception 'account_lifecycle_terminality_unproven';
  end if;
  if p_reason is null or pg_catalog.length(pg_catalog.btrim(p_reason)) not between 8 and 500
    or p_observation->>'confirmed' is distinct from 'true' or p_observation->>'connected' is distinct from 'false'
    or p_observation->>'state' not in ('SCAN_QR','QR') or p_observation->>'webhook_owned' is distinct from 'true'
    or p_observation->>'safety_confirmed' is distinct from 'true' or nullif(p_observation->>'observed_at','') is null
    or (p_observation->>'observed_at')::timestamptz < pg_catalog.now()-interval '1 minute'
    or (p_observation->>'observed_at')::timestamptz > pg_catalog.now()+interval '5 seconds' then
    raise exception 'account_lifecycle_recovery_evidence_invalid';
  end if;
  update public.integrations set connected=false,enabled=false,paused=true,last_tested_at=pg_catalog.now(),
    status_detail='Provisionamento WA-AKG confirmado por revisão; sessão pronta para pareamento e uso local desativado.',
    last_error=null,last_error_at=null,updated_at=pg_catalog.now()
    where id=a.integration_id and organization_id=p_organization_id;
  update public.whatsapp_accounts set enabled=false,is_default=false,connection_status='qr',status_checked_at=pg_catalog.now(),
    webhook_registered_at=coalesce(webhook_registered_at,pg_catalog.now()),last_error_code=null,updated_at=pg_catalog.now()
    where id=p_account_id and organization_id=p_organization_id;
  update private.whatsapp_account_lifecycle set revision=revision+1,state='completed',desired_action='provision_reconciled_disabled',
    requested_by=p_actor_id,operation_id=null,operation_revision=null,operation_action=null,operation_actor_id=null,operation_started_at=null,
    error_code=null,provisioning_step='reconciled_qr',updated_at=pg_catalog.now() where account_id=p_account_id returning * into l;
  insert into public.audit_logs(organization_id,actor_id,actor_name,actor_type,action,detail,entity_table,entity_id,event_data)
    values(p_organization_id,p_actor_id,'Administrador','user','whatsapp.wa_akg_provision_reconciled',pg_catalog.btrim(p_reason),
      'whatsapp_accounts',p_account_id,pg_catalog.jsonb_build_object('provider','wa_akg','previous_revision',p_expected_revision,
        'revision',l.revision,'session_state',p_observation->>'state','connected',false,'enabled',false));
  return pg_catalog.jsonb_build_object('state',l.state,'revision',l.revision,'desired_action',l.desired_action,'error_code',null);
end $$;

revoke all on function public.diagnose_wa_akg_provision_recovery(uuid,uuid,text,uuid),
  public.reconcile_wa_akg_provision_recovery(uuid,uuid,text,uuid,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.diagnose_wa_akg_provision_recovery(uuid,uuid,text,uuid),
  public.reconcile_wa_akg_provision_recovery(uuid,uuid,text,uuid,bigint,text,jsonb) to service_role;
