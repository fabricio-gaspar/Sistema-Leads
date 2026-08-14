-- Final reconciliation for P0: add missing column to notifications and create missing functions

-- 1. Ensure enum and functions
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('administrador', 'vendedor', 'ia', 'sdr', 'cx');
    ELSE
        ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sdr';
        ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cx';
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid;
$$;

-- 2. Fix notifications table (add organization_id)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS organization_id uuid NOT NULL DEFAULT current_org_id();

-- 3. Functions for outreach and suppressions
CREATE OR REPLACE FUNCTION public.has_contact_suppression(_lead_id uuid, _hashes text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contact_suppressions
    WHERE (lead_id = _lead_id OR contact_hash = ANY(_hashes))
      AND organization_id = current_org_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.clear_contact_suppressions(_lead_id uuid, _hashes text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.contact_suppressions
  WHERE (lead_id = _lead_id OR contact_hash = ANY(_hashes))
    AND organization_id = current_org_id();
END;
$$;

-- 4. RLS & Policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_suppressions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "notifications_user" ON public.notifications 
    FOR SELECT TO authenticated USING (user_id = auth.uid() AND organization_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. user_roles and profiles policies
DROP POLICY IF EXISTS "user_roles_select_org" ON public.user_roles;
DO $$ BEGIN
    CREATE POLICY "user_roles_auth_select" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated 
    USING (EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid() AND organization_id = current_org_id() AND role = 'administrador'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'administrador'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "profiles_owner_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
