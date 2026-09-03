-- Fecha o ciclo automático da Ana sem permitir que o cron encerre leads sozinho.
-- A política determinística de 48h cria handoff, tarefa, agent_run e auditoria.

begin;

create or replace function private.process_no_reply_deadlines(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_count integer := 0;
  v_lead record;
  v_reason text := '48h sem resposta: revisão humana obrigatória antes de encerrar o lead.';
  v_stage_label text;
begin
  for v_lead in
    select
      lead.id,
      lead.organization_id,
      lead.owner_id,
      lead.company,
      lead.score,
      coalesce(lead.ana_stage, 'novo') as ana_stage,
      lead.no_reply_deadline_at
    from public.leads lead
    where lead.no_reply_deadline_at <= now()
      and lead.no_reply_processed_at is null
      and lead.opt_out = false
      and lead.ai_paused = false
      and lead.modo_atendimento = 'ia'
      and lead.owner_id is not null
      and coalesce(lead.ana_stage, 'novo') <> 'fechado'
    order by lead.no_reply_deadline_at
    limit greatest(1, least(coalesce(p_limit, 100), 1000))
    for update skip locked
  loop
    v_stage_label := case v_lead.ana_stage
      when 'apresentado' then 'Apresentado'
      when 'qualificando' then 'Qualificando'
      when 'reuniao' then 'Reunião'
      when 'orcamento' then 'Orçamento'
      else 'Novo'
    end;

    update public.leads
    set
      ai_paused = true,
      automation_status = 'human',
      no_reply_processed_at = now(),
      no_reply_deadline_at = null,
      automation_updated_at = now()
    where id = v_lead.id
      and organization_id = v_lead.organization_id;

    if not exists (
      select 1
      from public.lead_handoffs handoff
      where handoff.organization_id = v_lead.organization_id
        and handoff.lead_id = v_lead.id
        and handoff.status = 'pending'
    ) then
      insert into public.lead_handoffs (
        organization_id, lead_id, to_user_id, assigned_to, status,
        reason, summary, due_at, context
      ) values (
        v_lead.organization_id, v_lead.id, v_lead.owner_id, v_lead.owner_id, 'pending',
        v_reason, v_reason, now() + interval '1 hour',
        jsonb_build_object('event', 'timeout.48h', 'source', 'pg_cron', 'score', coalesce(v_lead.score, 0))
      );
    end if;

    if not exists (
      select 1
      from public.lead_tasks task
      where task.organization_id = v_lead.organization_id
        and task.lead_id = v_lead.id
        and task.completed = false
        and task.text = v_reason
    ) then
      insert into public.lead_tasks (
        organization_id, lead_id, owner_id, owner_label, text, due_at, completed
      ) values (
        v_lead.organization_id, v_lead.id, v_lead.owner_id, 'Responsável', v_reason, now() + interval '1 hour', false
      );
    end if;

    insert into public.agent_runs (
      organization_id, lead_id, event, modo, status, input_context, result,
      idempotency_key, completed_at
    ) values (
      v_lead.organization_id,
      v_lead.id,
      'timeout.48h',
      'ia',
      'completed',
      jsonb_build_object('source', 'pg_cron', 'deadline_at', v_lead.no_reply_deadline_at),
      jsonb_build_object(
        'lead_id', v_lead.id,
        'estagio_atual', v_stage_label,
        'proximo_estagio', v_stage_label,
        'acoes', jsonb_build_array(jsonb_build_object('tipo', 'handoff', 'status', 'criado')),
        'mensagem_sugerida', '',
        'score', coalesce(v_lead.score, 0),
        'motivo', v_reason,
        'precisa_humano', true,
        'outcome', null,
        'status_canal', 'pendente_canal'
      ),
      'timeout.48h:' || v_lead.id::text || ':' || extract(epoch from v_lead.no_reply_deadline_at)::bigint::text,
      now()
    )
    on conflict (organization_id, idempotency_key) do nothing;

    insert into public.audit_logs (
      organization_id, actor_name, actor_type, action, detail, rule,
      occurred_at, entity_table, entity_id, event_data
    ) values (
      v_lead.organization_id,
      'Ana',
      'system',
      'ANA_TIMEOUT_HANDOFF',
      v_reason,
      'no_reply_deadline',
      now(),
      'leads',
      v_lead.id,
      jsonb_build_object('company', v_lead.company, 'owner_id', v_lead.owner_id, 'stage', v_stage_label)
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function private.process_no_reply_deadlines(integer) from public, anon, authenticated;
grant execute on function private.process_no_reply_deadlines(integer) to service_role;

comment on function private.process_no_reply_deadlines(integer) is
  'Política da Ana para timeout de 48h: pausa automação e cria handoff; nunca encerra o lead automaticamente.';

commit;
