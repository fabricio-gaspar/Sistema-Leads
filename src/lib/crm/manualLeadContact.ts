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
