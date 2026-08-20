-- 1) Novo estágio sistêmico no enum
ALTER TYPE public.lead_stage ADD VALUE IF NOT EXISTS 'Contatos Perdidos';

-- 2) Campos de fluxo de leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS first_outreach_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_inbound_at timestamptz,
  ADD COLUMN IF NOT EXISTS no_reply_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS conversation_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS no_reply_processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS approach_type text,
  ADD COLUMN IF NOT EXISTS approach_set_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_approach_type_check') THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_approach_type_check
      CHECK (approach_type IS NULL OR approach_type IN ('ia','humano'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_no_reply_deadline
  ON public.leads (no_reply_deadline_at)
  WHERE no_reply_deadline_at IS NOT NULL AND no_reply_processed_at IS NULL;

-- 3) Configuração de fluxo por organização
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS lead_flow jsonb NOT NULL DEFAULT '{}'::jsonb;