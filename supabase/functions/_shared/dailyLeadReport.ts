export const dailyLeadReportStages = ['Novo', 'Apresentado', 'Qualificando', 'Reunião', 'Orçamento', 'Ganho', 'Perdido'] as const;

export type DailyLeadReportStage = typeof dailyLeadReportStages[number];

const legacyStageMap: Record<string, DailyLeadReportStage> = {
  'prospeccao': 'Novo',
  'em contato': 'Apresentado',
  'aguardando resposta': 'Apresentado',
  'em qualificacao': 'Qualificando',
  'reuniao agendada': 'Reunião',
  'proposta em preparacao': 'Orçamento',
  'orcamento enviado': 'Orçamento',
  'negociacao': 'Orçamento',
  'fechado — ganho': 'Ganho',
  'fechado - ganho': 'Ganho',
  'fechado — perdido': 'Perdido',
  'fechado - perdido': 'Perdido',
};

function normalizeStageName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function dailyLeadReportStage(value: unknown): DailyLeadReportStage {
  const raw = typeof value === 'string' ? value.trim() : '';
  if ((dailyLeadReportStages as readonly string[]).includes(raw)) return raw as DailyLeadReportStage;
  return legacyStageMap[normalizeStageName(raw)] || 'Novo';
}

export function normalizeDailyReportPhone(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\+?[\d ()-]+$/.test(value.trim())) return null;
  let digits = value.replace(/\D/g, '');
  if (!value.trim().startsWith('+') && [10, 11].includes(digits.length)) digits = `55${digits}`;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function maskDailyReportPhone(value: unknown): string | null {
  const phone = normalizeDailyReportPhone(value);
  return phone ? `••••${phone.slice(-4)}` : null;
}

export function validDailyReportTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? `${match[1]}:${match[2]}` : null;
}

export interface DailyLeadReportSummary {
  dateLabel: string;
  totalLeads: number;
  newLeads: number;
  interactionsToday: number;
  noInteraction: number;
  stages: Record<DailyLeadReportStage, number>;
}

export function formatDailyLeadReport(summary: DailyLeadReportSummary): string {
  const stageLine = dailyLeadReportStages
    .map((stage) => `${stage} ${summary.stages[stage] || 0}`)
    .join(' · ');
  return [
    `Wayflex — resumo diário (${summary.dateLabel})`,
    `Carteira: ${summary.totalLeads} lead(s) · ${summary.newLeads} novo(s) hoje`,
    `Atividade: ${summary.interactionsToday} com interação hoje · ${summary.noInteraction} sem interação registrada`,
    `Funil: ${stageLine}`,
  ].join('\n');
}
