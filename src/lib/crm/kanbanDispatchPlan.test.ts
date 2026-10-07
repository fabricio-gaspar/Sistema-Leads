import { describe, expect, it } from 'vitest';
import { assignKanbanRoutingUser, buildKanbanDispatchPlan } from '@/lib/crm/kanbanDispatchPlan';

describe('buildKanbanDispatchPlan', () => {
  it('preserva a classificação individual de uma seleção mista', () => {
    const plan = buildKanbanDispatchPlan([
      { id: 'ana', modoAtendimento: 'IA' },
      { id: 'humano', modoAtendimento: 'HUMANO' },
    ], ['ana', 'humano']);

    expect(plan).toEqual({
      anaLeadIds: ['ana'], humanLeadIds: ['humano'], alreadyInKanbanLeadIds: [], needsRoutingLeadIds: ['ana'], unresolvedLeadIds: ['humano'],
    });
  });

  it('não presume um modo para lead ainda não classificado', () => {
    const plan = buildKanbanDispatchPlan([{ id: 'sem-modo', modoAtendimento: undefined }], ['sem-modo']);

    expect(plan).toEqual({
      anaLeadIds: [], humanLeadIds: [], alreadyInKanbanLeadIds: [], needsRoutingLeadIds: [], unresolvedLeadIds: ['sem-modo'],
    });
  });

  it('ignora ids repetidos sem duplicar uma ativação', () => {
    const plan = buildKanbanDispatchPlan([{ id: 'ana', modoAtendimento: 'IA' }], ['ana', 'ana']);

    expect(plan.anaLeadIds).toEqual(['ana']);
  });

  it('não reencaminha o mesmo lead quando o vínculo já o torna visível no Kanban', () => {
    const plan = buildKanbanDispatchPlan([
      { id: 'ana-no-kanban', modoAtendimento: 'IA', responsavelId: '11111111-1111-4111-8111-111111111111' },
    ], ['ana-no-kanban']);

    expect(plan.alreadyInKanbanLeadIds).toEqual(['ana-no-kanban']);
    expect(plan.needsRoutingLeadIds).toEqual([]);
  });

  it('muda somente o vínculo técnico ao rotear o lead da Ana', () => {
    const lead = {
      id: 'ana', modoAtendimento: 'IA' as const, responsavelId: '', score: 87,
      fitScore: 90, contactabilityScore: 80, engagementScore: 60,
      origem: 'Busca de leads', sourceRecordId: 'source-123',
    } as import('@/mocks/leadsData').Lead;

    const routed = assignKanbanRoutingUser(lead, '11111111-1111-4111-8111-111111111111');

    expect(routed).toEqual({ ...lead, responsavelId: '11111111-1111-4111-8111-111111111111' });
    expect(routed.score).toBe(87);
    expect(routed.fitScore).toBe(90);
    expect(routed.sourceRecordId).toBe('source-123');
  });
});
