import { describe, expect, it } from 'vitest';
import {
  nextProspectingWizardStep,
  prospectingAreaChanged,
  prospectingWizardBlockReason,
  validateProspectingWizardStep,
  type ProspectingWizardDraft,
} from '@/lib/crm/prospectingWizard';

const completeDraft: ProspectingWizardDraft = {
  sourceId: 'apify',
  city: 'São Paulo',
  offer: 'Soluções em borracha e silicone',
  terms: ['manutenção industrial'],
};

describe('wizard da Busca de Leads', () => {
  it('blocks every sample CTA if an earlier required step becomes invalid', () => {
    expect(prospectingWizardBlockReason(4,{...completeDraft,city:''})).toBe('Informe a cidade onde deseja encontrar empresas.');
    expect(prospectingWizardBlockReason(4,{...completeDraft,sourceId:''})).toBe('Escolha uma fonte validada para continuar.');
    expect(prospectingWizardBlockReason(4,completeDraft,true)).toBe('Aguarde a consulta em andamento.');
    expect(prospectingWizardBlockReason(4,completeDraft)).toBeNull();
  });
  it('does not require future steps while navigating', () => {
    expect(prospectingWizardBlockReason(1,{sourceId:'apify',city:'',offer:'',terms:[]})).toBeNull();
  });
  it('exige somente a informação necessária em cada passo', () => {
    expect(validateProspectingWizardStep(1, { ...completeDraft, sourceId: '  ' }))
      .toBe('Escolha uma fonte validada para continuar.');
    expect(validateProspectingWizardStep(2, { ...completeDraft, city: '  ' }))
      .toBe('Informe a cidade onde deseja encontrar empresas.');
    expect(validateProspectingWizardStep(3, { ...completeDraft, offer: '' }))
      .toBe('Descreva o que sua empresa vende para definir o perfil ideal.');
    expect(validateProspectingWizardStep(4, { ...completeDraft, terms: ['  '] }))
      .toBe('Adicione pelo menos um termo de busca antes de testar a amostra.');
  });

  it('não bloqueia um passo atual por dados que pertencem aos próximos passos', () => {
    expect(validateProspectingWizardStep(1, { sourceId: 'apify', city: '', offer: '', terms: [] })).toBeNull();
    expect(validateProspectingWizardStep(2, { sourceId: '', city: 'São Paulo', offer: '', terms: [] })).toBeNull();
    expect(validateProspectingWizardStep(3, { sourceId: '', city: '', offer: 'Soluções industriais', terms: [] })).toBeNull();
  });

  it('libera o avanço quando o passo atual está completo', () => {
    expect(validateProspectingWizardStep(1, completeDraft)).toBeNull();
    expect(validateProspectingWizardStep(2, completeDraft)).toBeNull();
    expect(validateProspectingWizardStep(3, completeDraft)).toBeNull();
    expect(validateProspectingWizardStep(4, completeDraft)).toBeNull();
  });

  it('exige centro confirmado e raio válido quando a busca usa o mapa', () => {
    const draft = { ...completeDraft, sourceKey: 'apify', radiusEnabled: true, radiusKm: 25, center: null };
    expect(validateProspectingWizardStep(2, draft)).toMatch(/centro/i);
    expect(validateProspectingWizardStep(2, { ...draft, center: { latitude: -23.55, longitude: -46.63 } })).toBeNull();
    expect(validateProspectingWizardStep(2, { ...draft, radiusKm: 0, center: { latitude: -23.55, longitude: -46.63 } })).toMatch(/raio/i);
    expect(validateProspectingWizardStep(2, { ...draft, sourceKey: 'linkedin', center: { latitude: -23.55, longitude: -46.63 } })).toMatch(/Google Maps/i);
  });

  it('preserva o centro da busca após sugestão da IA somente se cidade e UF continuarem iguais', () => {
    expect(prospectingAreaChanged({ city: 'São Paulo', state: 'SP' }, { city: ' são paulo ', state: 'sp' })).toBe(false);
    expect(prospectingAreaChanged({ city: 'São Paulo', state: 'SP' }, { city: 'Campinas', state: 'SP' })).toBe(true);
    expect(prospectingAreaChanged({ city: 'São Paulo', state: 'SP' }, { city: 'São Paulo', state: 'RJ' })).toBe(true);
  });

  it('não inicia Google Maps com mais termos do que o limite de leads solicitado', () => {
    expect(validateProspectingWizardStep(4, { ...completeDraft, sourceKey: 'apify', terms: ['Indústria', 'Mineração'], volume: 1 }))
      .toMatch(/quantidade.*termos/i);
  });

  it('avança linearmente e não ultrapassa a revisão', () => {
    expect(nextProspectingWizardStep(1)).toBe(2);
    expect(nextProspectingWizardStep(3)).toBe(4);
    expect(nextProspectingWizardStep(4)).toBe(4);
  });
});
