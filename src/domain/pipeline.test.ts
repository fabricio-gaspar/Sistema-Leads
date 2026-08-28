import { describe, expect, it } from 'vitest';
import { canTransitionOpportunity, legacyStageForPipeline, outcomeFromLegacy, stageFromLegacy } from './pipeline';

describe('pipeline comercial simplificado', () => {
  it('normaliza etapas legadas e separa o resultado', () => {
    expect(stageFromLegacy('Negociação')).toBe('decision');
    expect(stageFromLegacy('Proposta em Preparação')).toBe('quote_preparation');
    expect(legacyStageForPipeline('quote_preparation')).toBe('Proposta em Preparação');
    expect(outcomeFromLegacy('Fechado — Ganho')).toBe('won');
  });

  it('impede fechamento ganho pela Ana', () => {
    expect(canTransitionOpportunity({
      from: 'decision', to: 'decision', outcome: 'won', source: 'ai_suggestion', evidence: {},
    })).toEqual({ ok: false, reason: 'A Ana não pode concluir uma oportunidade como ganha.' });
  });

  it('exige evidência para o avanço no fluxo', () => {
    expect(canTransitionOpportunity({
      from: 'qualified', to: 'quote_preparation', source: 'human', evidence: {},
    }).ok).toBe(false);
    expect(canTransitionOpportunity({
      from: 'qualified', to: 'quote_preparation', source: 'human', evidence: { isQualified: true },
    }).ok).toBe(true);
    expect(canTransitionOpportunity({
      from: 'quote_preparation', to: 'quote_sent', source: 'human', evidence: { hasSentQuote: true },
    }).ok).toBe(true);
  });
});
