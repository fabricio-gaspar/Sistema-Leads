-- A self-assumed conversation is already accepted by the current operator.
-- Keeping the handoff as pending made the inbox/detail RPCs report
-- `waiting_human`, which disabled the composer and product sending even
-- though the lead was already in human mode.

create or replace function public.normalize_operator_takeover_handoff_status()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if new.category = 'operator_takeover' and new.status = 'pending' then
    new.status := 'accepted';
  end if;
  return new;
end;
$function$;

drop trigger if exists lead_handoffs_normalize_operator_takeover_status
  on public.lead_handoffs;

create trigger lead_handoffs_normalize_operator_takeover_status
before insert or update of status, category on public.lead_handoffs
for each row
execute function public.normalize_operator_takeover_handoff_status();

-- Repair rows created by the previous function version without touching
-- pending transfers or automatic handoffs.
update public.lead_handoffs as handoff
   set status = 'accepted',
       updated_at = pg_catalog.now()
  from public.leads as lead
 where handoff.lead_id = lead.id
   and handoff.status = 'pending'
   and handoff.category = 'operator_takeover'
   and (pg_catalog.lower(coalesce(lead.modo_atendimento, 'ia')) = 'humano'
        or coalesce(lead.ai_paused, false));

revoke all on function public.normalize_operator_takeover_handoff_status() from public, anon;
grant execute on function public.normalize_operator_takeover_handoff_status() to authenticated, service_role;
