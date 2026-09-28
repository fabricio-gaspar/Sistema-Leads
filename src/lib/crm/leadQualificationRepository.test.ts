import { describe, expect, it } from 'vitest';
import { mapLeadQualification } from './leadQualificationRepository';

describe('mapLeadQualification', () => {
  it('preserva apenas o dossiê técnico estruturado e os campos faltantes', () => {
    const qualification = mapLeadQualification({
      lead_id: 'lead-1', summary: 'Necessidade industrial em descoberta.', next_action: 'Confirmar medida.', next_action_due_at: '2026-09-30T13:00:00Z', readiness_score: 91,
      interest_level: 'hot', requested_action: 'quote', decision_maker: 'Compras', objections: ['Precisa validar desenho'],
      missing_fields: ['quantidade', 'prazo'], technical_context: {
        application: 'Vedação de flange', measurement_or_drawing: 'Aguardando desenho', material_or_condition: 'Contato com óleo', quantity: null, deadline: null, need: 'Fita PTFE', ignored: 'não expor',
      }, updated_at: '2026-09-26T12:00:00Z',
    });
    expect(qualification.technical).toEqual({ application: 'Vedação de flange', measurementOrDrawing: 'Aguardando desenho', materialOrCondition: 'Contato com óleo', quantity: null, deadline: null, need: 'Fita PTFE' });
    expect(qualification.missingFields).toEqual(['quantidade', 'prazo']);
    expect(qualification.readinessScore).toBe(91);
    expect(qualification.nextActionDueAt).toBe('2026-09-30T13:00:00Z');
  });
});
