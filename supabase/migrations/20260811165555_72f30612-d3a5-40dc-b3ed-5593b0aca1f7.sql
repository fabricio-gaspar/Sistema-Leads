-- Create organization if not exists
INSERT INTO public.organizations (name, slug)
VALUES ('WF Digital', 'wf-digital')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;
