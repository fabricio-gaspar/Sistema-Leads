import { describe, expect, it } from 'vitest';
import { buildContactDecisionPrompt } from './contactDecisionPrompt';

describe('contact decision prompt', () => {
  it('prompts for an agenda-protected contact when a new inbound message arrives', () => {
    expect(buildContactDecisionPrompt({
      leadId: 'lead-1',
      accountId: 'account-1',
      phone: '5511999999999',
      name: 'Carlos',
      state: 'agenda_protected',
    })).toEqual({
      leadId: 'lead-1',
      accountId: 'account-1',
      phone: '5511999999999',
      name: 'Carlos',
      state: 'agenda_protected',
    });
  });

  it('does not prompt for an authorized lead or an unresolved directory row', () => {
    expect(buildContactDecisionPrompt({ leadId: 'lead-1', accountId: 'account-1', phone: '5511', name: 'Carlos', state: 'lead_authorized' })).toBeNull();
    expect(buildContactDecisionPrompt({ leadId: 'lead-2', accountId: 'account-1', phone: '5522', name: 'A classificar', state: 'unknown' })).toBeNull();
  });
});
