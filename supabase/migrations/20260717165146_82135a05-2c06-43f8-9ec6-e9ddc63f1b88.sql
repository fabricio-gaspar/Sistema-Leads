
ALTER TABLE public.prospecting_cache
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS saved boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_prospecting_cache_saved
  ON public.prospecting_cache (user_id, saved, created_at DESC);
