import { describe, expect, it } from 'vitest';
import { isContactActivationPending, shouldDisplayInKanban } from '@/lib/crm/kanbanLeadVisibility';

describe('kanban lead visibility', () => {
  it('keeps an Ana lead visible while contact activation is pending', () => {
    const lead = { modoAtendimento: 'IA' as const, responsavelId: '11111111-1111-4111-8111-111111111111', contactApprovalStatus: 'pending' as const };

    expect(shouldDisplayInKanban(lead)).toBe(true);
    expect(isContactActivationPending(lead)).toBe(true);
  });

  it('does not show records without an assigned workflow', () => {
    expect(shouldDisplayInKanban({ modoAtendimento: undefined, responsavelId: undefined, contactApprovalStatus: 'pending' })).toBe(false);
  });
});
