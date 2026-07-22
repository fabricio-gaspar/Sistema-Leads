-- Prontidão comercial: dados de contato, governança, captação, campanhas,
-- CRM B2B, conhecimento pesquisável e integrações opcionais.
-- Migration inteiramente aditiva e idempotente.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 1. Contatos: normalização única, rastreabilidade e sincronização segura
-- ============================================================================

ALTER TABLE public.contact_points
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_method text,
  ADD COLUMN IF NOT EXISTS legal_basis text,
  ADD COLUMN IF NOT EXISTS source_detail text,
  ADD COLUMN IF NOT EXISTS opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS opt_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_allowed_at timestamptz;

CREATE OR REPLACE FUNCTION public.normalize_contact_point_value(_kind text, _value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _kind IN ('email', 'site') THEN lower(trim(coalesce(_value, '')))
    ELSE regexp_replace(coalesce(_value, ''), '\\D', '', 'g')
  END;
$$;

CREATE OR REPLACE FUNCTION public.set_contact_point_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.value_normalized := public.normalize_contact_point_value(NEW.kind, NEW.value);
  NEW.value_hash := encode(digest(NEW.value_normalized, 'sha256'), 'hex');
  IF NEW.verified AND NEW.verified_at IS NULL THEN
    NEW.verified_at := now();
  END IF;
  IF NEW.status = 'opt_out' AND NEW.opt_out_at IS NULL THEN
    NEW.opt_out_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_points_integrity ON public.contact_points;
CREATE TRIGGER trg_contact_points_integrity
  BEFORE INSERT OR UPDATE OF kind, value, verified, status ON public.contact_points
  FOR EACH ROW EXECUTE FUNCTION public.set_contact_point_integrity();

-- Corrige registros existentes e permite um canal preferencial por tipo.
UPDATE public.contact_points
SET value_normalized = public.normalize_contact_point_value(kind, value),
    value_hash = encode(digest(public.normalize_contact_point_value(kind, value), 'sha256'), 'hex')
WHERE value_normalized IS DISTINCT FROM public.normalize_contact_point_value(kind, value)
   OR value_hash IS NULL;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY lead_id, kind
           ORDER BY preferred DESC, verified DESC, created_at ASC
         ) AS position
  FROM public.contact_points
  WHERE preferred = true AND status = 'active'
)
UPDATE public.contact_points cp
SET preferred = false
FROM ranked r
WHERE cp.id = r.id AND r.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS contact_points_one_preferred_per_channel
  ON public.contact_points(lead_id, kind)
  WHERE preferred = true AND status = 'active';

CREATE OR REPLACE FUNCTION public.sync_preferred_contact_to_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channels jsonb;
BEGIN
  IF NEW.preferred IS NOT TRUE OR NEW.status <> 'active' OR NEW.kind NOT IN ('whatsapp', 'phone', 'email') THEN
    RETURN NEW;
  END IF;
  SELECT coalesce(contact_channels, '{}'::jsonb) INTO channels FROM public.leads WHERE id = NEW.lead_id;
  channels := jsonb_set(
    channels,
    ARRAY[NEW.kind],
    jsonb_build_object(
      'available', true,
      'last_status', null,
      'last_attempt_at', null,
      'verified', NEW.verified,
      'contact_point_id', NEW.id
    ),
    true
  );
  UPDATE public.leads
  SET whatsapp = CASE WHEN NEW.kind = 'whatsapp' THEN NEW.value ELSE whatsapp END,
      phone = CASE WHEN NEW.kind = 'phone' THEN NEW.value ELSE phone END,
      email = CASE WHEN NEW.kind = 'email' THEN NEW.value ELSE email END,
      contact_channels = channels
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_preferred_contact_to_lead ON public.contact_points;
CREATE TRIGGER trg_sync_preferred_contact_to_lead
  AFTER INSERT OR UPDATE OF preferred, status, value, verified ON public.contact_points
  FOR EACH ROW EXECUTE FUNCTION public.sync_preferred_contact_to_lead();

