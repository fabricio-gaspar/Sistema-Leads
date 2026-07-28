
-- === Fase 1: fundação multiempresa ===

-- organizations
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- organization_members
CREATE TABLE public.organization_members (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'vendedor',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);
CREATE INDEX ix_org_members_user ON public.organization_members(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- organization_invites
CREATE TABLE public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'vendedor',
  token text NOT NULL UNIQUE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_org_invites_org ON public.organization_invites(organization_id);
CREATE INDEX ix_org_invites_email ON public.organization_invites(lower(email));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invites TO authenticated;
GRANT ALL ON public.organization_invites TO service_role;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- ===== helpers =====

CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid, _user uuid, _role public.app_role DEFAULT NULL)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = _org
      AND m.user_id = _user
      AND (_role IS NULL OR m.role = _role)
  );
$$;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_txt text;
  v_org uuid;
  v_user uuid;
BEGIN
  -- 1) explicit request GUC (set by server middleware)
  BEGIN
    v_txt := current_setting('app.current_org', true);
  EXCEPTION WHEN OTHERS THEN v_txt := NULL;
  END;
  IF v_txt IS NOT NULL AND v_txt <> '' THEN
    BEGIN
      v_org := v_txt::uuid;
      RETURN v_org;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- 2) fallback: JWT app_metadata.org_id
  BEGIN
    v_txt := (auth.jwt() -> 'app_metadata' ->> 'org_id');
  EXCEPTION WHEN OTHERS THEN v_txt := NULL;
  END;
  IF v_txt IS NOT NULL AND v_txt <> '' THEN
    BEGIN RETURN v_txt::uuid; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- 3) last resort: user's oldest membership (avoids null during Phase 2 rollout)
  v_user := auth.uid();
  IF v_user IS NOT NULL THEN
    SELECT organization_id INTO v_org
    FROM public.organization_members
    WHERE user_id = v_user
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  RETURN v_org;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;

-- ===== RLS: organizations =====
CREATE POLICY orgs_member_read ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()));

CREATE POLICY orgs_insert_any_user ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY orgs_admin_update ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.is_org_member(id, auth.uid(), 'administrador'))
  WITH CHECK (public.is_org_member(id, auth.uid(), 'administrador'));

CREATE POLICY orgs_admin_delete ON public.organizations
  FOR DELETE TO authenticated
  USING (public.is_org_member(id, auth.uid(), 'administrador'));

-- ===== RLS: organization_members =====
CREATE POLICY orgmem_self_read ON public.organization_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(organization_id, auth.uid()));

CREATE POLICY orgmem_admin_write ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid(), 'administrador'));

CREATE POLICY orgmem_admin_update ON public.organization_members
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid(), 'administrador'))
  WITH CHECK (public.is_org_member(organization_id, auth.uid(), 'administrador'));

CREATE POLICY orgmem_admin_delete ON public.organization_members
  FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid(), 'administrador') OR user_id = auth.uid());

-- ===== RLS: organization_invites =====
CREATE POLICY invites_admin_read ON public.organization_invites
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid(), 'administrador')
    OR lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );

CREATE POLICY invites_admin_write ON public.organization_invites
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid(), 'administrador'));

CREATE POLICY invites_admin_update ON public.organization_invites
  FOR UPDATE TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid(), 'administrador')
    OR lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
  WITH CHECK (true);

CREATE POLICY invites_admin_delete ON public.organization_invites
  FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid(), 'administrador'));

-- ===== updated_at trigger for organizations =====
CREATE TRIGGER trg_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== bootstrap personal org for new signups =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_name text;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));

  -- profile (preserve original behavior)
  INSERT INTO public.profiles (id, name, email, avatar)
  VALUES (NEW.id, v_name, NEW.email, UPPER(LEFT(v_name, 1)))
  ON CONFLICT (id) DO NOTHING;

  -- personal org
  INSERT INTO public.organizations (name, created_by)
  VALUES (v_name || ' - Workspace', NEW.id)
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, NEW.id, 'administrador')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- ===== backfill: create a legacy org and enroll every existing profile =====
DO $$
DECLARE
  v_org_id uuid;
  v_owner uuid;
BEGIN
  -- pick first admin (from user_roles) as owner, else any profile
  SELECT user_id INTO v_owner
  FROM public.user_roles
  WHERE role = 'administrador'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_owner IS NULL THEN
    SELECT id INTO v_owner FROM public.profiles ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles) THEN
    INSERT INTO public.organizations (name, slug, created_by)
    VALUES ('Legado', 'legado', v_owner)
    RETURNING id INTO v_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    SELECT
      v_org_id,
      p.id,
      COALESCE(
        (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = p.id ORDER BY ur.created_at ASC LIMIT 1),
        'vendedor'::public.app_role
      )
    FROM public.profiles p
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
