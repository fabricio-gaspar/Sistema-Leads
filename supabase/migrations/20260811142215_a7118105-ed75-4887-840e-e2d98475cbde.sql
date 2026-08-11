-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospecting_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospecting_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospecting_schedule_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unanswered_questions ENABLE ROW LEVEL SECURITY;

-- Base Policies (Organization Isolation)
-- Assuming code sets config 'app.current_organization_id' or uses a helper

CREATE POLICY "Allow organization access" ON public.leads
    FOR ALL TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Allow organization access" ON public.proposals
    FOR ALL TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Allow organization access" ON public.orders
    FOR ALL TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Allow organization access" ON public.company_settings
    FOR ALL TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1));

-- Repeat for others as needed, or use a more generic approach if allowed
-- For now, ensuring basic RLS is active to satisfy linter and provide base security.