-- ============================================================================
-- 2. Políticas de envio, auditoria, LGPD e operação
-- ============================================================================

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS business_timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS business_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  ADD COLUMN IF NOT EXISTS business_start_time time NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS business_end_time time NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS outreach_daily_limit_per_contact integer NOT NULL DEFAULT 1
    CHECK (outreach_daily_limit_per_contact BETWEEN 1 AND 20),
  ADD COLUMN IF NOT EXISTS outreach_min_interval_minutes integer NOT NULL DEFAULT 1440
    CHECK (outreach_min_interval_minutes BETWEEN 5 AND 43200),
  ADD COLUMN IF NOT EXISTS outreach_require_verified_contact boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS outreach_require_manual_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS outreach_auto_start boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS handoff_escalation_minutes integer NOT NULL DEFAULT 60
    CHECK (handoff_escalation_minutes BETWEEN 5 AND 10080),
  ADD COLUMN IF NOT EXISTS privacy_contact_email text,
  ADD COLUMN IF NOT EXISTS retention_days integer NOT NULL DEFAULT 730
    CHECK (retention_days BETWEEN 30 AND 3650);

ALTER TABLE public.consent_events
  ADD COLUMN IF NOT EXISTS legal_basis text,
  ADD COLUMN IF NOT EXISTS proof_url text,
  ADD COLUMN IF NOT EXISTS source_detail text;

CREATE TABLE IF NOT EXISTS public.data_subject_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL CHECK (request_type IN ('access','correction','deletion','anonymization','portability','objection')),
  requester_name text,
  requester_email text,
  requester_phone text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','verifying','in_progress','completed','rejected')),
  due_at timestamptz NOT NULL DEFAULT now() + interval '15 days',
  resolution text,
  handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS data_subject_requests_status_due_idx ON public.data_subject_requests(status, due_at);
ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.data_subject_requests TO authenticated;
GRANT ALL ON public.data_subject_requests TO service_role;
DROP POLICY IF EXISTS data_subject_requests_admin ON public.data_subject_requests;
CREATE POLICY data_subject_requests_admin ON public.data_subject_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));
DROP TRIGGER IF EXISTS trg_data_subject_requests_updated_at ON public.data_subject_requests;
CREATE TRIGGER trg_data_subject_requests_updated_at BEFORE UPDATE ON public.data_subject_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.operational_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  category text NOT NULL CHECK (category IN ('outreach','webhook','queue','integration','privacy','handoff')),
  title text NOT NULL,
  detail text,
  reference_id uuid,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS operational_alerts_open_idx ON public.operational_alerts(status, severity, created_at DESC);
ALTER TABLE public.operational_alerts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.operational_alerts TO authenticated;
GRANT ALL ON public.operational_alerts TO service_role;
DROP POLICY IF EXISTS operational_alerts_admin ON public.operational_alerts;
CREATE POLICY operational_alerts_admin ON public.operational_alerts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));

-- Restringe auditoria: leitura somente administrativa e gravação associada ao autor.
DROP POLICY IF EXISTS audit_select_all ON public.audit_logs;
DROP POLICY IF EXISTS audit_insert_all ON public.audit_logs;
CREATE POLICY audit_select_admin ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));
CREATE POLICY audit_insert_own_actor ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));

DROP POLICY IF EXISTS consent_events_insert ON public.consent_events;
CREATE POLICY consent_events_insert_scope ON public.consent_events FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'administrador')
    OR actor_id = auth.uid()
    OR (lead_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id
        AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid())
    ))
  );

DROP POLICY IF EXISTS contact_suppressions_insert ON public.contact_suppressions;
CREATE POLICY contact_suppressions_insert_scope ON public.contact_suppressions FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'administrador')
    OR (lead_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id
        AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid())
    ))
  );

