import { describe, expect, it } from 'vitest';
import type { AnaOperationSettings } from './anaOperationRepository';
import { validateAnaOperationForActivation } from './anaOperationValidation';

const valid: AnaOperationSettings = {
  enabled: true, mode: 'automatic', name: 'Rotina', timezone: 'America/Sao_Paulo', weekdays: [1], runTime: '09:00',
  dailyLeadLimit: 10, dailyCap: 20, monthlyCap: 200, minimumFitScore: 70, assignmentStrategy: 'owner',
  initialAssignmentMode: 'ana', initialAssigneeUserId: null, teamMemberIds: [], handoffStage: null, handoffAssigneeUserId: null, handoffNotifyWhatsapp: false,
  city: 'Campinas', regions: ['SP'], segments: [], keywords: ['transportadores'], requireWebsite: true, requireWhatsapp: true, requireEmail: false,
  paidProspectingApproved: true, notifyImmediate: true, notifyProgress: true, digestEnabled: true, digestTime: '18:00',
};

describe('validateAnaOperationForActivation', () => {
  it('allows an automatic Ana route with its safeguards configured', () => {
    expect(validateAnaOperationForActivation(valid)).toEqual([]);
  });

  it('identifies the specific missing handoff seller', () => {
    expect(validateAnaOperationForActivation({ ...valid, handoffStage: 'qualificando' }))
      .toContainEqual(expect.objectContaining({ field: 'handoffAssigneeUserId' }));
  });

  it('requires a real selected team instead of the legacy global round robin', () => {
    expect(validateAnaOperationForActivation({ ...valid, initialAssignmentMode: 'team' }))
      .toContainEqual(expect.objectContaining({ field: 'teamMemberIds' }));
  });

  it.each(['', ' ', 'A', 'x'.repeat(121)])('rejects a missing or invalid city: %s', (city) => {
    expect(validateAnaOperationForActivation({ ...valid, city })).toContainEqual(expect.objectContaining({ field: 'city' }));
  });

  it.each([[], ['SP', 'PR'], ['XX'], ['sp']].map((regions) => ({ regions })))('requires exactly one valid UF: $regions', ({ regions }) => {
    expect(validateAnaOperationForActivation({ ...valid, regions })).toContainEqual(expect.objectContaining({ field: 'regions' }));
  });

  it('requires actual search terms while accepting a segment alone', () => {
    expect(validateAnaOperationForActivation({ ...valid, keywords: [] })).toContainEqual(expect.objectContaining({ field: 'keywords' }));
    expect(validateAnaOperationForActivation({ ...valid, keywords: [], segments: ['logística'] })).toEqual([]);
  });
});
