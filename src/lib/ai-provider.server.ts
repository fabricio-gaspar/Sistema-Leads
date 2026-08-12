export type AiProvider = "openai" | "anthropic" | "gemini";

export type AiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; url: string; mediaType?: string };

export type AiMessage = {
  role: "user" | "assistant";
  content: string | AiContentPart[];
};

export type AiGenerateInput = {
  provider?: AiProvider | null;
  fallbackProvider?: AiProvider | null;
  model?: string | null;
  system: string;
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
  json?: boolean;
};

export type AiGenerateResult = {
  text: string;
  provider: AiProvider;
  model: string;
};

const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: "gpt-4.1-mini",
  anthropic: "claude-sonnet-4-5-20250929",
  gemini: "gemini-2.5-flash",
};

export function inferAiProvider(model?: string | null, configured?: string | null): AiProvider {
  if (configured === "openai" || configured === "anthropic" || configured === "gemini")
    return configured;
  return providerFromModel(model) || "anthropic";
}

function providerFromModel(model?: string | null): AiProvider | null {
  const value = (model || "").toLowerCase();
  if (
    value.startsWith("gpt-") ||
    value.startsWith("o1") ||
    value.startsWith("o3") ||
    value.startsWith("o4")
  )
    return "openai";
  if (value.startsWith("gemini")) return "gemini";
  if (value.startsWith("claude")) return "anthropic";
  return null;
}

export function providerAvailable(provider: AiProvider): boolean {
  if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY);
  if (provider === "gemini") return Boolean(process.env.GEMINI_API_KEY);
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function aiProviderHealth() {
  return {
    openai: providerAvailable("openai"),
    anthropic: providerAvailable("anthropic"),
    gemini: providerAvailable("gemini"),
  };
}

export async function generateAiText(input: AiGenerateInput): Promise<AiGenerateResult> {
  const primary = inferAiProvider(input.model, input.provider);
  // External model calls are opt-in. This keeps the first delivery in a
  // deterministic sandbox even if a provider credential is present.
  if (process.env.AI_LIVE_ENABLED !== "true") {
    return {
      text: input.json ? "{}" : "[Ana em modo sandbox] Resposta simulada. Nenhum provedor externo foi acionado.",
      provider: primary,
      model: "sandbox",
    };
  }
  const candidates = [primary, input.fallbackProvider].filter(
    (provider, index, all): provider is AiProvider =>
      Boolean(provider) && all.indexOf(provider) === index,
  );
  let lastError: Error | null = null;

  for (const provider of candidates) {
    if (!providerAvailable(provider)) {
      lastError = new Error(`Credencial de ${provider} não configurada`);
      continue;
    }
    try {
      const detectedModelProvider = providerFromModel(input.model);
      const requestedModel =
        provider === primary && (!detectedModelProvider || detectedModelProvider === provider)
          ? input.model
          : null;
      const model = requestedModel || DEFAULT_MODELS[provider];
      const text =
        provider === "openai"
          ? await callOpenAi({ ...input, model })
          : provider === "gemini"
            ? await callGemini({ ...input, model })
            : await callAnthropic({ ...input, model });
      if (!text.trim()) throw new Error(`${provider} retornou resposta vazia`);
      return { text: text.trim(), provider, model };
    } catch (error) {
      lastError = error as Error;
    }
  }
  throw lastError ?? new Error("Nenhum provedor de IA está disponível");
}

function textOnly(content: AiMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .map((part) => (part.type === "text" ? part.text : `[Imagem: ${part.url}]`))
    .join("\n");
}

async function callAnthropic(input: AiGenerateInput & { model: string }): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY!;
  const messages = input.messages.map((message) => ({
    role: message.role,
    content:
      typeof message.content === "string"
        ? message.content
        : message.content.map((part) => {
            if (part.type === "text") return { type: "text", text: part.text };
            const match = part.url.match(/^data:([^;]+);base64,(.+)$/);
            return match
              ? {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: part.mediaType || match[1],
                    data: match[2],
                  },
                }
              : { type: "text", text: `[Imagem disponível em ${part.url}]` };
          }),
  }));
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: input.maxTokens ?? 900,
      temperature: input.temperature ?? 0,
      system: input.system,
      messages,
    }),
  });
  const payload = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(payload.error?.message || `Anthropic HTTP ${response.status}`);
  return (payload.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text || "")
    .join("\n");
}

async function callOpenAi(input: AiGenerateInput & { model: string }): Promise<string> {
  const key = process.env.OPENAI_API_KEY!;
  const messages = input.messages.map((message) => ({
    role: message.role,
    content:
      typeof message.content === "string"
        ? message.content
        : message.content.map((part) =>
            part.type === "text"
              ? { type: "input_text", text: part.text }
              : { type: "input_image", image_url: part.url },
          ),
  }));
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: input.model,
      instructions: input.system,
      input: messages,
      max_output_tokens: input.maxTokens ?? 900,
      ...(input.json ? { text: { format: { type: "json_object" } } } : {}),
    }),
  });
  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(payload.error?.message || `OpenAI HTTP ${response.status}`);
  if (payload.output_text) return payload.output_text;
  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((part) => part.text || "")
    .join("\n");
}

async function callGemini(input: AiGenerateInput & { model: string }): Promise<string> {
  const key = process.env.GEMINI_API_KEY!;
  const contents = input.messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts:
      typeof message.content === "string"
        ? [{ text: message.content }]
        : message.content.map((part) => {
            if (part.type === "text") return { text: part.text };
            const match = part.url.match(/^data:([^;]+);base64,(.+)$/);
            return match
              ? { inlineData: { mimeType: part.mediaType || match[1], data: match[2] } }
              : { text: `[Imagem disponível em ${part.url}]` };
          }),
  }));
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents,
        generationConfig: {
          maxOutputTokens: input.maxTokens ?? 900,
          temperature: input.temperature ?? 0,
          ...(input.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
  );
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(payload.error?.message || `Gemini HTTP ${response.status}`);
  return (payload.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text || "")
    .join("\n");
}

export async function transcribeAudio(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY é necessária para transcrever áudio");
  const form = new FormData();
  const data = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  form.append("file", new Blob([data], { type: mimeType }), fileName);
  form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");
  form.append("language", "pt");
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body: form,
  });
  const payload = (await response.json()) as { text?: string; error?: { message?: string } };
  if (!response.ok)
    throw new Error(payload.error?.message || `Transcrição HTTP ${response.status}`);
  return payload.text?.trim() || "";
}

export function normalizeAiJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const raw = fenced || text;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("A IA não retornou JSON válido");
  JSON.parse(match[0]);
  return match[0];
}

export function messagesAsText(messages: AiMessage[]): string {
  return messages.map((message) => `${message.role}: ${textOnly(message.content)}`).join("\n");
}
