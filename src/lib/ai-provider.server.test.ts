import { describe, expect, it } from "vitest";
import { generateAiText } from "./ai-provider.server";

describe("AI provider sandbox", () => {
  it("does not call an external provider until live mode is explicitly enabled", async () => {
    const original = process.env.AI_LIVE_ENABLED;
    delete process.env.AI_LIVE_ENABLED;

    try {
      const result = await generateAiText({
        provider: "openai",
        system: "Você é Ana.",
        messages: [{ role: "user", content: "Olá" }],
      });
      expect(result.model).toBe("sandbox");
      expect(result.text).toContain("modo sandbox");
    } finally {
      if (original === undefined) delete process.env.AI_LIVE_ENABLED;
      else process.env.AI_LIVE_ENABLED = original;
    }
  });
});
