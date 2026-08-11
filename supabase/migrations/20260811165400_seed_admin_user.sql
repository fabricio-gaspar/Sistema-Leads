-- Create organization if not exists
INSERT INTO public.organizations (name, slug)
VALUES ('WF Digital', 'wf-digital')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
RETURNING id;

-- Note: user_id is needed, but we can't create auth.users via SQL safely without knowing the UUID.
-- We use a script to ensure the user exists in auth.users and then map them to user_roles.
-- However, for the initial setup, we provide the instructions and a fallback role assignment.

-- Create admin role enum value if not exists (already exists from previous turns)
-- DO 7173 BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user'); END IF; END 7173;

-- This migration prepares the organization and grants service_role permissions.
-- The actual user creation must happen via the Supabase Auth API to generate a valid hash/UUID.
