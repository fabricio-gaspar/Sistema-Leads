import { createFileRoute } from "@tanstack/react-router";

type AnaMessage = { role: "user" | "assistant"; content: string };

type AnaRequestBody = {
  messages?: AnaMessage[];
  system?: string;
  model?: string;
};

const DEFAULT_SYSTEM = `Você é Ana, vendedora virtual da WF Digital.
Seja consultiva, cordial, objetiva e comercial. Reposicione objeções (preço, "vou pensar", concorrente) com valor.
Ofertas base: Assessoria de IA Comercial R$ 5.000 (taxa única) e Licença mensal R$ 490/mês.
Alçada de desconto: até 10%. Acima disso, escalone para o diretor comercial.
Responda em português do Brasil, mensagens curtas de WhatsApp (2 a 4 frases).`;

const DEFAULT_MODEL = "claude-sonnet-4-5";

export const Route = createFileRoute("/api/ana")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return Response.json(
            { error: "ANTHROPIC_API_KEY não configurada" },
            { status: 500 },
          );
        }

        let body: AnaRequestBody;
        try {
          body = (await request.json()) as AnaRequestBody;
        } catch {
          return Response.json({ error: "JSON inválido" }, { status: 400 });
        }

        const messages = Array.isArray(body.messages) ? body.messages : [];
        if (messages.length === 0) {
          return Response.json({ error: "messages é obrigatório" }, { status: 400 });
        }

        const system = (body.system && body.system.trim()) || DEFAULT_SYSTEM;
        const model = body.model || DEFAULT_MODEL;

        try {
          const upstream = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model,
              max_tokens: 512,
              system,
              messages: messages.map((m) => ({
                role: m.role === "assistant" ? "assistant" : "user",
                content: String(m.content ?? ""),
              })),
            }),
          });

          const data = (await upstream.json()) as {
            content?: Array<{ type: string; text?: string }>;
            error?: { message?: string };
          };

          if (!upstream.ok) {
            return Response.json(
              { error: data?.error?.message || `Anthropic ${upstream.status}` },
              { status: upstream.status },
            );
          }

          const text =
            (data.content || [])
              .filter((c) => c.type === "text")
              .map((c) => c.text || "")
              .join("\n")
              .trim() || "…";

          return Response.json({ text, model });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Erro desconhecido" },
            { status: 502 },
          );
        }
      },
    },
  },
});
