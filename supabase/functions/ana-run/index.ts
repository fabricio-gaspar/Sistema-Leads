import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

const EVENTS = new Set(['lead.created', 'message.received', 'stage.changed', 'meeting.done', 'timeout.48h', 'manual.run']);
const MODES = new Set(['ia', 'humano']);
const STAGES = ['novo', 'apresentado', 'qualificando', 'reuniao', 'orcamento', 'fechado'] as const;
type AnaStage = (typeof STAGES)[number];
type AnaMode = 'ia' | 'humano';
type AiProvider = 'openai' | 'claude';

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

const ANA_DECISION_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['proximo_estagio', 'outcome', 'acoes', 'mensagem_sugerida', 'score', 'motivo', 'precisa_humano'],
  properties: {
    proximo_estagio: { type: 'string', enum: [...STAGES] },
    outcome: { anyOf: [{ type: 'string', enum: ['ganho', 'perdido'] }, { type: 'null' }] },
    acoes: {
      type: 'array', maxItems: 5,
      items: {
        type: 'object', additionalProperties: false, required: ['tipo', 'payload'],
        properties: {
          tipo: { type: 'string', enum: ['atualizar_lead', 'enviar_mensagem', 'criar_tarefa', 'agendar', 'gerar_orcamento', 'handoff'] },
          payload: { type: 'object', additionalProperties: true },
        },
      },
    },
    mensagem_sugerida: { type: 'string' }, score: { type: 'integer', minimum: 0, maximum: 100 },
    motivo: { type: 'string' }, precisa_humano: { type: 'boolean' },
  },
};

const asObject = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asText = (value: unknown, max = 4_000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const asScore = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function secureEqual(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

function errorCode(error: unknown): string {
  const message = safeError(error);
  return message.replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 80) || 'ana_run_failed';
}

function canonicalChannel(value: unknown): string | null {
  const normalized = asText(value, 40).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized === 'whatsapp') return 'whatsapp';
  if (normalized === 'email') return 'email';
  if (normalized === 'instagram' || normalized === 'meta') return 'instagram';
  if (normalized === 'voice' || normalized === 'voip' || normalized === 'telefone') return 'voice';
  return normalized || null;
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

const ANA_REQUEST = (context: Record<string, unknown>) =>
  `Analise este contexto e retorne somente JSON com: proximo_estagio, outcome (ganho|perdido|null), acoes [{tipo,payload}], mensagem_sugerida, score (0-100), motivo, precisa_humano.\n${JSON.stringify(context)}`;

async function callOpenAI(apiKey: string, system: string, context: Record<string, unknown>, model?: string) {
  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || Deno.env.get('OPENAI_MODEL') || Deno.env.get('OPENAI_PROMPT_MODEL') || 'gpt-4.1-mini',
      temperature: 0.2,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ana_decision', strict: true,
          schema: ANA_DECISION_SCHEMA,
        },
      },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: ANA_REQUEST(context) },
      ],
    }),
    });
  } catch { throw new Error('openai_network_error'); }
  if (!response.ok) throw new Error(`openai_${response.status}`);
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('openai_empty_response');
  try { return JSON.parse(content); } catch { throw new Error('openai_invalid_json'); }
}

async function callClaude(apiKey: string, system: string, context: Record<string, unknown>, model?: string) {
  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: model || Deno.env.get('CLAUDE_MODEL') || 'claude-sonnet-5',
        max_tokens: 1_600,
        temperature: 0.2,
        system,
        messages: [{ role: 'user', content: ANA_REQUEST(context) }],
        tools: [{ name: 'ana_decision', description: 'Retorna exclusivamente a decisão estruturada que a Ana deve tomar.', input_schema: ANA_DECISION_SCHEMA }],
        tool_choice: { type: 'tool', name: 'ana_decision' },
      }),
    });
  } catch { throw new Error('claude_network_error'); }
  if (!response.ok) throw new Error(`claude_${response.status}`);
  const body = await response.json() as { content?: Array<{ type?: string; name?: string; input?: unknown }> };
  const toolUse = body.content?.find((block) => block.type === 'tool_use' && block.name === 'ana_decision');
  if (!toolUse?.input) throw new Error('claude_empty_response');
  return toolUse.input;
}

function canUseClaudeFallback(error: unknown): boolean {
  return /^(openai_network_error|openai_408|openai_409|openai_429|openai_5\d\d)$/.test(safeError(error));
}

