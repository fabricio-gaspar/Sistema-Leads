-- Disable generic policies
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "user_roles_select_all" ON public.user_roles;
DROP POLICY IF EXISTS "leads_all_auth" ON public.leads;
DROP POLICY IF EXISTS "company_select_all" ON public.company_settings;
DROP POLICY IF EXISTS "proposals_all_auth" ON public.proposals;
DROP POLICY IF EXISTS "orders_all_auth" ON public.orders;

-- 1. Profiles: Restricted to organization members
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
CREATE POLICY "user_roles_select_org" ON public.user_roles
FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

-- 3. Leads: Organization isolation
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

-- 5. Appointments, Proposals, Orders, etc. (The remaining 21 tables)
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
        EXECUTE format('DROP POLICY IF EXISTS %I_isolation ON public.%I', t, t);
        EXECUTE format('CREATE POLICY %I_isolation ON public.%I 
            FOR ALL TO authenticated 
            USING (organization_id IN (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()))
            WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()))', t, t);
    END LOOP;
END $$;

-- Special case for prospecting_cache which might not have organization_id
-- If it doesn't have it, we keep it restricted to service_role or authenticated reads
CREATE POLICY "prospecting_cache_read" ON public.prospecting_cache
FOR SELECT TO authenticated
USING (true);

-- Ensure service_role has full access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
