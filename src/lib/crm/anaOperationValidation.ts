import type { AnaOperationSettings } from './anaOperationRepository';

export type AnaOperationField =
  | 'runTime'
  | 'timezone'
  | 'weekdays'
  | 'dailyLeadLimit'
  | 'dailyCap'
  | 'monthlyCap'
  | 'city'
  | 'regions'
  | 'keywords'
  | 'paidProspectingApproved'
  | 'initialAssigneeUserId'
  | 'teamMemberIds'
  | 'handoffAssigneeUserId';

export interface AnaOperationValidationIssue {
  field: AnaOperationField;
  message: string;
}

const validClock = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const BRAZIL_UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));

export const anaLocationErrors: Record<string, string> = {
  operation_city_required: 'Informe e salve a cidade nas configurações da rotina da Ana antes de executar.',
  operation_single_state_required: 'Selecione e salve uma única UF brasileira nas configurações da rotina da Ana.',
  operation_search_terms_required: 'Informe e salve ao menos um segmento ou palavra-chave válido na rotina da Ana.',
};

/**
 * Checks only the data that makes an enabled operation unsafe or impossible.
 * Provider and environment readiness remain a server-side authority.
 */
export function validateAnaOperationForActivation(settings: AnaOperationSettings): AnaOperationValidationIssue[] {
  const issues: AnaOperationValidationIssue[] = [];
  if (settings.city.trim().length < 2 || settings.city.trim().length > 120) {
    issues.push({ field: 'city', message: 'Informe a cidade da busca (2 a 120 caracteres).' });
  }
  if (settings.regions.length !== 1 || !BRAZIL_UFS.has(settings.regions[0])) {
    issues.push({ field: 'regions', message: 'Selecione uma única UF brasileira para esta rotina.' });
  }
  if (![...settings.keywords, ...settings.segments].some((term) => term.trim().length >= 2 && term.trim().length <= 120)) {
    issues.push({ field: 'keywords', message: 'Informe ao menos um segmento ou palavra-chave válido.' });
  }
  if (!validClock(settings.runTime)) issues.push({ field: 'runTime', message: 'Informe um horário válido para a rotina.' });
  if (!settings.timezone.trim()) issues.push({ field: 'timezone', message: 'Informe o fuso horário da rotina.' });
  if (!settings.weekdays.length) issues.push({ field: 'weekdays', message: 'Selecione ao menos um dia de execução.' });
  if (!Number.isInteger(settings.dailyLeadLimit) || settings.dailyLeadLimit < 1 || settings.dailyLeadLimit > 100) {
    issues.push({ field: 'dailyLeadLimit', message: 'Informe de 1 a 100 leads por busca.' });
  }
  if (!Number.isInteger(settings.dailyCap) || settings.dailyCap < settings.dailyLeadLimit) {
    issues.push({ field: 'dailyCap', message: 'O limite diário deve ser igual ou maior que os leads por busca.' });
  }
  if (!Number.isInteger(settings.monthlyCap) || settings.monthlyCap < settings.dailyCap) {
    issues.push({ field: 'monthlyCap', message: 'O limite mensal deve ser igual ou maior que o limite diário.' });
  }
  if (settings.mode === 'automatic' && !settings.paidProspectingApproved) {
    issues.push({ field: 'paidProspectingApproved', message: 'Confirme o uso do Apify dentro dos limites configurados.' });
  }
  if (settings.initialAssignmentMode === 'human' && !settings.initialAssigneeUserId) {
    issues.push({ field: 'initialAssigneeUserId', message: 'Selecione o vendedor que assumirá os leads.' });
  }
  if (settings.initialAssignmentMode === 'team' && !settings.teamMemberIds.length) {
    issues.push({ field: 'teamMemberIds', message: 'Selecione pelo menos um vendedor para o rodízio.' });
  }
  if (settings.initialAssignmentMode === 'ana' && settings.handoffStage && !settings.handoffAssigneeUserId) {
    issues.push({ field: 'handoffAssigneeUserId', message: 'Selecione quem receberá a transferência da Ana.' });
  }
  return issues;
}
