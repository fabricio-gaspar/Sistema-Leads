import { afterEach, describe, expect, it, vi } from 'vitest';
import { callFreeLlm, freeLlmEndpoint, parseFreeLlmContent } from '../functions/_shared/freellm.ts';

afterEach(() => vi.restoreAllMocks());

describe('FreeLLMAPI provider', () => {
  it('normaliza a rota OpenAI-compatible sem duplicar /v1', () => {
    expect(freeLlmEndpoint('https://llm.example.com')).toBe('https://llm.example.com/v1/chat/completions');
    expect(freeLlmEndpoint('https://llm.example.com/v1/')).toBe('https://llm.example.com/v1/chat/completions');
    expect(freeLlmEndpoint('https://llm.example.com/v1/chat/completions')).toBe('https://llm.example.com/v1/chat/completions');
  });

  it('aceita JSON encapsulado em bloco de código', () => {
    expect(parseFreeLlmContent('```json\n{"score": 80}\n```')).toEqual({ score: 80 });
  });

  it('envia somente contrato estruturado e interpreta a resposta', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"score": 90}' } }] }), { status: 200 }));
    await expect(callFreeLlm('secret', 'https://llm.example.com', 'system', 'context', 'model')).resolves.toEqual({ score: 90 });
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(fetchMock.mock.calls[0][0]).toBe('https://llm.example.com/v1/chat/completions');
    expect(request.headers).toEqual({ Authorization: 'Bearer secret', 'Content-Type': 'application/json' });
    expect(JSON.parse(String(request.body)).response_format).toEqual({ type: 'json_object' });
  });

  it('converte resposta HTTP de falha em erro sem registrar o corpo', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('private provider details', { status: 429 }));
    await expect(callFreeLlm('secret', 'https://llm.example.com', 'system', 'context')).rejects.toThrow('freellm_429');
  });
});
