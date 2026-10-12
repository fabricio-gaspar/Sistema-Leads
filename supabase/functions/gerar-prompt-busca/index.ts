import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';
import { readJson, requiredString, requiredUuid } from '../_shared/validation.ts';
import { companyProspectingContext, currentProspectingAiFilters, normalizeProspectingAiFilters } from '../_shared/prospectingAiPlan.ts';

const CONTRIBUTOR_ROLES = ['owner', 'admin', 'manager', 'seller'];

async function suggestFilters(body: Record<string, unknown>, organizationId: string, apiKey: string, model: string) {
  const request = requiredString(body.request, 'request', 800);
  const current = currentProspectingAiFilters(body.currentFilters);
  const admin = createAdminClient();
  const { data: company, error: companyError } = await admin
    .from('company_settings')
    .select('name,description,segment,city,ui_settings')
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (companyError) throw new Error('company_context_unavailable');
  const context = companyProspectingContext(company);
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Você é um assistente de filtros de prospecção B2B. Retorne somente JSON válido. Nunca execute buscas, nunca inclua nomes, contatos ou dados pessoais. Preserve a região atual se o usuário não pedir outra. Use apenas targetProfile entre potential_customers, distributors, resellers, suppliers; customerSegments entre Automotivo, Alimentos e bebidas, Máquinas e equipamentos, Construção, Mineração; volume entre 1 e 100. O JSON deve conter city,state,offer,targetProfile,customerSegments,terms,volume,requireSite,requireWhatsApp,requireEmail,summary,rationale.',
        },
        {
          role: 'user',
          content: JSON.stringify({ company: context, currentFilters: current, request }),
        },
      ],
    }),
  });
  if (!response.ok) throw new Error('ai_provider_error');
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('ai_invalid_response');
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { throw new Error('ai_invalid_response'); }
  return normalizeProspectingAiFilters(parsed, current);
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ error: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, headers);

  try {
    const body = await readJson(request);
    const organizationId = requiredUuid(body.organizationId, 'organization_id');
    const { client, user } = await requireUser(request);
    await requireOrganizationRole(client, user.id, organizationId, CONTRIBUTOR_ROLES);
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    const model = Deno.env.get('OPENAI_PROMPT_MODEL') || 'gpt-4.1-mini';
    if (!apiKey) throw new Error('ai_not_configured');

    if (body.action === 'suggest_filters') {
      const plan = await suggestFilters(body, organizationId, apiKey, model);
      return json({ plan, source: 'ai' }, 200, headers);
    }

    const criteria = requiredString(body.criteria, 'criteria', 4_000);
    const fields = Array.isArray(body.fields)
      ? body.fields.map((field) => requiredString(field, 'field', 80)).slice(0, 20)
      : [];
    if (fields.length === 0) throw new Error('invalid_fields');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: 'system',
            content: 'Você cria prompts de prospecção B2B. Retorne apenas o prompt final, sem markdown. Não solicite ou produza dados pessoais sensíveis e inclua regras de deduplicação, finalidade legítima e opt-out.',
          },
          { role: 'user', content: `Critérios: ${criteria}\nCampos permitidos: ${fields.join(', ')}` },
        ],
      }),
    });
    if (!response.ok) throw new Error('ai_provider_error');
    const data = await response.json();
    const prompt = data?.choices?.[0]?.message?.content;
    if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('ai_invalid_response');
    return json({ prompt: prompt.trim() }, 200, headers);
  } catch (error) {
    const message = safeError(error);
    const status = ['authentication_required', 'invalid_session', 'organization_access_denied'].includes(message) ? 403 : 400;
    return json({ error: message }, status, headers);
  }
});
