import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

// Conversational decisions, follow-ups and outbound drafts are owned only by
// ana-run. This auxiliary endpoint may publish/read configuration and provide
// a user-triggered autocomplete suggestion, but cannot become a second Ana.
const actions = new Set(['autocompletar', 'salvar_configuracao', 'obter_configuracao']);
const text = (value: unknown, max = 8_000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const lines = (value: unknown, fallback: string[] = []) => {
  const result = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 12)
    : [];
  return result.length ? result : fallback;
};
const bool = (value: unknown, fallback = false) => typeof value === 'boolean' ? value : fallback;
const number = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const boundedNumber = (value: unknown, fallback: number, min: number, max: number) => Math.min(max, Math.max(min, number(value, fallback)));
const tone = (value: unknown) => ['consultivo', 'direto', 'acolhedor', 'tecnico'].includes(text(value, 32)) ? text(value, 32) : 'tecnico';
const allowedChannels = (value: unknown) => lines(value)
  .map((channel) => channel.toLowerCase())
  .filter((channel): channel is 'whatsapp' | 'email' => channel === 'whatsapp' || channel === 'email');

function hasConfigurationContent(value: unknown): boolean {
  const configuration = object(value);
  return [
    configuration.business,
    configuration.audience,
    configuration.greeting,
    configuration.signature,
  ].some((item) => Boolean(text(item))) || [
    configuration.valueProposition,
    configuration.qualificationQuestions,
    configuration.handoffTriggers,
    configuration.approvedKnowledge,
  ].some((item) => lines(item).length > 0);
}

