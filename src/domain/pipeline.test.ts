import { describe, expect, it } from 'vitest';
import { canTransitionOpportunity, outcomeFromLegacy, stageFromLegacy } from './pipeline';

describe('pipeline comercial simplificado', () => {
  it('normaliza etapas legadas e separa o resultado', () => {
    expect(stageFromLegacy('Negociação')).toBe('decision');
    expect(outcomeFromLegacy('Fechado — Ganho')).toBe('won');
  });

  it('impede fechamento ganho pela Ana', () => {
    expect(canTransitionOpportunity({
      from: 'decision', to: 'decision', outcome: 'won', source: 'ai_suggestion', evidence: {},
    })).toEqual({ ok: false, reason: 'A Ana não pode concluir uma oportunidade como ganha.' });
  });

  it('exige evidência para o avanço no fluxo', () => {
    expect(canTransitionOpportunity({
      from: 'qualified', to: 'quote_sent', source: 'human', evidence: {},
    }).ok).toBe(false);
    expect(canTransitionOpportunity({
      from: 'qualified', to: 'quote_sent', source: 'human', evidence: { hasSentQuote: true },
    }).ok).toBe(true);
  });
});
