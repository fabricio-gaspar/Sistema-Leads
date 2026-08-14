-- Security Linter Fixes: Revoke public execute on SECURITY DEFINER functions

-- 1. has_role
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;

-- 2. has_contact_suppression
REVOKE EXECUTE ON FUNCTION public.has_contact_suppression(uuid, text[]) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_contact_suppression(uuid, text[]) TO service_role;

-- 3. clear_contact_suppressions
REVOKE EXECUTE ON FUNCTION public.clear_contact_suppressions(uuid, text[]) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.clear_contact_suppressions(uuid, text[]) TO service_role;

-- 4. set_config (common in Lovable projects, let's secure it if it exists)
DO $$ 
BEGIN
    REVOKE EXECUTE ON FUNCTION public.set_config(text, text, boolean) FROM PUBLIC, authenticated, anon;
    GRANT EXECUTE ON FUNCTION public.set_config(text, text, boolean) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;
