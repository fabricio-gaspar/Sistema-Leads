-- Rbac admin security and profile isolation

-- 1. Refactor profiles RLS to be more robust
DROP POLICY IF EXISTS "profiles_select_org" ON public.profiles;
CREATE POLICY "profiles_select_org" ON public.profiles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur1
    WHERE ur1.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur2
        WHERE ur2.user_id = public.profiles.id
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

-- 2. Organizations: Ensure user can only see their own organization
DROP POLICY IF EXISTS "organizations_isolation" ON public.organizations;
CREATE POLICY "organizations_isolation" ON public.organizations
FOR SELECT TO authenticated
USING (
  id IN (
    SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

-- 3. Lead sequence enrollments: Ensure organization_id is populated and isolation is active
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lead_sequence_enrollments' AND column_name = 'organization_id') THEN
        ALTER TABLE public.lead_sequence_enrollments ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
    END IF;
END $$;

DROP POLICY IF EXISTS "lead_sequence_enrollments_isolation" ON public.lead_sequence_enrollments;
CREATE POLICY "lead_sequence_enrollments_isolation" ON public.lead_sequence_enrollments
FOR ALL TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.organizations TO service_role;
GRANT ALL ON public.lead_sequence_enrollments TO service_role;

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.organizations TO authenticated;
GRANT ALL ON public.lead_sequence_enrollments TO authenticated;
