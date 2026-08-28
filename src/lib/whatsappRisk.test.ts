import { describe, expect, it } from 'vitest';
import { evaluateWhatsappRisk } from './whatsappRisk';

describe('evaluateWhatsappRisk', () => {
  it('does not invent a risk level without provider telemetry', () => {
    expect(evaluateWhatsappRisk([], []).nivel).toBe('sem_dados');
  });

  it('honors an active server policy event over a derived score', () => {
    const result = evaluateWhatsappRisk([{ sampled_at: new Date().toISOString(), sent_count: 100, delivered_count: 99, failed_count: 1, opt_out_count: 0, complaint_count: 0, quality_rating: 'high', source: 'meta' }], [{ risk_level: 'critical', action: 'pause', created_at: new Date().toISOString(), resolved_at: null }]);
    expect(result.nivel).toBe('critico');
  });
});
