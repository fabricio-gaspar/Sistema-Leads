
-- Idempotência defensiva
DROP POLICY IF EXISTS documents_select ON public.documents;
DROP POLICY IF EXISTS documents_write ON public.documents;
DROP POLICY IF EXISTS unanswered_select ON public.unanswered_questions;
DROP POLICY IF EXISTS unanswered_write ON public.unanswered_questions;
DROP POLICY IF EXISTS tasks_select_all ON public.tasks;
DROP POLICY IF EXISTS tasks_write_admin ON public.tasks;
DROP POLICY IF EXISTS services_write_admin ON public.services;
DROP POLICY IF EXISTS objections_write_admin ON public.objections;
DROP POLICY IF EXISTS score_weights_write_admin ON public.score_weights;
DROP POLICY IF EXISTS proposals_select ON public.proposals;
DROP POLICY IF EXISTS proposals_write ON public.proposals;
DROP POLICY IF EXISTS orders_select ON public.orders;
DROP POLICY IF EXISTS orders_write ON public.orders;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) LEAD STAGE HISTORY
CREATE TABLE IF NOT EXISTS public.lead_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  source text NOT NULL DEFAULT 'system' CHECK (source IN ('ia','human','system')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.lead_stage_history TO authenticated;
GRANT ALL ON public.lead_stage_history TO service_role;
ALTER TABLE public.lead_stage_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_stage_history_select ON public.lead_stage_history;
DROP POLICY IF EXISTS lead_stage_history_insert ON public.lead_stage_history;
CREATE POLICY lead_stage_history_select ON public.lead_stage_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id
    AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))));
CREATE POLICY lead_stage_history_insert ON public.lead_stage_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_lead_stage_history_lead ON public.lead_stage_history(lead_id, created_at DESC);

-- 2) LEAD ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.lead_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  source text NOT NULL DEFAULT 'system' CHECK (source IN ('ia','human','system')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.lead_assignments TO authenticated;
GRANT ALL ON public.lead_assignments TO service_role;
ALTER TABLE public.lead_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_assignments_select ON public.lead_assignments;
DROP POLICY IF EXISTS lead_assignments_insert ON public.lead_assignments;
CREATE POLICY lead_assignments_select ON public.lead_assignments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id
    AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))));
CREATE POLICY lead_assignments_insert ON public.lead_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_lead ON public.lead_assignments(lead_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.track_lead_stage_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lead_stage_history(lead_id, from_stage, to_stage, changed_by, source)
    VALUES (NEW.id, NULL, NEW.stage, auth.uid(), 'system');
  ELSIF TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO public.lead_stage_history(lead_id, from_stage, to_stage, changed_by, source)
    VALUES (NEW.id, OLD.stage, NEW.stage, auth.uid(), 'system');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_lead_stage_history ON public.leads;
CREATE TRIGGER trg_lead_stage_history
  AFTER INSERT OR UPDATE OF stage ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.track_lead_stage_change();

CREATE OR REPLACE FUNCTION public.track_lead_assignment_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.lead_assignments(lead_id, from_user, to_user, changed_by, source)
    VALUES (NEW.id, NULL, NEW.assigned_to, auth.uid(), 'system');
  ELSIF TG_OP = 'UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.lead_assignments(lead_id, from_user, to_user, changed_by, source)
    VALUES (NEW.id, OLD.assigned_to, NEW.assigned_to, auth.uid(), 'system');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_lead_assignment_history ON public.leads;
CREATE TRIGGER trg_lead_assignment_history
  AFTER INSERT OR UPDATE OF assigned_to ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.track_lead_assignment_change();

-- 3) CONTACT POINTS
CREATE TABLE IF NOT EXISTS public.contact_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('whatsapp','phone','email','site')),
  value text NOT NULL,
  value_normalized text NOT NULL,
  value_hash text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  preferred boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','opt_out','bounced','invalid')),
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, kind, value_hash)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_points TO authenticated;
GRANT ALL ON public.contact_points TO service_role;
ALTER TABLE public.contact_points ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contact_points_select ON public.contact_points;
DROP POLICY IF EXISTS contact_points_write ON public.contact_points;
CREATE POLICY contact_points_select ON public.contact_points FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id
    AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))));
