create or replace function public.resolve_whatsapp_lead(p_organization_id uuid, p_phone text)
returns table(lead_id uuid, reason text)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  identity_value text;
  bound_lead uuid;
  candidate_lead uuid;
  candidate_count integer;
  active_ai_count integer;
  active_ai_lead uuid;
begin
  identity_value := public.normalize_phone_identity(p_phone);
  if identity_value is null then
    return query select null::uuid, 'invalid_phone'::text;
    return;
  end if;

  select b.lead_id
    into bound_lead
    from public.channel_contact_bindings b
    join public.leads l on l.id = b.lead_id and l.organization_id = b.organization_id
   where b.organization_id = p_organization_id
     and b.channel = 'whatsapp'
     and b.contact_identity = identity_value
     and (l.whatsapp_identity = identity_value or l.phone_identity = identity_value)
   limit 1;

  if bound_lead is not null then
    return query select bound_lead, 'active_binding'::text;
    return;
  end if;

  select count(*)::int
    into candidate_count
    from public.leads l
   where l.organization_id = p_organization_id
     and (l.whatsapp_identity = identity_value or l.phone_identity = identity_value);

  if candidate_count = 1 then
    select l.id into candidate_lead
      from public.leads l
     where l.organization_id = p_organization_id
       and (l.whatsapp_identity = identity_value or l.phone_identity = identity_value)
     limit 1;
    return query select candidate_lead, 'unique_identity'::text;
    return;
  end if;

  if candidate_count > 1 then
    select count(*)::int
      into active_ai_count
      from public.leads l
     where l.organization_id = p_organization_id
       and (l.whatsapp_identity = identity_value or l.phone_identity = identity_value)
       and l.modo_atendimento = 'ia'
       and l.ai_paused = false
       and l.opt_out = false;

    if active_ai_count = 1 then
      select l.id into active_ai_lead
        from public.leads l
       where l.organization_id = p_organization_id
         and (l.whatsapp_identity = identity_value or l.phone_identity = identity_value)
         and l.modo_atendimento = 'ia'
         and l.ai_paused = false
         and l.opt_out = false
       limit 1;
      return query select active_ai_lead, 'unique_active_ai_conversation'::text;
      return;
    end if;

    return query select null::uuid, 'ambiguous_identity'::text;
    return;
  end if;

  return query select null::uuid, 'not_found'::text;
end;
$$;

revoke all on function public.resolve_whatsapp_lead(uuid,text) from public, anon, authenticated;
grant execute on function public.resolve_whatsapp_lead(uuid,text) to service_role;
