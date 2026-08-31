import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

const EVENTS = new Set(['lead.created', 'message.received', 'stage.changed', 'meeting.done', 'timeout.48h', 'manual.run']);
const MODES = new Set(['ia', 'humano']);
const STAGES = ['novo', 'apresentado', 'qualificando', 'reuniao', 'orcamento', 'fechado'] as const;
type AnaStage = (typeof STAGES)[number];
type AnaMode = 'ia' | 'humano';

const DEFAULT_PROMPT = `Você é a Ana deste CRM. Responda em pt-BR, direta e exclusivamente em JSON válido.
Funil rígido: Novo → Apresentado → Qualificando → Reunião → Orçamento → Ganho/Perdido.
Faça uma pergunta e um CTA por vez. Nunca invente preço, prazo ou desconto fora do catálogo aprovado.
Faça handoff se o contato pedir humano, fizer reclamação, mencionar jurídico ou solicitar valor fora da faixa.
No primeiro contato, apresente a empresa e um serviço compatível com o ICP. Qualifique dor, prazo, orçamento e decisor.
Reunião: ofereça opções; só agende após confirmação. Orçamento sempre é rascunho e allow_auto_quote é falso.`;

const stageLabel: Record<AnaStage, string> = {
  novo: 'Novo', apresentado: 'Apresentado', qualificando: 'Qualificando', reuniao: 'Reunião', orcamento: 'Orçamento', fechado: 'Ganho / Perdido',
};
const databaseStage: Record<AnaStage, string> = {
  novo: 'Prospecção', apresentado: 'Prospecção', qualificando: 'Qualificado', reuniao: 'Qualificado', orcamento: 'Proposta', fechado: 'Fechado',
};

const asObject = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asText = (value: unknown, max = 4_000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const asScore = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function errorCode(error: unknown): string {
  const message = safeError(error);
  return message.replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 80) || 'ana_run_failed';
}

function transitionAllowed(current: AnaStage, next: AnaStage, outcome?: string): boolean {
  if (next === current) return true;
  if (next === 'fechado') return outcome === 'perdido' || outcome === 'ganho';
  return STAGES.indexOf(next) === STAGES.indexOf(current) + 1;
}

function parseDecision(raw: unknown, current: AnaStage) {
  const value = asObject(raw);
  const next = asText(value.proximo_estagio, 40).toLowerCase() as AnaStage;
  const outcome = asText(value.outcome, 20).toLowerCase();
  const actions = Array.isArray(value.acoes) ? value.acoes.slice(0, 5).map((action) => {
    const item = asObject(action);
    return { tipo: asText(item.tipo, 40), payload: asObject(item.payload) };
  }).filter((action) => ['atualizar_lead', 'enviar_mensagem', 'criar_tarefa', 'agendar', 'gerar_orcamento', 'handoff'].includes(action.tipo)) : [];
  if (!STAGES.includes(next)) throw new Error('ana_invalid_stage');
  if (!transitionAllowed(current, next, outcome)) throw new Error('ana_stage_jump_rejected');
  if (next === 'fechado' && !['ganho', 'perdido'].includes(outcome)) throw new Error('ana_invalid_outcome');
  return {
    proximo_estagio: next,
    outcome: next === 'fechado' ? outcome : null,
    acoes: actions,
    mensagem_sugerida: asText(value.mensagem_sugerida, 2_000),
    score: asScore(value.score),
    motivo: asText(value.motivo, 1_000),
    precisa_humano: value.precisa_humano === true,
  };
}

