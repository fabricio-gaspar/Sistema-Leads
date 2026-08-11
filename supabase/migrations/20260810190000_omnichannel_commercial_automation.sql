-- Plataforma comercial omnicanal: isolamento por organização, aprovação de
-- contato, operação da Central, automações genéricas e canais multimodais.

ALTER TYPE public.outreach_channel ADD VALUE IF NOT EXISTS 'instagram';

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS ai_provider text NOT NULL DEFAULT 'anthropic'
    CHECK (ai_provider IN ('openai', 'anthropic', 'gemini')),
  ADD COLUMN IF NOT EXISTS ai_fallback_provider text
    CHECK (ai_fallback_provider IS NULL OR ai_fallback_provider IN ('openai', 'anthropic', 'gemini')),
  ADD COLUMN IF NOT EXISTS ai_multimodal_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_actions_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_contact_approval boolean NOT NULL DEFAULT true;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS contact_approval_status text NOT NULL DEFAULT 'pending'
    CHECK (contact_approval_status IN ('pending', 'approved', 'rejected', 'inbound')),
  ADD COLUMN IF NOT EXISTS contact_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS contact_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instagram_user_id text;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'upload'
    CHECK (source_type IN ('upload', 'url', 'catalog', 'manual')),
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS indexed_at timestamptz,
  ADD COLUMN IF NOT EXISTS index_error text;

-- Todas as entidades operacionais recebem organization_id. O trigger abaixo
-- deriva o tenant do lead/documento/sequência/usuário quando um worker usa
-- service_role e não possui JWT de usuário.
DO $$
DECLARE
  table_name text;
  tables text[] := ARRAY[
    'services', 'objections', 'integrations', 'audit_logs', 'proposals', 'orders',
    'lead_messages', 'lead_outreach', 'lead_tasks', 'lead_handoffs',
    'lead_qualifications', 'lead_assignments', 'lead_stage_history', 'appointments',
    'outreach_sequences', 'outreach_sequence_steps', 'lead_sequence_enrollments',
    'outreach_jobs', 'knowledge_chunks', 'unanswered_questions', 'notifications',
    'prospecting_cache', 'prospecting_schedules', 'prospecting_schedule_runs'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE',
        table_name
      );
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.resolve_row_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb := to_jsonb(NEW);
  org_id uuid;
  ref_id uuid;
