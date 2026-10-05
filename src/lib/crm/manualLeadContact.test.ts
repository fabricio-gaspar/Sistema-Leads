import { describe, expect, it } from 'vitest';
import { approvedAnaWhatsAppChannel, pendingManualLeadContact } from '@/lib/crm/manualLeadContact';

describe('pendingManualLeadContact', () => {
  it('creates a manual lead without asserting WhatsApp or contact authorization', () => {
    expect(pendingManualLeadContact({ email: '', telefone: '11999990000' })).toEqual({
      whatsapp: '',
      canalPreferencial: 'Telefone',
      contatoPermitido: false,
      consentimentoWhatsApp: false,
      consentimentoEmail: false,
      contactApprovalStatus: 'pending',
      contactApprovalReason: 'Lead manual criado; aguardando comprovação de canal e autorização para primeiro contato.',
      contactApprovedAt: null,
    });
  });

  it('preserves email as the only declared channel when it is the available contact', () => {
    expect(pendingManualLeadContact({ email: 'contato@wayflex.ind.br', telefone: '' }).canalPreferencial).toBe('E-mail');
  });

  it('makes WhatsApp the active channel only at the explicit Ana activation', () => {
    expect(approvedAnaWhatsAppChannel({ whatsapp: '', telefone: '11999990000' })).toEqual({
      whatsapp: '11999990000', canalPreferencial: 'WhatsApp',
    });
    expect(approvedAnaWhatsAppChannel({ whatsapp: '', telefone: '' })).toBeNull();
  });
});
