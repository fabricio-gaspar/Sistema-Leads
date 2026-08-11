-- 1. Prevent non-service-role from self-promoting or editing user_roles
-- Service role (admin scripts) can do anything.
-- Authenticated users should not be able to INSERT/UPDATE/DELETE on user_roles at all.
-- They can only SELECT (already defined).

DROP POLICY IF EXISTS "user_roles_admin_only" ON public.user_roles;
-- We rely on the fact that no INSERT/UPDATE policies exist, effectively blocking those operations for 'authenticated'.

-- 2. Refactor profiles RLS to be more robust
DROP POLICY IF EXISTS "profiles_select_org" ON public.profiles;
CREATE POLICY "profiles_select_org" ON public.profiles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur1
    WHERE ur1.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur2
        WHERE ur2.user_id = profiles.id
          AND ur2.organization_id = ur1.organization_id
      )
  )
);

-- Profiles Update: Only self-update or admin
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
