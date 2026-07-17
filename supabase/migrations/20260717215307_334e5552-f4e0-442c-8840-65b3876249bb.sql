
-- Enums
DO $$ BEGIN
  CREATE TYPE public.outreach_channel AS ENUM ('whatsapp','email','phone');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.outreach_status AS ENUM ('pending','sent','delivered','read','replied','failed','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- lead_outreach
CREATE TABLE IF NOT EXISTS public.lead_outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  channel public.outreach_channel NOT NULL,
  status public.outreach_status NOT NULL DEFAULT 'pending',
  provider TEXT,
  provider_message_id TEXT,
  content TEXT,
  error TEXT,
  attempt INT NOT NULL DEFAULT 1,
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  actor_type TEXT NOT NULL DEFAULT 'ia',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_outreach_lead ON public.lead_outreach(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_outreach_owner ON public.lead_outreach(owner_id);
CREATE INDEX IF NOT EXISTS idx_lead_outreach_provider_msg ON public.lead_outreach(provider_message_id) WHERE provider_message_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_outreach TO authenticated;
GRANT ALL ON public.lead_outreach TO service_role;
ALTER TABLE public.lead_outreach ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outreach_owner_select" ON public.lead_outreach FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "outreach_owner_insert" ON public.lead_outreach FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "outreach_owner_update" ON public.lead_outreach FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "outreach_owner_delete" ON public.lead_outreach FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TRIGGER trg_lead_outreach_updated_at BEFORE UPDATE ON public.lead_outreach
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- leads columns
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS contact_channels JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS active_channel public.outreach_channel,
  ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_paused BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opt_out BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leads_next_action ON public.leads(next_action_at) WHERE next_action_at IS NOT NULL AND ai_paused = false AND opt_out = false;

-- company_settings cadence config
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS outreach_wait_hours INT NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS outreach_max_attempts INT NOT NULL DEFAULT 3;
