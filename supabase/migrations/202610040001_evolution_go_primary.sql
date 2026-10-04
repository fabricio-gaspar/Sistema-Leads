-- Evolution GO becomes the only WhatsApp provider for this rebuilt branch.
-- Credentials are deliberately split from the user-readable operational metadata.

-- Never trust a request GUC or a JWT org_id unless the authenticated user is a
-- current member of that organization. The previous implementation returned
-- either value without validating membership.
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_requested text;
  v_org uuid;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_requested := current_setting('app.current_org', true);
  EXCEPTION WHEN OTHERS THEN
    v_requested := NULL;
  END;

  IF v_requested IS NOT NULL AND v_requested <> '' THEN
    BEGIN
      v_org := v_requested::uuid;
      IF public.is_org_member(v_org, v_user) THEN
        RETURN v_org;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  BEGIN
    v_requested := auth.jwt() -> 'app_metadata' ->> 'org_id';
  EXCEPTION WHEN OTHERS THEN
    v_requested := NULL;
  END;

  IF v_requested IS NOT NULL AND v_requested <> '' THEN
    BEGIN
      v_org := v_requested::uuid;
      IF public.is_org_member(v_org, v_user) THEN
        RETURN v_org;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  SELECT organization_id INTO v_org
  FROM public.organization_members
  WHERE user_id = v_user AND active = true
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN v_org;
END;
$$;

-- Membership, not the global profile, controls access to a tenant.
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS password_change_required boolean NOT NULL DEFAULT false;

-- Disabled memberships must not retain tenant access through legacy policies.
CREATE OR REPLACE FUNCTION public.is_org_member(
  _org uuid,
  _user uuid,
  _role public.app_role DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.organization_id = _org
      AND m.user_id = _user
      AND m.active = true
      AND (_role IS NULL OR m.role = _role)
  );
$$;

-- Administrative team creation must not bootstrap a separate personal workspace.
-- The trusted server function adds the member to the administrator's organization.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_name text;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, name, email, avatar)
  VALUES (NEW.id, v_name, NEW.email, UPPER(LEFT(v_name, 1)))
  ON CONFLICT (id) DO NOTHING;

  IF COALESCE(NEW.raw_app_meta_data->>'managed_team_member', 'false') = 'true' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.organizations (name, created_by)
  VALUES (v_name || ' - Workspace', NEW.id)
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role, active)
  VALUES (v_org_id, NEW.id, 'administrador', true)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.evolution_go_configurations (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_name text NOT NULL DEFAULT 'WhatsApp Evolution GO',
  server_url text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  configured_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  configured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evolution_go_configurations_https_url CHECK (server_url ~* '^https://')
);

-- This table is server-only. It holds an application-encrypted GLOBAL_API_KEY.
CREATE TABLE IF NOT EXISTS public.evolution_go_credentials (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  global_api_key_encrypted text NOT NULL,
  key_version smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Safe, operational metadata. No global key and no instance token lives here.
CREATE TABLE IF NOT EXISTS public.evolution_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_name text NOT NULL,
  instance_name text NOT NULL,
  external_instance_id text,
  connection_status text NOT NULL DEFAULT 'pending_configuration'
    CHECK (connection_status IN ('pending_configuration', 'provisioning', 'awaiting_connection', 'connected', 'disconnected', 'error', 'disabled')),
  phone_e164 text,
  last_healthcheck_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, owner_user_id),
  UNIQUE (organization_id, instance_name)
);

-- Server-only encrypted token for a single Evolution GO instance.
CREATE TABLE IF NOT EXISTS public.evolution_instance_credentials (
  evolution_instance_id uuid PRIMARY KEY REFERENCES public.evolution_instances(id) ON DELETE CASCADE,
  instance_token_encrypted text NOT NULL,
  key_version smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Events are metadata/audit only; raw provider payloads must not be exposed to
-- regular users because they can contain contact data.
CREATE TABLE IF NOT EXISTS public.evolution_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evolution_instance_id uuid NOT NULL REFERENCES public.evolution_instances(id) ON DELETE CASCADE,
  provider_event_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_status text NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed')),
  error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (evolution_instance_id, provider_event_id)
);

CREATE INDEX IF NOT EXISTS evolution_instances_owner_idx
  ON public.evolution_instances (organization_id, owner_user_id);
CREATE INDEX IF NOT EXISTS evolution_webhook_events_instance_idx
  ON public.evolution_webhook_events (evolution_instance_id, received_at DESC);

DROP TRIGGER IF EXISTS trg_evolution_go_configurations_updated_at ON public.evolution_go_configurations;
CREATE TRIGGER trg_evolution_go_configurations_updated_at
  BEFORE UPDATE ON public.evolution_go_configurations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_evolution_go_credentials_updated_at ON public.evolution_go_credentials;
CREATE TRIGGER trg_evolution_go_credentials_updated_at
  BEFORE UPDATE ON public.evolution_go_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_evolution_instances_updated_at ON public.evolution_instances;
CREATE TRIGGER trg_evolution_instances_updated_at
  BEFORE UPDATE ON public.evolution_instances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_evolution_instance_credentials_updated_at ON public.evolution_instance_credentials;
CREATE TRIGGER trg_evolution_instance_credentials_updated_at
  BEFORE UPDATE ON public.evolution_instance_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.evolution_go_configurations TO authenticated;
GRANT SELECT ON public.evolution_instances TO authenticated;
GRANT ALL ON public.evolution_go_configurations, public.evolution_go_credentials,
  public.evolution_instances, public.evolution_instance_credentials,
  public.evolution_webhook_events TO service_role;

REVOKE ALL ON public.evolution_go_credentials, public.evolution_instance_credentials,
  public.evolution_webhook_events FROM anon, authenticated;

ALTER TABLE public.evolution_go_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_go_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_instance_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evolution_go_config_member_read ON public.evolution_go_configurations;
CREATE POLICY evolution_go_config_member_read ON public.evolution_go_configurations
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

-- All writes are made by trusted server functions using service_role.
DROP POLICY IF EXISTS evolution_instances_owner_or_admin_read ON public.evolution_instances;
CREATE POLICY evolution_instances_owner_or_admin_read ON public.evolution_instances
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (
      owner_user_id = auth.uid()
      OR public.is_org_member(organization_id, auth.uid(), 'administrador')
    )
  );

-- Do not create an Evolution instance by inserting rows from the browser.
REVOKE INSERT, UPDATE, DELETE ON public.evolution_go_configurations, public.evolution_instances FROM authenticated;
