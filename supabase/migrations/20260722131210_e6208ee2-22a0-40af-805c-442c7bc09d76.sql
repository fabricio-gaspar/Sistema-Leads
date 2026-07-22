-- Phase B — Configurable outreach sequences (additive, non-destructive)

-- 1) Enums (idempotent)
DO $$ BEGIN
  CREATE TYPE public.sequence_step_channel AS ENUM ('whatsapp','email','phone');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.enrollment_status AS ENUM ('active','paused','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) outreach_sequences
CREATE TABLE IF NOT EXISTS public.outreach_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.outreach_sequences TO authenticated;
GRANT ALL ON public.outreach_sequences TO service_role;
ALTER TABLE public.outreach_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outreach_sequences_select ON public.outreach_sequences;
CREATE POLICY outreach_sequences_select ON public.outreach_sequences
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS outreach_sequences_admin_write ON public.outreach_sequences;
CREATE POLICY outreach_sequences_admin_write ON public.outreach_sequences
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));
CREATE UNIQUE INDEX IF NOT EXISTS outreach_sequences_single_default
  ON public.outreach_sequences(is_default) WHERE is_default = true;
DROP TRIGGER IF EXISTS trg_outreach_sequences_updated_at ON public.outreach_sequences;
CREATE TRIGGER trg_outreach_sequences_updated_at
  BEFORE UPDATE ON public.outreach_sequences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) outreach_sequence_steps
CREATE TABLE IF NOT EXISTS public.outreach_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES public.outreach_sequences(id) ON DELETE CASCADE,
  order_index int NOT NULL,
  channel public.sequence_step_channel NOT NULL,
  delay_minutes int NOT NULL DEFAULT 1440 CHECK (delay_minutes >= 0),
  template text,
  continue_on jsonb NOT NULL DEFAULT '["failed","skipped"]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sequence_id, order_index)
);
GRANT SELECT ON public.outreach_sequence_steps TO authenticated;
GRANT ALL ON public.outreach_sequence_steps TO service_role;
ALTER TABLE public.outreach_sequence_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outreach_sequence_steps_select ON public.outreach_sequence_steps;
CREATE POLICY outreach_sequence_steps_select ON public.outreach_sequence_steps
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS outreach_sequence_steps_admin_write ON public.outreach_sequence_steps;
CREATE POLICY outreach_sequence_steps_admin_write ON public.outreach_sequence_steps
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));
CREATE INDEX IF NOT EXISTS idx_seq_steps_seq
  ON public.outreach_sequence_steps(sequence_id, order_index);
DROP TRIGGER IF EXISTS trg_seq_steps_updated_at ON public.outreach_sequence_steps;
CREATE TRIGGER trg_seq_steps_updated_at
  BEFORE UPDATE ON public.outreach_sequence_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) lead_sequence_enrollments
CREATE TABLE IF NOT EXISTS public.lead_sequence_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  sequence_id uuid NOT NULL REFERENCES public.outreach_sequences(id) ON DELETE RESTRICT,
  current_step_index int NOT NULL DEFAULT 0,
  status public.enrollment_status NOT NULL DEFAULT 'active',
  pause_reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_step_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lead_sequence_enrollments TO authenticated;
GRANT ALL ON public.lead_sequence_enrollments TO service_role;
ALTER TABLE public.lead_sequence_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS enrollments_select ON public.lead_sequence_enrollments;
CREATE POLICY enrollments_select ON public.lead_sequence_enrollments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_id
        AND (
          l.owner_id = auth.uid()
          OR l.assigned_to = auth.uid()
          OR public.has_role(auth.uid(), 'administrador')
        )
    )
  );
CREATE INDEX IF NOT EXISTS idx_enrollments_lead
  ON public.lead_sequence_enrollments(lead_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status
  ON public.lead_sequence_enrollments(status);
DROP TRIGGER IF EXISTS trg_enrollments_updated_at ON public.lead_sequence_enrollments;
CREATE TRIGGER trg_enrollments_updated_at
  BEFORE UPDATE ON public.lead_sequence_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Idempotent seed of the default sequence (preserves WhatsApp → Email → Phone priority)
INSERT INTO public.outreach_sequences (name, description, active, is_default)
SELECT
  'Cadência padrão WayFlex',
  'Ordem: WhatsApp → e-mail → tarefa humana de telefone. Espera entre passos em minutos. Telefone nunca é disparado automaticamente.',
  true,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.outreach_sequences WHERE is_default = true);

INSERT INTO public.outreach_sequence_steps (sequence_id, order_index, channel, delay_minutes, template, continue_on, active)
SELECT s.id, 0, 'whatsapp'::public.sequence_step_channel, 1440, NULL, '["failed","skipped"]'::jsonb, true
FROM public.outreach_sequences s
WHERE s.is_default = true
  AND NOT EXISTS (
    SELECT 1 FROM public.outreach_sequence_steps ss WHERE ss.sequence_id = s.id AND ss.order_index = 0
  );

INSERT INTO public.outreach_sequence_steps (sequence_id, order_index, channel, delay_minutes, template, continue_on, active)
SELECT s.id, 1, 'email'::public.sequence_step_channel, 1440, NULL, '["failed","skipped"]'::jsonb, true
FROM public.outreach_sequences s
WHERE s.is_default = true
  AND NOT EXISTS (
    SELECT 1 FROM public.outreach_sequence_steps ss WHERE ss.sequence_id = s.id AND ss.order_index = 1
  );

INSERT INTO public.outreach_sequence_steps (sequence_id, order_index, channel, delay_minutes, template, continue_on, active)
SELECT s.id, 2, 'phone'::public.sequence_step_channel, 0, NULL, '[]'::jsonb, true
FROM public.outreach_sequences s
WHERE s.is_default = true
  AND NOT EXISTS (
    SELECT 1 FROM public.outreach_sequence_steps ss WHERE ss.sequence_id = s.id AND ss.order_index = 2
  );