ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS prospecting_sources jsonb NOT NULL DEFAULT '{"cnpj_ws": true, "google_places": false, "ai_only": false}'::jsonb;