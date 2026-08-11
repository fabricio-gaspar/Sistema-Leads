-- Completa o fluxo Captura -> Classificacao -> Aprovacao -> Ticket -> Cadencia.
-- Migration aditiva: nao remove nem reescreve dados existentes.

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS contact_approval_mode text NOT NULL DEFAULT 'automatic',
  ADD COLUMN IF NOT EXISTS contact_approval_min_score integer NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS prospecting_ai_providers text[] NOT NULL DEFAULT ARRAY['anthropic']::text[],
  ADD COLUMN IF NOT EXISTS prospecting_ai_strategy text NOT NULL DEFAULT 'consensus';

ALTER TABLE public.company_settings
  DROP CONSTRAINT IF EXISTS company_settings_contact_approval_mode_check,
  DROP CONSTRAINT IF EXISTS company_settings_contact_approval_min_score_check,
  DROP CONSTRAINT IF EXISTS company_settings_prospecting_ai_strategy_check,
  DROP CONSTRAINT IF EXISTS company_settings_prospecting_ai_providers_check;

ALTER TABLE public.company_settings
  ADD CONSTRAINT company_settings_contact_approval_mode_check
    CHECK (contact_approval_mode IN ('automatic', 'score', 'manual')),
  ADD CONSTRAINT company_settings_contact_approval_min_score_check
    CHECK (contact_approval_min_score BETWEEN 0 AND 100),
  ADD CONSTRAINT company_settings_prospecting_ai_strategy_check
    CHECK (prospecting_ai_strategy IN ('consensus', 'fallback')),
  ADD CONSTRAINT company_settings_prospecting_ai_providers_check
    CHECK (
      cardinality(prospecting_ai_providers) BETWEEN 1 AND 3
      AND prospecting_ai_providers <@ ARRAY['openai', 'anthropic', 'gemini']::text[]
    );

-- O booleano antigo permanece por compatibilidade com instalacoes existentes.
-- A partir desta migration, o modo acima e a fonte de verdade. Todo contato
-- ainda exige status approved/inbound no proprio lead.
UPDATE public.company_settings
SET require_contact_approval = true
WHERE require_contact_approval IS DISTINCT FROM true;

-- Os pesos eram uma unica linha global. A classificacao automatizada precisa
-- usar pesos por organizacao para que uma empresa nao altere a regra da outra.
ALTER TABLE public.score_weights
  ADD COLUMN IF NOT EXISTS organization_id uuid
    REFERENCES public.organizations(id) ON DELETE CASCADE;

DO $$
DECLARE
  legacy_org uuid;
BEGIN
  SELECT id INTO legacy_org FROM public.organizations ORDER BY created_at LIMIT 1;
  IF legacy_org IS NOT NULL THEN
    UPDATE public.score_weights
    SET organization_id = legacy_org
    WHERE id = (
      SELECT id
      FROM public.score_weights
      WHERE organization_id IS NULL
      ORDER BY updated_at DESC, id
      LIMIT 1
    );
  END IF;

  INSERT INTO public.score_weights(organization_id)
  SELECT org.id
  FROM public.organizations org
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.score_weights weights
    WHERE weights.organization_id = org.id
  );
END $$;

ALTER TABLE public.score_weights
  ALTER COLUMN organization_id SET DEFAULT public.current_org_id();
DROP TRIGGER IF EXISTS trg_score_weights_resolve_org ON public.score_weights;
CREATE TRIGGER trg_score_weights_resolve_org
BEFORE INSERT OR UPDATE ON public.score_weights
FOR EACH ROW EXECUTE FUNCTION public.resolve_row_organization();
CREATE UNIQUE INDEX IF NOT EXISTS score_weights_one_per_org_idx
  ON public.score_weights(organization_id)
  WHERE organization_id IS NOT NULL;

ALTER TABLE public.score_weights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS score_weights_org_scope ON public.score_weights;
CREATE POLICY score_weights_org_scope
ON public.score_weights AS RESTRICTIVE FOR ALL TO authenticated
USING (organization_id = public.current_org_id())
WITH CHECK (organization_id = public.current_org_id());