BEGIN
  BEGIN
    org_id := NULLIF(payload->>'organization_id', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    org_id := NULL;
  END;
  IF org_id IS NOT NULL THEN RETURN NEW; END IF;

  org_id := public.current_org_id();

  IF org_id IS NULL AND NULLIF(payload->>'lead_id', '') IS NOT NULL THEN
    ref_id := (payload->>'lead_id')::uuid;
    SELECT organization_id INTO org_id FROM public.leads WHERE id = ref_id;
  END IF;
  IF org_id IS NULL AND NULLIF(payload->>'document_id', '') IS NOT NULL THEN
    ref_id := (payload->>'document_id')::uuid;
    SELECT organization_id INTO org_id FROM public.documents WHERE id = ref_id;
  END IF;
  IF org_id IS NULL AND NULLIF(payload->>'sequence_id', '') IS NOT NULL THEN
    ref_id := (payload->>'sequence_id')::uuid;
    SELECT organization_id INTO org_id FROM public.outreach_sequences WHERE id = ref_id;
  END IF;
  IF org_id IS NULL AND NULLIF(payload->>'schedule_id', '') IS NOT NULL THEN
    ref_id := (payload->>'schedule_id')::uuid;
    SELECT organization_id INTO org_id FROM public.prospecting_schedules WHERE id = ref_id;
  END IF;
  IF org_id IS NULL THEN
    BEGIN
      ref_id := COALESCE(
        NULLIF(payload->>'owner_id', '')::uuid,
        NULLIF(payload->>'actor_id', '')::uuid,
        NULLIF(payload->>'user_id', '')::uuid,
        NULLIF(payload->>'created_by', '')::uuid,
        NULLIF(payload->>'uploaded_by', '')::uuid
      );
    EXCEPTION WHEN OTHERS THEN
      ref_id := NULL;
    END;
    IF ref_id IS NOT NULL THEN
      SELECT organization_id INTO org_id
      FROM public.organization_members
      WHERE user_id = ref_id
      ORDER BY created_at
      LIMIT 1;
    END IF;
  END IF;

  -- Compatibilidade segura para instalações com apenas uma organização.
  IF org_id IS NULL AND (SELECT count(*) FROM public.organizations) = 1 THEN
    SELECT id INTO org_id FROM public.organizations LIMIT 1;
  END IF;
  IF org_id IS NULL THEN
    RAISE EXCEPTION 'organization_id obrigatório para %', TG_TABLE_NAME;
  END IF;

  NEW := jsonb_populate_record(NEW, jsonb_build_object('organization_id', org_id));
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name text;
  legacy_org uuid;
  tables text[] := ARRAY[
    'company_settings', 'leads', 'documents', 'services', 'objections', 'integrations',
    'audit_logs', 'proposals', 'orders', 'lead_messages', 'lead_outreach', 'lead_tasks',
    'lead_handoffs', 'lead_qualifications', 'lead_assignments', 'lead_stage_history',
    'appointments', 'outreach_sequences', 'outreach_sequence_steps',
    'lead_sequence_enrollments', 'outreach_jobs', 'knowledge_chunks',
    'unanswered_questions', 'notifications', 'prospecting_cache',
    'prospecting_schedules', 'prospecting_schedule_runs'
  ];
BEGIN
  SELECT id INTO legacy_org FROM public.organizations ORDER BY created_at LIMIT 1;
  FOREACH table_name IN ARRAY tables LOOP
    IF to_regclass('public.' || table_name) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    IF legacy_org IS NOT NULL THEN
      EXECUTE format('UPDATE public.%I SET organization_id = $1 WHERE organization_id IS NULL', table_name)
      USING legacy_org;
    END IF;
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN organization_id SET DEFAULT public.current_org_id()',
      table_name
    );
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_resolve_org ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_resolve_org BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.resolve_row_organization()',
      table_name, table_name
    );
    EXECUTE format('DROP POLICY IF EXISTS %I_org_scope ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I_org_scope ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id())',
      table_name, table_name
    );
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS company_settings_one_per_org_idx
  ON public.company_settings(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_org_stage_idx ON public.leads(organization_id, stage);
CREATE INDEX IF NOT EXISTS leads_instagram_user_idx ON public.leads(organization_id, instagram_user_id)
  WHERE instagram_user_id IS NOT NULL;

-- Central de Atendimento -----------------------------------------------------

CREATE TABLE public.sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  first_response_minutes integer NOT NULL DEFAULT 30 CHECK (first_response_minutes BETWEEN 1 AND 10080),
  resolution_minutes integer NOT NULL DEFAULT 1440 CHECK (resolution_minutes BETWEEN 1 AND 43200),
  business_hours_only boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#2563eb',
  sla_policy_id uuid REFERENCES public.sla_policies(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE public.service_queues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  name text NOT NULL,
  channel text NOT NULL DEFAULT 'all' CHECK (channel IN ('all', 'whatsapp', 'email', 'instagram', 'phone')),
  assignment_strategy text NOT NULL DEFAULT 'round_robin' CHECK (assignment_strategy IN ('manual', 'round_robin', 'least_loaded')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  protocol text NOT NULL DEFAULT ('ATD-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  queue_id uuid REFERENCES public.service_queues(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting_customer', 'waiting_agent', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  source_channel text NOT NULL DEFAULT 'whatsapp' CHECK (source_channel IN ('whatsapp', 'email', 'instagram', 'phone', 'manual')),
  first_response_due_at timestamptz,
  resolution_due_at timestamptz,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX tickets_one_open_per_lead_idx ON public.tickets(lead_id)
  WHERE status IN ('open', 'waiting_customer', 'waiting_agent');
CREATE UNIQUE INDEX tickets_protocol_org_idx ON public.tickets(organization_id, protocol);
CREATE INDEX tickets_queue_sla_idx ON public.tickets(organization_id, status, first_response_due_at, assigned_to);

CREATE OR REPLACE FUNCTION public.create_ticket_on_lead_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_queue uuid;
  default_department uuid;
  channel_name text;
BEGIN
  IF NEW.contact_approval_status NOT IN ('approved', 'inbound') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.contact_approval_status = NEW.contact_approval_status THEN RETURN NEW; END IF;
  SELECT q.id, q.department_id INTO default_queue, default_department
  FROM public.service_queues q
  WHERE q.organization_id = NEW.organization_id AND q.active
  ORDER BY q.created_at
  LIMIT 1;
  channel_name := CASE
    WHEN NEW.instagram_user_id IS NOT NULL THEN 'instagram'
    WHEN NEW.email IS NOT NULL AND NEW.phone IS NULL AND NEW.whatsapp IS NULL THEN 'email'
    ELSE 'whatsapp'
  END;
  INSERT INTO public.tickets(
    organization_id, lead_id, queue_id, department_id, assigned_to, status, source_channel
  ) VALUES (
    NEW.organization_id, NEW.id, default_queue, default_department, NEW.assigned_to,
    CASE WHEN NEW.owner = 'human' THEN 'waiting_agent' ELSE 'open' END,
    channel_name
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leads_create_ticket_after_approval
AFTER INSERT OR UPDATE OF contact_approval_status ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.create_ticket_on_lead_approval();

CREATE TABLE public.ticket_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE public.ticket_tags (
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, tag_id)
);

CREATE TABLE public.quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  shortcut text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  channel text NOT NULL DEFAULT 'all' CHECK (channel IN ('all', 'whatsapp', 'email', 'instagram')),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, shortcut)
);

CREATE TABLE public.call_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  provider text,
  external_id text,
  direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'ringing', 'answered', 'failed', 'completed')),
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  recording_url text,
  recording_consent boolean NOT NULL DEFAULT false,
  transcript text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Canais, anexos e Instagram -------------------------------------------------

