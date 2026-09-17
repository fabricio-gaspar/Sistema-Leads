export interface PendingManualLeadContact {
  whatsapp: string;
  canalPreferencial: string;
  contatoPermitido: false;
  consentimentoWhatsApp: false;
  consentimentoEmail: false;
  contactApprovalStatus: 'pending';
  contactApprovalReason: string;
  contactApprovedAt: null;
}

export function pendingManualLeadContact(input: { email: string; telefone: string }): PendingManualLeadContact {
  return {
    whatsapp: '',
    canalPreferencial: input.email.trim() ? 'E-mail' : input.telefone.trim() ? 'Telefone' : '',
    contatoPermitido: false,
    consentimentoWhatsApp: false,
    consentimentoEmail: false,
    contactApprovalStatus: 'pending',
    contactApprovalReason: 'Lead manual criado; aguardando comprovação de canal e autorização para primeiro contato.',
    contactApprovedAt: null,
  };
}

/**
 * The first automatic contact is an explicit WhatsApp activation, not an
 * inference based on which optional contact field happened to be filled in
 * first. Keeping this decision here prevents a manual lead with both e-mail
 * and phone from being persisted as an e-mail conversation when Ana is
 * authorized to start on WhatsApp.
 */
export function approvedAnaWhatsAppChannel(input: { whatsapp: string; telefone: string }): { whatsapp: string; canalPreferencial: 'WhatsApp' } | null {
  const whatsapp = input.whatsapp.trim() || input.telefone.trim();
  return whatsapp ? { whatsapp, canalPreferencial: 'WhatsApp' } : null;
}
