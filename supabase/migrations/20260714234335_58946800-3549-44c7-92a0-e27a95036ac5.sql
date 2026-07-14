ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS annual_revenue numeric;

CREATE INDEX IF NOT EXISTS idx_leads_size ON public.leads(size);
CREATE INDEX IF NOT EXISTS idx_leads_city ON public.leads(city);
CREATE INDEX IF NOT EXISTS idx_leads_annual_revenue ON public.leads(annual_revenue);