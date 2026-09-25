-- Validate the owner before the existing identity sync trigger writes CRM account/contact rows.
alter trigger z_validate_active_lead_assignee on public.leads
  rename to a_validate_active_lead_assignee;
