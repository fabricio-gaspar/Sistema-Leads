import { describe, expect, it } from 'vitest';
import { companyProspectingContext, currentProspectingAiFilters, normalizeProspectingAiFilters } from '../functions/_shared/prospectingAiPlan.ts';

const fallback = {
  city: 'São Paulo', state: 'SP', offer: 'Soluções em borracha', targetProfile: 'potential_customers' as const,
  customerSegments: [], terms: ['vedação industrial'], volume: 10, requireSite: true, requireWhatsApp: false, requireEmail: false,
};

describe('plano seguro da IA de prospecção', () => {
  it('restringe a resposta da IA aos filtros publicados e preserva valores inválidos', () => {
    const plan = normalizeProspectingAiFilters({
      city: 'Campinas', state: 'sp', targetProfile: 'distributors', customerSegments: ['Automotivo', 'Interno'],
      terms: ['perfis de silicone', 'PERFIS DE SILICONE'], volume: 500, requireWhatsApp: true,
    }, fallback);

    expect(plan).toMatchObject({ city: 'Campinas', state: 'SP', targetProfile: 'distributors', customerSegments: ['Automotivo'], terms: ['perfis de silicone'], volume: 10, requireSite: true, requireWhatsApp: true });
  });

  it('deriva contexto comercial sem incluir configurações ou segredos', () => {
    const context = companyProspectingContext({
      name: 'WayFlex', segment: 'Componentes técnicos', description: 'Indústria B2B', city: 'São Paulo',
      ui_settings: { token: 'nunca-vaza', organizacao: { nome: 'Outro nome' } },
    });

    expect(context).toEqual({ name: 'WayFlex', segment: 'Componentes técnicos', description: 'Indústria B2B', city: 'São Paulo' });
    expect(JSON.stringify(context)).not.toContain('nunca-vaza');
  });

  it('normaliza os filtros enviados pela tela antes de consultar o provedor', () => {
    expect(currentProspectingAiFilters({ city: '  Campinas ', state: 'sp', volume: 20, terms: [' vedação industrial '] })).toMatchObject({ city: 'Campinas', state: 'SP', volume: 20, terms: ['vedação industrial'] });
  });
});