CREATE TABLE public.channel_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'email', 'instagram', 'phone')),
  provider text NOT NULL,
  label text NOT NULL,
  external_account_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'error', 'disabled')),
  is_default boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_healthcheck_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, channel, provider, label)
);

CREATE UNIQUE INDEX channel_connections_one_default_idx
  ON public.channel_connections(organization_id, channel) WHERE is_default AND status <> 'disabled';

CREATE TABLE public.channel_inbound_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  event_type text NOT NULL,
  external_id text NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (organization_id, provider, external_id)
);

CREATE TABLE public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.lead_messages(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('image', 'audio', 'document', 'video')),
  mime_type text,
  file_name text,
  storage_path text,
  external_url text,
  transcript text,
  extracted_text text,
  ai_processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Motor genérico de automações ----------------------------------------------

CREATE TABLE public.workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  trigger_event text NOT NULL CHECK (trigger_event IN (
    'lead_approved', 'message_received', 'stage_changed', 'sla_breached',
    'appointment_created', 'handoff_created', 'ticket_closed'
  )),
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE public.workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
  order_index integer NOT NULL,
  action_type text NOT NULL CHECK (action_type IN (
    'wait', 'condition', 'send_message', 'create_task', 'assign', 'change_stage',
    'add_tag', 'create_ticket', 'webhook', 'handoff', 'schedule'
  )),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, order_index)
);

CREATE TABLE public.workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'waiting', 'completed', 'failed', 'cancelled')),
  current_step_index integer NOT NULL DEFAULT 0,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  next_run_at timestamptz,
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workflow_runs_due_idx ON public.workflow_runs(organization_id, status, next_run_at);

-- RLS e grants das novas entidades.
DO $$
DECLARE
  table_name text;
  tables text[] := ARRAY[
    'sla_policies', 'departments', 'service_queues', 'tickets', 'ticket_notes',
    'tags', 'ticket_tags', 'quick_replies', 'call_records', 'channel_connections',
    'channel_inbound_events', 'message_attachments', 'workflow_definitions',
    'workflow_steps', 'workflow_runs'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', table_name);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I_org_access ON public.%I FOR ALL TO authenticated USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id())',
      table_name, table_name
    );
  END LOOP;
END $$;

-- O vendedor só consulta tickets atribuídos ou de leads próprios; administradores
-- mantêm visão total dentro da organização. Substitui a política ampla de tickets.
DROP POLICY IF EXISTS tickets_org_access ON public.tickets;
CREATE POLICY tickets_scoped_access ON public.tickets FOR ALL TO authenticated
USING (
  organization_id = public.current_org_id()
  AND (
    public.has_role(auth.uid(), 'administrador')
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = tickets.lead_id
        AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid())
    )
  )
)
WITH CHECK (
  organization_id = public.current_org_id()
  AND (
    public.has_role(auth.uid(), 'administrador')
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = tickets.lead_id
        AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid())
    )
  )
);

-- Notas e tags internas herdam o recorte do ticket. Assim, um vendedor não
-- consegue acessar dados internos de tickets pertencentes a outro vendedor.
DROP POLICY IF EXISTS ticket_notes_org_access ON public.ticket_notes;
CREATE POLICY ticket_notes_ticket_access ON public.ticket_notes FOR ALL TO authenticated
USING (
  organization_id = public.current_org_id()
  AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_notes.ticket_id)
)
WITH CHECK (
  organization_id = public.current_org_id()
  AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_notes.ticket_id)
);

