alter table public.appointments
  add constraint appointments_time_order_chk check (ends_at > starts_at),
  add constraint appointments_status_chk check (status is null or status in ('scheduled','confirmed','completed','cancelled','no_show','rescheduled','pending'));

alter table public.lead_handoffs
  add constraint lead_handoffs_status_chk check (status is null or status in ('pending','accepted','closed','cancelled','expired')),
  add constraint lead_handoffs_due_order_chk check (due_at is null or due_at >= requested_at);

alter table public.proposals
  add constraint proposals_value_nonnegative_chk check (value is null or value >= 0),
  add constraint proposals_items_array_chk check (items is null or jsonb_typeof(items) = 'array'),
  add constraint proposals_status_chk check (status is null or status in ('pending','draft','rascunho','enviado','sent','visualizado','aprovado','approved','recusado','rejected','cancelled'));
