update public.leads
set contact_approval_status = case when first_inbound_at is not null then 'approved' else 'pending' end,
    contact_approval_reason = case when first_inbound_at is not null
      then 'Contato iniciou uma conversa individual no WhatsApp.'
      else 'Aguardando comprovação de autorização para contato.' end,
    contact_approved_at = case when first_inbound_at is not null
      then coalesce(contact_approved_at, first_inbound_at) else null end,
    automation_status = case when first_inbound_at is null and automation_status = 'running'
      then 'pending_approval' else automation_status end,
    automation_updated_at = now()
where contact_approval_status is null;

alter table public.leads alter column contact_approval_status set default 'pending';
alter table public.leads alter column contact_approval_status set not null;

alter table public.leads drop constraint if exists leads_contact_approval_status_check;
alter table public.leads add constraint leads_contact_approval_status_check
  check (contact_approval_status in ('pending', 'approved', 'rejected'));

alter table public.leads drop constraint if exists leads_contact_approval_evidence_check;
alter table public.leads add constraint leads_contact_approval_evidence_check
  check (contact_approval_status <> 'approved' or contact_approved_at is not null);

create index if not exists leads_org_contact_approval_idx
  on public.leads (organization_id, contact_approval_status, automation_status);

create index if not exists leads_org_deduplication_key_idx
  on public.leads (organization_id, deduplication_key)
  where deduplication_key is not null;