function normalizeConfiguration(value: unknown): Record<string, unknown> {
  const configuration = object(value);
  const quote = object(configuration.quotePolicy);
  const cadence = object(configuration.cadencePolicy);
  const handoff = object(configuration.handoffPolicy);
  const risk = object(configuration.riskPolicy);
  const normalizedChannels = allowedChannels(configuration.allowedChannels);
  return {
    business: text(configuration.business, 1_000),
    audience: text(configuration.audience, 1_500),
    greeting: text(configuration.greeting, 500),
    signature: text(configuration.signature, 240),
    dailyMessageLimit: boundedNumber(configuration.dailyMessageLimit, 5, 1, 20),
    valueProposition: lines(configuration.valueProposition),
    qualificationQuestions: lines(configuration.qualificationQuestions),
    handoffTriggers: lines(configuration.handoffTriggers),
    tone: tone(configuration.tone),
    approvedKnowledge: lines(configuration.approvedKnowledge),
    quotePolicy: {
      requireHumanApproval: bool(quote.requireHumanApproval, true),
      neverInventPrices: bool(quote.neverInventPrices, true),
      discountLimit: boundedNumber(quote.discountLimit, 0, 0, 100),
    },
    cadencePolicy: {
      firstFollowUpHours: boundedNumber(cadence.firstFollowUpHours, 24, 1, 24 * 30),
      secondFollowUpHours: boundedNumber(cadence.secondFollowUpHours, 72, 2, 24 * 60),
      timeoutHours: boundedNumber(cadence.timeoutHours, 120, 24, 24 * 90),
      businessHoursOnly: bool(cadence.businessHoursOnly, true),
    },
    handoffPolicy: {
      requireSummary: bool(handoff.requireSummary, true),
      pauseAnaUntilReturn: bool(handoff.pauseAnaUntilReturn, true),
      lowConfidenceThreshold: boundedNumber(handoff.lowConfidenceThreshold, 70, 1, 100),
    },
    // Empty is deliberately safe: a configuration must explicitly permit a channel.
    allowedChannels: normalizedChannels,
    // Media is an explicit opt-in because a catalog image is an external
    // WhatsApp delivery, not a cosmetic change in the CRM.
    catalogMediaImagesEnabled: bool(configuration.catalogMediaImagesEnabled, false),
    riskPolicy: {
      requireConsent: bool(risk.requireConsent, true),
      stopOnOptOut: bool(risk.stopOnOptOut, true),
      pauseOnHighRisk: bool(risk.pauseOnHighRisk, true),
    },
  };
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = text(body.acao, 32);
    if (!actions.has(action)) throw new Error('unsupported_action');
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (profileError || !profile?.active_organization_id) throw new Error('organization_context_required');
    const organizationId = profile.active_organization_id as string;
    await requireOrganizationRole(admin, user.id, organizationId, ['owner', 'admin', 'manager', 'seller', 'sdr', 'ia']);
    if (action === 'obter_configuracao') {
      const { data: agent, error: agentError } = await admin.from('ai_agents')
        .select('id,active_version_id').eq('organization_id', organizationId).eq('key', 'ana').maybeSingle();
      if (agentError) throw agentError;
      const { data: version, error: versionError } = agent?.active_version_id
        ? await admin.from('ai_agent_versions').select('id,version_number,configuration,published_at')
          .eq('id', agent.active_version_id).eq('organization_id', organizationId).maybeSingle()
        : { data: null, error: null };
      if (versionError) throw versionError;
      return json({ ok: true, configuration: version ? normalizeConfiguration(version.configuration) : null, version: version ? {
        id: version.id, number: version.version_number, publishedAt: version.published_at,
      } : null }, 200, headers);
    }
    if (action === 'salvar_configuracao') {
      await requireOrganizationRole(admin, user.id, organizationId, ['owner', 'admin', 'manager']);
      if (!hasConfigurationContent(body.configuracao)) throw new Error('configuration_content_required');
      const configuration = normalizeConfiguration(body.configuracao);
      const { data: agent, error: agentError } = await admin.from('ai_agents')
        .upsert({ organization_id: organizationId, key: 'ana', name: 'Ana' }, { onConflict: 'organization_id,key' })
        .select('id').single();
      if (agentError || !agent) throw agentError ?? new Error('ana_agent_not_created');
      const { data: latest, error: latestError } = await admin.from('ai_agent_versions')
        .select('version_number').eq('agent_id', agent.id).order('version_number', { ascending: false }).limit(1).maybeSingle();
      if (latestError) throw latestError;
      const versionNumber = (latest?.version_number ?? 0) + 1;
      const publishedAt = new Date().toISOString();
      const { data: version, error: versionError } = await admin.from('ai_agent_versions').insert({
        organization_id: organizationId, agent_id: agent.id, version_number: versionNumber,
        status: 'published', configuration, published_by: user.id, published_at: publishedAt,
      }).select('id').single();
      if (versionError || !version) throw versionError ?? new Error('ana_version_not_created');
      const { error: activeError } = await admin.from('ai_agents').update({ active_version_id: version.id, updated_at: new Date().toISOString() })
        .eq('id', agent.id).eq('organization_id', organizationId);
      if (activeError) throw activeError;
      await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'ana.configuration_published', detail: 'Personalização da Ana publicada.', entity_table: 'ai_agents', entity_id: agent.id, event_data: { version_id: version.id } });
      return json({ ok: true, version: { id: version.id, number: versionNumber, publishedAt } }, 200, headers);
    }
    const { data: agent } = await admin.from('ai_agents').select('active_version_id').eq('organization_id', organizationId).eq('key', 'ana').maybeSingle();
    const { data: version } = agent?.active_version_id ? await admin.from('ai_agent_versions').select('configuration').eq('id', agent.active_version_id).maybeSingle() : { data: null };
    const configuration = object(version?.configuration);
    const context = object(body.contexto);
    const message = text(body.mensagem || context.trecho, 8_000);
    await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: `ana.${action}`, detail: 'Sugestão da Ana solicitada.', entity_table: 'ai_agents', event_data: { chars: message.length } });
    if (action === 'analisar') {
      const normalized = message.toLowerCase();
      const optOut = /não quero|nao quero|pare|remova|descadastrar|opt.?out/.test(normalized);
      const urgency = /urgente|pra ontem|imediatamente|hoje/.test(normalized);
      const negotiation = /desconto|negoci|caro|melhor preço|melhor preco/.test(normalized);
      const complaint = /reclamação|reclamacao|insatisfeit|problema|péssimo|pessimo/.test(normalized);
      const humanRequest = /falar com (uma )?pessoa|atendente|humano|vendedor/.test(normalized);
      const meeting = /reunião|reuniao|agendar|agenda|call|ligar/.test(normalized);
      const quote = /orçamento|orcamento|cotação|cotacao|proposta|quanto custa|preço|preco/.test(normalized);
      const interest = /quero|interesse|preciso|gostaria|me explica/.test(normalized);
      const configuredTriggers = lines(configuration.handoffTriggers);
      const normalizedForMatch = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const configuredTrigger = configuredTriggers.find((trigger) => trigger
        .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9]+/).filter((word) => word.length >= 4)
        .some((word) => normalizedForMatch.includes(word)));
      const handoffPolicy = object(configuration.handoffPolicy);
      const minimumConfidence = Math.min(100, Math.max(1, number(handoffPolicy.lowConfidenceThreshold, 70))) / 100;
      const explicitSignal = optOut || urgency || negotiation || complaint || humanRequest || Boolean(configuredTrigger) || meeting || quote;
      const baseConfidence = explicitSignal ? 0.95 : interest ? 0.78 : 0.6;
      const requiresHumanOnLowConfidence = baseConfidence < minimumConfidence;
      const handoff = urgency || negotiation || complaint || humanRequest || Boolean(configuredTrigger) || requiresHumanOnLowConfidence;
      const motivo = complaint ? 'Reclamação ou insatisfação' : urgency ? 'Urgência operacional' : negotiation ? 'Pedido de desconto ou negociação' : humanRequest ? 'Solicitação de atendimento humano' : configuredTrigger ? `Regra da empresa: ${configuredTrigger}` : requiresHumanOnLowConfidence ? 'Confiança abaixo do mínimo configurado' : undefined;
      return json({ ok: true, analise: {
        intencao: optOut ? 'OPT_OUT' : handoff ? 'OBJECAO' : meeting ? 'AGENDAMENTO' : quote ? 'ORCAMENTO' : interest ? 'INTERESSE' : 'NEUTRO',
        sentimento: complaint || optOut ? 'NEGATIVO' : interest ? 'POSITIVO' : 'NEUTRO',
        scoreInteresse: optOut ? 0 : meeting || quote ? 75 : interest ? 65 : 50,
        confianca: baseConfidence,
        proximaAcao: optOut ? 'ENCERRAR' : handoff ? 'TRANSFERIR_HUMANO' : meeting ? 'AGENDAR' : quote ? 'CRIAR_ORCAMENTO' : interest ? 'QUALIFICAR' : 'RESPONDER',
        etapaSugerida: optOut ? 'Fechado — Perdido' : handoff && negotiation ? 'Negociação' : meeting ? 'Reunião Agendada' : quote ? 'Proposta em Preparação' : interest ? 'Em Qualificação' : 'Em Contato',
        motivoTransferencia: motivo,
        regrasAtivas: configuredTriggers,
      } }, 200, headers);
    }
    if (action === 'autocompletar') return json({ ok: true, texto: `${message}${message.endsWith('.') ? '' : '.'} Posso complementar com os detalhes técnicos e preparar um orçamento?` }, 200, headers);
    const approvedKnowledge = lines(configuration.approvedKnowledge);
    const quotePolicy = object(configuration.quotePolicy);
    const normalized = message.toLowerCase();
    const asksForPrice = /orçamento|orcamento|cotação|cotacao|quanto custa|preço|preco|desconto/.test(normalized);
    if (asksForPrice && bool(quotePolicy.neverInventPrices, true)) {
      return json({ ok: true, texto: 'Para garantir um orçamento correto, preciso confirmar o escopo e os itens desejados. Vou preparar um rascunho somente com o catálogo aprovado para revisão humana.' }, 200, headers);
    }
    if (!approvedKnowledge.length) {
      return json({ ok: true, texto: 'Para responder com precisão e apenas com informações aprovadas, vou encaminhar seu atendimento para um especialista da equipe.' }, 200, headers);
    }
    const greeting = text(configuration.greeting, 500) || 'Olá! Sou a Ana, assistente comercial da empresa.';
    const name = text(context.nome, 120);
    const offer = lines(configuration.valueProposition);
    const questions = lines(configuration.qualificationQuestions, ['Qual necessidade você quer resolver?', 'Qual o prazo ou urgência?', 'Qual escopo ou quantidade?']);
    const offerContext = offer.length ? ` Trabalhamos com ${offer.slice(0, 2).join(' e ')}.` : '';
    const signature = text(configuration.signature, 240);
    return json({ ok: true, texto: `${greeting}${name ? ` ${name},` : ''}${offerContext} Para preparar um orçamento adequado, ${questions[0].charAt(0).toLowerCase()}${questions[0].slice(1)}${signature ? `\n\n${signature}` : ''}` }, 200, headers);
  } catch (error) { return json({ ok: false, erro: safeError(error) }, 400, headers); }
});
