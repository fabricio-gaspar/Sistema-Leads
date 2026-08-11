-- Outreach
CREATE TABLE IF NOT EXISTS public.outreach_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.outreach_sequence_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES public.outreach_sequences(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    channel TEXT NOT NULL,
    content TEXT,
    wait_hours INTEGER DEFAULT 24,
    order_index INTEGER NOT NULL,
    max_attempts INTEGER DEFAULT 1,
    continue_on JSONB DEFAULT '["delivered", "read"]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.lead_sequence_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES public.outreach_sequences(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active',
    current_step_id UUID REFERENCES public.outreach_sequence_steps(id),
    next_run_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(lead_id, sequence_id)
);

-- Audit
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id),
    actor_name TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT,
    rule TEXT,
    occurred_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Knowledge
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    content_text TEXT,
    storage_path TEXT,
    type TEXT,
    size TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    tokens INTEGER,
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Prospecting
CREATE TABLE IF NOT EXISTS public.prospecting_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prospecting_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES auth.users(id),
    filters JSONB NOT NULL,
    quantity INTEGER DEFAULT 10,
    auto_approve_min_score INTEGER DEFAULT 80,
    sequence_id UUID REFERENCES public.outreach_sequences(id),
    assignment_strategy TEXT DEFAULT 'manual',
    daily_cap INTEGER DEFAULT 50,
    monthly_cap INTEGER DEFAULT 500,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prospecting_schedule_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    schedule_id UUID NOT NULL REFERENCES public.prospecting_schedules(id) ON DELETE CASCADE,
    imported_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Appointments & Handoffs
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'scheduled',
    meeting_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_handoffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES auth.users(id),
    to_user_id UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'pending',
    sla_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Suppression
CREATE TABLE IF NOT EXISTS public.contact_suppressions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    contact TEXT NOT NULL,
    contact_hash TEXT NOT NULL,
    channel TEXT NOT NULL,
    reason TEXT,
    lead_id UUID REFERENCES public.leads(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, contact_hash)
);

-- Grants
GRANT ALL ON public.outreach_sequences TO authenticated;
GRANT ALL ON public.outreach_sequences TO service_role;
GRANT ALL ON public.outreach_sequence_steps TO authenticated;
GRANT ALL ON public.outreach_sequence_steps TO service_role;
GRANT ALL ON public.lead_sequence_enrollments TO authenticated;
GRANT ALL ON public.lead_sequence_enrollments TO service_role;
GRANT ALL ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
GRANT ALL ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
GRANT ALL ON public.knowledge_chunks TO authenticated;
GRANT ALL ON public.knowledge_chunks TO service_role;
GRANT ALL ON public.prospecting_cache TO authenticated;
GRANT ALL ON public.prospecting_cache TO service_role;
GRANT ALL ON public.prospecting_schedules TO authenticated;
GRANT ALL ON public.prospecting_schedules TO service_role;
GRANT ALL ON public.prospecting_schedule_runs TO authenticated;
GRANT ALL ON public.prospecting_schedule_runs TO service_role;
GRANT ALL ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
GRANT ALL ON public.lead_handoffs TO authenticated;
GRANT ALL ON public.lead_handoffs TO service_role;
GRANT ALL ON public.contact_suppressions TO authenticated;
GRANT ALL ON public.contact_suppressions TO service_role;
