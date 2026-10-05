export type ProspectingWizardStep = 1 | 2 | 3 | 4;

export interface ProspectingWizardDraft {
  sourceId: string;
  city: string;
  offer: string;
  terms: readonly string[];
}

export const PROSPECTING_WIZARD_STEPS: Array<{
  id: ProspectingWizardStep;
  label: string;
  description: string;
}> = [
  { id: 1, label: 'Fonte', description: 'Escolha uma fonte já validada.' },
  { id: 2, label: 'Região', description: 'Defina onde encontrar empresas.' },
  { id: 3, label: 'Perfil', description: 'Descreva o cliente ideal.' },
  { id: 4, label: 'Critérios', description: 'Revise os termos antes da amostra.' },
];

export function validateProspectingWizardStep(
  step: ProspectingWizardStep,
  draft: ProspectingWizardDraft,
): string | null {
  if (step === 1 && !draft.sourceId.trim()) {
    return 'Escolha uma fonte validada para continuar.';
  }

  if (step === 2 && !draft.city.trim()) {
    return 'Informe a cidade onde deseja encontrar empresas.';
  }

  if (step === 3 && !draft.offer.trim()) {
    return 'Descreva o que sua empresa vende para definir o perfil ideal.';
  }

  if (step === 4 && draft.terms.filter((term) => term.trim()).length === 0) {
    return 'Adicione pelo menos um termo de busca antes de testar a amostra.';
  }

  return null;
}

export function nextProspectingWizardStep(step: ProspectingWizardStep): ProspectingWizardStep {
  return Math.min(step + 1, 4) as ProspectingWizardStep;
}
