-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Drop existing types if they exist to avoid conflicts during recreation
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('administrador', 'vendedor', 'ia');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_stage') THEN
        CREATE TYPE public.lead_stage AS ENUM ('Prospecção', 'Qualificado', 'Proposta', 'Negociação', 'Pedido', 'Fechado', 'Perdido');
    END IF;
END $$;

-- 1. Organizations
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT ALL ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2. Profiles (Auth linked)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    avatar TEXT,
    active BOOLEAN DEFAULT true,
    can_use_ia BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. User Roles (Multi-tenant)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL DEFAULT 'vendedor',
    UNIQUE(organization_id, user_id, role)
);
GRANT ALL ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security Definer Functions for RLS
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID AS $$
    SELECT (current_setting('app.current_organization_id', true))::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id 
        AND role::text = _role
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4. Leads
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    company TEXT NOT NULL,
    contact TEXT,
    title TEXT,
    phone TEXT,
    email TEXT,
    whatsapp TEXT,
    segment TEXT,
    uf TEXT,
    distance NUMERIC,
    score INTEGER DEFAULT 0,
    temp TEXT DEFAULT 'cold',
    stage public.lead_stage DEFAULT 'Prospecção',
    value NUMERIC DEFAULT 0,
    owner_id UUID REFERENCES auth.users(id),
    assigned_to UUID REFERENCES auth.users(id),
    stale_hours INTEGER DEFAULT 24,
    escalated BOOLEAN DEFAULT false,
    escalation_reason TEXT,
    sla_info TEXT,
    last_contact TIMESTAMPTZ,
    next_action_at TIMESTAMPTZ,
    lost_reason TEXT,
    origin TEXT,
    annual_revenue TEXT,
    score_snapshot JSONB,
    score_explanation TEXT,
    score_source TEXT,
    score_verified_at TIMESTAMPTZ,
    opt_out BOOLEAN DEFAULT false,
    ai_paused BOOLEAN DEFAULT false,
    contact_channels JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT ALL ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see leads from their organization" 
ON public.leads FOR SELECT TO authenticated 
USING (organization_id = (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Users can insert leads to their organization" 
ON public.leads FOR INSERT TO authenticated 
WITH CHECK (organization_id = (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1));

-- 5. Company Settings
CREATE TABLE IF NOT EXISTS public.company_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID UNIQUE NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT,
    description TEXT,
    tone_of_voice TEXT,
    differentiators TEXT,
    ai_prompt TEXT,
    ai_model TEXT DEFAULT 'claude-sonnet-4-5-20250929',
    ai_temperature NUMERIC DEFAULT 0.7,
    ai_max_tokens INTEGER DEFAULT 1000,
    active BOOLEAN DEFAULT true,
    can_use_ia BOOLEAN DEFAULT true,
    assignment_strategy TEXT DEFAULT 'manual',
    handoff_sla_minutes INTEGER DEFAULT 60,
    handoff_readiness_score INTEGER DEFAULT 70,
    nurture_days INTEGER DEFAULT 7,
    nurture_max_cycles INTEGER DEFAULT 3,
    autonomy JSONB DEFAULT '{}'::jsonb,
    outreach_wait_hours INTEGER DEFAULT 24,
    outreach_max_attempts INTEGER DEFAULT 3,
    prospecting_sources JSONB DEFAULT '{"cnpj_ws": true, "google_places": true}'::jsonb,
    sandbox_mode BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT ALL ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- 6. Outreach Sequences
CREATE TABLE IF NOT EXISTS public.outreach_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
GRANT ALL ON public.outreach_sequences TO authenticated;
GRANT ALL ON public.outreach_sequences TO service_role;
ALTER TABLE public.outreach_sequences ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.outreach_sequence_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES public.outreach_sequences(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- whatsapp, email, phone
    channel TEXT NOT NULL,
    content TEXT,
    wait_hours INTEGER DEFAULT 24,
    order_index INTEGER NOT NULL,
    max_attempts INTEGER DEFAULT 1,
    continue_on JSONB DEFAULT '["delivered", "read"]'::jsonb
);
GRANT ALL ON public.outreach_sequence_steps TO authenticated;
GRANT ALL ON public.outreach_sequence_steps TO service_role;
ALTER TABLE public.outreach_sequence_steps ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.lead_sequence_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES public.outreach_sequences(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active', -- active, paused, completed, cancelled
    current_step_id UUID REFERENCES public.outreach_sequence_steps(id),
    next_run_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(lead_id, sequence_id)
);
GRANT ALL ON public.lead_sequence_enrollments TO authenticated;
GRANT ALL ON public.lead_sequence_enrollments TO service_role;
ALTER TABLE public.lead_sequence_enrollments ENABLE ROW LEVEL SECURITY;

-- 7. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id),
    actor_name TEXT NOT NULL,
    actor_type TEXT NOT NULL, -- human, ia, system
    action TEXT NOT NULL,
    detail TEXT,
    rule TEXT,
    occurred_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);
GRANT ALL ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 8. Knowledge Base
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
GRANT ALL ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    tokens INTEGER,
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active', -- active, stale
    created_at TIMESTAMPTZ DEFAULT now()
);
GRANT ALL ON public.knowledge_chunks TO authenticated;
GRANT ALL ON public.knowledge_chunks TO service_role;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- 9. Prospecting
CREATE TABLE IF NOT EXISTS public.prospecting_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
GRANT ALL ON public.prospecting_cache TO authenticated;
GRANT ALL ON public.prospecting_cache TO service_role;
ALTER TABLE public.prospecting_cache ENABLE ROW LEVEL SECURITY;

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
GRANT ALL ON public.prospecting_schedules TO authenticated;
GRANT ALL ON public.prospecting_schedules TO service_role;
ALTER TABLE public.prospecting_schedules ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.prospecting_schedule_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    schedule_id UUID NOT NULL REFERENCES public.prospecting_schedules(id) ON DELETE CASCADE,
    imported_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
GRANT ALL ON public.prospecting_schedule_runs TO authenticated;
GRANT ALL ON public.prospecting_schedule_runs TO service_role;
ALTER TABLE public.prospecting_schedule_runs ENABLE ROW LEVEL SECURITY;

-- 10. Appointments & Handoffs
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
GRANT ALL ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

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
GRANT ALL ON public.lead_handoffs TO authenticated;
GRANT ALL ON public.lead_handoffs TO service_role;
ALTER TABLE public.lead_handoffs ENABLE ROW LEVEL SECURITY;

-- 11. Contact Suppression
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
GRANT ALL ON public.contact_suppressions TO authenticated;
GRANT ALL ON public.contact_suppressions TO service_role;
ALTER TABLE public.contact_suppressions ENABLE ROW LEVEL SECURITY;

-- Functions for automation triggers
CREATE OR REPLACE FUNCTION public.runScheduledProspecting()
RETURNS VOID AS $$
BEGIN
    -- This would be called by pg_cron to trigger a serverless function via webhook
    -- Logic resides in the app code, this is just a placeholder to ensure the schedule exists
    PERFORM 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Suppression helper functions used by code
CREATE OR REPLACE FUNCTION public.has_contact_suppression(_lead_id UUID, _hashes TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.contact_suppressions 
        WHERE (lead_id = _lead_id OR contact_hash = ANY(_hashes))
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.clear_contact_suppressions(_lead_id UUID, _hashes TEXT[])
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.contact_suppressions 
    WHERE lead_id = _lead_id OR contact_hash = ANY(_hashes);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_company_settings_updated_at BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
