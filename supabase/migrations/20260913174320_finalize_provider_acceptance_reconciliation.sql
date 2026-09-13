begin;

create or replace function public.reconcile_provider_accepted_outreach(
  p_organization_id uuid,
  p_limit integer default 100
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_job public.outreach_jobs%rowtype;
  v_message_id uuid;
  v_reconciled integer := 0;
  v_sent_at timestamptz;
begin
  if p_organization_id is null then
    raise exception 'organization_required';
  end if;

  for v_job in
    select j.*
      from public.outreach_jobs as j
      join public.lead_outreach as o
        on o.id = j.id
       and o.organization_id = j.organization_id
       and o.lead_id = j.lead_id
     where j.organization_id = p_organization_id
       and j.status = 'reconciliation_required'
       and j.error = 'provider_accepted_reconciliation_required'
       and nullif(pg_catalog.btrim(j.payload ->> 'provider_message_id'), '') is not null
       and o.status = 'pending'
       and o.provider_message_id = j.payload ->> 'provider_message_id'
     order by j.run_at, j.id
     limit least(greatest(coalesce(p_limit, 100), 1), 500)
     for update of j, o skip locked
  loop
    v_sent_at := coalesce(v_job.processed_at, v_job.run_at, pg_catalog.now());
    v_message_id := null;

    select case
             when (o.metadata ->> 'message_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
             then (o.metadata ->> 'message_id')::uuid
             else null
           end
      into v_message_id
      from public.lead_outreach as o
     where o.id = v_job.id
       and o.organization_id = p_organization_id
     for update;

    update public.lead_outreach as o
       set status = 'sent',
           sent_at = coalesce(o.sent_at, v_sent_at),
           error = null,
           updated_at = pg_catalog.now()
     where o.id = v_job.id
       and o.organization_id = p_organization_id
       and o.status = 'pending'
       and o.provider_message_id = v_job.payload ->> 'provider_message_id';
    if not found then
      continue;
    end if;

    if v_message_id is not null then
      update public.lead_messages as m
         set type = 'sent',
             sent_at = coalesce(m.sent_at, v_sent_at),
             provider_message_id = coalesce(
               m.provider_message_id,
               v_job.payload ->> 'provider_message_id'
             )
       where m.id = v_message_id
         and m.organization_id = p_organization_id
         and m.lead_id = v_job.lead_id
         and m.type in ('draft', 'queued', 'reconciliation_required')
         and (
           m.provider_message_id is null
           or m.provider_message_id = v_job.payload ->> 'provider_message_id'
         );
    end if;

    update public.outreach_jobs as j
       set status = 'processed',
           processed_at = coalesce(j.processed_at, v_sent_at),
           locked_at = null,
           locked_by = null,
           error = null
     where j.id = v_job.id
       and j.organization_id = p_organization_id
       and j.status = 'reconciliation_required';

    v_reconciled := v_reconciled + 1;
  end loop;

  return v_reconciled;
end;
$function$;

revoke all on function public.reconcile_provider_accepted_outreach(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.reconcile_provider_accepted_outreach(uuid, integer)
  to service_role;

commit;
