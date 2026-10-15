import { describe, expect, it } from 'vitest';
import { filterProspectingCandidates } from '../functions/_shared/prospectingResultFilter.ts';

describe('filtros finais da busca de leads', () => {
  const candidates = [
    { id: 'phone-only', telefone: '11999990000', whatsapp: null, email: null, website: 'https://example.invalid' },
    { id: 'whatsapp', telefone: null, whatsapp: '11988880000', email: 'a@example.invalid', website: null },
    { id: 'no-contact', telefone: null, whatsapp: null, email: null, website: null },
  ];

  it('aceita telefone comum no critério Telefone ou WhatsApp sem inventar WhatsApp', () => {
    const result = filterProspectingCandidates(candidates, { exigeWhatsApp: true }, 10);
    expect(result.leads.map((lead) => lead.id)).toEqual(['phone-only', 'whatsapp']);
    expect(result.leads[0].whatsapp).toBeNull();
    expect(result.diagnostics).toEqual({ normalizedCount: 3, matchedCount: 2, rejectedByContact: 1, rejectedByEmail: 0, rejectedByWebsite: 0 });
  });

  it('informa quando critérios cumulativos eliminam todos os candidatos', () => {
    const result = filterProspectingCandidates(candidates, { exigeWhatsApp: true, exigeEmail: true, exigeSite: true }, 10);
    expect(result.leads).toEqual([]);
    expect(result.diagnostics).toEqual({ normalizedCount: 3, matchedCount: 0, rejectedByContact: 1, rejectedByEmail: 2, rejectedByWebsite: 2 });
  });
});
