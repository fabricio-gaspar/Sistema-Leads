-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Create Types
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('administrador', 'vendedor', 'ia');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_stage') THEN
        CREATE TYPE public.lead_stage AS ENUM ('Prospecção', 'Qualificado', 'Proposta', 'Negociação', 'Pedido', 'Fechado', 'Perdido');
    END IF;
END $$;

-- Create Tables
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL DEFAULT 'vendedor',
    UNIQUE(organization_id, user_id, role)
);

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

-- Grant Access
GRANT ALL ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
GRANT ALL ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