async function callOpenAI(system: string, context: Record<string, unknown>) {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('openai_not_configured');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Analise este contexto e retorne somente JSON com: proximo_estagio, outcome (ganho|perdido|null), acoes [{tipo,payload}], mensagem_sugerida, score (0-100), motivo, precisa_humano.\n${JSON.stringify(context)}` },
      ],
    }),
  });
  if (!response.ok) throw new Error(`openai_${response.status}`);
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('openai_empty_response');
  try { return JSON.parse(content); } catch { throw new Error('openai_invalid_json'); }
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);

  let admin: ReturnType<typeof createAdminClient> | null = null;
  let runId: string | null = null;
  let organizationId: string | null = null;
  try {
    const body = asObject(await request.json());
    const event = asText(body.event, 40);
    const leadId = asText(body.lead_id, 80);
    if (!EVENTS.has(event) || !isUuid(leadId)) throw new Error('ana_invalid_input');

    const { user } = await requireUser(request);
    admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (profileError || !profile?.active_organization_id) throw new Error('organization_context_required');
    organizationId = profile.active_organization_id as string;
    await requireOrganizationRole(admin, user.id, organizationId, ['owner', 'admin', 'manager', 'seller', 'sdr']);

    const { data: lead, error: leadError } = await admin.from('leads')
      .select('id,organization_id,company,contact,segment,email,phone,whatsapp,score,stage,ana_stage,ana_outcome,modo_atendimento,owner_id,assigned_to,active_channel,ai_paused,last_contact,no_reply_deadline_at')
      .eq('id', leadId).eq('organization_id', organizationId).maybeSingle();
    if (leadError || !lead) throw new Error('lead_not_found');
    const mode = asText(body.modo, 12).toLowerCase() || lead.modo_atendimento;
    if (!MODES.has(mode) || mode !== lead.modo_atendimento || !lead.owner_id) throw new Error('lead_mode_or_owner_required');
    const modo = mode as AnaMode;
    const currentStage = (lead.ana_stage || 'novo') as AnaStage;
    const idempotencyKey = `${event}:${leadId}:${Math.floor(Date.now() / 120_000)}`;

    const { data: previousRun } = await admin.from('agent_runs').select('id,status,result,error_code,error_message')
      .eq('organization_id', organizationId).eq('idempotency_key', idempotencyKey).maybeSingle();
    if (previousRun) return json({ ok: previousRun.status === 'completed', duplicate: true, run: previousRun }, 200, headers);

    const { data: run, error: runError } = await admin.from('agent_runs').insert({
      organization_id: organizationId, lead_id: leadId, actor_id: user.id, event, modo, status: 'running',
      input_context: asObject(body.contexto), idempotency_key: idempotencyKey,
    }).select('id').single();
    if (runError || !run) throw runError ?? new Error('agent_run_not_created');
    runId = run.id as string;

    const [{ data: company }, { data: messages }, { data: channel }, { data: agent }] = await Promise.all([
      admin.from('company_settings').select('name,description,segment,website,phone,email,differentiators,ai_prompt,autonomy,lead_flow').eq('organization_id', organizationId).maybeSingle(),
      admin.from('lead_messages').select('sender,sender_name,type,text,sent_at').eq('organization_id', organizationId).eq('lead_id', leadId).order('sent_at', { ascending: false }).limit(20),
      lead.active_channel ? admin.from('integrations').select('connected,enabled,paused').eq('organization_id', organizationId).eq('key', lead.active_channel).maybeSingle() : Promise.resolve({ data: null }),
      admin.from('ai_agents').select('active_version_id').eq('organization_id', organizationId).eq('key', 'ana').maybeSingle(),
    ]);
    const { data: version } = agent?.active_version_id
      ? await admin.from('ai_agent_versions').select('configuration').eq('id', agent.active_version_id).maybeSingle()
      : { data: null };
    const timeout = event === 'timeout.48h' || Boolean(lead.no_reply_deadline_at && new Date(lead.no_reply_deadline_at).getTime() <= Date.now());
    const baseContext = {
      event, lead: { company: lead.company, contact: lead.contact, segment: lead.segment, active_channel: lead.active_channel, current_stage: stageLabel[currentStage] },
      company: company ?? {}, agent_configuration: asObject(version?.configuration), catalog: [], messages: messages ?? [], contexto: asObject(body.contexto),
      policies: { allow_auto_quote: false, channel_connected: Boolean(channel?.connected && channel?.enabled && !channel?.paused), timeout_48h: timeout },
    };

    let decision;
    if (modo === 'humano' || timeout) {
      decision = {
        proximo_estagio: currentStage, outcome: null, mensagem_sugerida: '', score: Number(lead.score ?? 0),
        motivo: timeout ? '48h sem resposta: revisar como perdido.' : 'Lead em modo humano: Ana não envia mensagens.',
        precisa_humano: true,
        acoes: [{ tipo: 'handoff', payload: { reason: timeout ? 'timeout_48h' : 'modo_humano' } }],
      };
    } else {
      decision = parseDecision(await callOpenAI(asText(company?.ai_prompt, 8_000) || DEFAULT_PROMPT, baseContext), currentStage);
    }

    const needsHuman = decision.precisa_humano || decision.acoes.some((action) => action.tipo === 'handoff') || modo === 'humano' || timeout;
    const channelConnected = Boolean(channel?.connected && channel?.enabled && !channel?.paused);
    const update = {
      ana_stage: decision.proximo_estagio,
      ana_outcome: decision.outcome,
      stage: databaseStage[decision.proximo_estagio],
      score: decision.score || lead.score || 0,
      ai_paused: needsHuman,
      automation_status: needsHuman ? 'human' : 'running',
      automation_error: null,
      automation_updated_at: new Date().toISOString(),
      last_contact: event === 'message.received' ? new Date().toISOString() : lead.last_contact,
      no_reply_deadline_at: event === 'message.received' ? null : lead.no_reply_deadline_at,
    };
    const { error: updateError } = await admin.from('leads').update(update).eq('id', leadId).eq('organization_id', organizationId);
    if (updateError) throw updateError;

    const appliedActions: Array<Record<string, unknown>> = [];
    if (decision.mensagem_sugerida && !needsHuman) {
      await admin.from('lead_messages').insert({
        organization_id: organizationId, lead_id: leadId, sender: 'ana', sender_name: 'Ana',
        type: channelConnected ? 'draft' : 'pending_channel', text: decision.mensagem_sugerida, sent_at: new Date().toISOString(),
      });
      appliedActions.push({ tipo: 'enviar_mensagem', status: channelConnected ? 'rascunho_para_aprovacao' : 'pendente_canal' });
    }
    if (needsHuman) {
      await admin.from('lead_tasks').insert({ organization_id: organizationId, lead_id: leadId, owner_id: lead.owner_id, owner_label: profile.name || 'Responsável', text: decision.motivo || 'Revisar atendimento da Ana.', due_at: new Date().toISOString(), completed: false });
      appliedActions.push({ tipo: 'handoff', status: 'criado' });
    }
    if (decision.acoes.some((action) => action.tipo === 'gerar_orcamento')) {
      const { data: latest } = await admin.from('proposals').select('id').eq('organization_id', organizationId).eq('lead_id', leadId).in('status', ['draft', 'pending']).limit(1).maybeSingle();
      if (!latest) {
        await admin.from('proposals').insert({ organization_id: organizationId, lead_id: leadId, number: `ANA-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`, client: lead.company, items: [], value: 0, creator: 'ana', creator_name: 'Ana', owner_id: lead.owner_id, status: 'pending', need_approval: true });
      }
      appliedActions.push({ tipo: 'gerar_orcamento', status: 'rascunho' });
    }

    const result = {
      lead_id: leadId, estagio_atual: stageLabel[currentStage], proximo_estagio: stageLabel[decision.proximo_estagio],
      acoes: [...decision.acoes, ...appliedActions], mensagem_sugerida: decision.mensagem_sugerida,
      score: update.score, motivo: decision.motivo, precisa_humano: needsHuman,
      outcome: decision.outcome,
      status_canal: channelConnected ? 'rascunho_para_aprovacao' : 'pendente_canal',
    };
    await admin.from('agent_runs').update({ status: 'completed', result, completed_at: new Date().toISOString() }).eq('id', runId);
    await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'ana.run.completed', detail: `Ana processou ${event}.`, entity_table: 'leads', entity_id: leadId, event_data: { run_id: runId, modo, needs_human: needsHuman } });
    return json({ ok: true, run_id: runId, ...result }, 200, headers);
  } catch (error) {
    const code = errorCode(error);
    if (admin && runId) await admin.from('agent_runs').update({ status: 'failed', error_code: code, error_message: safeError(error), completed_at: new Date().toISOString() }).eq('id', runId);
    return json({ ok: false, erro: code }, 400, headers);
  }
});
