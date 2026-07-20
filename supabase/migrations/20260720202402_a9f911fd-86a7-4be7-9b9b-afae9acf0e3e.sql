DROP POLICY IF EXISTS leads_select ON public.leads;
DROP POLICY IF EXISTS leads_update ON public.leads;
CREATE POLICY leads_select ON public.leads FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR assigned_to = auth.uid()
    OR public.has_role(auth.uid(), 'administrador')
  );
CREATE POLICY leads_update ON public.leads FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR assigned_to = auth.uid()
    OR public.has_role(auth.uid(), 'administrador')
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR assigned_to = auth.uid()
    OR public.has_role(auth.uid(), 'administrador')
  );

DROP POLICY IF EXISTS lead_messages_select ON public.lead_messages;
DROP POLICY IF EXISTS lead_messages_insert ON public.lead_messages;
CREATE POLICY lead_messages_select ON public.lead_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_id
      AND (
        l.owner_id = auth.uid()
        OR l.assigned_to = auth.uid()
        OR public.has_role(auth.uid(), 'administrador')
      )
  ));
CREATE POLICY lead_messages_insert ON public.lead_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_id
      AND (
        l.owner_id = auth.uid()
        OR l.assigned_to = auth.uid()
        OR public.has_role(auth.uid(), 'administrador')
      )
  ));

DROP POLICY IF EXISTS lead_tasks_select ON public.lead_tasks;
DROP POLICY IF EXISTS lead_tasks_write ON public.lead_tasks;
CREATE POLICY lead_tasks_select ON public.lead_tasks FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_id
      AND (
        l.owner_id = auth.uid()
        OR l.assigned_to = auth.uid()
        OR public.has_role(auth.uid(), 'administrador')
      )
  ));
CREATE POLICY lead_tasks_write ON public.lead_tasks FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_id
      AND (
        l.owner_id = auth.uid()
        OR l.assigned_to = auth.uid()
        OR public.has_role(auth.uid(), 'administrador')
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_id
      AND (
        l.owner_id = auth.uid()
        OR l.assigned_to = auth.uid()
        OR public.has_role(auth.uid(), 'administrador')
      )
  ));

DROP POLICY IF EXISTS outreach_owner_select ON public.lead_outreach;
DROP POLICY IF EXISTS outreach_owner_insert ON public.lead_outreach;
DROP POLICY IF EXISTS outreach_owner_update ON public.lead_outreach;
DROP POLICY IF EXISTS outreach_owner_delete ON public.lead_outreach;
DROP POLICY IF EXISTS outreach_lead_select ON public.lead_outreach;
DROP POLICY IF EXISTS outreach_lead_insert ON public.lead_outreach;
DROP POLICY IF EXISTS outreach_lead_update ON public.lead_outreach;
DROP POLICY IF EXISTS outreach_lead_delete ON public.lead_outreach;
CREATE POLICY outreach_lead_select ON public.lead_outreach FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_id
      AND (
        l.owner_id = auth.uid()
        OR l.assigned_to = auth.uid()
        OR public.has_role(auth.uid(), 'administrador')
      )
  ));
CREATE POLICY outreach_lead_insert ON public.lead_outreach FOR INSERT TO authenticated
  WITH CHECK (
    (owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'))
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_id
        AND (
          l.owner_id = auth.uid()
          OR l.assigned_to = auth.uid()
          OR public.has_role(auth.uid(), 'administrador')
        )
    )
  );
CREATE POLICY outreach_lead_update ON public.lead_outreach FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));
CREATE POLICY outreach_lead_delete ON public.lead_outreach FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));

CREATE INDEX IF NOT EXISTS idx_leads_assigned_updated
  ON public.leads(assigned_to, updated_at DESC);

-- === Segunda migration: Z-API único e dedup de webhook ===
ALTER TABLE public.company_settings
  DROP COLUMN IF EXISTS evolution_url,
  DROP COLUMN IF EXISTS evolution_api_key,
  DROP COLUMN IF EXISTS evolution_instance,
  DROP COLUMN IF EXISTS evolution_active;

UPDATE public.integrations SET label = 'WhatsApp (Z-API)' WHERE key = 'whatsapp';
UPDATE public.integrations SET label = 'E-mail (Resend)' WHERE key = 'email';

ALTER TABLE public.lead_messages
  ADD COLUMN IF NOT EXISTS provider_message_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_messages_provider_message_id
  ON public.lead_messages(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS content_text text;

ALTER TABLE public.unanswered_questions
  ADD COLUMN IF NOT EXISTS answer text;

CREATE TABLE IF NOT EXISTS public.contact_suppressions (
  contact_hash text PRIMARY KEY,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'phone', 'email')),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT 'opt_out',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.contact_suppressions TO authenticated;
GRANT ALL ON public.contact_suppressions TO service_role;
ALTER TABLE public.contact_suppressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY contact_suppressions_select ON public.contact_suppressions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));
CREATE POLICY contact_suppressions_insert ON public.contact_suppressions
  FOR INSERT TO authenticated WITH CHECK (true);