async function callAi(system: string, context: Record<string, unknown>, storedCredentials: Record<string, unknown> = {}): Promise<{ provider: AiProvider; decision: unknown }> {
  const openAiKey = Deno.env.get('OPENAI_API_KEY') || asText(storedCredentials.openai_key, 1_000);
  const claudeKey = Deno.env.get('CLAUDE_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY') || asText(storedCredentials.claude_key, 1_000);
  const preferred = asText(storedCredentials.provedor_principal, 20).toLowerCase();
  const openAiModel = asText(storedCredentials.openai_model, 100);
  const claudeModel = asText(storedCredentials.claude_model, 100);
  if (!openAiKey && !claudeKey) throw new Error('ai_provider_not_configured');
  if (preferred === 'claude' && claudeKey) {
    try { return { provider: 'claude', decision: await callClaude(claudeKey, system, context, claudeModel) }; }
    catch (error) {
      // Algumas contas Anthropic não têm acesso a todos os modelos. Quando o
      // modelo escolhido é recusado, tenta o modelo comercial padrão sem
      // alterar a configuração do administrador.
      if (safeError(error) !== 'claude_400' || claudeModel === 'claude-sonnet-5') throw error;
      return { provider: 'claude', decision: await callClaude(claudeKey, system, context, 'claude-sonnet-5') };
    }
  }
  if (openAiKey) {
    try { return { provider: 'openai', decision: await callOpenAI(openAiKey, system, context, openAiModel) }; }
    catch (error) {
      if (!claudeKey || !canUseClaudeFallback(error)) throw error;
    }
  }
  return { provider: 'claude', decision: await callClaude(claudeKey!, system, context, claudeModel) };
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

    admin = createAdminClient();
    const internal = secureEqual(request.headers.get('x-internal-worker-secret'), Deno.env.get('WHATSAPP_WEBHOOK_SHARED_SECRET'));
    let actorId: string | null = null;
    let actorName = 'Ana';
    if (internal) {
      organizationId = asText(body.organization_id, 80);
      if (!isUuid(organizationId)) throw new Error('organization_context_required');
    } else {
      const { user } = await requireUser(request);
      actorId = user.id;
      const { data: profile, error: profileError } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
      if (profileError || !profile?.active_organization_id) throw new Error('organization_context_required');
      organizationId = profile.active_organization_id as string;
      actorName = profile.name || 'Usuário';
      await requireOrganizationRole(admin, user.id, organizationId, ['owner', 'admin', 'manager', 'seller', 'sdr']);
    }

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
      organization_id: organizationId, lead_id: leadId, actor_id: actorId, event, modo, status: 'running',
      input_context: asObject(body.contexto), idempotency_key: idempotencyKey,
    }).select('id').single();
    if (runError || !run) throw runError ?? new Error('agent_run_not_created');
    runId = run.id as string;

    const activeChannel = canonicalChannel(lead.active_channel);
    const [{ data: company }, { data: messages }, { data: channel }, { data: agent }, { data: catalog }, { data: knowledge }, { data: appointments }, { data: suppressions }, { data: aiIntegration }] = await Promise.all([
      admin.from('company_settings').select('name,description,segment,website,phone,email,differentiators,ai_prompt,autonomy,lead_flow').eq('organization_id', organizationId).maybeSingle(),
      admin.from('lead_messages').select('sender,sender_name,type,text,sent_at').eq('organization_id', organizationId).eq('lead_id', leadId).order('sent_at', { ascending: false }).limit(20),
      activeChannel ? admin.from('integrations').select('connected,enabled,paused').eq('organization_id', organizationId).eq('key', activeChannel).maybeSingle() : Promise.resolve({ data: null }),
      admin.from('ai_agents').select('active_version_id').eq('organization_id', organizationId).eq('key', 'ana').maybeSingle(),
      admin.from('services').select('id,name,category,description,price,unit,term,max_discount').eq('organization_id', organizationId).eq('active', true).limit(50),
      admin.from('knowledge_chunks').select('content,metadata').eq('organization_id', organizationId).eq('status', 'active').limit(20),
      admin.from('appointments').select('starts_at,ends_at,status,meeting_url').eq('organization_id', organizationId).eq('lead_id', leadId).order('starts_at', { ascending: false }).limit(10),
      admin.from('contact_suppressions').select('channel,reason,created_at').eq('organization_id', organizationId).eq('lead_id', leadId).limit(10),
      admin.from('integrations').select('id').eq('organization_id', organizationId).eq('key', 'ai').maybeSingle(),
    ]);
    const { data: aiCredentials } = aiIntegration?.id
      ? await admin.rpc('read_integration_secret', { p_integration: aiIntegration.id })
      : { data: null };
    const { data: version } = agent?.active_version_id
      ? await admin.from('ai_agent_versions').select('configuration').eq('id', agent.active_version_id).maybeSingle()
      : { data: null };
    const timeout = event === 'timeout.48h' || Boolean(lead.no_reply_deadline_at && new Date(lead.no_reply_deadline_at).getTime() <= Date.now());
    const baseContext = {
      event, lead: { company: lead.company, contact: lead.contact, segment: lead.segment, active_channel: activeChannel, current_stage: stageLabel[currentStage] },
      company: company ?? {}, agent_configuration: asObject(version?.configuration), catalog: catalog ?? [], knowledge: knowledge ?? [],
      messages: messages ?? [], appointments: appointments ?? [], suppressions: suppressions ?? [], contexto: asObject(body.contexto),
      policies: { allow_auto_quote: false, channel_connected: Boolean(channel?.connected && channel?.enabled && !channel?.paused), timeout_48h: timeout, suppressed: Boolean(suppressions?.length) },
    };

    let decision;
    let aiProvider: AiProvider | 'policy' = 'policy';
    if (modo === 'humano' || timeout) {
      decision = {
        proximo_estagio: currentStage, outcome: null, mensagem_sugerida: '', score: Number(lead.score ?? 0),
        motivo: timeout ? '48h sem resposta: revisar como perdido.' : 'Lead em modo humano: Ana não envia mensagens.',
        precisa_humano: true,
        acoes: [{ tipo: 'handoff', payload: { reason: timeout ? 'timeout_48h' : 'modo_humano' } }],
      };
    } else {
      const ai = await callAi(asText(company?.ai_prompt, 8_000) || DEFAULT_PROMPT, baseContext, asObject(aiCredentials));
      aiProvider = ai.provider;
      decision = parseDecision(ai.decision, currentStage);
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
      if (channelConnected && !suppressions?.length) {
        await admin.from('outreach_jobs').upsert({
          organization_id: organizationId, lead_id: leadId, channel: activeChannel,
          run_at: new Date().toISOString(), status: 'queued', attempt: 0,
          idempotency_key: `${runId}:message`, payload: { text: decision.mensagem_sugerida, agent_run_id: runId },
        }, { onConflict: 'idempotency_key', ignoreDuplicates: true });
      }
      appliedActions.push({ tipo: 'enviar_mensagem', status: channelConnected && !suppressions?.length ? 'enfileirado' : 'pendente_canal' });
    }
    if (needsHuman) {
      await admin.from('lead_handoffs').insert({ organization_id: organizationId, lead_id: leadId, to_user_id: lead.owner_id, assigned_to: lead.owner_id, status: 'pending', reason: decision.motivo || 'Revisar atendimento da Ana.', summary: decision.motivo || 'Revisar atendimento da Ana.', due_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), context: { run_id: runId, event, score: decision.score } });
      await admin.from('lead_tasks').insert({ organization_id: organizationId, lead_id: leadId, owner_id: lead.owner_id, owner_label: actorName || 'Responsável', text: decision.motivo || 'Revisar atendimento da Ana.', due_at: new Date().toISOString(), completed: false });
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
      provedor_ia: aiProvider,
      status_canal: channelConnected && !suppressions?.length ? 'enfileirado' : 'pendente_canal',
    };
    await admin.from('agent_runs').update({ status: 'completed', result, completed_at: new Date().toISOString() }).eq('id', runId);
    await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: actorId, actor_name: actorName, actor_type: internal ? 'system' : 'user', action: 'ana.run.completed', detail: `Ana processou ${event}.`, entity_table: 'leads', entity_id: leadId, event_data: { run_id: runId, modo, needs_human: needsHuman } });
    return json({ ok: true, run_id: runId, ...result }, 200, headers);
  } catch (error) {
    const code = errorCode(error);
    if (admin && runId) await admin.from('agent_runs').update({ status: 'failed', error_code: code, error_message: safeError(error), completed_at: new Date().toISOString() }).eq('id', runId);
    return json({ ok: false, erro: code }, 400, headers);
  }
});
