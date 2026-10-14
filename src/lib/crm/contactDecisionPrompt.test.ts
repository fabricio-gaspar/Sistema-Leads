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
      messageId: 'message-1',
      latestInboundText: 'Olá, preciso de ajuda.',
      decisionRevision: 4,
      canEnableAi: false,
    })).toEqual({
      leadId: 'lead-1',
      accountId: 'account-1',
      phone: '5511999999999',
      name: 'Carlos',
      state: 'agenda_protected',
      messageId: 'message-1',
      latestInboundText: 'Olá, preciso de ajuda.',
      decisionRevision: 4,
      canEnableAi: false,
    });
  });

  it('does not prompt for an authorized lead or an unresolved directory row', () => {
    expect(buildContactDecisionPrompt({ leadId: 'lead-1', accountId: 'account-1', phone: '5511', name: 'Carlos', state: 'lead_authorized', messageId: 'message-1', latestInboundText: '', decisionRevision: 1, canEnableAi: false })).toBeNull();
    expect(buildContactDecisionPrompt({ leadId: 'lead-2', accountId: 'account-1', phone: '5522', name: 'A classificar', state: 'unknown', messageId: 'message-2', latestInboundText: '', decisionRevision: 1, canEnableAi: false })).toBeNull();
  });

  it('keeps an unclassified inbound contact actionable until the server records a decision', () => {
    expect(buildContactDecisionPrompt({
      leadId: 'lead-3', accountId: 'account-1', phone: '5531999999999', name: 'Novo contato', state: 'unclassified',
      messageId: 'message-3', latestInboundText: 'Pode me ajudar?', decisionRevision: 2, canEnableAi: false,
    })).toMatchObject({
      leadId: 'lead-3', state: 'unclassified', messageId: 'message-3', decisionRevision: 2,
    });
  });
});
