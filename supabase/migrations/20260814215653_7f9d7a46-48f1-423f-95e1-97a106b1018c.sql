-- Security Linter Fix: Set search_path for mutable functions

ALTER FUNCTION public.current_org_id() SET search_path = public;