-- ============================================================================
-- 3. CRM B2B: contas, decisores, campanhas, origem e deduplicação
-- ============================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS account_id uuid,
  ADD COLUMN IF NOT EXISTS primary_contact_id uuid,
  ADD COLUMN IF NOT EXISTS contact_status text NOT NULL DEFAULT 'unverified'
    CHECK (contact_status IN ('unverified','verified','approved','blocked')),
  ADD COLUMN IF NOT EXISTS contact_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS campaign_id uuid,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text;

CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  cnpj text,
  domain text,
  segment text,
  size text,
  city text,
  uf text,
  website text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_cnpj_unique_idx ON public.accounts(cnpj) WHERE cnpj IS NOT NULL AND cnpj <> '';
CREATE UNIQUE INDEX IF NOT EXISTS accounts_domain_unique_idx ON public.accounts(domain) WHERE domain IS NOT NULL AND domain <> '';
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
DROP POLICY IF EXISTS accounts_scope ON public.accounts;
CREATE POLICY accounts_scope ON public.accounts FOR ALL TO authenticated
  USING (
    owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador') OR EXISTS (
      SELECT 1 FROM public.leads l WHERE l.account_id = accounts.id
        AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid())
    )
  )
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));
DROP TRIGGER IF EXISTS trg_accounts_updated_at ON public.accounts;
CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text,
  department text,
  email text,
  phone text,
  whatsapp text,
  linkedin_url text,
  decision_role text CHECK (decision_role IN ('decision_maker','influencer','user','gatekeeper','unknown')) DEFAULT 'unknown',
  is_primary boolean NOT NULL DEFAULT false,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS contacts_account_email_unique_idx ON public.contacts(account_id, lower(email)) WHERE email IS NOT NULL AND email <> '';
CREATE UNIQUE INDEX IF NOT EXISTS contacts_one_primary_per_account_idx ON public.contacts(account_id) WHERE is_primary = true;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
DROP POLICY IF EXISTS contacts_scope ON public.contacts;
CREATE POLICY contacts_scope ON public.contacts FOR ALL TO authenticated
  USING (
    owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador') OR EXISTS (
      SELECT 1 FROM public.accounts a WHERE a.id = contacts.account_id
        AND (a.owner_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.leads l WHERE l.account_id = a.id
            AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid())
        ))
    )
  )
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));
DROP TRIGGER IF EXISTS trg_contacts_updated_at ON public.contacts;
CREATE TRIGGER trg_contacts_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS leads_account_idx ON public.leads(account_id);
CREATE INDEX IF NOT EXISTS leads_campaign_idx ON public.leads(campaign_id);
CREATE INDEX IF NOT EXISTS leads_contact_status_idx ON public.leads(contact_status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  objective text,
  channel text CHECK (channel IN ('whatsapp','email','phone','mixed','inbound')) NOT NULL DEFAULT 'mixed',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','archived')),
  start_at timestamptz,
  end_at timestamptz,
  budget numeric(12,2),
  expected_value numeric(12,2),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
DROP POLICY IF EXISTS campaigns_admin ON public.campaigns;
CREATE POLICY campaigns_admin ON public.campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));
DROP TRIGGER IF EXISTS trg_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER trg_campaigns_updated_at BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_account_fk' AND conrelid = 'public.leads'::regclass
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_account_fk
      FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_primary_contact_fk' AND conrelid = 'public.leads'::regclass
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_primary_contact_fk
      FOREIGN KEY (primary_contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_campaign_fk' AND conrelid = 'public.leads'::regclass
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_campaign_fk
      FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.campaign_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'selected' CHECK (status IN ('selected','approved','queued','contacted','responded','suppressed','removed')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, lead_id)
);
ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.campaign_members TO authenticated;
GRANT ALL ON public.campaign_members TO service_role;
DROP POLICY IF EXISTS campaign_members_admin ON public.campaign_members;
CREATE POLICY campaign_members_admin ON public.campaign_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));
DROP TRIGGER IF EXISTS trg_campaign_members_updated_at ON public.campaign_members;
CREATE TRIGGER trg_campaign_members_updated_at BEFORE UPDATE ON public.campaign_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.lead_source_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  source text NOT NULL,
  external_id text,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  landing_page text,
  received_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS lead_source_events_lead_idx ON public.lead_source_events(lead_id, received_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS lead_source_events_external_unique_idx
  ON public.lead_source_events(source, external_id) WHERE external_id IS NOT NULL;
ALTER TABLE public.lead_source_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.lead_source_events TO authenticated;
GRANT ALL ON public.lead_source_events TO service_role;
DROP POLICY IF EXISTS lead_source_events_admin ON public.lead_source_events;
CREATE POLICY lead_source_events_admin ON public.lead_source_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));