CREATE POLICY contact_points_write ON public.contact_points FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id
    AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id
    AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))));
CREATE INDEX IF NOT EXISTS idx_contact_points_lead ON public.contact_points(lead_id);
CREATE INDEX IF NOT EXISTS idx_contact_points_hash ON public.contact_points(value_hash);
DROP TRIGGER IF EXISTS trg_contact_points_updated_at ON public.contact_points;
CREATE TRIGGER trg_contact_points_updated_at
  BEFORE UPDATE ON public.contact_points
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill
INSERT INTO public.contact_points (lead_id, kind, value, value_normalized, value_hash, preferred, source)
SELECT l.id, 'whatsapp', l.whatsapp,
       regexp_replace(l.whatsapp, '\D', '', 'g'),
       encode(digest(regexp_replace(l.whatsapp, '\D', '', 'g'), 'sha256'), 'hex'),
       true, 'backfill'
FROM public.leads l
WHERE l.whatsapp IS NOT NULL AND length(regexp_replace(l.whatsapp, '\D', '', 'g')) > 6
ON CONFLICT DO NOTHING;

INSERT INTO public.contact_points (lead_id, kind, value, value_normalized, value_hash, source)
SELECT l.id, 'phone', l.phone,
       regexp_replace(l.phone, '\D', '', 'g'),
       encode(digest(regexp_replace(l.phone, '\D', '', 'g'), 'sha256'), 'hex'),
       'backfill'
FROM public.leads l
WHERE l.phone IS NOT NULL AND length(regexp_replace(l.phone, '\D', '', 'g')) > 6
ON CONFLICT DO NOTHING;

INSERT INTO public.contact_points (lead_id, kind, value, value_normalized, value_hash, source)
SELECT l.id, 'email', l.email, lower(trim(l.email)),
       encode(digest(lower(trim(l.email)), 'sha256'), 'hex'), 'backfill'
FROM public.leads l
WHERE l.email IS NOT NULL AND position('@' IN l.email) > 1
ON CONFLICT DO NOTHING;

-- 4) OUTREACH JOBS
CREATE TABLE IF NOT EXISTS public.outreach_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  outreach_id uuid REFERENCES public.lead_outreach(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp','email','phone')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','locked','done','failed','cancelled')),
  attempt int NOT NULL DEFAULT 0,
  idempotency_key text UNIQUE,
  run_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  processed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.outreach_jobs TO authenticated;
GRANT ALL ON public.outreach_jobs TO service_role;
ALTER TABLE public.outreach_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outreach_jobs_select ON public.outreach_jobs;
CREATE POLICY outreach_jobs_select ON public.outreach_jobs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id
    AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))));
CREATE INDEX IF NOT EXISTS idx_outreach_jobs_run ON public.outreach_jobs(status, run_at);
CREATE INDEX IF NOT EXISTS idx_outreach_jobs_lead ON public.outreach_jobs(lead_id);
DROP TRIGGER IF EXISTS trg_outreach_jobs_updated_at ON public.outreach_jobs;
CREATE TRIGGER trg_outreach_jobs_updated_at
  BEFORE UPDATE ON public.outreach_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) WEBHOOK EVENTS
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  external_id text,
  event_type text,
  payload_sha text,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','failed','ignored')),
  processed_at timestamptz,
  error text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  outreach_id uuid REFERENCES public.lead_outreach(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);
GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS webhook_events_select ON public.webhook_events;
CREATE POLICY webhook_events_select ON public.webhook_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON public.webhook_events(provider, created_at DESC);

-- 6) KNOWLEDGE CHUNKS
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  content text NOT NULL,
  tokens int,
  version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','stale','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_chunks TO authenticated;
