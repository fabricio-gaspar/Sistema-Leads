
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS sandbox_mode boolean NOT NULL DEFAULT false;
