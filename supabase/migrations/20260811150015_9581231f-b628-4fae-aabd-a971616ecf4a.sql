-- Create a migration for fixing RLS policies for multi-tenancy
-- Recreating the schema fix logic properly

-- 1. Profiles: Restricted to organization members
DROP POLICY IF EXISTS "profiles_select_org" ON public.profiles;
CREATE POLICY "profiles_select_org" ON public.profiles
FOR SELECT TO authenticated
USING (
  id IN (
    SELECT user_id FROM public.user_roles 
    WHERE organization_id IN (
      SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  )
);

-- 2. User Roles: Restricted to own organization
DROP POLICY IF EXISTS "user_roles_select_org" ON public.user_roles;
CREATE POLICY "user_roles_select_org" ON public.user_roles
FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

-- 3. Leads: Organization isolation
DROP POLICY IF EXISTS "leads_isolation" ON public.leads;
CREATE POLICY "leads_isolation" ON public.leads
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

-- 4. Company Settings: Organization isolation
DROP POLICY IF EXISTS "company_settings_isolation" ON public.company_settings;
CREATE POLICY "company_settings_isolation" ON public.company_settings
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

-- 5. Appointments, Proposals, Orders, etc. (The remaining tables)
-- We need to ensure organization_id exists on these tables first
DO $$
DECLARE
    t text;
    tables_to_fix text[] := ARRAY[
        'appointments', 'audit_logs', 'contact_suppressions', 'documents', 
        'integrations', 'knowledge_chunks', 'lead_handoffs', 'lead_messages', 
        'lead_sequence_enrollments', 'lead_tasks', 'outreach_jobs', 
        'outreach_sequence_steps', 'outreach_sequences', 'prospecting_cache', 
        'prospecting_schedule_runs', 'prospecting_schedules', 'proposals', 'orders'
    ];
BEGIN
    FOREACH t IN ARRAY tables_to_fix
    LOOP
        -- Ensure column exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'organization_id') THEN
                EXECUTE format('ALTER TABLE public.%I ADD COLUMN organization_id uuid REFERENCES public.organizations(id)', t);
            END IF;

            -- Create Policy
            EXECUTE format('DROP POLICY IF EXISTS %I_isolation ON public.%I', t, t);
            EXECUTE format('CREATE POLICY %I_isolation ON public.%I 
                FOR ALL TO authenticated 
                USING (organization_id IN (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()))
                WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()))', t, t);
        END IF;
    END LOOP;
END $$;

-- 6. Grants
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