GRANT ALL ON public.knowledge_chunks TO service_role;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS knowledge_chunks_select ON public.knowledge_chunks;
DROP POLICY IF EXISTS knowledge_chunks_write ON public.knowledge_chunks;
CREATE POLICY knowledge_chunks_select ON public.knowledge_chunks FOR SELECT TO authenticated USING (true);
CREATE POLICY knowledge_chunks_write ON public.knowledge_chunks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON public.knowledge_chunks(document_id, status);

-- 7) CONSENT EVENTS
CREATE TABLE IF NOT EXISTS public.consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  contact_point_id uuid REFERENCES public.contact_points(id) ON DELETE SET NULL,
  event text NOT NULL CHECK (event IN ('opt_in','opt_out','complaint','resubscribe')),
  channel text NOT NULL CHECK (channel IN ('whatsapp','phone','email')),
  source text NOT NULL CHECK (source IN ('client_reply','admin','webhook','import')),
  text text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.consent_events TO authenticated;
GRANT ALL ON public.consent_events TO service_role;
ALTER TABLE public.consent_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS consent_events_select ON public.consent_events;
DROP POLICY IF EXISTS consent_events_insert ON public.consent_events;
CREATE POLICY consent_events_select ON public.consent_events FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'administrador')
    OR (lead_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id
        AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid())
    ))
  );
CREATE POLICY consent_events_insert ON public.consent_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_consent_events_lead ON public.consent_events(lead_id, created_at DESC);

-- 8) LEAD NOTES
CREATE TABLE IF NOT EXISTS public.lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_notes TO authenticated;
GRANT ALL ON public.lead_notes TO service_role;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_notes_select ON public.lead_notes;
DROP POLICY IF EXISTS lead_notes_write ON public.lead_notes;
CREATE POLICY lead_notes_select ON public.lead_notes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id
    AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))));
CREATE POLICY lead_notes_write ON public.lead_notes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id
    AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id
    AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))));
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead ON public.lead_notes(lead_id, created_at DESC);
DROP TRIGGER IF EXISTS trg_lead_notes_updated_at ON public.lead_notes;
CREATE TRIGGER trg_lead_notes_updated_at
  BEFORE UPDATE ON public.lead_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Fechar USING(true) em tabelas comerciais
DROP POLICY IF EXISTS proposals_all_auth ON public.proposals;
CREATE POLICY proposals_select ON public.proposals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id
    AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))));
CREATE POLICY proposals_write ON public.proposals FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id
    AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id
    AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador'))));

DROP POLICY IF EXISTS orders_all_auth ON public.orders;
CREATE POLICY orders_select ON public.orders FOR SELECT TO authenticated
  USING (
    (lead_id IS NULL AND public.has_role(auth.uid(), 'administrador'))
    OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id
      AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador')))
  );
CREATE POLICY orders_write ON public.orders FOR ALL TO authenticated
  USING (
    (lead_id IS NULL AND public.has_role(auth.uid(), 'administrador'))
    OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id
      AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador')))
  )
  WITH CHECK (
    (lead_id IS NULL AND public.has_role(auth.uid(), 'administrador'))
    OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id
      AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'administrador')))
  );

DROP POLICY IF EXISTS documents_all_auth ON public.documents;
CREATE POLICY documents_select ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY documents_write ON public.documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));

DROP POLICY IF EXISTS unanswered_all_auth ON public.unanswered_questions;
CREATE POLICY unanswered_select ON public.unanswered_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY unanswered_write ON public.unanswered_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));

DROP POLICY IF EXISTS tasks_all_auth ON public.tasks;
CREATE POLICY tasks_select_all ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY tasks_write_admin ON public.tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));

DROP POLICY IF EXISTS services_all_auth ON public.services;
CREATE POLICY services_write_admin ON public.services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));

DROP POLICY IF EXISTS objections_all_auth ON public.objections;
CREATE POLICY objections_write_admin ON public.objections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));

DROP POLICY IF EXISTS score_weights_all_auth ON public.score_weights;
CREATE POLICY score_weights_write_admin ON public.score_weights FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));
