import { describe, expect, it } from 'vitest';
import { canTransitionOpportunity, legacyStageForPipeline, outcomeFromLegacy, stageFromLegacy } from './pipeline';

describe('pipeline comercial simplificado', () => {
  it('normaliza etapas legadas e separa o resultado', () => {
    expect(stageFromLegacy('Negociação')).toBe('quote_sent');
    expect(stageFromLegacy('Proposta em Preparação')).toBe('quote_preparation');
    expect(legacyStageForPipeline('quote_preparation')).toBe('Reunião');
    expect(stageFromLegacy('Ganho')).toBe('won');
    expect(stageFromLegacy('Perdido')).toBe('lost');
    expect(legacyStageForPipeline('won')).toBe('Ganho');
    expect(legacyStageForPipeline('lost')).toBe('Perdido');
    expect(outcomeFromLegacy('Fechado — Ganho')).toBe('won');
    expect(stageFromLegacy('Prospecção')).toBe('entered');
    expect(stageFromLegacy('Fechado')).toBe('won');
  });

  it('impede fechamento ganho pela Ana', () => {
    expect(canTransitionOpportunity({
      from: 'quote_sent', to: 'won', outcome: 'won', source: 'ai_suggestion', evidence: {},
    })).toEqual({ ok: false, reason: 'A Ana não pode concluir uma oportunidade como ganha.' });
  });

  it('exige confirmação humana para os dois resultados finais', () => {
    expect(canTransitionOpportunity({
      from: 'quote_sent', to: 'won', source: 'human', evidence: {},
    })).toEqual({ ok: false, reason: 'O fechamento como ganho exige confirmação humana.' });
    expect(canTransitionOpportunity({
      from: 'quote_sent', to: 'won', source: 'human', evidence: { confirmedByHuman: true },
    }).ok).toBe(true);
    expect(canTransitionOpportunity({
      from: 'quote_sent', to: 'lost', source: 'human', evidence: {},
    })).toEqual({ ok: false, reason: 'Perdas exigem confirmação humana, exceto opt-out inequívoco.' });
    expect(canTransitionOpportunity({
      from: 'quote_sent', to: 'lost', source: 'rule', evidence: { explicitOptOut: true },
    }).ok).toBe(true);
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

  it('impede salto automático de etapas, mas preserva avanço humano comprovado', () => {
    expect(canTransitionOpportunity({
      from: 'entered', to: 'qualified', source: 'ai_suggestion', evidence: { isQualified: true },
    })).toEqual({ ok: false, reason: 'Automações avançam somente uma etapa por vez.' });
    expect(canTransitionOpportunity({
      from: 'entered', to: 'qualified', source: 'human', evidence: { isQualified: true },
    }).ok).toBe(true);
  });

  it('mantém Ganho e Perdido como estados terminais', () => {
    expect(canTransitionOpportunity({
      from: 'won', to: 'lost', source: 'human', evidence: { confirmedByHuman: true },
    })).toEqual({ ok: false, reason: 'Ganho e Perdido são estados terminais e não podem ser reabertos por transição comum.' });
    expect(canTransitionOpportunity({
      from: 'lost', to: 'won', source: 'human', evidence: { confirmedByHuman: true },
    })).toEqual({ ok: false, reason: 'Ganho e Perdido são estados terminais e não podem ser reabertos por transição comum.' });
  });
});
