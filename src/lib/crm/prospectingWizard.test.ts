import { describe, expect, it } from 'vitest';
import {
  nextProspectingWizardStep,
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

  it('avança linearmente e não ultrapassa a revisão', () => {
    expect(nextProspectingWizardStep(1)).toBe(2);
    expect(nextProspectingWizardStep(3)).toBe(4);
    expect(nextProspectingWizardStep(4)).toBe(4);
  });
});
