INSERT INTO public.pipeline_stages (organization_id, pipeline_id, name, position, color, probability, legacy_stage, is_won, is_lost, active)
SELECT p.organization_id, p.id, 'Contatos Perdidos',
       COALESCE((SELECT MAX(s.position) FROM public.pipeline_stages s WHERE s.pipeline_id = p.id), 0) + 1,
       '#94a3b8', 0, 'Contatos Perdidos'::public.lead_stage, false, true, true
FROM public.pipelines p
WHERE NOT EXISTS (
  SELECT 1 FROM public.pipeline_stages s
  WHERE s.pipeline_id = p.id AND s.legacy_stage = 'Contatos Perdidos'::public.lead_stage
);