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
    expect(result.diagnostics).toEqual({ normalizedCount: 3, matchedCount: 2, rejectedByContact: 1, rejectedByEmail: 0, rejectedByWebsite: 0, rejectedByDuplicate: 0, rejectedByMinimumScore: 0, rejectedByActivityEvidence: 0 });
  });

  it('informa quando critérios cumulativos eliminam todos os candidatos', () => {
    const result = filterProspectingCandidates(candidates, { exigeWhatsApp: true, exigeEmail: true, exigeSite: true }, 10);
    expect(result.leads).toEqual([]);
    expect(result.diagnostics).toEqual({ normalizedCount: 3, matchedCount: 0, rejectedByContact: 1, rejectedByEmail: 2, rejectedByWebsite: 2, rejectedByDuplicate: 0, rejectedByMinimumScore: 0, rejectedByActivityEvidence: 0 });
  });

  it('keeps the highest-evidence copy of a duplicate before applying the limit', () => {
    const result = filterProspectingCandidates([
      { id: 'low', source_record_id: 'place-low', razao_social: 'Baixa', municipio: 'São Paulo', uf: 'SP', score: 45 },
      { id: 'duplicate-first', source_record_id: 'place-duplicate', razao_social: 'Duplicada', municipio: 'São Paulo', uf: 'SP', score: 92 },
      { id: 'duplicate-replay', source_record_id: 'place-duplicate', razao_social: 'Duplicada', municipio: 'São Paulo', uf: 'SP', score: 99 },
      { id: 'qualified', source_record_id: 'place-qualified', razao_social: 'Qualificada', municipio: 'São Paulo', uf: 'SP', score: 78 },
    ], { minimumScore: 70 }, 1);

    expect(result.leads.map((lead) => lead.id)).toEqual(['duplicate-replay']);
    expect(result.diagnostics).toEqual({
      normalizedCount: 3,
      matchedCount: 2,
      rejectedByContact: 0,
      rejectedByEmail: 0,
      rejectedByWebsite: 0,
      rejectedByDuplicate: 1,
      rejectedByMinimumScore: 1,
      rejectedByActivityEvidence: 0,
    });
  });

  it('does not treat contactability alone as offer adherence at 50+', () => {
    const result = filterProspectingCandidates([
      {
        id: 'unrelated-but-reachable',
        score: 54,
        cnae_descricao: 'Serviços contábeis',
        telefone: '11999990000',
        email: 'financeiro@example.invalid',
        website: 'https://contabilidade.example.invalid',
        municipio: 'São Paulo',
        uf: 'SP',
      },
      {
        id: 'activity-match',
        score: 72,
        cnae_descricao: 'Manutenção industrial e automação',
        telefone: '11988880000',
        municipio: 'São Paulo',
        uf: 'SP',
      },
    ], { minimumScore: 50, atividades: ['manutenção industrial'] }, 10);

    expect(result.leads.map((lead) => lead.id)).toEqual(['activity-match']);
    expect(result.diagnostics.rejectedByActivityEvidence).toBe(1);
  });
});