CREATE OR REPLACE FUNCTION public.find_duplicate_leads(
  _cnpj text DEFAULT NULL,
  _domain text DEFAULT NULL,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL
)
RETURNS TABLE(id uuid, company text, reason text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.company,
    CASE
      WHEN _email IS NOT NULL AND lower(coalesce(l.email, '')) = lower(_email) THEN 'email'
      WHEN _phone IS NOT NULL AND regexp_replace(coalesce(l.phone, ''), '\\D', '', 'g') = regexp_replace(_phone, '\\D', '', 'g') THEN 'phone'
      WHEN _phone IS NOT NULL AND regexp_replace(coalesce(l.whatsapp, ''), '\\D', '', 'g') = regexp_replace(_phone, '\\D', '', 'g') THEN 'whatsapp'
      WHEN _domain IS NOT NULL AND lower(coalesce(a.domain, '')) = lower(_domain) THEN 'domain'
      WHEN _cnpj IS NOT NULL AND a.cnpj = _cnpj THEN 'cnpj'
      ELSE 'company'
    END AS reason
  FROM public.leads l
  LEFT JOIN public.accounts a ON a.id = l.account_id
  WHERE (
       (_email IS NOT NULL AND lower(coalesce(l.email, '')) = lower(_email))
       OR (_phone IS NOT NULL AND (
         regexp_replace(coalesce(l.phone, ''), '\\D', '', 'g') = regexp_replace(_phone, '\\D', '', 'g')
         OR regexp_replace(coalesce(l.whatsapp, ''), '\\D', '', 'g') = regexp_replace(_phone, '\\D', '', 'g')
       ))
       OR (_domain IS NOT NULL AND lower(coalesce(a.domain, '')) = lower(_domain))
       OR (_cnpj IS NOT NULL AND a.cnpj = _cnpj)
    )
    AND (
      auth.role() = 'service_role'
      OR public.has_role(auth.uid(), 'administrador')
      OR l.owner_id = auth.uid()
      OR l.assigned_to = auth.uid()
    )
  ORDER BY l.updated_at DESC
  LIMIT 10;
$$;
REVOKE ALL ON FUNCTION public.find_duplicate_leads(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_duplicate_leads(text, text, text, text) TO authenticated, service_role;

-- ============================================================================
-- 4. Conhecimento por relevância, qualidade e integração de agenda/telefonia
-- ============================================================================

ALTER TABLE public.knowledge_chunks ADD COLUMN IF NOT EXISTS search_vector tsvector;
UPDATE public.knowledge_chunks
SET search_vector = to_tsvector('portuguese', coalesce(content, ''))
WHERE search_vector IS NULL;
CREATE INDEX IF NOT EXISTS knowledge_chunks_search_idx ON public.knowledge_chunks USING gin(search_vector);

CREATE OR REPLACE FUNCTION public.set_knowledge_chunk_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := to_tsvector('portuguese', coalesce(NEW.content, ''));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_knowledge_chunks_search_vector ON public.knowledge_chunks;
CREATE TRIGGER trg_knowledge_chunks_search_vector
  BEFORE INSERT OR UPDATE OF content ON public.knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION public.set_knowledge_chunk_search_vector();

CREATE OR REPLACE FUNCTION public.search_knowledge_chunks(_query text, _limit integer DEFAULT 8)
RETURNS TABLE(document_id uuid, document_name text, content text, score real, version integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH query AS (SELECT websearch_to_tsquery('portuguese', coalesce(_query, '')) AS q)
  SELECT kc.document_id, d.name, kc.content,
    ts_rank_cd(kc.search_vector, query.q)::real AS score,
    kc.version
  FROM public.knowledge_chunks kc
  JOIN public.documents d ON d.id = kc.document_id
  CROSS JOIN query
  WHERE kc.status = 'active' AND d.status = 'active'
    AND (query.q = ''::tsquery OR kc.search_vector @@ query.q)
  ORDER BY score DESC, kc.created_at DESC
  LIMIT greatest(1, least(coalesce(_limit, 8), 20));
$$;
REVOKE ALL ON FUNCTION public.search_knowledge_chunks(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_knowledge_chunks(text, integer) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.knowledge_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.lead_messages(id) ON DELETE SET NULL,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  outcome text NOT NULL CHECK (outcome IN ('approved','corrected','handoff_needed','unsafe')),
  correction text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.knowledge_feedback ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.knowledge_feedback TO authenticated;
GRANT ALL ON public.knowledge_feedback TO service_role;
DROP POLICY IF EXISTS knowledge_feedback_scope ON public.knowledge_feedback;
CREATE POLICY knowledge_feedback_scope ON public.knowledge_feedback FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));

CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google','outlook','ics')),
  calendar_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','connected','error','revoked')),
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.calendar_connections TO authenticated;
GRANT ALL ON public.calendar_connections TO service_role;
DROP POLICY IF EXISTS calendar_connections_own ON public.calendar_connections;
CREATE POLICY calendar_connections_own ON public.calendar_connections FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));
DROP TRIGGER IF EXISTS trg_calendar_connections_updated_at ON public.calendar_connections;
CREATE TRIGGER trg_calendar_connections_updated_at BEFORE UPDATE ON public.calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.external_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google','outlook','ics')),
  external_id text,
  join_url text,
  sync_status text NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','failed','cancelled')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(appointment_id, provider)
);
ALTER TABLE public.external_calendar_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.external_calendar_events TO authenticated;
GRANT ALL ON public.external_calendar_events TO service_role;
DROP POLICY IF EXISTS external_calendar_events_scope ON public.external_calendar_events;
CREATE POLICY external_calendar_events_scope ON public.external_calendar_events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_id AND a.owner_id = auth.uid()) OR public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_id AND a.owner_id = auth.uid()) OR public.has_role(auth.uid(), 'administrador'));
DROP TRIGGER IF EXISTS trg_external_calendar_events_updated_at ON public.external_calendar_events;
CREATE TRIGGER trg_external_calendar_events_updated_at BEFORE UPDATE ON public.external_calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.call_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  contact_point_id uuid REFERENCES public.contact_points(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  outcome text NOT NULL CHECK (outcome IN ('planned','connected','voicemail','no_answer','wrong_number','follow_up','qualified','lost')),
  duration_seconds integer,
  notes text,
  recording_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS call_activities_lead_idx ON public.call_activities(lead_id, created_at DESC);
ALTER TABLE public.call_activities ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.call_activities TO authenticated;
GRANT ALL ON public.call_activities TO service_role;
DROP POLICY IF EXISTS call_activities_scope ON public.call_activities;
CREATE POLICY call_activities_scope ON public.call_activities FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))));

-- Fila e webhooks recebem informações de recuperação/alerta.
ALTER TABLE public.outreach_jobs
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz;
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz;
ALTER TABLE public.lead_outreach
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS policy_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Modelos aprovados podem ser associados a etapas de cadência/campanhas.
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp','email','phone')),
  purpose text NOT NULL DEFAULT 'first_contact',
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','archived')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
DROP POLICY IF EXISTS message_templates_admin ON public.message_templates;
CREATE POLICY message_templates_admin ON public.message_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));
DROP TRIGGER IF EXISTS trg_message_templates_updated_at ON public.message_templates;
CREATE TRIGGER trg_message_templates_updated_at BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
