import { describe, expect, it } from 'vitest';
import { calculateProspectingScore } from '../functions/_shared/prospectingScore.ts';

describe('prospecting score', () => {
  it('does not treat a provider identifier or company name as evidence of fit', () => {
    expect(calculateProspectingScore({
      id: 'provider-id',
      name: 'Empresa identificada',
      phone: '',
      whatsapp: '',
      email: '',
      website: '',
      segment: '',
      uf: '',
      porte: '',
    }, { atividades: [], estado: '', portes: [] })).toMatchObject({
      overall: 0,
      fit: 0,
      contactability: 0,
    });
  });

  it('explains score from matching activity, region, company size, and a real contact channel', () => {
    const result = calculateProspectingScore({
      id: 'provider-id',
      name: 'Empresa industrial',
      phone: '11999990000',
      whatsapp: '',
      email: '',
      website: '',
      segment: 'Manutenção industrial',
      uf: 'SP',
      porte: '51-200',
    }, { atividades: ['manutenção industrial'], estado: 'SP', portes: ['51-200'] });

    expect(result).toMatchObject({ overall: 76, fit: 100, contactability: 30 });
    expect(result.reason).toContain('atividade compatível');
    expect(result.reason).toContain('porte compatível');
  });

  it('does not promote a generic source activity to a specific requested activity', () => {
    const result = calculateProspectingScore({
      segment: 'Industrial',
      uf: 'SP',
    }, { atividades: ['manutenção industrial'], estado: 'SP' });

    expect(result.fit).toBe(45);
    expect(result.reason).not.toContain('atividade compatível');
  });
});
