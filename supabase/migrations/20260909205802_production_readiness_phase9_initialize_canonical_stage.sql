create or replace function private.sync_lead_commercial_state()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  target_key text;
  target_stage public.pipeline_stages%rowtype;
begin
  if tg_op = 'UPDATE'
     and new.stage is distinct from old.stage
     and new.pipeline_stage_id is not distinct from old.pipeline_stage_id
     and new.ana_stage is not distinct from old.ana_stage
     and new.ana_outcome is not distinct from old.ana_outcome then
    target_key := case new.stage
      when 'Prospecção'::public.lead_stage then 'novo'
      when 'Qualificado'::public.lead_stage then 'qualificando'
      when 'Proposta'::public.lead_stage then 'orcamento'
      when 'Negociação'::public.lead_stage then 'reuniao'
      when 'Pedido'::public.lead_stage then 'orcamento'
      when 'Fechado'::public.lead_stage then 'ganho'
      when 'Perdido'::public.lead_stage then 'perdido'
      when 'Contatos Perdidos'::public.lead_stage then 'perdido'
      else null
    end;

    if target_key is not null then
      select * into target_stage
        from public.pipeline_stages
       where organization_id = new.organization_id
         and pipeline_id = new.pipeline_id
         and ana_stage_key = target_key
         and active = true
       limit 1;
      if found then
        new.pipeline_stage_id := target_stage.id;
        if target_key = 'ganho' then
          new.ana_stage := 'fechado'; new.ana_outcome := 'ganho';
        elsif target_key = 'perdido' then
          new.ana_stage := 'fechado'; new.ana_outcome := 'perdido';
        else
          new.ana_stage := target_key; new.ana_outcome := null;
        end if;
        new.stage := target_stage.legacy_stage;
      end if;
    end if;
    return new;
  end if;

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
    if target_key = 'ganho' then
      new.ana_stage := 'fechado'; new.ana_outcome := 'ganho';
    elsif target_key = 'perdido' then
      new.ana_stage := 'fechado'; new.ana_outcome := 'perdido';
    else
      new.ana_stage := target_key; new.ana_outcome := null;
    end if;
  end if;
  return new;
end;
$function$;
