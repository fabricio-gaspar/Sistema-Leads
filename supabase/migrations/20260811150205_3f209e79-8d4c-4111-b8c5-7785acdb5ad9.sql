-- Fix missing RLS policies for organizations, score_weights, and unanswered_questions

-- 1. Organizations: Allow members to see their own organization
DROP POLICY IF EXISTS "organizations_isolation" ON public.organizations;
CREATE POLICY "organizations_isolation" ON public.organizations
FOR SELECT TO authenticated
USING (
  id IN (
    SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

-- 2. Score Weights: Organization isolation
-- Ensure organization_id exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'score_weights' AND column_name = 'organization_id') THEN
        ALTER TABLE public.score_weights ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
    END IF;
END $$;

DROP POLICY IF EXISTS "score_weights_isolation" ON public.score_weights;
CREATE POLICY "score_weights_isolation" ON public.score_weights
FOR ALL TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

-- 3. Unanswered Questions: Organization isolation
-- Ensure organization_id exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'unanswered_questions' AND column_name = 'organization_id') THEN
        ALTER TABLE public.unanswered_questions ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
    END IF;
END $$;

DROP POLICY IF EXISTS "unanswered_questions_isolation" ON public.unanswered_questions;
CREATE POLICY "unanswered_questions_isolation" ON public.unanswered_questions
FOR ALL TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

-- Grants
GRANT ALL ON public.organizations TO service_role;
GRANT ALL ON public.score_weights TO service_role;
GRANT ALL ON public.unanswered_questions TO service_role;

GRANT SELECT ON public.organizations TO authenticated;
GRANT ALL ON public.score_weights TO authenticated;
GRANT ALL ON public.unanswered_questions TO authenticated;