DROP POLICY IF EXISTS ticket_tags_org_access ON public.ticket_tags;
CREATE POLICY ticket_tags_ticket_access ON public.ticket_tags FOR ALL TO authenticated
USING (
  organization_id = public.current_org_id()
  AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_tags.ticket_id)
)
WITH CHECK (
  organization_id = public.current_org_id()
  AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_tags.ticket_id)
);

CREATE OR REPLACE FUNCTION public.apply_ticket_sla()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  first_minutes integer := 30;
  resolution_minutes integer := 1440;
BEGIN
  SELECT sp.first_response_minutes, sp.resolution_minutes
    INTO first_minutes, resolution_minutes
  FROM public.sla_policies sp
  LEFT JOIN public.departments d ON d.sla_policy_id = sp.id
  WHERE sp.organization_id = NEW.organization_id
    AND sp.active
    AND (NEW.department_id IS NULL OR d.id = NEW.department_id)
  ORDER BY (d.id IS NOT NULL) DESC
  LIMIT 1;
  NEW.first_response_due_at := COALESCE(NEW.first_response_due_at, now() + make_interval(mins => COALESCE(first_minutes, 30)));
  NEW.resolution_due_at := COALESCE(NEW.resolution_due_at, now() + make_interval(mins => COALESCE(resolution_minutes, 1440)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tickets_apply_sla BEFORE INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.apply_ticket_sla();

DO $$
DECLARE org record;
DECLARE sla uuid;
DECLARE dept uuid;
DECLARE queue uuid;
BEGIN
  FOR org IN SELECT id FROM public.organizations LOOP
    INSERT INTO public.sla_policies(organization_id, name, first_response_minutes, resolution_minutes)
    VALUES (org.id, 'SLA Comercial', 30, 1440)
    ON CONFLICT (organization_id, name) DO UPDATE SET active = true
    RETURNING id INTO sla;

    INSERT INTO public.departments(organization_id, name, description, color, sla_policy_id)
    VALUES (org.id, 'Comercial', 'Qualificação, propostas e fechamento', '#2563eb', sla)
    ON CONFLICT (organization_id, name) DO UPDATE SET sla_policy_id = EXCLUDED.sla_policy_id
    RETURNING id INTO dept;

    INSERT INTO public.service_queues(organization_id, department_id, name, channel, assignment_strategy)
    VALUES (org.id, dept, 'Novas oportunidades', 'all', 'round_robin')
    ON CONFLICT (organization_id, name) DO UPDATE SET department_id = EXCLUDED.department_id
    RETURNING id INTO queue;

    INSERT INTO public.tags(organization_id, name, color) VALUES
      (org.id, 'Quente', '#dc2626'),
      (org.id, 'Orçamento', '#d97706'),
      (org.id, 'Reunião', '#7c3aed'),
      (org.id, 'Prioritário', '#be123c')
    ON CONFLICT (organization_id, name) DO NOTHING;

    INSERT INTO public.quick_replies(organization_id, shortcut, title, body, channel) VALUES
      (org.id, '/apresentacao', 'Apresentação', 'Olá! Sou da equipe comercial. Obrigado pelo contato. Como posso ajudar?', 'all'),
      (org.id, '/especialista', 'Transferência para especialista', 'Vou encaminhar sua solicitação para um especialista, que continuará o atendimento por aqui.', 'all'),
      (org.id, '/agenda', 'Agendamento', 'Posso verificar os horários disponíveis para agendarmos uma conversa rápida.', 'all')
    ON CONFLICT (organization_id, shortcut) DO NOTHING;

    INSERT INTO public.tickets(organization_id, lead_id, queue_id, department_id, assigned_to, status, source_channel)
    SELECT org.id, l.id, queue, dept, l.assigned_to, 'open',
      CASE WHEN l.instagram_user_id IS NOT NULL THEN 'instagram'
           WHEN l.email IS NOT NULL AND l.phone IS NULL AND l.whatsapp IS NULL THEN 'email'
           ELSE 'whatsapp' END
    FROM public.leads l
    WHERE l.organization_id = org.id
      AND l.stage NOT IN ('Fechado', 'Perdido')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Storage privado para anexos da Central. O acesso é sempre mediado pelo app.
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-media', 'message-media', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS message_media_auth_read ON storage.objects;
CREATE POLICY message_media_auth_read ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'message-media'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
);
DROP POLICY IF EXISTS message_media_auth_insert ON storage.objects;
CREATE POLICY message_media_auth_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'message-media'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
);
