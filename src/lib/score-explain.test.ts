import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, distributionFor, explainScore } from "./score-explain";

describe("lead score", () => {
  it("combines deterministic evidence and AI score into a hot lead", () => {
    const score = explainScore(
      {
        cnae_principal: "2219-6/00",
        cnae_descricao: "Artefatos de borracha",
        whatsapp: "5511999999999",
        website: "https://empresa.example",
        source: "google_places",
        uf: "SP",
        score: 90,
      },
      DEFAULT_WEIGHTS,
      { ufFilter: "SP" },
    );

    expect(score.deterministic).toBeGreaterThanOrEqual(85);
    expect(score.combined).toBeGreaterThanOrEqual(85);
    expect(score.temp).toBe("hot");
  });

  it("reports a stable distribution for an empty list", () => {
    expect(distributionFor([], DEFAULT_WEIGHTS)).toEqual({
      total: 0,
      hot: 0,
      warm: 0,
      cold: 0,
      avg: 0,
    });
  });
});
