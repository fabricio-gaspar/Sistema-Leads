-- Evolução comercial sobre a cadência configurável já criada pelo Lovable.
ALTER TABLE public.outreach_sequence_steps
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 1
    CHECK (max_attempts BETWEEN 1 AND 10);

ALTER TABLE public.lead_sequence_enrollments
  ADD COLUMN IF NOT EXISTS next_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

CREATE INDEX IF NOT EXISTS lead_sequence_due_idx
  ON public.lead_sequence_enrollments(status, next_run_at)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.lead_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  intent text,
  service_interest text,
  pain text,
  urgency text,
  budget_range text,
  decision_maker text,
  objections jsonb NOT NULL DEFAULT '[]'::jsonb,
  sentiment text,
  next_action text,
  summary text,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  readiness_score integer CHECK (readiness_score BETWEEN 0 AND 100),
  updated_by text NOT NULL DEFAULT 'ia' CHECK (updated_by IN ('ia','human','system')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  reason text NOT NULL,
  category text NOT NULL DEFAULT 'geral',
  summary text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','closed','cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  accepted_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lead_handoffs_one_open_idx
  ON public.lead_handoffs(lead_id) WHERE status IN ('pending','accepted');
CREATE INDEX IF NOT EXISTS lead_handoffs_queue_idx
  ON public.lead_handoffs(status, due_at, assigned_to);

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  origin text NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual','ia','external')),
  provider text,
  external_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointments_owner_date_idx ON public.appointments(owner_id, starts_at);
CREATE INDEX IF NOT EXISTS appointments_lead_date_idx ON public.appointments(lead_id, starts_at DESC);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS score_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS score_explanation text,
  ADD COLUMN IF NOT EXISTS score_source text,
  ADD COLUMN IF NOT EXISTS score_verified_at timestamptz;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS assignment_strategy text NOT NULL DEFAULT 'manual'
    CHECK (assignment_strategy IN ('manual','round_robin','least_loaded')),
  ADD COLUMN IF NOT EXISTS handoff_sla_minutes integer NOT NULL DEFAULT 30
    CHECK (handoff_sla_minutes BETWEEN 5 AND 1440),
  ADD COLUMN IF NOT EXISTS handoff_readiness_score integer NOT NULL DEFAULT 70
    CHECK (handoff_readiness_score BETWEEN 0 AND 100);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_sequences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_sequence_steps TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.lead_sequence_enrollments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.lead_qualifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.lead_handoffs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.lead_qualifications, public.lead_handoffs, public.appointments TO service_role;

ALTER TABLE public.lead_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS enrollments_write ON public.lead_sequence_enrollments;
CREATE POLICY enrollments_write ON public.lead_sequence_enrollments
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.leads l WHERE l.id = lead_id AND
      (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.leads l WHERE l.id = lead_id AND
      (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))
  ));

DROP POLICY IF EXISTS lead_qualifications_scope ON public.lead_qualifications;
CREATE POLICY lead_qualifications_scope ON public.lead_qualifications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND
    (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND
    (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))));

DROP POLICY IF EXISTS lead_handoffs_scope ON public.lead_handoffs;
CREATE POLICY lead_handoffs_scope ON public.lead_handoffs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND
    (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND
    (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))));

DROP POLICY IF EXISTS appointments_scope ON public.appointments;
CREATE POLICY appointments_scope ON public.appointments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND
    (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND
    (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))));

DROP TRIGGER IF EXISTS trg_lead_qualifications_updated_at ON public.lead_qualifications;
CREATE TRIGGER trg_lead_qualifications_updated_at BEFORE UPDATE ON public.lead_qualifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_lead_handoffs_updated_at ON public.lead_handoffs;
CREATE TRIGGER trg_lead_handoffs_updated_at BEFORE UPDATE ON public.lead_handoffs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.has_contact_suppression(_lead_id uuid, _hashes text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role'
      OR (_lead_id IS NULL AND auth.uid() IS NOT NULL)
      OR public.has_role(auth.uid(), 'administrador')
      OR EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = _lead_id
          AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid())
      )
    THEN EXISTS (
      SELECT 1 FROM public.contact_suppressions
      WHERE contact_hash = ANY(COALESCE(_hashes, ARRAY[]::text[]))
    )
    ELSE true
  END;
$$;

CREATE OR REPLACE FUNCTION public.clear_contact_suppressions(_lead_id uuid, _hashes text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed integer := 0;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'administrador') OR
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = _lead_id
        AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid())
    )
  ) THEN
    RAISE EXCEPTION 'Acesso negado para reativar este contato';
  END IF;

  DELETE FROM public.contact_suppressions
  WHERE contact_hash = ANY(COALESCE(_hashes, ARRAY[]::text[]));
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.has_contact_suppression(uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_contact_suppressions(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_contact_suppression(uuid, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clear_contact_suppressions(uuid, text[]) TO authenticated, service_role;