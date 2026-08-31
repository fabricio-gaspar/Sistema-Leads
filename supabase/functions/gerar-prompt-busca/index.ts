import { requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';
import { readJson, requiredString, requiredUuid } from '../_shared/validation.ts';

const CONTRIBUTOR_ROLES = ['owner', 'admin', 'manager', 'seller'];

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ error: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, headers);

  try {
    const body = await readJson(request);
    const organizationId = requiredUuid(body.organizationId, 'organization_id');
    const criteria = requiredString(body.criteria, 'criteria', 4_000);
    const fields = Array.isArray(body.fields)
      ? body.fields.map((field) => requiredString(field, 'field', 80)).slice(0, 20)
      : [];
    if (fields.length === 0) throw new Error('invalid_fields');

    const { client, user } = await requireUser(request);
    await requireOrganizationRole(client, user.id, organizationId, CONTRIBUTOR_ROLES);
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    const model = Deno.env.get('OPENAI_PROMPT_MODEL') || 'gpt-4.1-mini';
    if (!apiKey) throw new Error('ai_not_configured');

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
