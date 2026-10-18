create index if not exists prospecting_import_dedupe_keys_lead_id_idx
  on private.prospecting_import_dedupe_keys (lead_id);

create index if not exists prospecting_bulk_import_members_lead_id_idx
  on lead_import_private.prospecting_bulk_import_members (lead_id);
