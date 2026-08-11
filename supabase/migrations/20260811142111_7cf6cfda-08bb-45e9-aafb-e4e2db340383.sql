-- CRM Extras
CREATE TABLE IF NOT EXISTS public.proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    number TEXT NOT NULL,
    lead_id UUID REFERENCES public.leads(id),
    client TEXT NOT NULL,
    items JSONB DEFAULT '[]'::jsonb,
    value NUMERIC DEFAULT 0,
    discount TEXT,
    creator TEXT NOT NULL,
    creator_name TEXT,
    owner_id UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'pending',
    need_approval BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    number TEXT NOT NULL,
    lead_id UUID REFERENCES public.leads(id),
    proposal_id UUID REFERENCES public.proposals(id),
    company TEXT NOT NULL,
    seller_name TEXT,
    seller_type TEXT,
    order_date TIMESTAMPTZ DEFAULT now(),
    items JSONB DEFAULT '[]'::jsonb,
    value NUMERIC DEFAULT 0,
    payment TEXT,
    contract_status TEXT,
    status TEXT DEFAULT 'pending',
    owner_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    sender TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    type TEXT NOT NULL,
    text TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    due_at TIMESTAMPTZ,
    owner_id UUID REFERENCES auth.users(id),
    owner_label TEXT,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Analytics & Weights
CREATE TABLE IF NOT EXISTS public.score_weights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    segment INTEGER DEFAULT 20,
    whatsapp INTEGER DEFAULT 20,
    site INTEGER DEFAULT 10,
    porte INTEGER DEFAULT 20,
    google INTEGER DEFAULT 15,
    regiao INTEGER DEFAULT 15,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id)
);

CREATE TABLE IF NOT EXISTS public.integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    label TEXT NOT NULL,
    connected BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, key)
);

-- Outreach Jobs & Extra Tasks
CREATE TABLE IF NOT EXISTS public.outreach_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    attempt INTEGER DEFAULT 1,
    run_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'queued',
    locked_at TIMESTAMPTZ,
    locked_by TEXT,
    processed_at TIMESTAMPTZ,
    error TEXT,
    payload JSONB,
    idempotency_key TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS public.unanswered_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Grants
GRANT ALL ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;
GRANT ALL ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.lead_messages TO authenticated;
GRANT ALL ON public.lead_messages TO service_role;
GRANT ALL ON public.lead_tasks TO authenticated;
GRANT ALL ON public.lead_tasks TO service_role;
GRANT ALL ON public.score_weights TO authenticated;
GRANT ALL ON public.score_weights TO service_role;
GRANT ALL ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
GRANT ALL ON public.outreach_jobs TO authenticated;
GRANT ALL ON public.outreach_jobs TO service_role;
GRANT ALL ON public.unanswered_questions TO authenticated;
GRANT ALL ON public.unanswered_questions TO service_role;
