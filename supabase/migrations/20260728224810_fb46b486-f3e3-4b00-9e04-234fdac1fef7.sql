ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS autonomy jsonb NOT NULL DEFAULT jsonb_build_object(
    'prospect_to_lead', 'assist',
    'first_contact',    'auto',
    'ai_reply',         'auto',
    'qualification',    'auto',
    'proposal_send',    'assist',
    'proposal_followup','auto',
    'appointment',      'assist',
    'closing',          'manual',
    'nurture',          'auto'
  );

UPDATE public.company_settings
SET autonomy = jsonb_build_object(
  'prospect_to_lead', 'assist',
  'first_contact',    'auto',
  'ai_reply',         'auto',
  'qualification',    'auto',
  'proposal_send',    'assist',
  'proposal_followup','auto',
  'appointment',      'assist',
  'closing',          'manual',
  'nurture',          'auto'
)
WHERE autonomy IS NULL OR autonomy = '{}'::jsonb;