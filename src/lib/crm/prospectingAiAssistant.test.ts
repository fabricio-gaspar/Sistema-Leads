import { describe, expect, it } from 'vitest';
import {
  buildLocalProspectingAiPlan,
  normalizeProspectingAiPlan,
  type ProspectingAiDraft,
} from './prospectingAiAssistant';

const current: ProspectingAiDraft = {
  city: 'São Paulo',
  state: 'SP',
  offer: 'Soluções em borracha e silicone',
  targetProfile: 'potential_customers',
  customerSegments: [],
  terms: ['vedação industrial'],
  volume: 10,
  requireSite: true,
  requireWhatsApp: false,
  requireEmail: false,
};

describe('assistente IA de prospecção', () => {
  it('normaliza uma sugestão para os filtros suportados sem perder o contexto atual', () => {
    const plan = normalizeProspectingAiPlan({
      city: 'Campinas',
      state: 'sp',
      offer: 'Perfis técnicos de silicone',
      targetProfile: 'distributors',
      customerSegments: ['Automotivo', 'Não catalogado', 'Automotivo'],
      terms: ['perfis de silicone', 'PERFIS DE SILICONE', 'vedação industrial'],
      volume: 20,
      requireSite: false,
      requireWhatsApp: true,
      requireEmail: true,
      summary: 'Distribuidores técnicos na região escolhida.',
      rationale: 'Combina o perfil comercial com os segmentos selecionados.',
    }, current);

    expect(plan).toMatchObject({
      city: 'Campinas',
      state: 'SP',
      offer: 'Perfis técnicos de silicone',
      targetProfile: 'distributors',
      customerSegments: ['Automotivo'],
      terms: ['perfis de silicone', 'vedação industrial'],
      volume: 20,
      requireSite: false,
      requireWhatsApp: true,
      requireEmail: true,
    });
  });

  it('preserva filtros atuais quando a resposta da IA é incompleta ou fora do catálogo', () => {
    const plan = normalizeProspectingAiPlan({
      city: '',
      state: 'Brasil',
      targetProfile: 'admin',
      customerSegments: ['Segredo interno'],
      terms: [],
      volume: -5,
    }, current);

    expect(plan).toMatchObject({
      city: 'São Paulo',
      state: 'SP',
      targetProfile: 'potential_customers',
      customerSegments: [],
      terms: ['vedação industrial'],
      volume: 10,
    });
  });

  it('oferece fallback local baseado no perfil comercial sem iniciar uma busca', () => {
    const plan = buildLocalProspectingAiPlan(current);

    expect(plan.terms).toEqual(expect.arrayContaining(['vedação industrial', 'artefatos de borracha', 'perfis de silicone']));
    expect(plan.summary).toContain('revisão');
  });
});
