-- Production readiness phase 0: operational mode and commercial pipeline.

create or replace function private.sync_runtime_from_company_settings()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  update public.organization_module_data
     set data = jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      coalesce(data, '{}'::jsonb),
                      '{modoExecucao}',
                      to_jsonb(case when new.sandbox_mode then 'DEMONSTRACAO' else 'PRODUCAO' end::text),
                      true
                    ),
                    '{anaPodeAplicarDesconto}',
                    'false'::jsonb,
                    true
                  ),
                  '{anaDescontoMaximo}',
                  '0'::jsonb,
                  true
                ) || jsonb_build_object('descontoExigeAprovacaoAcima', 0),
         updated_at = now()
   where organization_id = new.organization_id
     and module_key = 'configuracao_runtime';
  return new;
end;
$$;

drop trigger if exists trg_company_settings_sync_runtime on public.company_settings;
create trigger trg_company_settings_sync_runtime
after insert or update of sandbox_mode on public.company_settings
for each row execute function private.sync_runtime_from_company_settings();

update public.organization_module_data omd
   set data = jsonb_set(
                jsonb_set(
                  jsonb_set(
                    coalesce(omd.data, '{}'::jsonb),
                    '{modoExecucao}',
                    to_jsonb(case when cs.sandbox_mode then 'DEMONSTRACAO' else 'PRODUCAO' end::text),
                    true
                  ),
                  '{anaPodeAplicarDesconto}',
                  'false'::jsonb,
                  true
                ),
                '{anaDescontoMaximo}',
                '0'::jsonb,
                true
              ) || jsonb_build_object('descontoExigeAprovacaoAcima', 0),
       updated_at = now()
  from public.company_settings cs
 where omd.organization_id = cs.organization_id
   and omd.module_key = 'configuracao_runtime';

alter table public.pipeline_stages
  add column if not exists ana_stage_key text;

create unique index if not exists pipeline_stages_pipeline_ana_key_unique
  on public.pipeline_stages (pipeline_id, ana_stage_key)
  where ana_stage_key is not null and active = true;

update public.pipeline_stages
   set position = position + 100,
       updated_at = now()
 where active = true;

update public.pipeline_stages
set name = case name
    when 'Prospecção' then 'Novo'
    when 'Qualificado' then 'Apresentado'
    when 'Proposta' then 'Qualificando'
    when 'Negociação' then 'Reunião'
    when 'Pedido' then 'Orçamento'
    when 'Fechado' then 'Ganho'
    else name
  end,
  position = case name
    when 'Prospecção' then 1
    when 'Qualificado' then 2
    when 'Proposta' then 3
    when 'Negociação' then 4
    when 'Pedido' then 5
    when 'Fechado' then 6
    when 'Perdido' then 7
    else position
  end,
  ana_stage_key = case name
    when 'Prospecção' then 'novo'
    when 'Qualificado' then 'apresentado'
    when 'Proposta' then 'qualificando'
    when 'Negociação' then 'reuniao'
    when 'Pedido' then 'orcamento'
    when 'Fechado' then 'ganho'
    when 'Perdido' then 'perdido'
    else null
  end,
  legacy_stage = case name
    when 'Prospecção' then 'Prospecção'::public.lead_stage
    when 'Qualificado' then 'Prospecção'::public.lead_stage
    when 'Proposta' then 'Qualificado'::public.lead_stage
    when 'Negociação' then 'Qualificado'::public.lead_stage
    when 'Pedido' then 'Proposta'::public.lead_stage
    when 'Fechado' then 'Fechado'::public.lead_stage
    when 'Perdido' then 'Perdido'::public.lead_stage
    else legacy_stage
  end,
  is_won = (name = 'Fechado'),
  is_lost = (name = 'Perdido'),
  active = case when name = 'Contatos Perdidos' then false else active end,
  updated_at = now();

update public.pipeline_stages set position=1, name='Novo', legacy_stage='Prospecção'::public.lead_stage, is_won=false, is_lost=false, updated_at=now() where ana_stage_key='novo';
update public.pipeline_stages set position=2, name='Apresentado', legacy_stage='Prospecção'::public.lead_stage, is_won=false, is_lost=false, updated_at=now() where ana_stage_key='apresentado';
update public.pipeline_stages set position=3, name='Qualificando', legacy_stage='Qualificado'::public.lead_stage, is_won=false, is_lost=false, updated_at=now() where ana_stage_key='qualificando';
update public.pipeline_stages set position=4, name='Reunião', legacy_stage='Qualificado'::public.lead_stage, is_won=false, is_lost=false, updated_at=now() where ana_stage_key='reuniao';
update public.pipeline_stages set position=5, name='Orçamento', legacy_stage='Proposta'::public.lead_stage, is_won=false, is_lost=false, updated_at=now() where ana_stage_key='orcamento';
update public.pipeline_stages set position=6, name='Ganho', legacy_stage='Fechado'::public.lead_stage, is_won=true, is_lost=false, updated_at=now() where ana_stage_key='ganho';
update public.pipeline_stages set position=7, name='Perdido', legacy_stage='Perdido'::public.lead_stage, is_won=false, is_lost=true, updated_at=now() where ana_stage_key='perdido';

create or replace function private.sync_lead_commercial_state()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  target_key text;
  target_stage public.pipeline_stages%rowtype;
begin
  if tg_op = 'UPDATE'
     and new.pipeline_stage_id is distinct from old.pipeline_stage_id
     and new.ana_stage is not distinct from old.ana_stage
     and new.ana_outcome is not distinct from old.ana_outcome then
    select * into target_stage
      from public.pipeline_stages
     where id = new.pipeline_stage_id
       and organization_id = new.organization_id
       and pipeline_id = new.pipeline_id
       and active = true;

    if found and target_stage.ana_stage_key is not null then
      if target_stage.ana_stage_key = 'ganho' then
        new.ana_stage := 'fechado'; new.ana_outcome := 'ganho';
      elsif target_stage.ana_stage_key = 'perdido' then
        new.ana_stage := 'fechado'; new.ana_outcome := 'perdido';
      else
        new.ana_stage := target_stage.ana_stage_key; new.ana_outcome := null;
      end if;
      new.stage := target_stage.legacy_stage;
    end if;
    return new;
  end if;

  target_key := case
    when new.ana_stage = 'fechado' and new.ana_outcome = 'ganho' then 'ganho'
    when new.ana_stage = 'fechado' and new.ana_outcome = 'perdido' then 'perdido'
    when new.ana_stage in ('novo','apresentado','qualificando','reuniao','orcamento') then new.ana_stage
    else 'novo'
  end;

  select * into target_stage
    from public.pipeline_stages
   where organization_id = new.organization_id
     and pipeline_id = new.pipeline_id
     and ana_stage_key = target_key
     and active = true
   limit 1;

  if found then
    new.pipeline_stage_id := target_stage.id;
    new.stage := target_stage.legacy_stage;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_sync_commercial_state on public.leads;
create trigger trg_leads_sync_commercial_state
before insert or update of ana_stage, ana_outcome, pipeline_stage_id on public.leads
for each row execute function private.sync_lead_commercial_state();

update public.leads
   set ana_stage = coalesce(ana_stage, 'novo'),
       ana_outcome = ana_outcome
 where pipeline_id is not null;
