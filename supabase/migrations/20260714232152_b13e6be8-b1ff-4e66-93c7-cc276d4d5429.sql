
-- Add company profile fields
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS annual_revenue text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text;

ALTER TABLE public.company_settings
  DROP CONSTRAINT IF EXISTS company_settings_size_check;
ALTER TABLE public.company_settings
  ADD CONSTRAINT company_settings_size_check
  CHECK (size IS NULL OR size IN ('pequena','media','grande'));

-- Real integrations table (no more hardcoded "conectado")
CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  connected boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integrations_select_auth ON public.integrations;
CREATE POLICY integrations_select_auth ON public.integrations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS integrations_admin_write ON public.integrations;
CREATE POLICY integrations_admin_write ON public.integrations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'administrador'::app_role))
  WITH CHECK (has_role(auth.uid(), 'administrador'::app_role));

DROP TRIGGER IF EXISTS trg_integrations_updated_at ON public.integrations;
CREATE TRIGGER trg_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed the 4 known integration slots as disconnected
INSERT INTO public.integrations (key, label) VALUES
  ('whatsapp', 'WhatsApp Business'),
  ('email',    'E-mail (SMTP)'),
  ('erp_bling','ERP — Bling'),
  ('meta_ads', 'Meta Ads')
ON CONFLICT (key) DO NOTHING;
