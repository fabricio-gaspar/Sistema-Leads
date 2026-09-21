import { describe, expect, it } from 'vitest';
import { normalizeWhatsAppForActivation } from '@/lib/crm/leadWorkflowRepository';

describe('leadWorkflowRepository', () => {
  it('normaliza o WhatsApp informado antes de pedir a ativação da Ana', () => {
    expect(normalizeWhatsAppForActivation('(11) 99744-1875')).toBe('11997441875');
  });

  it('não inventa código de país para uma identidade de contato', () => {
    expect(normalizeWhatsAppForActivation('+55 11 99744-1875')).toBe('5511997441875');
  });
});
