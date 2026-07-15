CREATE TABLE public.prospecting_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  filters JSONB NOT NULL,
  filters_hash TEXT NOT NULL,
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_found INTEGER NOT NULL DEFAULT 0,
  scored BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX idx_prospecting_cache_user_hash ON public.prospecting_cache(user_id, filters_hash);
CREATE INDEX idx_prospecting_cache_expires ON public.prospecting_cache(expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospecting_cache TO authenticated;
GRANT ALL ON public.prospecting_cache TO service_role;

ALTER TABLE public.prospecting_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own prospecting cache"
  ON public.prospecting_cache
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);