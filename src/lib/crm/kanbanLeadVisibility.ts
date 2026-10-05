import type { Lead } from '@/mocks/leadsData';

type KanbanLead = Pick<Lead, 'modoAtendimento' | 'responsavelId' | 'contactApprovalStatus'>;

export function shouldDisplayInKanban(lead: KanbanLead): boolean {
  return Boolean(lead.modoAtendimento && lead.responsavelId);
}

export function isContactActivationPending(lead: KanbanLead): boolean {
  return lead.modoAtendimento === 'IA' && lead.contactApprovalStatus !== 'approved';
}
