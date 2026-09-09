alter table public.proposals
  drop constraint if exists proposals_items_array_chk,
  drop constraint if exists proposals_status_chk;

alter table public.proposals
  add constraint proposals_items_shape_chk
    check (items is null or jsonb_typeof(items) in ('array', 'object')),
  add constraint proposals_status_chk
    check (
      status is null or status in (
        'pending', 'draft', 'rascunho',
        'pending_approval',
        'enviado', 'sent',
        'visualizado', 'viewed',
        'aprovado', 'approved', 'accepted',
        'recusado', 'rejected',
        'expired', 'cancelled', 'archived'
      )
    );
