-- The Central calls this predicate under the authenticated role. The predicate
-- still enforces organization, administrator, and seller-account ownership.
grant execute on function private.can_read_wa_akg_central_lead(uuid, uuid, uuid)
  to authenticated;
