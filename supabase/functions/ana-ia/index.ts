import { createAdminClient, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

const actions = new Set(['responder', 'analisar', 'redigir', 'autocompletar', 'salvar_configuracao']);
const text = (value: unknown, max = 8_000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

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
    const { data: member } = await admin.from('organization_members').select('status,role').eq('organization_id', organizationId).eq('user_id', user.id).maybeSingle();
    if (!member || member.status !== 'active') throw new Error('organization_access_denied');
    if (action === 'salvar_configuracao') {
      if (!['owner', 'admin', 'manager'].includes(member.role)) throw new Error('organization_role_denied');
      const configuration = object(body.configuracao);
      if (!Object.keys(configuration).length) throw new Error('configuration_required');
      const { data: agent, error: agentError } = await admin.from('ai_agents')
        .upsert({ organization_id: organizationId, key: 'ana', name: 'Ana' }, { onConflict: 'organization_id,key' })
        .select('id').single();
      if (agentError || !agent) throw agentError ?? new Error('ana_agent_not_created');
      const { data: latest, error: latestError } = await admin.from('ai_agent_versions')
        .select('version_number').eq('agent_id', agent.id).order('version_number', { ascending: false }).limit(1).maybeSingle();
      if (latestError) throw latestError;
      const { data: version, error: versionError } = await admin.from('ai_agent_versions').insert({
        organization_id: organizationId, agent_id: agent.id, version_number: (latest?.version_number ?? 0) + 1,
        status: 'published', configuration, published_by: user.id, published_at: new Date().toISOString(),
      }).select('id').single();
      if (versionError || !version) throw versionError ?? new Error('ana_version_not_created');
      const { error: activeError } = await admin.from('ai_agents').update({ active_version_id: version.id, updated_at: new Date().toISOString() })
        .eq('id', agent.id).eq('organization_id', organizationId);
      if (activeError) throw activeError;
      await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'ana.configuration_published', detail: 'Personalização da Ana publicada.', entity_table: 'ai_agents', entity_id: agent.id, event_data: { version_id: version.id } });
      return json({ ok: true, versionId: version.id }, 200, headers);
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
      const urgent = /urgente|reclamação|reclamacao|desconto|negoci/.test(normalized);
      return json({ ok: true, analise: { intencao: optOut ? 'OPT_OUT' : urgent ? 'HANDOFF' : 'DESCONHECIDA', sentimento: 'NEUTRO', interesse: 0, confianca: 0.55, proximaAcao: optOut ? 'BLOQUEAR_CONTATO' : urgent ? 'TRANSFERIR_HUMANO' : 'QUALIFICAR' } }, 200, headers);
    }
    if (action === 'autocompletar') return json({ ok: true, texto: `${message}${message.endsWith('.') ? '' : '.'} Posso complementar com os detalhes técnicos e preparar um orçamento?` }, 200, headers);
    const greeting = text(configuration.greeting, 500) || 'Olá! Sou a Ana, assistente comercial da empresa.';
    const name = text(context.nome, 120);
    return json({ ok: true, texto: `${greeting}${name ? ` ${name},` : ''} para preparar um orçamento adequado, pode me contar a necessidade, prazo e quantidade ou escopo desejado?` }, 200, headers);
  } catch (error) { return json({ ok: false, erro: safeError(error) }, 400, headers); }
});
