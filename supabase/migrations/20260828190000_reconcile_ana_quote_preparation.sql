-- Reconcilia o estágio de preparação de orçamento usado pelo Kanban e pela Ana.
-- Esta alteração preserva os registros existentes e mantém o domínio sem venda direta.

alter table public.crm_opportunities
  drop constraint if exists crm_opportunities_stage_code_check,
  add constraint crm_opportunities_stage_code_check
  check (stage_code in ('entered', 'engaging', 'qualified', 'quote_preparation', 'quote_sent', 'decision'));

alter table public.crm_stage_events
  drop constraint if exists crm_stage_events_to_stage_code_check,
  add constraint crm_stage_events_to_stage_code_check
  check (to_stage_code in ('entered', 'engaging', 'qualified', 'quote_preparation', 'quote_sent', 'decision'));

alter table public.crm_stage_events
  drop constraint if exists crm_stage_events_from_stage_code_check,
  add constraint crm_stage_events_from_stage_code_check
  check (from_stage_code is null or from_stage_code in ('entered', 'engaging', 'qualified', 'quote_preparation', 'quote_sent', 'decision'));