-- A restricao legada permitia somente uma cadencia padrao na plataforma
-- inteira. Cada organizacao precisa da propria cadencia para operar de forma
-- independente e para o worker localizar o primeiro passo corretamente.
DROP INDEX IF EXISTS public.outreach_sequences_single_default;

INSERT INTO public.outreach_sequences(
  organization_id, name, description, active, is_default
)
SELECT
  org.id,
  'Cadencia padrao',
  'WhatsApp, depois e-mail e, por ultimo, tarefa humana de telefone.',
  true,
  true
FROM public.organizations org
WHERE NOT EXISTS (
  SELECT 1
  FROM public.outreach_sequences seq
  WHERE seq.organization_id = org.id
    AND seq.is_default = true
);

INSERT INTO public.outreach_sequence_steps(
  organization_id, sequence_id, order_index, channel, delay_minutes,
  template, continue_on, active
)
SELECT
  seq.organization_id, seq.id, step.order_index,
  step.channel::public.sequence_step_channel, step.delay_minutes,
  NULL, step.continue_on::jsonb, true
FROM public.outreach_sequences seq
CROSS JOIN (
  VALUES
    (0, 'whatsapp', 1440, '["failed","skipped"]'),
    (1, 'email', 1440, '["failed","skipped"]'),
    (2, 'phone', 0, '[]')
) AS step(order_index, channel, delay_minutes, continue_on)
WHERE seq.is_default = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.outreach_sequence_steps existing
    WHERE existing.sequence_id = seq.id
      AND existing.order_index = step.order_index
  );

CREATE UNIQUE INDEX IF NOT EXISTS outreach_sequences_default_per_org_idx
  ON public.outreach_sequences(organization_id)
  WHERE is_default = true AND organization_id IS NOT NULL;

-- O primeiro contato e executado em uma Server Function autenticada. Ela
-- precisa poder enfileirar o timeout; atualizacao/lock continuam exclusivos do
-- worker com service_role.
GRANT SELECT, INSERT ON public.outreach_jobs TO authenticated;
DROP POLICY IF EXISTS outreach_jobs_insert_for_accessible_lead ON public.outreach_jobs;
CREATE POLICY outreach_jobs_insert_for_accessible_lead
ON public.outreach_jobs FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_org_id()
  AND EXISTS (
    SELECT 1
    FROM public.leads lead
    WHERE lead.id = outreach_jobs.lead_id
      AND (
        public.has_role(auth.uid(), 'administrador')
        OR lead.owner_id = auth.uid()
        OR lead.assigned_to = auth.uid()
      )
  )
);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS prospect_identity text,
  ADD COLUMN IF NOT EXISTS contact_approval_reason text,
  ADD COLUMN IF NOT EXISTS automation_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS automation_error text,
  ADD COLUMN IF NOT EXISTS automation_updated_at timestamptz;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_automation_status_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_automation_status_check CHECK (
    automation_status IN (
      'not_started', 'pending_approval', 'running', 'failed', 'paused', 'completed', 'human'
    )
  );

-- Nao fazemos backfill da identidade: dados antigos podem conter duplicatas.
-- Todos os novos prospectos recebem a chave canonica na aplicacao.
CREATE UNIQUE INDEX IF NOT EXISTS leads_org_prospect_identity_unique_idx
  ON public.leads(organization_id, prospect_identity)
  WHERE organization_id IS NOT NULL AND prospect_identity IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_pending_approval_idx
  ON public.leads(organization_id, contact_approval_status, score DESC)
  WHERE contact_approval_status = 'pending';
CREATE INDEX IF NOT EXISTS leads_automation_status_idx
  ON public.leads(organization_id, automation_status, automation_updated_at DESC);

