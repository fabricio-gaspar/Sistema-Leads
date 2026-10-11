import { describe, expect, it } from 'vitest';
import { buildAnaActivationRequest, normalizeWhatsAppForActivation } from '@/lib/crm/leadWorkflowRepository';

describe('leadWorkflowRepository', () => {
  it('normaliza o WhatsApp informado antes de pedir a ativação da Ana', () => {
    expect(normalizeWhatsAppForActivation('(11) 99744-1875')).toBe('11997441875');
  });

  it('não inventa código de país para uma identidade de contato', () => {
    expect(normalizeWhatsAppForActivation('+55 11 99744-1875')).toBe('5511997441875');
  });

  it('monta a ativação explícita pelo contrato canônico da Ana', () => {
    expect(buildAnaActivationRequest({
      leadId: '7d432765-84e8-4e37-a67c-0a63b2212c52',
      whatsapp: '(11) 93063-3341',
      approvalReason: 'Autorização confirmada pelo responsável no CRM.',
      requestId: 'c3d8ef21-6be7-4aa7-a589-40c9846dd09f',
    })).toEqual({
      action: 'start_ai',
      lead_id: '7d432765-84e8-4e37-a67c-0a63b2212c52',
      whatsapp: '11930633341',
      approve_whatsapp_contact: true,
      approval_reason: 'Autorização confirmada pelo responsável no CRM.',
      request_id: 'c3d8ef21-6be7-4aa7-a589-40c9846dd09f',
      clear_handoff_policy: false,
    });
  });

  it('recusa uma ativação sem autorização registrada', () => {
    expect(() => buildAnaActivationRequest({
      leadId: '7d432765-84e8-4e37-a67c-0a63b2212c52',
      whatsapp: '11930633341',
      approvalReason: '   ',
    })).toThrow('contact_approval_reason_required');
  });
});
