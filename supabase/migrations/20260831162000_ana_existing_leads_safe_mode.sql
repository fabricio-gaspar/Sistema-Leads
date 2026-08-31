-- Existing operational leads keep their owner and enter the new strict flow
-- conservatively: human mode until a person explicitly returns them to Ana.
update public.leads
set modo_atendimento = 'humano',
    ai_paused = true,
    automation_status = 'human',
    updated_at = now()
where modo_atendimento is null
  and owner_id is not null;
