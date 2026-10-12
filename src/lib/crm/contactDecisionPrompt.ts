export type ContactDecisionState = 'agenda_protected' | 'unclassified' | 'lead_authorized' | 'unknown';

export type ContactDecisionCandidate = {
  leadId: string;
  accountId: string;
  phone: string;
  name: string;
  state: ContactDecisionState;
};

export type ContactDecisionPrompt = Omit<ContactDecisionCandidate, 'state'> & {
  state: Extract<ContactDecisionState, 'agenda_protected' | 'unclassified'>;
};

export function buildContactDecisionPrompt(candidate: ContactDecisionCandidate): ContactDecisionPrompt | null {
  if (candidate.state !== 'agenda_protected' && candidate.state !== 'unclassified') return null;
  return candidate as ContactDecisionPrompt;
}
