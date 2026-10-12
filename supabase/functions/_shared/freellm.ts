export function freeLlmEndpoint(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (!base) throw new Error('freellm_url_missing');
  return /\/v1\/chat\/completions$/i.test(base)
    ? base
    : `${base.replace(/\/v1$/i, '')}/v1/chat/completions`;
}

export function parseFreeLlmContent(content: unknown): unknown {
  if (typeof content !== 'string' || !content.trim()) throw new Error('freellm_empty_response');
  const normalized = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(normalized); } catch { throw new Error('freellm_invalid_json'); }
}

export async function callFreeLlm(
  apiKey: string,
  baseUrl: string,
  system: string,
  prompt: string,
  model?: string,
  timeoutMs = 20_000,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(freeLlmEndpoint(baseUrl), {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'llama-3.3-70b-versatile',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('freellm_timeout');
    throw new Error('freellm_network_error');
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`freellm_${response.status}`);
  const body = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
  return parseFreeLlmContent(body.choices?.[0]?.message?.content);
}
