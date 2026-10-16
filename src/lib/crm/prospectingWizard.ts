export type ProspectingWizardStep = 1 | 2 | 3 | 4;

export interface ProspectingWizardDraft {
  sourceId: string;
  sourceKey?: string;
  city: string;
  offer: string;
  terms: readonly string[];
  volume?: number;
  radiusEnabled?: boolean;
  radiusKm?: number;
  center?: { latitude: number; longitude: number } | null;
}

export function prospectingAreaChanged(
  previous: { city: string; state: string },
  next: { city: string; state: string },
): boolean {
  const normalize = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  return normalize(previous.city) !== normalize(next.city) || normalize(previous.state) !== normalize(next.state);
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

  if (step === 2 && draft.radiusEnabled) {
    if (draft.sourceKey !== 'apify') return 'A busca por raio está disponível somente no Google Maps.';
    if (!Number.isInteger(draft.radiusKm) || Number(draft.radiusKm) < 1 || Number(draft.radiusKm) > 200) return 'Informe um raio entre 1 e 200 km.';
    if (!draft.center || !Number.isFinite(draft.center.latitude) || !Number.isFinite(draft.center.longitude)
      || Math.abs(draft.center.latitude) > 85 || Math.abs(draft.center.longitude) > 180) {
      return 'Marque o centro da área no mapa para continuar.';
    }
  }

  if (step === 3 && !draft.offer.trim()) {
    return 'Descreva o que sua empresa vende para definir o perfil ideal.';
  }

  if (step === 4 && draft.terms.filter((term) => term.trim()).length === 0) {
    return 'Adicione pelo menos um termo de busca antes de testar a amostra.';
  }

  if (step === 4 && draft.sourceKey === 'apify' && draft.volume !== undefined
    && draft.terms.filter((term) => term.trim()).length > draft.volume) {
    return 'A quantidade de leads deve ser igual ou maior que o número de termos no Google Maps.';
  }

  return null;
}

export function nextProspectingWizardStep(step: ProspectingWizardStep): ProspectingWizardStep {
  return Math.min(step + 1, 4) as ProspectingWizardStep;
}

export function prospectingWizardBlockReason(step: ProspectingWizardStep, draft: ProspectingWizardDraft, busy = false): string | null {
  if (busy) return 'Aguarde a consulta em andamento.';
  for (const required of PROSPECTING_WIZARD_STEPS) {
    if (required.id > step) break;
    const reason = validateProspectingWizardStep(required.id, draft);
    if (reason) return reason;
  }
  return null;
}
