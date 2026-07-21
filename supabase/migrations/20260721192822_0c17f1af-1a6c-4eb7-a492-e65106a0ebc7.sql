ALTER TABLE public.contact_points ADD COLUMN IF NOT EXISTS sandbox boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS contact_points_lead_preferred_idx ON public.contact_points(lead_id, preferred DESC);
CREATE INDEX IF NOT EXISTS consent_events_lead_created_idx ON public.consent_events(lead_id, created_at DESC);