-- Historico imutavel de decisoes de contato. O trigger garante auditoria
-- inclusive para alteracoes realizadas por automacoes ou service role.
CREATE TABLE IF NOT EXISTS public.lead_contact_approval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id()
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('pending', 'approved', 'rejected', 'inbound')),
  approval_mode text NOT NULL CHECK (approval_mode IN ('automatic', 'score', 'manual', 'inbound')),
  lead_score integer,
  min_score integer,
  reason text,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_contact_approval_events_lead_idx
  ON public.lead_contact_approval_events(lead_id, decided_at DESC);

CREATE OR REPLACE FUNCTION public.log_lead_contact_approval_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  configured_mode text := 'automatic';
  configured_min_score integer := 70;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.contact_approval_status IS NOT DISTINCT FROM NEW.contact_approval_status THEN
    RETURN NEW;
  END IF;

  SELECT cs.contact_approval_mode, cs.contact_approval_min_score
  INTO configured_mode, configured_min_score
  FROM public.company_settings cs
  WHERE cs.organization_id = NEW.organization_id
  LIMIT 1;

  INSERT INTO public.lead_contact_approval_events(
    organization_id, lead_id, decision, approval_mode, lead_score,
    min_score, reason, decided_by, decided_at
  ) VALUES (
    NEW.organization_id,
    NEW.id,
    NEW.contact_approval_status,
    CASE WHEN NEW.contact_approval_status = 'inbound' THEN 'inbound'
         ELSE COALESCE(configured_mode, 'automatic') END,
    NEW.score,
    configured_min_score,
    NEW.contact_approval_reason,
    NEW.contact_approved_by,
    COALESCE(NEW.contact_approved_at, now())
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_log_contact_approval ON public.leads;
CREATE TRIGGER trg_leads_log_contact_approval
AFTER INSERT OR UPDATE OF contact_approval_status ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.log_lead_contact_approval_event();

GRANT SELECT ON public.lead_contact_approval_events TO authenticated;
GRANT ALL ON public.lead_contact_approval_events TO service_role;
ALTER TABLE public.lead_contact_approval_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_contact_approval_events_org_access ON public.lead_contact_approval_events;
CREATE POLICY lead_contact_approval_events_org_access
ON public.lead_contact_approval_events FOR SELECT TO authenticated
USING (organization_id = public.current_org_id());

-- Heartbeat global dos dois workers. Nao contem dados de leads; serve para
-- deixar claro na interface se o agendador realmente esta executando.
CREATE TABLE IF NOT EXISTS public.automation_heartbeats (
  job_name text PRIMARY KEY CHECK (job_name IN ('outreach', 'prospecting')),
  last_started_at timestamptz,
  last_finished_at timestamptz,
  status text NOT NULL DEFAULT 'never' CHECK (status IN ('never', 'running', 'success', 'partial', 'failed')),
  last_error text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.automation_heartbeats(job_name) VALUES ('outreach'), ('prospecting')
ON CONFLICT (job_name) DO NOTHING;

GRANT SELECT ON public.automation_heartbeats TO authenticated;
GRANT ALL ON public.automation_heartbeats TO service_role;
ALTER TABLE public.automation_heartbeats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS automation_heartbeats_admin_read ON public.automation_heartbeats;
CREATE POLICY automation_heartbeats_admin_read
ON public.automation_heartbeats FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'administrador'));

-- Anexos seguem exatamente o mesmo recorte do lead/ticket: administrador ve
-- todos; vendedor ve apenas leads proprios ou atribuidos.
DROP POLICY IF EXISTS message_attachments_org_access ON public.message_attachments;
CREATE POLICY message_attachments_lead_access
ON public.message_attachments FOR SELECT TO authenticated
USING (
  organization_id = public.current_org_id()
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = message_attachments.lead_id
      AND (
        public.has_role(auth.uid(), 'administrador')
        OR l.owner_id = auth.uid()
        OR l.assigned_to = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS message_media_auth_read ON storage.objects;
CREATE POLICY message_media_auth_read ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'message-media'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id::text = (storage.foldername(name))[2]
      AND (
        public.has_role(auth.uid(), 'administrador')
        OR l.owner_id = auth.uid()
        OR l.assigned_to = auth.uid()
      )
  )
);
