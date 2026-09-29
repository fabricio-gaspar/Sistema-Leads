import { createAdminClient, requireOrganizationPermission, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

type ModuleKey = 'company' | 'offer' | 'conversation' | 'commercial' | 'cadence' | 'channels';
type AnaModule = { enabled: boolean; reviewed: boolean };
type AnaPolicy = {
  modules: Record<ModuleKey, AnaModule>;
  limits: { channels: string[]; perLead: number; humanApproval: boolean; stopOnOptOut: boolean };
  simulation?: { question: string; response: string; modules: string[]; sources: string[]; rules: string[]; decision: string };
  [key: string]: unknown;
};

const ACTIONS = new Set(['get', 'save_draft', 'publish', 'set_master', 'simulate', 'discard']);
const asObject = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asText = (value: unknown, max = 1000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const asBool = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;
const bounded = (value: unknown, fallback: number, min: number, max: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
};
const MODULES: ModuleKey[] = ['company', 'offer', 'conversation', 'commercial', 'cadence', 'channels'];
const moduleNames: Record<ModuleKey, string> = {
  company: 'Empresa e público', offer: 'Oferta permitida', conversation: 'Conversa e qualificação',
  commercial: 'Reunião e orçamento', cadence: 'Cadência e handoff', channels: 'Canais e publicar',
};

function normalizePolicy(value: unknown): AnaPolicy {
  const input = asObject(value);
  const modulesInput = asObject(input.modules);
  const modules = Object.fromEntries(MODULES.map((key) => {
    const item = asObject(modulesInput[key]);
    return [key, { enabled: asBool(item.enabled, true), reviewed: asBool(item.reviewed, false) }];
  })) as Record<ModuleKey, AnaModule>;
  const limitsInput = asObject(input.limits);
  const channels = Array.isArray(limitsInput.channels)
    ? [...new Set(limitsInput.channels.filter((item): item is string => item === 'whatsapp' || item === 'email'))]
    : [];
  return {
    ...input,
    modules,
    limits: {
      channels,
      perLead: bounded(limitsInput.perLead, 10, 1, 20),
      humanApproval: asBool(limitsInput.humanApproval, true),
      stopOnOptOut: asBool(limitsInput.stopOnOptOut, true),
    },
  };
}

function validatePolicy(policy: AnaPolicy) {
  if (!policy.modules.company.enabled || !policy.modules.offer.enabled) throw new Error('ana_policy_required_modules_disabled');
  if (!policy.limits.channels.length) throw new Error('ana_policy_channel_required');
  if (!policy.limits.humanApproval || !policy.limits.stopOnOptOut) throw new Error('ana_policy_safety_required');
}

async function context(request: Request) {
  const { user } = await requireUser(request);
  const admin = createAdminClient();
  const { data: profile, error } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
  if (error || !profile?.active_organization_id) throw new Error('organization_context_required');
  return { user, admin, organizationId: profile.active_organization_id as string, actorName: profile.name || user.email || 'Usuário' };
}

async function readState(admin: ReturnType<typeof createAdminClient>, organizationId: string) {
  const [{ data: agent, error: agentError }, { data: company, error: companyError }, { data: audit, error: auditError }] = await Promise.all([
    admin.from('ai_agents').select('id,active_version_id').eq('organization_id', organizationId).eq('key', 'ana').maybeSingle(),
    admin.from('company_settings').select('ai_actions_enabled,can_use_ia').eq('organization_id', organizationId).maybeSingle(),
    admin.from('audit_logs').select('id,action,detail,actor_name,created_at,event_data').eq('organization_id', organizationId).like('action', 'ana.%').order('created_at', { ascending: false }).limit(30),
  ]);
  if (agentError || companyError || auditError) throw new Error('ana_policy_read_failed');
  const { data: published } = agent?.active_version_id
    ? await admin.from('ai_agent_versions').select('id,version_number,status,configuration,published_at,created_at').eq('id', agent.active_version_id).eq('organization_id', organizationId).maybeSingle()
    : { data: null };
  const { data: draft } = agent?.id
    ? await admin.from('ai_agent_versions').select('id,version_number,status,configuration,published_at,created_at').eq('agent_id', agent.id).eq('organization_id', organizationId).eq('status', 'draft').order('created_at', { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const version = published ? { id: published.id, number: published.version_number, publishedAt: published.published_at, status: published.status } : null;
  const draftVersion = draft ? { id: draft.id, number: draft.version_number, createdAt: draft.created_at } : null;
  const policy = normalizePolicy(draft?.configuration ?? published?.configuration ?? {});
  return { agentId: agent?.id ?? null, masterEnabled: company?.ai_actions_enabled === true, canUseIa: company?.can_use_ia === true, policy, published: version, draft: draftVersion, audit: audit ?? [] };
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, error: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, headers);
  try {
    const body = asObject(await request.json());
    const action = asText(body.action, 40);
    if (!ACTIONS.has(action)) throw new Error('unsupported_action');
    const { user, admin, organizationId, actorName } = await context(request);
    if (action === 'get') return json({ ok: true, state: await readState(admin, organizationId) }, 200, headers);
    await requireOrganizationPermission(admin, organizationId, user.id, 'configuration.manage');
    if (action === 'set_master') {
      const enabled = body.enabled === true;
      const { error } = await admin.from('company_settings').update({ ai_actions_enabled: enabled, updated_at: new Date().toISOString() }).eq('organization_id', organizationId);
      if (error) throw new Error('ana_master_state_not_saved');
      await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: actorName, actor_type: 'user', action: enabled ? 'ana.master_enabled' : 'ana.master_paused', detail: enabled ? 'Ana ativada pela política comercial.' : 'Ana pausada pela política comercial.', entity_table: 'company_settings', event_data: { enabled } });
      return json({ ok: true, state: await readState(admin, organizationId) }, 200, headers);
    }
    const current = await readState(admin, organizationId);
    if (action === 'discard') {
      if (current.draft?.id) {
        const { error } = await admin.from('ai_agent_versions').delete().eq('id', current.draft.id).eq('organization_id', organizationId).eq('status', 'draft');
        if (error) throw new Error('ana_draft_discard_failed');
        await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: actorName, actor_type: 'user', action: 'ana.draft_discarded', detail: 'Rascunho da política descartado.', entity_table: 'ai_agent_versions', entity_id: current.draft.id, event_data: {} });
      }
      return json({ ok: true, state: await readState(admin, organizationId) }, 200, headers);
    }
    if (action === 'save_draft') {
      const policy = normalizePolicy(body.policy);
      if (!current.agentId) {
        const { data, error } = await admin.from('ai_agents').insert({ organization_id: organizationId, key: 'ana', name: 'Ana' }).select('id').single();
        if (error || !data) throw new Error('ana_agent_not_created');
        current.agentId = data.id;
      }
      const latest = current.published?.number ?? 0;
      const payload = { configuration: policy, status: 'draft' as const, published_at: null, published_by: null };
      const write = current.draft?.id
        ? await admin.from('ai_agent_versions').update(payload).eq('id', current.draft.id).eq('organization_id', organizationId).select('id,version_number,created_at').single()
        : await admin.from('ai_agent_versions').insert({ organization_id: organizationId, agent_id: current.agentId, version_number: latest + 1, ...payload }).select('id,version_number,created_at').single();
      if (write.error || !write.data) throw new Error('ana_draft_not_saved');
      await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: actorName, actor_type: 'user', action: 'ana.draft_saved', detail: 'Rascunho da política atualizado.', entity_table: 'ai_agent_versions', entity_id: write.data.id, event_data: { version: write.data.version_number } });
      return json({ ok: true, state: await readState(admin, organizationId) }, 200, headers);
    }
    if (action === 'publish') {
      const policy = normalizePolicy(body.policy ?? current.policy);
      validatePolicy(policy);
      if (!current.agentId) throw new Error('ana_agent_not_created');
      const now = new Date().toISOString();
      let draftId = current.draft?.id;
      if (draftId) {
        const { error } = await admin.from('ai_agent_versions').update({ configuration: policy }).eq('id', draftId).eq('organization_id', organizationId);
        if (error) throw new Error('ana_draft_not_saved');
      } else {
        const { data, error } = await admin.from('ai_agent_versions').insert({ organization_id: organizationId, agent_id: current.agentId, version_number: (current.published?.number ?? 0) + 1, status: 'draft', configuration: policy }).select('id').single();
        if (error || !data) throw new Error('ana_draft_not_saved');
        draftId = data.id;
      }
      const { data: published, error: publishError } = await admin.from('ai_agent_versions').update({ status: 'published', published_by: user.id, published_at: now }).eq('id', draftId).eq('organization_id', organizationId).select('id,version_number,published_at').single();
      if (publishError || !published) throw new Error('ana_policy_publish_failed');
      const { error: agentError } = await admin.from('ai_agents').update({ active_version_id: published.id, updated_at: now }).eq('id', current.agentId).eq('organization_id', organizationId);
      if (agentError) throw new Error('ana_active_version_not_saved');
      await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: actorName, actor_type: 'user', action: 'ana.policy_published', detail: `Política da Ana publicada na versão v${published.version_number}.`, entity_table: 'ai_agent_versions', entity_id: published.id, event_data: { version: published.version_number, modules: policy.modules, limits: policy.limits } });
      return json({ ok: true, state: await readState(admin, organizationId) }, 200, headers);
    }
    const question = asText(body.question, 800) || 'Como a Wayflex pode me ajudar?';
    const activeModules = MODULES.filter((key) => current.policy.modules[key].enabled).map((key) => moduleNames[key]);
    await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: actorName, actor_type: 'user', action: 'ana.simulation_run', detail: 'Simulação da política executada sem envio ou alteração operacional.', entity_table: 'ai_agent_versions', event_data: { question_length: question.length } });
    return json({ ok: true, simulation: { question, response: 'Simulação: a Ana responderia usando somente a política e o conhecimento aprovado. Nenhuma mensagem foi enviada.', modules: activeModules, sources: ['Perfil da empresa', 'Catálogo aprovado'], rules: ['Aprovação humana para preço, desconto, reunião e orçamento', 'Pausa imediata por opt-out'], decision: 'Resposta segura; produção não foi alterada.' }, state: current }, 200, headers);
  } catch (error) { return json({ ok: false, error: safeError(error) }, 400, headers); }
});
