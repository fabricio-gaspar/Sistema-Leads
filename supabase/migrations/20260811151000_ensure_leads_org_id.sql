DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'organization_id') THEN
        ALTER TABLE public.leads ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
    END IF;
END $$;
