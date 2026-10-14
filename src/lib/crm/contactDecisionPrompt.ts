export type ContactDecisionState = 'agenda_protected' | 'unclassified' | 'lead_authorized' | 'unknown';

export type ContactDecisionCandidate = {
  leadId: string;
  accountId: string;
  phone: string;
  name: string;
  state: ContactDecisionState;
  /** The inbound event that caused this prompt. It is the durable dismissal key. */
  messageId: string;
  latestInboundText: string;
  decisionRevision: number;
  /** UI hint only. The server remains authoritative for an Ana activation. */
  canEnableAi: boolean;
};

export type ContactDecisionPrompt = Omit<ContactDecisionCandidate, 'state'> & {
  state: Extract<ContactDecisionState, 'agenda_protected' | 'unclassified'>;
};

export function buildContactDecisionPrompt(candidate: ContactDecisionCandidate): ContactDecisionPrompt | null {
  if (candidate.state !== 'agenda_protected' && candidate.state !== 'unclassified') return null;
  return candidate as ContactDecisionPrompt;
}
