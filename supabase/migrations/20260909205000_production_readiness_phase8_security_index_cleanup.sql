alter function public.normalize_phone_identity(text) set search_path = public, pg_temp;

create index if not exists channel_contact_bindings_lead_id_idx
  on public.channel_contact_bindings(lead_id);
