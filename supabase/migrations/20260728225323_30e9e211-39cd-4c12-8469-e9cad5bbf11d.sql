ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS nurture_days integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS nurture_max_cycles integer NOT NULL DEFAULT 2;

ALTER TABLE public.lead_sequence_enrollments
  ADD COLUMN IF NOT EXISTS nurture_cycles integer NOT NULL DEFAULT 0;