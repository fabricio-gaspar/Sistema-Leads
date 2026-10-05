-- Storage objects must be removed through the Storage API. Direct SQL is
-- rejected by Storage's protection trigger, so retaining this helper makes
-- permanent member deletion fail even when the user has no files.
begin;

drop function if exists public.purge_user_owned_storage(uuid);

commit;
