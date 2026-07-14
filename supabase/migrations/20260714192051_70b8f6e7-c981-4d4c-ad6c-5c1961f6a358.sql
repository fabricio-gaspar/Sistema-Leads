
-- BLOCO 2: refinar RLS por dono + admin, adicionar índices e colunas de IA

-- 1) Colunas de IA em company_settings (persistir prompt/modelo/temperatura da Ana)
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS ai_prompt text,
  ADD COLUMN IF NOT EXISTS ai_model text DEFAULT 'claude-sonnet-4-5',
  ADD COLUMN IF NOT EXISTS ai_temperature numeric DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS ai_max_tokens integer DEFAULT 1024;

-- 2) owner_id nas tabelas de negócio (referenciando auth.users via profiles)
ALTER TABLE public.leads      ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.proposals  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.orders     ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3) Índices em FKs quentes
CREATE INDEX IF NOT EXISTS idx_leads_owner_id        ON public.leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage           ON public.leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_updated_at      ON public.leads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_messages_lead    ON public.lead_messages(lead_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_lead       ON public.lead_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_owner      ON public.lead_tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_proposals_owner       ON public.proposals(owner_id);
CREATE INDEX IF NOT EXISTS idx_orders_owner          ON public.orders(owner_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred   ON public.audit_logs(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents(uploaded_by);

-- 4) RLS: substituir policies permissivas por owner + admin
-- LEADS
DROP POLICY IF EXISTS leads_all_auth ON public.leads;
CREATE POLICY leads_select ON public.leads FOR SELECT TO authenticated
  USING (owner_id IS NULL OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));
CREATE POLICY leads_insert ON public.leads FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));
CREATE POLICY leads_update ON public.leads FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));
CREATE POLICY leads_delete ON public.leads FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));

-- LEAD_MESSAGES (herda do lead)
DROP POLICY IF EXISTS lead_messages_all_auth ON public.lead_messages;
CREATE POLICY lead_messages_select ON public.lead_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id
    AND (l.owner_id IS NULL OR l.owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'))));
CREATE POLICY lead_messages_insert ON public.lead_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id
    AND (l.owner_id IS NULL OR l.owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'))));
CREATE POLICY lead_messages_update ON public.lead_messages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));
CREATE POLICY lead_messages_delete ON public.lead_messages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));

-- LEAD_TASKS
DROP POLICY IF EXISTS lead_tasks_all_auth ON public.lead_tasks;
CREATE POLICY lead_tasks_select ON public.lead_tasks FOR SELECT TO authenticated
  USING (owner_id IS NULL OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador')
    OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.owner_id = auth.uid()));
CREATE POLICY lead_tasks_write ON public.lead_tasks FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador')
    OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.owner_id = auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador')
    OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.owner_id = auth.uid()));

-- PROPOSALS
DROP POLICY IF EXISTS proposals_all_auth ON public.proposals;
CREATE POLICY proposals_select ON public.proposals FOR SELECT TO authenticated
  USING (owner_id IS NULL OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));
CREATE POLICY proposals_write ON public.proposals FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));

-- ORDERS
DROP POLICY IF EXISTS orders_all_auth ON public.orders;
CREATE POLICY orders_select ON public.orders FOR SELECT TO authenticated
  USING (owner_id IS NULL OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));
CREATE POLICY orders_write ON public.orders FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));

-- SERVICES / OBJECTIONS / SCORE_WEIGHTS: catálogo compartilhado — leitura todos, escrita admin
DROP POLICY IF EXISTS services_all_auth ON public.services;
CREATE POLICY services_select ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY services_admin_write ON public.services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador')) WITH CHECK (public.has_role(auth.uid(), 'administrador'));

DROP POLICY IF EXISTS objections_all_auth ON public.objections;
CREATE POLICY objections_select ON public.objections FOR SELECT TO authenticated USING (true);
CREATE POLICY objections_admin_write ON public.objections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador')) WITH CHECK (public.has_role(auth.uid(), 'administrador'));

DROP POLICY IF EXISTS score_weights_all_auth ON public.score_weights;
CREATE POLICY score_weights_select ON public.score_weights FOR SELECT TO authenticated USING (true);
CREATE POLICY score_weights_admin_write ON public.score_weights FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador')) WITH CHECK (public.has_role(auth.uid(), 'administrador'));

-- TASKS (globais) e UNANSWERED_QUESTIONS: leitura todos, admin gerencia
DROP POLICY IF EXISTS tasks_all_auth ON public.tasks;
CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY tasks_admin_write ON public.tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador')) WITH CHECK (public.has_role(auth.uid(), 'administrador'));

DROP POLICY IF EXISTS unanswered_all_auth ON public.unanswered_questions;
CREATE POLICY unanswered_select ON public.unanswered_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY unanswered_insert ON public.unanswered_questions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY unanswered_admin_write ON public.unanswered_questions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'administrador')) WITH CHECK (public.has_role(auth.uid(), 'administrador'));
CREATE POLICY unanswered_admin_delete ON public.unanswered_questions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));

-- DOCUMENTS: dono do upload + admin
DROP POLICY IF EXISTS documents_all_auth ON public.documents;
CREATE POLICY documents_select ON public.documents FOR SELECT TO authenticated
  USING (uploaded_by IS NULL OR uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'administrador'));
CREATE POLICY documents_insert ON public.documents FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'administrador'));
CREATE POLICY documents_update ON public.documents FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'administrador'));
CREATE POLICY documents_delete ON public.documents FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'administrador'));

-- VENDOR_SESSIONS: só admin cria/gerencia, vendedor consome via server function
DROP POLICY IF EXISTS vendor_sessions_all_auth ON public.vendor_sessions;
CREATE POLICY vendor_sessions_admin_all ON public.vendor_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador')) WITH CHECK (public.has_role(auth.uid(), 'administrador'));

-- AUDIT_LOGS: manter leitura para todos (usado em timeline), insert livre autenticado
-- policies existentes ficam.
